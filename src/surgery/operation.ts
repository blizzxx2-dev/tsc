import { SpatialGrid, SPATIAL_THRESHOLD } from './spatial';
import { bloodOf } from './species';
import { seedFx } from './fxRandom';
import { clamp, dist, pointSegment, Rng, side, type Vec } from '../core/math';
import { EventBus } from '../core/events';
import { Entity, type Origin } from './entity';
import type { FxKind } from '../render/particles';
import { toolInfo, type Pointer, type Rank, type Rating, type ToolId } from './types';
import { DEFAULT_TUNING, mergeTuning, type Tuning, type TuningOverride } from './tuning';
import { applySpecies, type Species } from './species';
import { AUTO_LENS_AFTER, combineMods, DIFFICULTIES, NO_ASSISTS, NO_MODS, SLOW_TELLS, assistFlags, type Assists, type Difficulty, type Modifiers } from './difficulty';
import type { LitanyVariant } from './litany';
import { CueSink, type JournalEvent, type SimEvents } from './events';
import { rankThresholds } from './ranks';
import { upgradeTuning, type TinctureColor } from './progress';
import { OP_TUNING } from './optuning';
import { FIRST_HINTS, TUTORIALS, type TutorialStep } from './tutorial';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export type OrganKind = 'flesh' | 'heart' | 'lung' | 'gut' | 'liver' | 'brain' | 'bone' | 'muscle' | 'skin';

/** Vitals lost to one mistake at or above which the sim announces an `impact` (hitstop, ENG-0058). */
export const IMPACT_HARM = 5;
/** Per-organ multiplier on the harm done by mistakes (stray cuts, slips, tears). */
export const ORGAN_SENSITIVITY: Record<OrganKind, number> = { flesh: 1, heart: 2, lung: 1.5, gut: 1.2, liver: 1.4, brain: 2, bone: 0.8, muscle: 1.1, skin: 0.9 };

/** An organ region on a multi-organ field (elliptical, virtual screen space). */
export interface OrganRegion {
  kind: OrganKind;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** A line of a mid-operation dialogue insert (CON-0128): who speaks (a cast id, or a shown name) and what. */
export interface DialogueLine {
  text: string;
  /** Cast id (src/content/characters.ts) — its name and colour label the line. */
  who?: string;
  /** Shown name when the speaker is not in the cast (a patient, a cyst). */
  name?: string;
}

/** Seconds an unread dialogue line stays before moving on by itself (CON-0128). */
export const readingTime = (l: DialogueLine): number => Math.min(6, Math.max(2.5, 1.2 + l.text.length * 0.045));

export interface PhaseDef {
  /**
   * A dialogue insert before the phase (CON-0128): the operation pauses for these lines — the clock
   * and the drain stand still — and the phase's callout and spawns follow once they are read.
   */
  interject?: readonly DialogueLine[] | ((op: Operation) => readonly DialogueLine[]);
  /** Lines the assistant says when the phase begins. */
  callout?: string[];
  /** Short objective shown with the phase banner and kept under the timer (UIX-0061), e.g. "Close the wounds". */
  objective?: string;
  spawn(op: Operation): Entity[];
}

/** Scripted events: callouts or spawns keyed to a phase time or to something being cleared. */
export interface ScriptedEvent {
  at?: { phase: number; t: number };
  /** Fires once no entity of this class is left alive (after one has been seen). */
  when?: { cleared: abstract new (...a: never[]) => Entity };
  say?: string[];
  spawn?: (op: Operation) => Entity[];
}

export interface OperationDef {
  id: string;
  title: string;
  patient: string;
  /** Grammatical gender of the patient for translated lines (ICU `select`, LOC-0014). */
  patientGender?: 'm' | 'f' | 'unknown';
  diagnosis: string;
  organ: OrganKind;
  /** The patient's people: skin, flesh and depth on the table, and how their body responds (src/surgery/species.ts). */
  race?: Species;
  timeLimit: number;
  vitals?: number;
  /** Passive vitals loss per second, independent of wounds. */
  baseDrain?: number;
  tools: readonly ToolId[];
  phases: readonly PhaseDef[];
  ranks: { S: number; A: number; B: number };
  seed?: number;
  litany?: boolean;
  /** How many times the Litany may be invoked (default 1). */
  litanyUses?: number;
  /** Per-operation tuning overrides, merged over the defaults. */
  tuning?: TuningOverride;
  /** The operation has no initial incision to close. */
  noClose?: boolean;
  /** Secondary vitals shown only when declared. */
  secondary?: { bloodVolume?: boolean; temperature?: boolean };
  /** Frail patients have 0.8× max vitals; hardy ones shrug off 1/1.2 of the drain. */
  constitution?: 'frail' | 'hardy';
  /**
   * Two-patient triage (GAM-0248): a second patient on the second region's cot, with vitals of
   * their own. Wounds in that region drain them, not the first; the op is lost if either dies.
   */
  second?: { patient: string; vitals?: number };
  /** Drape cloth around amputations and draped fields (ENG-0276): hospice linen by default. */
  drape?: 'linen' | 'silk' | 'sackcloth' | 'canvas';
  /** Where it happens (ENG-0272/0274): the hospice by default, a field-triage tent, or the forensic slab. */
  venue?: 'hospice' | 'field' | 'forensic';
  /** Colour grade (a `GRADES` name, ENG-0153); defaults by venue and chapter. */
  grade?: 'candle' | 'dawn' | 'theatre' | 'street' | 'chapel' | 'night';
  /** Muscle fibre direction in radians (ENG-0093; the `muscle` organ's striations run along it). */
  fiber?: number;
  /** Multi-organ fields: regions with their own sensitivity; with two or more, the camera frames one at a time (GAM-0247). */
  regions?: readonly OrganRegion[];
  events?: readonly ScriptedEvent[];
  /** Sext: the HUD shows a smoothed false vitals value unless the lens is on the heart. */
  fakeVitals?: boolean;
  /** Flagellants and penitents thrash on the table: the field sways until a tincture calms them. */
  thrashing?: boolean;
  /** Story flags decided by how the operation ended (evaluated on victory). */
  outcomes?: (op: Operation) => string[];
  /** Short strategy tips per failure cause, offered after repeated losses. */
  tips?: Partial<Record<string, string>>;
  /**
   * Field-hospital environment (CON-0121, CON-0138, CON-0139): `candle` light follows the cursor,
   * `rain` drips pools every 5 s, the `cart` sways the table, `mud` fouls every laceration until salved.
   * Seeded like the rest of the op; challenge mutators add to it.
   */
  env?: readonly MutatorId[];
  /** Someone watching from the edge of the field (CON-0048): a character id, drawn as a dim bust. */
  observer?: string;
  /**
   * Limited supplies (CON-0140): thread (stitches), salve (seconds laid) and tincture (doses) this op
   * carries. Running out is a soft fail: the work goes on, each use past empty costs 40 end bonus.
   */
  supplies?: Partial<Record<SupplyKind, number>>;
  /**
   * Slow-pulse vitals (CON-0155): the heart beats once every this many seconds, and the vitals only
   * move on a beat — the drain between beats lands all at once. Ends when `op.endSlowPulse()` is called.
   */
  slowPulse?: number;
  /** Who calls the phases (a cast id; CON-0190) — Sister Ilse unless she is on the table. */
  assistant?: string;
  /** Stages inside a multi-stage Hour a retry may resume at (e.g. Compline's [2, 3]; CON-0200). */
  bossCheckpoints?: readonly number[];
  /** Tincture colours this operation supplies besides red. */
  tinctures?: readonly TinctureColor[];
}

export interface OperationOptions {
  difficulty?: Difficulty;
  assists?: Partial<Assists>;
  mods?: Partial<Modifiers>;
  litanyVariant?: LitanyVariant;
  /** Instrument upgrades owned (see progress.ts). */
  upgrades?: readonly string[];
  /** Start at this phase (boss checkpoint). */
  checkpoint?: number;
  /** The player's audio latency in ms (INP-0111), allowed for by the rhythm windows. */
  audioOffset?: number;
  /** The rules in force, as wax seals for the HUD corner (UIX-0187). */
  seals?: readonly string[];
  /** Trials rules (CON-0202): any MISS ends the run. */
  oneLife?: boolean;
  /** Trials rules: the assistant says nothing (Compline, Alone). */
  silentAssistant?: boolean;
  /** Trials rules: no sound cue plays at all (the Choir in full voice). */
  muted?: boolean;
  /** With `checkpoint`: the stage inside the Hour to resume at (one of `def.bossCheckpoints`). */
  bossStage?: number;
  /** Record every input for replay. */
  record?: boolean;
  seed?: number;
  /** Challenge op: no assists allowed, results flagged. */
  challenge?: string;
  /** Kit loadout: extra tincture colours brought along. */
  tinctures?: readonly TinctureColor[];
  /** First-time hints already seen on this save (not repeated). */
  hintsSeen?: readonly string[];
  /** Challenge mutators (Candle-Only, Moving Cart, Field Tent in Rain, Stroh Watches). */
  mutators?: readonly MutatorId[];
  /** Run the guided tutorial steps for this op (and the Litany practice before a first boss). */
  tutorial?: boolean;
  /** Practice Theatre: nothing is scored and the patient cannot die. */
  practice?: boolean;
  /** Time attack (GAM-0217): a cleared op against the clock, raced by the personal-best ghost. */
  timeAttack?: boolean;
  /** Which try at this op this is (1 = first; the save's run of failures + 1). */
  attempt?: number;
}

/** Seconds a pinned grip holds before it lets go (INP-0107). */
export const PIN_HOLD = 10;

export type SupplyKind = 'thread' | 'salve' | 'tincture';
export const SUPPLY = { penalty: 40 };

export type MutatorId = 'candle' | 'cart' | 'rain' | 'stroh' | 'mud';

/**
 * What an op's `env` spawns alongside each phase (CON-0139), keyed by modifier. Filled in by
 * src/surgery/ailments/environment.ts, which would otherwise be an import cycle.
 */
export const ENV_EFFECTS: Partial<Record<MutatorId, (op: Operation, spawned: readonly Entity[], first: boolean) => Entity[]>> = {};

/** Floating text shown by the HUD; built by the scene from `popup` events (see SimEvents). */
export interface Popup {
  text: string;
  pos: Vec;
  t: number;
  color: string;
  /** Set for action ratings so the HUD can style them. */
  rating?: Rating;
  label?: string;
  combo?: number;
}

export type Status = 'intro' | 'running' | 'won' | 'lost';
export type CalloutPriority = 'danger' | 'instruction' | 'praise';
const PRIORITY: Record<CalloutPriority, number> = { danger: 0, instruction: 1, praise: 2 };

export const RATING_POINTS: Record<Rating, number> = { cool: 100, good: 60, bad: 15, miss: 0 };
const RATING_TEXT: Record<Rating, string> = { cool: 'COOL', good: 'GOOD', bad: 'BAD', miss: 'MISS' };
const RATING_COLOR: Record<Rating, string> = { cool: '#f5d76e', good: '#9fd3a8', bad: '#d98a5f', miss: '#c0392b' };

export const MAX_VITALS = DEFAULT_TUNING.vitals.max;
export const LITANY_DURATION = DEFAULT_TUNING.litany.duration;
export const LITANY_SCALE = DEFAULT_TUNING.litany.scale;
export const TINCTURE_TIME = DEFAULT_TUNING.tincture.time;
export const TINCTURE_HEAL = DEFAULT_TUNING.tincture.heal;
export const TINCTURE_COOLDOWN = DEFAULT_TUNING.tincture.cooldown;
/** Fixed simulation step. */
export const STEP = 1 / 120;

/** The operating field: an elliptical body region in virtual screen space. */
export const FIELD = { cx: 660, cy: 410, rx: 430, ry: 250 };
/** The lead-lined dish hexstone must be dropped into (bottom right, off the body). */
export const LEAD_DISH = { x: 1195, y: 590, r: 62 };
/** The ordinary instrument tray for extracted debris (top right, off the body). */
export const TRAY_DISH = { x: 1195, y: 150, r: 62 };

export function onBody(p: Vec): boolean {
  const dx = (p.x - FIELD.cx) / FIELD.rx;
  const dy = (p.y - FIELD.cy) / FIELD.ry;
  return dx * dx + dy * dy <= 1;
}

export const inLeadDish = (p: Vec): boolean => dist(p, LEAD_DISH) <= LEAD_DISH.r;

/**
 * Does a pointer stroke segment p1→p2 cross the line a–b? Unlike a strict
 * segment intersection, a stroke point landing exactly on the line still counts
 * (once), so no crossing is lost at any sampling rate.
 */
export function strokeCrosses(p1: Vec, p2: Vec, a: Vec, b: Vec): boolean {
  const s1 = side(p1, a, b) >= 0;
  const s2 = side(p2, a, b) >= 0;
  if (s1 === s2) return false;
  const d3 = side(a, p1, p2);
  const d4 = side(b, p1, p2);
  return d3 * d4 <= 0;
}

export const TINCTURE_HEX: Record<TinctureColor, string> = { red: '#e05060', green: '#80d070', blue: '#70a0f0', amber: '#f0b040' };

/** Tools that are held down to work, for the hold-to-toggle assist. */
/** From this attempt on (the second retry), sigils hide their stroke numbers (CON-0051). */
export const STROKE_NUMBERS_UNTIL = 3;

const HELD_TOOLS: readonly ToolId[] = ['leech', 'brand', 'tincture', 'lens'];

/** One recorded call into the simulation, for exact replays. */
export type LogOp =
  | ['p', number, number, number, number, 0 | 1, 0 | 1, 0 | 1, number]
  | ['u', number]
  | ['t', ToolId]
  | ['c', number]
  | ['q']
  | ['l']
  | ['h']
  | ['w', number]
  | ['k']
  | ['r']
  | ['d']
  | ['f'];

export interface Telemetry {
  opId: string;
  won: boolean;
  score: number;
  rank: Rank;
  phaseTimes: number[];
  ratings: Record<Rating, number>;
  minVitals: number;
  toolsUsed: ToolId[];
  litanyAt: number[];
  maxCombo: number;
  addPoints: number;
  elapsed: number;
}

export interface Breakdown {
  counts: Record<Rating, number>;
  maxCombo: number;
  actionPoints: number;
  vitalsBonus: number;
  timeBonus: number;
  closureBonus: number;
  penalties: number;
  capped: number;
  score: number;
  rank: Rank;
  next: { rank: Rank; delta: number } | null;
  flags: string[];
}

/** Mutable cue queue that also publishes every cue on the event bus. */
export class Operation {
  readonly rng: Rng;
  readonly tuning: Tuning;
  readonly difficulty: Difficulty;
  readonly assists: Assists;
  readonly mods: Modifiers;
  readonly litanyVariant: LitanyVariant;
  readonly upgrades: ReadonlySet<string>;
  entities: Entity[] = [];
  vitals: number;
  /** The second patient's vitals in a triage op (GAM-0248), else null. */
  vitals2: number | null = null;
  minVitals2 = Infinity;
  /** Current ceiling on vitals (bites, collapsed lungs lower it). */
  vitalsCap: number;
  readonly maxVitals: number;
  timeLeft: number;
  readonly timeLimit: number;
  elapsed = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Rating, number> = { cool: 0, good: 0, bad: 0, miss: 0 };
  tool: ToolId;
  status: Status = 'intro';
  lostReason = '';
  /** Machine-readable cause of a loss (for hints): 'vitals' | 'time' | …. */
  lostCause = '';
  phase = -1;
  private phaseDelay: number;
  private inBreather = false;
  callouts: string[] = [];
  /** Reading-time factor for callouts (the locale's reading speed, LOC-0018); presentation only. */
  calloutPace = 1;
  private calloutPri: number[] = [];
  /** The priority of the callout showing (0 danger, 1 instruction, 2 praise), or null with none. */
  get calloutPriority(): number | null {
    return this.callouts.length ? (this.calloutPri[0] ?? 1) : null;
  }
  calloutT = 0;
  litanyTime = 0;
  /** Vigil / Mercy / Wrath rite time remaining. */
  riteTime = 0;
  litanyUsed = false;
  litanyUses = 0;
  litanyAllowed: number;
  private litanyExtended = 0;
  whisper = 0;
  injectT = 0;
  injectCooldown = 0;
  private doses: number[] = [];
  private paidDoses = 0;
  tremorT = 0;
  private captured: Entity | null = null;
  /** Entity whose code is running (for tagging spawns and ratings). */
  actor: Entity | null = null;
  /** Increments on every press, so entities can tell one stroke from the next. */
  pressId = 0;
  /** Typed simulation events (ENG-0243): audio, particles, popups and achievements subscribe. */
  readonly events = new EventBus<SimEvents>();
  /** Sound requests — `op.cues.push('cut')` publishes `cue` (and `cut`) events on the bus. */
  readonly cues = new CueSink(this.events);
  /** Gameplay journal, in order (bounded): telemetry, achievements, hints and replays read it. */
  journal: JournalEvent[] = [];
  /** Per-operation entity ids (ENG-0242): identical across runs of the same seed. */
  private nextEntityId = 1;
  /** One-shot tutorial/story flags any entity may set. */
  flags = new Set<string>();
  /** Story flags decided during play (thrallKept, …). */
  storyFlags = new Set<string>();
  /** Screen shake intensity, decays over time. */
  shake = 0;
  /** Lasting blood stains and scars left on the flesh. */
  stains: { x: number; y: number; r: number; a: number }[] = [];
  scars: Vec[][] = [];
  /** Final bonus breakdown, filled on victory. */
  bonus = { vitals: 0, time: 0, closure: 0 };
  /** Points from boss adds so far (capped). */
  addPoints = 0;
  private addCapped = 0;
  penalties = 0;
  /** A boss has appeared in this operation. */
  bossOp = false;
  bossPhase = -1;
  checkpointed = false;
  minVitals: number;
  private comboIdle = 0;
  private warnState: 0 | 1 | 2 = 0;
  /** Last pointer position (for lens-dependent drawing and hints). */
  cursor: Vec = { x: FIELD.cx, y: FIELD.cy };
  /** Salve in the brush, and seconds since it was last used. */
  salve: number;
  private salveIdle = 0;
  /** Brand heat (s of continuous use) and lock-out. */
  brandHeat = 0;
  /** True while the brand is pressed to the field (HUD hold ring). */
  get holdingBrand(): boolean {
    return this.brandHeld;
  }
  /** Skip the rest of the title card (UIX-0069). */
  skipIntro(): void {
    if (this.status === 'intro') this.phaseDelay = 0;
  }
  brandLock = 0;
  private brandHeld = false;
  /** How many things the brand touched this frame (a grub seared alongside a Malison doesn't split). */
  brandTargets = 0;
  private fleshBrandT = 0;
  /** Continuous brand contact with bare flesh (s), for the grace (INP-0035). */
  private fleshContactT = 0;
  private emptyHoldT = 0;
  private emptyMissed = false;
  private toggleLatch = false;
  private blockedPress = -1;
  /** Tincture colours in the kit and the one loaded. */
  tinctures: TinctureColor[];
  tinctureColor: TinctureColor = 'red';
  /** The tincture's button is down (the wheel then picks its colour). */
  tinctureHeld = false;
  /** Anti-fever (amber) and antivenom (green) effects, seconds remaining. */
  feverCalmT = 0;
  venomSlowT = 0;
  /** Torpor (Sext): the hand drags until a blue stimulant is given. */
  torporT = 0;
  /** Thrashing patient: the field sways until calmed. */
  thrashT = 0;
  /** Haze from a lanced gas pocket (the scene blurs the field). */
  hazeT = 0;
  /** Leech-pipe reversed (irrigation / transfusion). */
  leechReverse = false;
  /** End-bonus multiplier adjustments (antiparasitic finish, pinned misalignment). */
  endBonusMult = 1;
  endPenalty = 0;
  /** First-time hints shown this run (the save records them). */
  hintsShown: string[] = [];
  /** Guided tutorial: the step waiting for its first correct action. */
  tutorialStep = 0;
  private tutorialSaid = -1;
  /** Litany practice before the first boss: attempts left (null = not practising). */
  litanyPractice: { attempts: number } | null = null;
  private practiced = false;
  private labels = new Map<string, number>();
  private wheelT = -1;
  /** Radial tool wheel open (slows world time). */
  wheelOpen = false;
  /** Tools temporarily disabled (acid spray, corrosion), seconds remaining. */
  disabled = new Map<ToolId, number>();
  /** Secondary vitals. */
  bloodVolume = 100;
  temperature = 37;
  /** Deterministic heartbeat (drives ECG, beat-synced hazards). */
  beatPhase = 0;
  private beatT = 0;
  /** Seconds between beats while the pulse is slowed (0 = a normal heart), and the drain held for the next beat. */
  slowPulseEvery = 0;
  private slowPulseT = 0;
  private heldDrain = 0;
  /** Seconds since the last R-wave. */
  sinceBeat = 0;
  /** Displayed (possibly false) vitals for Sext. */
  shownVitals: number;
  paused = false;
  /** Dialogue insert pausing the simulation (mid-op talking patient). */
  dialogue: DialogueLine[] = [];
  private dialogueT = 0;
  /** A phase whose callout and spawns wait for its dialogue insert to be read. */
  private pendingPhase: PhaseDef | null = null;
  private graceT = 0;
  private ilseUsed = false;
  private feverDone = false;
  private autoClosed = false;
  private scripted: { ev: ScriptedEvent; fired: boolean; seen: boolean }[];
  private phaseT = 0;
  private tick: number;
  readonly log: LogOp[] | null;
  private telemetryData = { phaseTimes: [] as number[], tools: new Set<ToolId>(), litanyAt: [] as number[] };
  private hiddenT = new Map<Entity, number>();
  /** Vitals sampled every 0.25 s over the last second (for the HUD drain arrow). */
  private trend: number[] = [];
  /** Time-integrated vitals while running (for the average-vitals bonus). */
  private vitalsInt = 0;
  private runT = 0;
  private trendT = 0;
  /** The environment in force: the op's own `env` and any challenge mutators. */
  readonly env: ReadonlySet<MutatorId>;
  /** A MISS under the one-life rule (CON-0202): the run ends at the next check. */
  private oneLifeLost = false;
  /** Supplies left (CON-0140); absent kinds are unlimited. */
  readonly stock: Partial<Record<SupplyKind, number>>;
  /** Uses made past empty, per kind. */
  readonly overdrawn: Partial<Record<SupplyKind, number>> = {};
  private salveUse = 0;

  constructor(
    readonly def: OperationDef,
    readonly opts: OperationOptions = {},
  ) {
    this.rng = new Rng(opts.seed ?? def.seed ?? 1);
    this.slowPulseEvery = def.slowPulse ?? 0;
    this.difficulty = opts.difficulty ?? 'surgeon';
    this.assists = { ...NO_ASSISTS, ...(opts.challenge ? {} : opts.assists), ...(opts.practice ? { noFail: true } : {}) };
    this.mods = combineMods(NO_MODS, opts.mods ?? {});
    this.upgrades = new Set(opts.challenge ? [] : (opts.upgrades ?? []));
    this.tuning = applySpecies(mergeTuning(OP_TUNING[def.id], def.tuning, this.mods.tuning, upgradeTuning(this.upgrades)), def.race);
    this.env = new Set([...(opts.mutators ?? []), ...(def.env ?? [])]);
    this.stock = { ...(def.supplies ?? {}) };
    if (opts.muted) this.cues.muteFrames = Number.MAX_SAFE_INTEGER;
    if (def.supplies) {
      const push = this.cues.push.bind(this.cues);
      this.cues.push = (...cs) => {
        for (const c of cs) if (c === 'stitch') this.spend('thread');
        else if (c === 'inject') this.spend('tincture');
        return push(...cs);
      };
    }
    // Candle-Only: the lens sees less in the gloom.
    if (this.env.has('candle')) this.tuning.lens.radius *= 0.7;
    this.litanyVariant = opts.litanyVariant ?? 'stillness';
    this.maxVitals = Math.round(this.tuning.vitals.max * (def.constitution === 'frail' ? 0.8 : 1));
    this.vitalsCap = this.maxVitals;
    // Cosmetic draws replay with the run (ENG-0252).
    seedFx(opts.seed ?? def.seed ?? 1);
    this.vitals = Math.min(this.maxVitals, def.vitals ?? this.maxVitals);
    if (def.second && (def.regions?.length ?? 0) >= 2) this.vitals2 = this.minVitals2 = Math.min(this.maxVitals, def.second.vitals ?? this.maxVitals);
    this.shownVitals = this.vitals;
    this.minVitals = this.vitals;
    const diff = DIFFICULTIES[this.difficulty];
    this.timeLimit = Math.round(def.timeLimit * diff.time * this.mods.time);
    this.timeLeft = this.timeLimit;
    this.tool = def.tools[0];
    this.litanyAllowed = def.litany === false ? 0 : (def.litanyUses ?? 1);
    this.tinctures = [...new Set<TinctureColor>(['red', ...(def.tinctures ?? []), ...(opts.tinctures ?? [])])];
    this.phaseDelay = this.tuning.flow.intro;
    this.tick = Math.floor(this.tuning.flow.timerWarn) + 1;
    this.salve = this.tuning.salve.capacity;
    this.scripted = (def.events ?? []).map((ev) => ({ ev, fired: false, seen: false }));
    this.log = opts.record ? [] : null;
    this.events.on('cue', (c) => this.event({ kind: 'cue', cue: c }));
    if (opts.checkpoint !== undefined) this.checkpointed = true;
  }

  // ------------------------------------------------------------------ derived

  get timeScale(): number {
    let s = 1;
    if (this.litanyTime > 0) s = Math.min(s, this.tuning.litany.scale);
    if (this.wheelOpen) s = Math.min(s, this.tuning.tools.wheelScale);
    return s;
  }


  get phaseCount(): number {
    return this.def.phases.length;
  }

  /** Guides (dotted lines, numbered nodes, pull axes) are shown. */
  get guides(): boolean {
    return DIFFICULTIES[this.difficulty].guides || this.assists.guides;
  }

  /**
   * Stroke-order numbers on sigils (CON-0051): shown on the first try and the first retry, then the
   * surgeon is trusted to remember — unless Novice or the Guides assist keeps them.
   */
  get strokeNumbers(): boolean {
    if (!this.guides) return false;
    return this.difficulty === 'novice' || this.assists.guides || (this.opts.attempt ?? 1) < STROKE_NUMBERS_UNTIL;
  }

  /** Extra hit radius from the larger-targets assist. */
  get hitPad(): number {
    return this.assists.bigHitboxes ? this.tuning.tongs.assistPad : 0;
  }

  /** Multiplier on all vitals drain. */
  get drainMult(): number {
    return DIFFICULTIES[this.difficulty].drain * this.mods.drain * (this.def.constitution === 'hardy' ? 1 / 1.2 : 1);
  }

  get ranks(): { S: number; A: number; B: number } {
    return rankThresholds(this.def);
  }

  /** Is a tool usable right now? */
  toolUsable(t: ToolId): boolean {
    if ((this.disabled.get(t) ?? 0) > 0) return false;
    if (t === 'brand' && this.brandLock > 0) return false;
    return true;
  }

  /** The organ under a point (regions first, then the op's organ). */
  organAt(p: Vec): OrganKind {
    for (const r of this.def.regions ?? []) {
      const dx = (p.x - r.x) / r.rx;
      const dy = (p.y - r.y) / r.ry;
      if (dx * dx + dy * dy <= 1) return r.kind;
    }
    return this.def.organ;
  }

  // ------------------------------------------------------------------ events

  event(e: JournalEvent): void {
    this.journal.push(e);
    if (this.journal.length > 4000) this.journal.splice(0, this.journal.length - 3000);
  }

  // ------------------------------------------------------------------ scoring

  /** Rate an action. `pay = false` counts the rating (and combo) but awards no points. */
  rate(r: Rating, pos: Vec, label?: string, pay = true): void {
    const T = this.tuning.scoring;
    if (r === 'miss' && this.opts.oneLife && this.status === 'running') this.oneLifeLost = true;
    const origin: Origin = this.actor?.spawnedBy ?? 'content';
    this.counts[r]++;
    const positive = r === 'cool' || r === 'good';
    if (positive) {
      if (origin === 'content' || origin === 'self' || this.combo < T.addComboCap) this.combo++;
      if (origin !== 'penalty' && T.comboMilestones.includes(this.combo)) {
        this.event({ kind: 'comboMilestone', combo: this.combo });
        this.cues.push('bell');
        this.say('Steady hands!', 'praise');
      }
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (r === 'cool' && this.litanyTime > 0 && this.litanyExtended < this.tuning.litany.coolExtendMax) {
        const ext = Math.min(this.tuning.litany.coolExtend, this.tuning.litany.coolExtendMax - this.litanyExtended);
        this.litanyExtended += ext;
        this.litanyTime += ext;
      }
    } else {
      this.combo = 0;
    }
    this.comboIdle = 0;
    if (label) this.labels.set(label, (this.labels.get(label) ?? 0) + 1);
    let pts = Math.round(T[r] * (1 + Math.min(this.combo, T.comboCap) * T.comboStep));
    let capped = false;
    if (origin === 'penalty' || !pay || this.opts.practice) pts = 0;
    else if (origin === 'boss') {
      pts = Math.round(pts * T.addPointsFactor);
      const cap = Math.round(this.ranks.S * T.addScoreCapFrac);
      if (this.addPoints + pts > cap) {
        this.addCapped += pts - Math.max(0, cap - this.addPoints);
        pts = Math.max(0, cap - this.addPoints);
        capped = pts === 0;
      }
      this.addPoints += pts;
    }
    this.score += pts;
    const text = capped ? '—' : label ? `${label} ${RATING_TEXT[r]}` : RATING_TEXT[r];
    this.events.emit('rate', { rating: r, pos: { x: pos.x, y: pos.y }, label, combo: this.combo, points: pts });
    this.events.emit('popup', { text, pos: { x: pos.x, y: pos.y }, color: RATING_COLOR[r], rating: capped ? undefined : r, label, combo: this.combo });
    if (r === 'cool') this.emit('gold', pos, 14);
    if (r === 'bad') this.shake = Math.max(this.shake, 2);
    this.cues.push(r);
    this.event({ kind: 'rated', rating: r, label, points: pts, pos: { ...pos }, combo: this.combo, add: origin });
  }

  emit(kind: FxKind, pos: Vec, n = 10, dir?: number, spread?: number, speed?: number): void {
    this.events.emit('fx', { kind, pos: { x: pos.x, y: pos.y }, n, dir, spread, speed });
  }

  stain(pos: Vec, r: number, a = 0.5): void {
    this.stains.push({ x: pos.x, y: pos.y, r, a });
    if (this.stains.length > 160) this.stains.shift();
  }

  popup(text: string, pos: Vec, color = '#e8dcc0'): void {
    this.events.emit('popup', { text, pos: { x: pos.x, y: pos.y }, color });
  }

  /** Queue assistant lines. Danger lines jump ahead of instructions, which jump ahead of praise. */
  say(...args: (string | CalloutPriority)[]): void {
    if (this.opts.silentAssistant) return;
    let pri: CalloutPriority = 'instruction';
    const last = args[args.length - 1];
    if (last === 'danger' || last === 'instruction' || last === 'praise') {
      pri = last;
      args = args.slice(0, -1);
    }
    this.events.emit('say', { lines: args as string[] });
    for (let line of args) {
      // Master: Ilse keeps it terse — the first sentence only.
      if (this.difficulty === 'master') line = terse(line);
      if (this.callouts.length === 0) this.calloutT = 0;
      // Never displace the line currently showing; insert after lines of equal or higher priority.
      let i = this.callouts.length;
      while (i > 1 && this.calloutPri[i - 1] > PRIORITY[pri]) i--;
      this.callouts.splice(i, 0, line);
      this.calloutPri.splice(i, 0, PRIORITY[pri]);
      // Praise is disposable: keep the queue short.
      if (this.callouts.length > 6 && this.calloutPri[this.callouts.length - 1] === PRIORITY.praise) {
        this.callouts.pop();
        this.calloutPri.pop();
      }
    }
  }

  /** Say something only once per operation. */
  sayOnce(flag: string, line: string, pri: CalloutPriority = 'instruction'): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    this.say(line, pri);
    this.event({ kind: 'hint', key: flag, text: line });
  }

  /** Most recent damage, for directional feedback. */
  lastHurt = { x: FIELD.cx, y: FIELD.cy, amount: 0, at: -10 };

  /** Which patient a point belongs to in a triage op (GAM-0248): the nearer of the two cots. */
  patientAt(p: Vec): 1 | 2 {
    const r = this.def.regions;
    if (this.vitals2 === null || !r || r.length < 2) return 1;
    return dist(p, r[1]) < dist(p, r[0]) ? 2 : 1;
  }

  /** Lose vitals. Every loss (drain, lashes, bursts) is scaled by the difficulty multiplier. */
  hurt(amount: number, pos?: Vec): void {
    if (this.status !== 'running') return;
    if (pos && this.vitals2 !== null && this.patientAt(pos) === 2) return this.hurt2(amount, pos);
    amount *= this.drainMult;
    if (amount >= 1) this.lastHurt = { x: pos?.x ?? FIELD.cx, y: pos?.y ?? FIELD.cy, amount, at: this.elapsed };
    this.vitals = Math.max(this.assists.noFail ? 1 : 0, this.vitals - amount);
    this.minVitals = Math.min(this.minVitals, this.vitals);
    this.shake = Math.min(12, this.shake + amount * 1.5);
    if (amount > 0) this.events.emit('hurt', { amount, pos, vitals: this.vitals });
    if (pos && amount >= 1) this.popup(`-${Math.round(amount)}`, pos, '#c0392b');
  }

  /** The second patient's losses (GAM-0248), scaled like the first's. */
  hurt2(amount: number, pos?: Vec): void {
    if (this.status !== 'running' || this.vitals2 === null) return;
    amount *= this.drainMult;
    this.vitals2 = Math.max(this.assists.noFail ? 1 : 0, this.vitals2 - amount);
    this.minVitals2 = Math.min(this.minVitals2, this.vitals2);
    if (amount > 0) this.events.emit('hurt', { amount, pos, vitals: this.vitals2 });
    if (pos && amount >= 1) this.popup(`-${Math.round(amount)}`, pos, '#c0392b');
  }

  /** Harm caused by a surgeon's mistake: scaled by the organ's sensitivity. */
  harm(amount: number, pos: Vec): void {
    this.penalties += amount;
    const scaled = amount * ORGAN_SENSITIVITY[this.organAt(pos)];
    this.hurt(scaled, pos);
    // Heavy blows (barb tears, deep stray cuts, bursts) announce an impact for the presentation's
    // hitstop (ENG-0058); the sim itself never pauses, so outcomes stay identical.
    if (this.status === 'running' && scaled * this.drainMult >= IMPACT_HARM) this.events.emit('impact', { kind: 'harm', amount: scaled * this.drainMult, pos: { x: pos.x, y: pos.y } });
  }

  heal(amount: number): void {
    this.vitals = Math.min(this.vitalsCap, this.vitals + amount);
    this.events.emit('heal', { amount, vitals: this.vitals });
  }

  spawn(...es: Entity[]): void {
    const a = this.actor;
    for (const e of es) {
      if (!e.id) e.id = this.nextEntityId++;
      if (a && e.spawnedBy === 'content') e.spawnedBy = a.boss || a.spawnedBy === 'boss' ? 'boss' : a.spawnedBy === 'penalty' ? 'penalty' : 'self';
      if (e.boss) this.onBossSpawn(e);
      this.firstHint(e);
      this.event({ kind: 'spawned', entity: e.constructor.name, id: e.id, origin: e.spawnedBy });
      this.entities.push(e);
      this.events.emit('spawn', { entity: e });
    }
  }

  /** Spawn entities created by the surgeon's own mistake: they never award points. */
  spawnPenalty(...es: Entity[]): void {
    for (const e of es) e.spawnedBy = 'penalty';
    this.spawn(...es);
  }

  /** One-shot contextual hint the first time a mechanic appears (on this save). */
  private firstHint(e: Entity): void {
    if (e.hidden) return;
    const h = FIRST_HINTS.find((x) => x.match(e));
    if (!h || this.opts.hintsSeen?.includes(h.id) || this.hintsShown.includes(h.id)) return;
    this.hintsShown.push(h.id);
    this.sayOnce(`first-${h.id}`, h.text);
  }

  private onBossSpawn(e: Entity): void {
    if (this.opts.tutorial && !this.practiced && this.litanyAllowed > 0 && this.litanyUses === 0) {
      this.practiced = true;
      this.litanyPractice = { attempts: 3 };
      this.say('Now, Doctor — the Litany. Draw the five-pointed star with the right hand.', 'instruction');
    }
    if (!this.bossOp) this.bossPhase = this.phase;
    this.bossOp = true;
    const b = e as unknown as { hp?: number; maxHp?: number };
    if (this.mods.hp !== 1 && typeof b.hp === 'number' && typeof b.maxHp === 'number' && e.spawnedBy === 'content') {
      b.hp *= this.mods.hp;
      b.maxHp *= this.mods.hp;
    }
  }

  /** Run entity code with it as the actor, so its spawns and ratings are attributed. */
  private as<T>(e: Entity, f: () => T): T {
    const prev = this.actor;
    this.actor = e;
    try {
      return f();
    } finally {
      this.actor = prev;
    }
  }

  // ------------------------------------------------------------------ powers

  /** A boss holds the Litany (Compline's Nunc Dimittis): it cannot be spoken until released. */
  litanyLocked = false;

  canInvokeLitany(): boolean {
    return !this.litanyLocked && this.litanyUses < this.litanyAllowed && this.status === 'running' && !this.paused;
  }

  /** Grant another use (Compline: breaking the silence nodes). */
  grantLitany(): void {
    this.litanyAllowed++;
  }

  invokeLitany(): boolean {
    this.log?.push(['l']);
    if (!this.canInvokeLitany()) return false;
    if (this.env.has('stroh')) {
      this.lose('Inquisitor Stroh saw the sign. The operation is over.', 'stroh');
      return false;
    }
    this.litanyUsed = true;
    this.litanyUses++;
    this.whisper++;
    this.telemetryData.litanyAt.push(this.elapsed);
    const L = this.tuning.litany;
    if (this.litanyVariant === 'stillness') {
      this.litanyTime = L.duration;
      this.litanyExtended = 0;
    } else this.riteTime = L.variantDuration;
    if (this.litanyVariant === 'vigil') for (const e of this.entities) if (e.alive && e.hidden) this.as(e, () => e.reveal(this));
    this.cues.push('litany');
    this.events.emit('litany', { duration: this.litanyTime });
    this.event({ kind: 'litany', variant: this.litanyVariant, use: this.litanyUses });
    this.event({ kind: 'whisper', total: this.whisper });
    const names = { stillness: 'THE LITANY OF STILLNESS', vigil: 'THE LITANY OF VIGIL', mercy: 'THE LITANY OF MERCY', wrath: 'THE LITANY OF WRATH' } as const;
    this.popup(names[this.litanyVariant], { x: FIELD.cx, y: FIELD.cy - 120 }, '#f5d76e');
    // A rite invoked while a boss is on the table is "at the peak" (XS stays possible).
    if (this.entities.some((e) => e.alive && e.boss)) this.flags.add('litany-peak');
    return true;
  }

  /** The patient's average vitals so far — the vitals bonus pays for this, so a last-second tincture buys nothing. */
  get averageVitals(): number {
    return this.runT > 0 ? this.vitalsInt / this.runT : this.vitals;
  }

  /** How many times an action with this label has been rated this run. */
  labelCount(label: string): number {
    return this.labels.get(label) ?? 0;
  }

  /** The guided-tutorial step in force (null when none, or all done). */
  get tutorial(): TutorialStep | null {
    if (!this.opts.tutorial) return null;
    const steps = TUTORIALS[this.def.id];
    const s = steps?.[this.tutorialStep];
    return s && this.phase >= s.phase ? s : null;
  }

  private advanceTutorial(): void {
    const steps = TUTORIALS[this.def.id];
    if (!this.opts.tutorial || !steps) return;
    for (;;) {
      // A step whose phase has already ended was done some other way: move on.
      while (steps[this.tutorialStep] && steps[this.tutorialStep].phase < this.phase) this.tutorialStep++;
      const s = this.tutorial;
      if (!s) return;
      if (this.tutorialSaid !== this.tutorialStep) {
        this.tutorialSaid = this.tutorialStep;
        this.say(s.say, 'instruction');
      }
      if (!s.done(this)) return;
      this.tutorialStep++;
    }
  }

  /** Litany practice: a drawn star (recognised or not). Success invokes the Litany for real. */
  practiceStar(ok: boolean): void {
    if (!this.litanyPractice) return;
    if (ok) {
      this.litanyPractice = null;
      this.invokeLitany();
      return;
    }
    this.litanyPractice.attempts--;
    this.popup('The words falter. Again.', { x: FIELD.cx, y: FIELD.cy - 120 }, '#e8dcc0');
    if (this.litanyPractice.attempts <= 0) this.skipPractice();
  }

  /** Skip the practice: the rite is spoken for you. */
  skipPractice(): void {
    if (!this.litanyPractice) return;
    this.litanyPractice = null;
    this.invokeLitany();
  }

  /** Candle-Only: the vignette closes to 45 % of the view. */
  get vignette(): number {
    return this.env.has('candle') ? 0.45 : 1;
  }

  /**
   * Moving Cart: the whole field sways 12 px at 0.3 Hz. The scene draws the field
   * offset by this and maps the pointer back, so aim tolerance is unchanged.
   */
  sway(): Vec {
    if (!this.env.has('cart')) return { x: 0, y: 0 };
    const w = Math.PI * 2 * 0.3 * this.elapsed;
    return { x: Math.sin(w) * 12, y: Math.sin(w * 0.5) * 4 };
  }

  /** Vitals lost over the last second (positive = falling). */
  get drainRate(): number {
    return this.trend.length < 2 ? 0 : (this.trend[0] - this.trend[this.trend.length - 1]) / ((this.trend.length - 1) * 0.25);
  }

  /** HUD drain arrow: 0 none, 1 slow (↓), 2 fast (↓↓). */
  drainArrow(): 0 | 1 | 2 {
    const r = this.drainRate;
    return r >= 1.5 ? 2 : r >= 0.3 ? 1 : 0;
  }

  /** What the vitals readout shows: Sext feeds it a false calm unless the lens is held over the heart. */
  displayVitals(): number {
    if (!this.def.fakeVitals) return this.vitals;
    const heart = { x: FIELD.cx, y: FIELD.cy - FIELD.ry * 0.55 };
    return this.tool === 'lens' && dist(this.cursor, heart) < 60 ? this.vitals : this.shownVitals;
  }

  /** Mercy: drain frozen; Wrath: brand doubled. */
  get mercy(): boolean {
    return this.litanyVariant === 'mercy' && this.riteTime > 0;
  }
  get wrath(): boolean {
    return this.litanyVariant === 'wrath' && this.riteTime > 0;
  }

  /** Once per op: Sister Ilse draws off the largest pool herself, at a cost of 200 points. */
  ilseAssist(): boolean {
    this.log?.push(['h']);
    if (this.ilseUsed || this.status !== 'running') return false;
    const pools = this.entities.filter((e) => e.alive && !e.hidden && 'ichor' in e && 'r' in e) as (Entity & { r: number })[];
    if (!pools.length) {
      this.popup('Nothing to hold, Doctor.', this.cursor, '#e8dcc0');
      return false;
    }
    const p = pools.sort((a, b) => b.r - a.r)[0];
    this.ilseUsed = true;
    p.kill();
    this.score = Math.max(0, this.score - 200);
    this.penalties += 200;
    this.say('I have it, Doctor — keep working.', 'instruction');
    this.popup('Ilse assists  -200', p.pos, '#e8dcc0');
    return true;
  }

  /** The previously held instrument, for quick-swap. */
  lastTool: ToolId | null = null;

  /** The entity the current stroke seized (a grabbed object, an incision being traced), if any. */
  get held(): Entity | null {
    return this.captured;
  }

  setTool(t: ToolId): void {
    this.log?.push(['t', t]);
    if (!this.def.tools.includes(t) || this.tool === t) return;
    this.lastTool = this.tool;
    this.tool = t;
    this.cues.push('select');
    this.event({ kind: 'toolChanged', tool: t });
    this.events.emit('tool', { tool: t, previous: this.lastTool ?? t });
    this.releaseCapture();
  }

  quickSwap(): void {
    this.log?.push(['q']);
    if (this.lastTool) this.setTool(this.lastTool);
  }

  /** Mouse-wheel stepping, debounced so one flick doesn't skip past the wanted tool. */
  cycleTool(dir: number): void {
    this.log?.push(['c', dir]);
    if (this.wheelT >= 0 && this.elapsed - this.wheelT < this.tuning.tools.wheelDebounce) return;
    this.wheelT = this.elapsed;
    const tools = this.def.tools;
    const i = tools.indexOf(this.tool);
    this.setTool(tools[(i + Math.sign(dir) + tools.length) % tools.length]);
  }

  /** Mouse wheel: turns whatever the tongs hold (bone fragments, tumblers); with the tincture pressed, picks its colour (CON-0109); otherwise steps the tool. */
  wheel(dir: number): void {
    const c = this.captured;
    if (c?.alive) {
      this.log?.push(['w', dir]);
      if (this.as(c, () => c.onWheel(this, dir))) return;
    }
    const pin = this.pinned?.e;
    if (pin?.alive) {
      this.log?.push(['w', dir]);
      if (this.as(pin, () => pin.onWheel(this, dir))) return;
    }
    if (this.tinctureHeld && this.tinctures.length > 1) {
      this.cycleTincture();
      return;
    }
    this.cycleTool(dir);
  }

  /** Use one of a limited supply (CON-0140); past empty, the work goes on at a cost. */
  spend(kind: SupplyKind, n = 1): void {
    const left = this.stock[kind];
    if (left === undefined) return;
    if (left >= n) {
      this.stock[kind] = left - n;
      if (left - n === 0) this.sayOnce(`last-${kind}`, `That was the last of the ${kind}, Doctor. We’ll have to make do.`, 'danger');
      return;
    }
    this.stock[kind] = 0;
    this.overdrawn[kind] = (this.overdrawn[kind] ?? 0) + n;
    this.endPenalty += SUPPLY.penalty * n;
  }

  /** Pressing the tincture key again cycles the loaded colour. */
  cycleTincture(): void {
    this.log?.push(['k']);
    if (this.tinctures.length < 2) return;
    this.tinctureColor = this.tinctures[(this.tinctures.indexOf(this.tinctureColor) + 1) % this.tinctures.length];
    this.cues.push('select');
    this.popup(`${this.tinctureColor} tincture`, this.cursor, TINCTURE_HEX[this.tinctureColor]);
  }

  toggleLeechReverse(): void {
    this.log?.push(['r']);
    this.leechReverse = !this.leechReverse;
    this.popup(this.leechReverse ? 'Leech-pipe reversed' : 'Leech-pipe drawing', this.cursor, '#e8dcc0');
  }

  /** Overdose risk (the vial darkens before a tremor). */
  get overdoseRisk(): boolean {
    return this.doses.length >= this.tuning.tincture.overdoseDoses;
  }

  /** Temporarily disable an instrument (acid, corrosion). */
  disableTool(t: ToolId, seconds: number): void {
    this.disabled.set(t, Math.max(this.disabled.get(t) ?? 0, seconds));
    this.event({ kind: 'toolDisabled', tool: t, seconds });
    if (this.tool === t) this.releaseCapture();
  }

  /** Use the spatial index on crowded fields (ENG-0246); tests may turn it off to compare. */
  spatialIndex = true;

  /**
   * Entities that could answer a stroke from `a` to `b`, top layer first. On a crowded field the
   * uniform grid (ENG-0246) skips small things too far away; otherwise every visible entity.
   */
  candidates(a: Vec, b: Vec): Entity[] {
    const live = this.visibleEntities().sort((x, y) => y.layer - x.layer);
    if (!this.spatialIndex || live.length <= SPATIAL_THRESHOLD) return live;
    return new SpatialGrid(live).query(a, b, this.hitPad + 8, live);
  }

  /** Assist suggestion: which instrument the thing under the point needs. */
  suggestTool(p: Vec): ToolId | null {
    const live = this.visibleEntities().sort((a, b) => b.layer - a.layer);
    for (const e of live) if (e.hitTest(p, this.hitPad)) {
      const w = e.wants(this).filter((t) => this.def.tools.includes(t));
      if (w.length) return w.includes(this.tool) ? this.tool : w[0];
    }
    return null;
  }

  // ------------------------------------------------------------------ frame

  /** A tongs grip locked in place (INP-0107): the hand is free for another instrument. Auto-releases after 10 s. */
  pinned: { e: Entity; t: number } | null = null;

  /** Pin (or unpin) the tongs' grip on what they hold, if it can be pinned. */
  pinGrip(): boolean {
    this.log?.push(['f']);
    if (this.pinned) {
      this.unpin();
      return true;
    }
    const c = this.captured;
    if (!c?.alive || this.tool !== 'tongs' || !c.canPin) return false;
    this.pinned = { e: c, t: PIN_HOLD };
    this.captured = null;
    this.cues.push('select');
    this.popup('Grip pinned', { x: this.pointer.x, y: this.pointer.y - 30 }, '#e8dcc0');
    return true;
  }

  private unpin(): void {
    const p = this.pinned;
    this.pinned = null;
    const at = { ...this.pointer };
    if (p?.e.alive) this.as(p.e, () => p.e.onRelease(this, { pos: at, prev: at, down: false, pressed: false, released: true }, 'tongs'));
  }

  private releaseCapture(): void {
    this.captured = null;
    this.injectT = 0;
    this.toggleLatch = false;
  }

  /** Player input: uses real time so the Litany does not slow the surgeon. */
  /** Optional distortion of the surgeon's input (a boss's torpor or heat-haze); null = none. */
  inputFilter: ((ptr: Pointer, dt: number) => Pointer) | null = null;
  /** Seconds the whole simulation stands still (a boss's phase-transition beat, BOS-0004). */
  freezeT = 0;
  /** Where the surgeon's instrument last was (after any input distortion), for gaze attacks. */
  pointer: Vec = { x: FIELD.cx, y: FIELD.cy };

  handlePointer(ptr: Pointer, dt: number): void {
    this.log?.push(['p', ptr.pos.x, ptr.pos.y, ptr.prev.x, ptr.prev.y, ptr.down ? 1 : 0, ptr.pressed ? 1 : 0, ptr.released ? 1 : 0, dt]);
    if (this.status !== 'running' || this.paused || this.dialogue.length || this.litanyPractice) return;
    if (this.inputFilter) ptr = this.inputFilter(ptr, dt);
    dt *= this.assists.gameSpeed;
    this.cursor = { ...ptr.pos };
    // Tremor from a tincture overdose jitters the hand (deterministically).
    if (this.tremorT > 0) {
      const j = this.tuning.tincture.tremorPx;
      ptr = { ...ptr, pos: { x: ptr.pos.x + Math.sin(this.elapsed * 53) * j, y: ptr.pos.y + Math.cos(this.elapsed * 47) * j } };
    }
    // A thrashing patient sways under the hand until a tincture calms him.
    if (this.def.thrashing && this.thrashT <= 0) {
      ptr = { ...ptr, pos: { x: ptr.pos.x + Math.sin(this.elapsed * 7.3) * 6, y: ptr.pos.y + Math.cos(this.elapsed * 5.9) * 6 } };
    }
    // Torpor: everything the hand does takes twice as long.
    if (this.torporT > 0) dt *= 0.5;
    // Hold-to-toggle assist: a click latches a held tool on; the next click lets go.
    if (this.assists.holdToggle && HELD_TOOLS.includes(this.tool)) {
      if (ptr.pressed) {
        this.toggleLatch = !this.toggleLatch;
        ptr = { ...ptr, pressed: this.toggleLatch, released: !this.toggleLatch, down: this.toggleLatch };
      } else ptr = { ...ptr, pressed: false, released: false, down: this.toggleLatch };
    }
    this.pointer = ptr.pos;
    if (this.freezeT > 0) {
      if (ptr.released) this.releaseCapture();
      return;
    }
    const tool = this.tool;
    if (!this.toolUsable(tool)) {
      if (ptr.pressed) this.popup(tool === 'brand' && this.brandLock > 0 ? 'The brand is too hot!' : `${toolInfo(tool).name} is useless for now!`, ptr.pos, '#d98a5f');
      if (ptr.released) this.releaseCapture();
      return;
    }
    if (ptr.down || ptr.pressed) this.telemetryData.tools.add(tool);
    const live = this.candidates(ptr.prev, ptr.pos);
    // Frozen flesh and the like make some instruments skid: no effect, no rating.
    if ((ptr.down || ptr.pressed) && !this.captured) {
      let why: string | null = null;
      for (const e of live) if ((why = e.blocksTool(this, ptr.pos, tool))) break;
      if (why) {
        if (ptr.pressed) this.pressId++;
        if (this.blockedPress !== this.pressId) {
          this.blockedPress = this.pressId;
          this.popup(why, ptr.pos, '#b9d7ff');
        }
        return;
      }
    }
    // Wrath: the brand works twice as fast on everything it touches.
    const edt = tool === 'brand' && this.wrath ? dt * this.tuning.litany.wrathBrandMult : dt;

    if (ptr.pressed) {
      this.pressId++;
      this.captured = null;
      if (this.pinned && tool === 'tongs' && this.pinned.e.hitTest(ptr.pos, this.hitPad)) this.unpin();
      this.emptyHoldT = 0;
      this.emptyMissed = false;
      for (const e of live) {
        if (this.as(e, () => e.onPress(this, ptr, tool))) {
          this.captured = e;
          break;
        }
      }
      if (!this.captured) this.wrongToolHint(ptr.pos, live);
    }

    if (ptr.down) {
      if (this.captured) {
        const c = this.captured;
        if (c.alive) this.as(c, () => c.onDrag(this, ptr, tool, edt));
      } else {
        for (const e of live) this.as(e, () => e.onSweep(this, ptr, tool, edt));
        if (tool === 'brand') this.brandTargets = live.filter((e) => e.branded).length;
        this.emptyHold(ptr, dt, live);
      }
    }

    if (tool === 'lens') {
      for (const e of this.entities) if (e.alive && e.hidden) this.as(e, () => e.onReveal(this, ptr.pos, dt));
    }

    this.brandHeld = tool === 'brand' && ptr.down;
    this.tinctureHeld = tool === 'tincture' && ptr.down;
    if (tool === 'salve' && ptr.down && this.stock.salve !== undefined && (this.salveUse += edt) >= 1) {
      this.salveUse -= 1;
      this.spend('salve');
    }
    if (tool === 'brand') {
      if (ptr.down) {
        this.brandHeat += dt;
        if (this.brandHeat >= this.tuning.brand.overheatAfter) {
          this.brandLock = this.tuning.brand.overheatLock;
          this.brandHeat = 0;
          this.popup('White-hot! Let it cool.', ptr.pos, '#ff9040');
          this.sayOnce('overheat', 'The brand’s overheated. Give it a moment between searings.');
          this.releaseCapture();
        }
      }
    }
    if (tool === 'salve' && ptr.down) this.salveIdle = 0;

    if (ptr.released) {
      const c = this.captured;
      if (c?.alive) this.as(c, () => c.onRelease(this, ptr, tool));
      this.releaseCapture();
      this.fleshBrandT = this.fleshContactT = 0;
    }
  }

  private wrongToolHint(p: Vec, live: Entity[]): void {
    for (const e of live) {
      if (!e.hitTest(p, this.hitPad)) continue;
      const w = e.wants(this).filter((t) => this.def.tools.includes(t));
      if (!w.length || w.includes(this.tool)) return;
      const key = `wrong-${this.tool}-${e.constructor.name}`;
      if (this.flags.has(key)) return;
      this.flags.add(key);
      const text = `The ${toolInfo(this.tool).name} won’t help with ${e.noun} — try the ${toolInfo(w[0]).name}.`;
      this.popup(text, { x: p.x, y: p.y - 30 }, '#e8dcc0');
      this.event({ kind: 'hint', key, text });
      return;
    }
  }

  /** Is anything (visible) under this point? */
  private overSomething(p: Vec, live: Entity[]): boolean {
    return live.some((e) => e.hitTest(p, this.hitPad));
  }

  private emptyHold(ptr: Pointer, dt: number, live: Entity[]): void {
    const T = this.tuning;
    const onFlesh = onBody(ptr.pos);
    // A tool held on nothing for a moment is a miss — a plain click never is.
    if ((this.tool === 'lancet' || this.tool === 'tongs') && onFlesh && !this.overSomething(ptr.pos, live) && !this.emptyMissed) {
      this.emptyHoldT += dt;
      if (this.emptyHoldT > T.miss.emptyHold && this.entities.some((e) => e.alive && e.required && !e.hidden)) {
        this.emptyMissed = true;
        this.rate('miss', ptr.pos, this.tool === 'lancet' ? 'Stray cut' : undefined);
        if (this.tool === 'lancet') {
          this.harm(T.miss.strayCutHurt, ptr.pos);
          this.cues.push('cut');
        }
      }
    }
    if (this.tool === 'lancet' && ptr.down && !ptr.pressed) this.cutScars(ptr);
    if (this.tool === 'tincture') {
      if (this.injectCooldown > 0 || !onFlesh) return;
      this.injectT += dt;
      if (this.injectT >= T.tincture.time) {
        this.injectT = 0;
        this.inject(ptr.pos);
      }
    } else if (this.tool === 'brand' && onFlesh) {
      // Searing healthy flesh hurts; entities that absorb the brand set this flag.
      if (!live.some((e) => e.alive && e.branded)) {
        // A short grace (INP-0035): the first `fleshGrace` s of contact do no harm, so brief contact while
        // moving between targets is not penalised. The grace runs once per contact; a scorch does not re-arm it.
        const was = this.fleshContactT;
        this.fleshContactT += dt;
        this.fleshBrandT += dt;
        const past = Math.max(0, this.fleshContactT - Math.max(was, T.brand.fleshGrace));
        if (past > 0) {
          this.hurt(T.brand.fleshHurt * past);
          this.sayOnce('brand-flesh', 'Careful! The brand is searing healthy flesh!', 'danger');
        }
        if (this.fleshBrandT > T.brand.fleshBurnAfter) {
          this.fleshBrandT = 0;
          this.rate('bad', ptr.pos, 'Scorched');
          this.spawnPenalty(new SimpleBurn(ptr.pos));
        }
      } else this.fleshBrandT = this.fleshContactT = 0;
    }
  }

  /** A lancet dragged across a closed suture reopens it. */
  private cutScars(ptr: Pointer): void {
    for (let s = this.scars.length - 1; s >= 0; s--) {
      const sc = this.scars[s];
      for (let i = 1; i < sc.length; i++) {
        if (!strokeCrosses(ptr.prev, ptr.pos, sc[i - 1], sc[i])) continue;
        this.scars.splice(s, 1);
        this.rate('bad', ptr.pos, 'Reopened');
        this.harm(2, ptr.pos);
        this.cues.push('cut');
        this.sayOnce('reopened', 'You’ve cut through your own stitches! Close it again.', 'danger');
        const a = sc[0];
        const b = sc[sc.length - 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.spawnPenalty(new Reopened(mid, Math.atan2(b.y - a.y, b.x - a.x), Math.max(24, dist(a, b))));
        return;
      }
    }
  }

  /** A dose of the red tincture. */
  private inject(p: Vec): void {
    const T = this.tuning.tincture;
    this.injectCooldown = T.cooldown;
    const tooClose = this.entities.some((e) => e.alive && !e.hidden && isOpenWound(e) && woundDistance(e, p) < T.woundClearance);
    if (tooClose) {
      this.rate('miss', p, 'Into the wound');
      this.sayOnce('inject-wound', 'Not into the wound, Doctor — clean flesh, away from the cuts.');
      return;
    }
    this.cues.push('inject');
    if (this.def.thrashing) this.thrashT = 10;
    if (this.tinctureColor !== 'red') {
      this.injectColour(p);
      this.recordDose();
      return;
    }
    const before = this.vitals;
    this.heal(T.heal);
    this.popup(`+${T.heal}`, p, '#9fd3a8');
    // Only the first few doses pay: letting him fade to earn a COOL is no strategy.
    const pay = this.paidDoses < T.paidDoses;
    if (before < T.goodBelow) {
      if (pay) this.paidDoses++;
      this.rate(before < T.coolBelow ? 'cool' : 'good', p, 'Stabilised', pay);
    }
    else if (before > T.badAbove) {
      this.rate('bad', p, 'Wasteful');
      this.sayOnce('inject-waste', 'He didn’t need that, Doctor. Save the tincture.');
    }
    this.recordDose();
  }

  private recordDose(): void {
    const T = this.tuning.tincture;
    this.doses.push(this.elapsed);
    this.doses = this.doses.filter((t) => this.elapsed - t <= T.overdoseWindow);
    if (this.doses.length > T.overdoseDoses) {
      this.tremorT = T.tremorTime;
      this.doses = [];
      this.sayOnce('overdose', 'Too much tincture — your hands are shaking!', 'danger');
    }
  }

  /** Green slows every venom, blue lifts torpor, amber cools fever. */
  private injectColour(p: Vec): void {
    const c = this.tinctureColor;
    if (c === 'green') {
      this.venomSlowT = 10;
      this.heal(8);
      this.popup('Antivenom', p, TINCTURE_HEX.green);
    } else if (c === 'blue') {
      if (this.torporT > 0) this.rate('good', p, 'Roused');
      this.torporT = 0;
      this.heal(5);
      this.popup('Stimulant', p, TINCTURE_HEX.blue);
    } else if (c === 'amber') {
      this.feverCalmT = 10;
      this.temperature = Math.max(37, this.temperature - 1.5);
      this.popup('Fever eased', p, TINCTURE_HEX.amber);
    }
    for (const e of this.entities) if (e.alive) (e as unknown as { onTincture?: (op: Operation, c: TinctureColor, p: Vec) => void }).onTincture?.(this, c, p);
  }

  visibleEntities(): Entity[] {
    return this.entities.filter((e) => e.alive && !e.hidden);
  }

  /** Variable-rate driver: runs whole fixed steps and carries the remainder. */
  private acc = 0;
  advance(frameDt: number, beforeStep?: (step: number) => void): number {
    this.acc += frameDt;
    let n = 0;
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP;
      beforeStep?.(n);
      this.update(STEP);
      n++;
    }
    return n;
  }

  update(dt: number): void {
    this.cues.endFrame();
    this.log?.push(['u', dt]);
    if (this.paused) return;
    // Render interpolation (ENG-0054): each entity remembers where this tick started.
    for (const e of this.entities) {
      e.prevPos.x = e.pos.x;
      e.prevPos.y = e.pos.y;
    }
    dt *= this.assists.gameSpeed;
    const T = this.tuning;
    if (this.pinned) {
      this.pinned.t -= dt;
      if (!this.pinned.e.alive) this.pinned = null;
      else if (this.pinned.t <= 0) this.unpin();
    }
    // Presentation timers run in real time.
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.callouts.length) {
      this.calloutT += dt;
      if (this.calloutT > Math.max(2.5, this.callouts[0].length * 0.055) * this.calloutPace) {
        this.callouts.shift();
        this.calloutPri.shift();
        this.calloutT = 0;
      }
    }
    if (this.status === 'won' || this.status === 'lost') return;
    if (this.freezeT > 0) {
      this.freezeT = Math.max(0, this.freezeT - dt);
      return;
    }
    if (this.dialogue.length) {
      // An unread line moves on by itself after a reading time, so an unattended insert never stalls.
      this.dialogueT += dt;
      if (this.dialogueT >= readingTime(this.dialogue[0])) this.advanceDialogue(false);
      return;
    }
    if (this.litanyPractice) return;

    this.injectCooldown = Math.max(0, this.injectCooldown - dt);
    this.tremorT = Math.max(0, this.tremorT - dt);
    this.brandLock = Math.max(0, this.brandLock - dt);
    if (!this.brandHeld || this.brandLock > 0) this.brandHeat = Math.max(0, this.brandHeat - dt * T.brand.coolRate);
    for (const [t, s] of this.disabled) {
      if (s - dt <= 0) this.disabled.delete(t);
      else this.disabled.set(t, s - dt);
    }
    this.salveIdle += dt;
    if (this.salveIdle >= T.salve.refillIdle) this.salve = T.salve.capacity;
    if (this.litanyTime > 0) this.litanyTime = Math.max(0, this.litanyTime - dt);
    if (this.riteTime > 0) this.riteTime = Math.max(0, this.riteTime - dt);
    this.graceT = Math.max(0, this.graceT - dt);
    this.feverCalmT = Math.max(0, this.feverCalmT - dt);
    this.venomSlowT = Math.max(0, this.venomSlowT - dt);
    this.thrashT = Math.max(0, this.thrashT - dt);
    this.hazeT = Math.max(0, this.hazeT - dt);
    if (this.torporT > 0) this.torporT = Math.max(0, this.torporT - dt);

    const wdt = dt * this.timeScale;
    this.elapsed += dt;
    this.heartbeat(dt);

    if (this.status === 'intro') {
      this.phaseDelay -= dt;
      if (this.phaseDelay <= 0) {
        this.status = 'running';
        if (this.opts.checkpoint !== undefined) this.fastForward(this.opts.checkpoint);
        this.nextPhase();
      }
      return;
    }

    // The clock stands still while the Litany holds.
    if (this.litanyTime <= 0) this.timeLeft -= dt;
    this.phaseT += dt;
    if (this.timeLeft <= T.flow.timerWarn && Math.ceil(this.timeLeft) < this.tick) {
      this.tick = Math.ceil(this.timeLeft);
      this.event({ kind: 'hint', key: 'timer', text: `${this.tick}` });
      if (this.tick === Math.floor(T.flow.timerWarn)) this.cues.push('alarm');
    }
    if (this.litanyTime <= 0) {
      this.comboIdle += dt;
      if (this.combo > 0 && this.comboIdle > T.scoring.comboTimeout) {
        this.event({ kind: 'comboLapsed', combo: this.combo });
        this.combo = 0;
      }
    }

    const bossDt = wdt * this.mods.tellSpeed / (this.assists.slowTells ? SLOW_TELLS : 1);
    let drain = 0;
    let drain2 = 0;
    for (const e of this.entities) {
      if (!e.alive) continue;
      const edt = e.boss ? bossDt : e.spawnedBy === 'boss' ? wdt * this.mods.addCadence : wdt;
      e.age += edt;
      this.as(e, () => e.update(this, edt));
      if (e.alive) {
        // Triage (GAM-0248): a wound on the second cot drains the second patient.
        if (this.vitals2 !== null && this.patientAt(e.pos) === 2) drain2 += e.drain(this);
        else drain += e.drain(this);
      }
      // The auto-lens clock runs while a thing stays hidden, and starts over whenever it hides again.
      if (this.assists.autoLens && e.alive && !e.hidden) this.hiddenT.delete(e);
      if (e.alive && e.hidden && this.assists.autoLens) {
        const t = (this.hiddenT.get(e) ?? 0) + dt;
        this.hiddenT.set(e, t);
        if (t > AUTO_LENS_AFTER) this.as(e, () => e.reveal(this));
      }
    }
    // Ceilings on vitals: bites, collapsed lungs, lost blood.
    let cap = this.maxVitals;
    for (const e of this.entities) if (e.alive) cap = Math.min(cap, e.vitalsCeiling(this));
    if (this.def.secondary?.bloodVolume) cap = Math.min(cap, Math.round(30 + this.bloodVolume * 0.7));
    this.vitalsCap = cap;
    if (this.vitals > cap) this.vitals = cap;
    if (this.def.secondary?.temperature) {
      // The body warms back toward 37 °C; fever and frost push it away.
      this.temperature += (37 - this.temperature) * Math.min(1, wdt * 0.05);
      drain += Math.abs(this.temperature - 37) * 0.1;
    }
    this.advanceTutorial();
    // The guided tutorial pauses the bleeding until each step's first correct action.
    const frozen = this.inBreather || this.mercy || this.graceT > 0 || this.tutorial !== null;
    if (!frozen) {
      const total = drain + (this.def.baseDrain ?? 0);
      // A patient already at 0 is lost below — recovery never revives them.
      if (drain === 0 && this.vitals > 0) this.heal(T.vitals.passiveRecovery * wdt);
      if (this.slowPulseEvery > 0) {
        // Slow pulse: the harm between beats is held, and lands on the beat.
        this.heldDrain += total * wdt;
        this.slowPulseT += wdt;
        if (this.slowPulseT >= this.slowPulseEvery) {
          this.slowPulseT -= this.slowPulseEvery;
          this.hurt(this.heldDrain);
          this.heldDrain = 0;
          this.cues.push('heartbeat');
          this.event({ kind: 'hint', key: 'pulse', text: 'beat' });
        }
      } else this.hurt(total * wdt);
      if (this.vitals2 !== null) {
        const total2 = drain2 + (this.def.baseDrain ?? 0);
        if (drain2 === 0 && this.vitals2 > 0) this.vitals2 = Math.min(this.maxVitals, this.vitals2 + T.vitals.passiveRecovery * wdt);
        this.hurt2(total2 * wdt);
      }
    }
    // Compact dead entities in place (stable order, no per-tick allocation).
    let k = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.alive) this.entities[k++] = e;
      else this.events.emit('death', { entity: e });
    }
    this.entities.length = k;
    this.minVitals = Math.min(this.minVitals, this.vitals);
    this.vitalsInt += this.vitals * dt;
    this.runT += dt;
    this.trendT += dt;
    if (this.trendT >= 0.25) {
      this.trendT = 0;
      this.trend.push(this.vitals);
      if (this.trend.length > 5) this.trend.shift();
    }
    this.shownVitals = this.def.fakeVitals ? this.shownVitals + (Math.max(this.vitals, 55) - this.shownVitals) * Math.min(1, dt * 0.5) : this.vitals;
    this.runScripted();

    if (this.vitals <= 0) return this.lose('The patient has died.', 'vitals');
    if (this.oneLifeLost) return this.lose('A single miss, and the trial is over.', 'one-life');
    if (this.vitals2 !== null && this.vitals2 <= 0) return this.lose('The second patient has died.', 'vitals2');
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this.lose('Time has run out.', 'time');
    }
    this.vitalsWarnings();

    if (!this.entities.some((e) => e.required)) {
      if (!this.inBreather && this.phase < this.phaseCount - 1) {
        this.inBreather = true;
        this.phaseDelay = T.flow.breather;
        this.event({ kind: 'breather', phase: this.phase });
        const praise = ['Good. Breathe, Doctor.', 'Well done. Next.', 'Clean work. On to the next.', 'Steady. There’s more.'];
        if (this.phase >= 0) this.say(praise[this.phase % praise.length], 'praise');
      } else if (!this.inBreather) {
        this.inBreather = true;
        this.phaseDelay = 0.8;
      }
      this.phaseDelay -= dt;
      if (this.phaseDelay <= 0) this.nextPhase();
    } else this.inBreather = false;
  }

  /** Seconds since the last slow-pulse beat (entities that beat with the heart read it). */
  get slowPulseClock(): number {
    return this.slowPulseT;
  }

  /** The heart takes up its own rhythm again: any held drain lands now (CON-0155). */
  endSlowPulse(): void {
    if (this.slowPulseEvery <= 0) return;
    this.slowPulseEvery = 0;
    if (this.heldDrain > 0) this.hurt(this.heldDrain);
    this.heldDrain = 0;
  }

  private heartbeat(dt: number): void {
    const bpm = this.status === 'lost' ? 0 : this.slowPulseEvery > 0 ? 60 / this.slowPulseEvery : 58 + (this.maxVitals - this.vitals) * 0.9;
    this.beatT += (dt * bpm) / 60;
    this.sinceBeat += dt;
    if (this.beatT >= 1) {
      this.beatT -= 1;
      this.sinceBeat = 0;
    }
    this.beatPhase = this.beatT;
  }

  private vitalsWarnings(): void {
    const V = this.tuning.vitals;
    if (this.warnState === 0 && this.vitals < V.warn) {
      this.warnState = 1;
      this.event({ kind: 'vitalsWarn', level: 'warn', vitals: this.vitals });
      this.cues.push('heartbeat');
      this.say('Vitals are failing! Use the tincture, Doctor!', 'danger');
    }
    if (this.warnState === 1 && this.vitals < V.critical) {
      this.warnState = 2;
      this.event({ kind: 'vitalsWarn', level: 'critical', vitals: this.vitals });
      this.cues.push('alarm');
      this.say('We’re losing him!', 'danger');
    }
    if (this.warnState === 2 && this.vitals > V.critical + V.hysteresis) this.warnState = 1;
    if (this.warnState === 1 && this.vitals > V.warn + V.hysteresis) this.warnState = 0;
  }

  private runScripted(): void {
    for (const s of this.scripted) {
      if (s.fired) continue;
      const ev = s.ev;
      let go = false;
      if (ev.at) go = this.phase === ev.at.phase && this.phaseT >= ev.at.t;
      if (ev.when) {
        const cls = ev.when.cleared;
        const any = this.entities.some((e) => e.alive && e instanceof cls);
        if (any) s.seen = true;
        else if (s.seen) go = true;
      }
      if (!go) continue;
      s.fired = true;
      if (ev.say) this.say(...ev.say);
      if (ev.spawn) this.spawn(...ev.spawn(this));
    }
  }

  /** Checkpoint restart: resolve the phases before `phase` instantly, keeping open incisions. */
  private fastForward(phase: number): void {
    for (let i = 0; i < phase && i < this.phaseCount; i++) {
      this.phase = i;
      const es = this.def.phases[i].spawn(this);
      for (const e of es) {
        const inc = e as unknown as { state?: string };
        if (inc.state === 'mark') {
          inc.state = 'open';
          e.required = false;
          this.entities.push(e);
        } else if (inc.state === 'open' || inc.state === 'closing') this.entities.push(e);
      }
    }
    this.vitals = Math.min(this.vitals, this.tuning.vitals.checkpoint);
    this.minVitals = this.vitals;
    this.checkpointed = true;
    this.event({ kind: 'checkpoint', phase });
  }

  private nextPhase(): void {
    this.inBreather = false;
    if (this.phase >= 0) this.telemetryData.phaseTimes.push(this.phaseT);
    this.phaseT = 0;
    this.phase++;
    this.phaseDelay = 0.8;
    const def = this.def.phases[this.phase];
    if (!def) {
      this.phase = this.phaseCount;
      if (this.closeUp()) return;
      return this.win();
    }
    this.event({ kind: 'phaseStart', phase: this.phase });
    this.events.emit('phase', { index: this.phase, count: this.def.phases.length });
    const lines = typeof def.interject === 'function' ? def.interject(this) : def.interject;
    if (lines?.length) {
      this.interrupt(lines);
      this.pendingPhase = def;
      return;
    }
    this.beginPhase(def);
  }

  private beginPhase(def: PhaseDef): void {
    if (def.callout) this.say(...def.callout);
    const made = def.spawn(this);
    this.spawn(...made);
    // The environment answers each phase's spawns (CON-0139): rain starts once, mud fouls the cuts.
    for (const m of this.def.env ?? []) {
      const extra = ENV_EFFECTS[m]?.(this, made, this.phase === 0);
      if (extra?.length) this.spawn(...extra);
    }
  }

  /** Before the patient is closed: an unclosed incision gets closed; things left inside cause wound-fever. */
  private closeUp(): boolean {
    const open = this.entities.find((e) => e.alive && (e as unknown as { state?: string }).state === 'open' && typeof (e as unknown as { beginClosing?: unknown }).beginClosing === 'function');
    if (open && !this.def.noClose && !this.autoClosed) {
      this.autoClosed = true;
      (open as unknown as { beginClosing(): void }).beginClosing();
      this.say('Everything’s clear. Close the incision with the thread.');
      this.phase = this.phaseCount - 1;
      return true;
    }
    const left = this.entities.filter((e) => e.alive && e.feverOnClose);
    if (left.length && !this.feverDone) {
      this.feverDone = true;
      const feverDrain = Math.max(...left.filter((e) => e.feverDrain >= 0.4).map((e) => e.feverDrain), 0) + left.filter((e) => e.feverDrain < 0.4).reduce((a, e) => a + e.feverDrain, 0);
      for (const e of left) e.kill();
      this.say('He’s burning up — something was left in the wound! Keep him alive through the fever.', 'danger');
      this.spawn(new WoundFever({ x: FIELD.cx, y: FIELD.cy }, feverDrain));
      this.phase = this.phaseCount - 1;
      return true;
    }
    return false;
  }

  /** Pause the simulation for a mid-operation dialogue insert. */
  interrupt(lines: readonly (string | DialogueLine)[]): void {
    this.dialogue.push(...lines.map((l) => (typeof l === 'string' ? { text: l } : l)));
  }

  /** Freeze all drain for a while (resume grace; dev cheat). */
  graceTime(seconds: number): void {
    this.graceT = Math.max(this.graceT, seconds);
  }

  /** End any drain-free grace at once (the dev "freeze drain" cheat switched off). */
  endGrace(): void {
    this.graceT = 0;
  }

  /** Advance the dialogue insert; resumes with a short drain-free grace. */
  advanceDialogue(manual = true): void {
    if (!this.dialogue.length) return;
    // Only the player's advance is input; the reading-time advance replays from the clock.
    if (manual) this.log?.push(['d']);
    this.dialogueT = 0;
    this.dialogue.shift();
    if (this.dialogue.length) return;
    this.graceT = 1;
    // The phase that waited on the insert begins now.
    const def = this.pendingPhase;
    this.pendingPhase = null;
    if (def) this.beginPhase(def);
  }

  /** Record a story flag (branching outcomes). Scoring never depends on these. */
  setStoryFlag(flag: string): void {
    this.storyFlags.add(flag);
    this.event({ kind: 'storyFlag', flag });
  }

  private win(): void {
    const T = this.tuning.scoring;
    this.status = 'won';
    for (const e of this.entities) if (e.alive) this.as(e, () => e.onOperationEnd(this));
    const perSec = this.bossOp ? T.bossTimeBonus : T.timeBonus;
    const time = this.timeLeft < T.timeBonusFloor ? 0 : Math.round(this.timeLeft) * perSec;
    const m = this.endBonusMult;
    this.bonus = { ...this.bonus, vitals: Math.round(Math.round(this.averageVitals) * T.vitalsBonus * m), time: Math.round(time * m) - this.endPenalty };
    this.score += this.bonus.vitals + this.bonus.time;
    for (const f of this.def.outcomes?.(this) ?? []) this.setStoryFlag(f);
    this.cues.push('bell');
    this.say('The operation is complete.');
    this.event({ kind: 'won', score: this.score });
    this.events.emit('win', { score: this.score, vitals: this.vitals, timeLeft: this.timeLeft });
  }

  /** Flat bonus for a clean closing suture (called by the incision). */
  closureBonus(): void {
    const b = this.tuning.scoring.closureBonus;
    this.bonus.closure += b;
    this.score += b;
    this.popup(`Clean closure +${b}`, { x: FIELD.cx, y: FIELD.cy - 60 }, '#f5d76e');
  }

  lose(reason: string, cause = 'other'): void {
    this.status = 'lost';
    this.lostReason = reason;
    this.lostCause = cause;
    this.cues.push('flatline');
    this.telemetryData.phaseTimes.push(this.phaseT);
    this.event({ kind: 'lost', reason, cause });
    this.events.emit('lose', { reason });
  }

  /** Phase to restart from after a loss, if a checkpoint applies (boss phases only). */
  checkpointPhase(): number | null {
    if (this.status !== 'lost' || !this.bossOp || this.opts.challenge) return null;
    return this.phase >= this.bossPhase && this.bossPhase >= 1 ? this.bossPhase : null;
  }

  /**
   * The Hour's own checkpoint after a loss (CON-0200): the furthest of `def.bossCheckpoints` the stage
   * reached has passed, read from any entity exposing a numeric `stage` — or null.
   */
  checkpointBossStage(): number | null {
    const cps = this.def.bossCheckpoints;
    // Unlike checkpointPhase, this applies when the Hour is the first phase too (Compline opens op5-8).
    if (!cps?.length || this.status !== 'lost' || !this.bossOp || this.opts.challenge || this.phase < this.bossPhase) return null;
    let reached = 0;
    for (const e of this.entities) {
      const st = (e as { stage?: unknown }).stage;
      if (typeof st === 'number') reached = Math.max(reached, st);
    }
    const ok = cps.filter((c) => c <= reached);
    return ok.length ? Math.max(...ok) : null;
  }

  /** Assists or states that disqualify XS / leaderboards. */
  resultFlags(): string[] {
    const f = assistFlags(this.assists);
    if (this.checkpointed) f.push('checkpointed');
    if (this.upgrades.size) f.push('upgraded kit');
    if (this.difficulty !== 'surgeon') f.push(DIFFICULTIES[this.difficulty].name);
    return f;
  }

  rank(): Rank {
    const r = this.ranks;
    const clean = this.counts.bad + this.counts.miss === 0;
    const litanyOk = !this.litanyUsed || this.flags.has('litany-peak');
    const unaided = assistFlags(this.assists).length === 0 && !this.checkpointed;
    if (this.score >= r.S * 1.05 && clean && this.minVitals >= this.tuning.scoring.xsVitalsFloor && litanyOk && unaided) return 'XS';
    if (this.score >= r.S) return 'S';
    if (this.score >= r.A) return 'A';
    if (this.score >= r.B) return 'B';
    return 'C';
  }

  /** Why an S-scoring run was not XS (for the results tooltip). */
  xsBlockers(): string[] {
    const out: string[] = [];
    if (this.counts.bad + this.counts.miss > 0) out.push('a Bad or Miss');
    if (this.minVitals < this.tuning.scoring.xsVitalsFloor) out.push(`vitals fell below ${this.tuning.scoring.xsVitalsFloor}`);
    if (this.litanyUsed && !this.flags.has('litany-peak')) out.push('the Litany was spent before the crisis');
    if (this.checkpointed) out.push('checkpoint restart');
    if (assistFlags(this.assists).length) out.push('assists');
    return out;
  }

  breakdown(): Breakdown {
    const rank = this.rank();
    const r = this.ranks;
    const ladder: [Rank, number][] = [
      ['B', r.B],
      ['A', r.A],
      ['S', r.S],
      ['XS', Math.ceil(r.S * 1.05)],
    ];
    const order: Rank[] = ['C', 'B', 'A', 'S', 'XS'];
    const nextStep = ladder.find(([k]) => order.indexOf(k) > order.indexOf(rank));
    return {
      counts: { ...this.counts },
      maxCombo: this.maxCombo,
      actionPoints: this.score - this.bonus.vitals - this.bonus.time - this.bonus.closure,
      vitalsBonus: this.bonus.vitals,
      timeBonus: this.bonus.time,
      closureBonus: this.bonus.closure,
      penalties: Math.round(this.penalties),
      capped: this.addCapped,
      score: this.score,
      rank,
      next: nextStep ? { rank: nextStep[0], delta: Math.max(0, nextStep[1] - this.score) } : null,
      flags: this.resultFlags(),
    };
  }

  telemetry(): Telemetry {
    return {
      opId: this.def.id,
      won: this.status === 'won',
      score: this.score,
      rank: this.rank(),
      phaseTimes: this.telemetryData.phaseTimes.map((t) => Math.round(t * 10) / 10),
      ratings: { ...this.counts },
      minVitals: Math.round(this.minVitals),
      toolsUsed: [...this.telemetryData.tools],
      litanyAt: this.telemetryData.litanyAt.map((t) => Math.round(t * 10) / 10),
      maxCombo: this.maxCombo,
      addPoints: this.addPoints,
      elapsed: Math.round(this.elapsed * 10) / 10,
    };
  }

  /** Is there salve on the brush? (Says so once when it has run dry.) */
  canSalve(): boolean {
    this.salveIdle = 0;
    if (this.salve > 0) return true;
    this.sayOnce('salve-dry', 'The salve pot’s empty — give it a moment to refill.');
    return false;
  }

  /** Spend salve for newly covered cells. */
  useSalve(cells: number): void {
    this.salveIdle = 0;
    this.salve = Math.max(0, this.salve - cells * this.tuning.salve.perCell);
  }
}

export const clampVitals = (v: number, max = MAX_VITALS): number => clamp(v, 0, max);

/** The first sentence (or clause before a dash) of a callout: Master-mode terseness. */
export function terse(line: string): string {
  const m = line.match(/^(.+?[.!?])(\s|$)/);
  const first = m ? m[1] : line;
  const dash = first.indexOf(' — ');
  return dash > 12 ? `${first.slice(0, dash)}.` : first;
}

// ---------------------------------------------------------------- shared helpers

/** Entities that count as an open wound (for injection clearance, grubs, pus). */
export function isOpenWound(e: Entity): boolean {
  const w = e as unknown as { openWound?: boolean };
  return w.openWound === true;
}

export function woundDistance(e: Entity, p: Vec): number {
  const w = e as unknown as { a?: Vec; b?: Vec };
  if (w.a && w.b) return pointSegment(p, w.a, w.b).d;
  return dist(p, e.pos);
}

// Small internal entities the operation itself creates. Kept here (not in
// entities.ts) so the core does not import every ailment.

/** A scorch mark from branding healthy flesh: salve it. */
export class SimpleBurn extends Entity {
  private cells = 6;
  noun = 'a scorch';
  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
  }
  override drain(): number {
    return 0.15;
  }
  override wants(): readonly ToolId[] {
    return ['salve'];
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || dist(ptr.pos, this.pos) > 24 || !op.canSalve()) return;
    op.useSalve(1);
    this.cells--;
    if (this.cells <= 0) {
      this.kill();
      op.rate('good', this.pos, 'Soothed');
    }
  }
  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, 16, hex('#3a1408', 0.7), hex('#3a1408', 0));
  }
}

/** A suture cut open again: behaves like a fresh laceration (see entities.ts), registered lazily to avoid an import cycle. */
export class Reopened extends Entity {
  noun = 'the reopened wound';
  openWound = true;
  readonly a: Vec;
  readonly b: Vec;
  private stitches = 0;
  private marks: Vec[] = [];
  constructor(
    center: Vec,
    angle: number,
    public length: number,
  ) {
    super(center);
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    this.a = { x: center.x - dx, y: center.y - dy };
    this.b = { x: center.x + dx, y: center.y + dy };
  }
  get needed(): number {
    return Math.max(2, Math.ceil(this.length / DEFAULT_TUNING.stitch.pxPerStitch));
  }
  override drain(op: Operation): number {
    return this.length * op.tuning.laceration.drainPerPx;
  }
  override wants(): readonly ToolId[] {
    return ['thread'];
  }
  override hitTest(p: Vec, pad = 0): boolean {
    return pointSegment(p, this.a, this.b).d < 24 + pad;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'thread' || ptr.pressed) return;
    if (!strokeCrosses(ptr.prev, ptr.pos, this.a, this.b)) return;
    if (this.marks.some((m) => dist(m, ptr.pos) < op.tuning.stitch.minSpacing)) return;
    this.marks.push({ ...ptr.pos });
    op.cues.push('stitch');
    if (++this.stitches >= this.needed) {
      this.kill();
      op.scars.push([{ ...this.a }, { ...this.b }]);
      op.rate('good', this.pos, 'Restitched');
    }
  }
  draw(g: Gfx, op: Operation): void {
    g.line(this.a, this.b, 3, hex(bloodOf(op.def.race), 0.9));
    for (const m of this.marks) g.rect(m.x - 2, m.y - 2, 4, 4, hex('#efe6c4'));
  }
}

/** Wound-fever from something left inside at closing: survive it. */
export class WoundFever extends Entity {
  private left: number;
  noun = 'the fever';
  constructor(
    pos: Vec,
    public rate: number = DEFAULT_TUNING.fever.drain,
  ) {
    super(pos);
    this.left = DEFAULT_TUNING.fever.duration;
    this.layer = -3;
  }
  override drain(op: Operation): number {
    return this.rate * (op.feverCalmT > 0 ? 0.5 : 1);
  }
  override hitTest(): boolean {
    return false;
  }
  override update(_op: Operation, dt: number): void {
    this.left -= dt;
    if (this.left <= 0) this.kill();
  }
  get remaining(): number {
    return Math.max(0, this.left);
  }
  draw(g: Gfx, op: Operation): void {
    g.glow(FIELD.cx, FIELD.cy, 300, hex('#ff6020', 0.06 + 0.03 * Math.sin(op.elapsed * 3)));
    g.arc(FIELD.cx, FIELD.cy - FIELD.ry - 20, 18, 3, hex('#ff8040'), this.left / DEFAULT_TUNING.fever.duration);
  }
}

