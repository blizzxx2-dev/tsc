import { clamp, dist, pointSegment, Rng, side, type Vec } from '../core/math';
import type { Cue } from '../core/audio';
import { Entity, type Origin } from './entity';
import type { FxEvent, FxKind } from '../render/particles';
import { toolInfo, type Pointer, type Rank, type Rating, type ToolId } from './types';
import { DEFAULT_TUNING, mergeTuning, type Tuning, type TuningOverride } from './tuning';
import { AUTO_LENS_AFTER, combineMods, DIFFICULTIES, NO_ASSISTS, NO_MODS, SLOW_TELLS, assistFlags, type Assists, type Difficulty, type Modifiers } from './difficulty';
import type { LitanyVariant } from './litany';
import type { SimEvent } from './events';
import { rankThresholds } from './ranks';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export type OrganKind = 'flesh' | 'heart' | 'lung' | 'gut' | 'liver' | 'brain' | 'bone';

/** Per-organ multiplier on the harm done by mistakes (stray cuts, slips, tears). */
export const ORGAN_SENSITIVITY: Record<OrganKind, number> = { flesh: 1, heart: 2, lung: 1.5, gut: 1.2, liver: 1.4, brain: 2, bone: 0.8 };

/** An organ region on a multi-organ field (elliptical, virtual screen space). */
export interface OrganRegion {
  kind: OrganKind;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface PhaseDef {
  /** Lines the assistant says when the phase begins. */
  callout?: string[];
  spawn(op: Operation): Entity[];
}

/** Scripted events: callouts or spawns keyed to a phase time or to something being cleared. */
export interface ScriptedEvent {
  at?: { phase: number; t: number };
  /** Fires once no entity whose class name matches is left alive (after one has been seen). */
  when?: { cleared: string };
  say?: string[];
  spawn?: (op: Operation) => Entity[];
}

export interface OperationDef {
  id: string;
  title: string;
  patient: string;
  diagnosis: string;
  organ: OrganKind;
  /** Species of patient, for flesh tint. */
  race?: 'human' | 'dwarf' | 'elf' | 'halfling' | 'orc';
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
  /** Multi-organ fields: regions with their own sensitivity. */
  regions?: readonly OrganRegion[];
  events?: readonly ScriptedEvent[];
  /** Sext: the HUD shows a smoothed false vitals value unless the lens is on the heart. */
  fakeVitals?: boolean;
  /** Story flags decided by how the operation ended (evaluated on victory). */
  outcomes?: (op: Operation) => string[];
  /** Short strategy tips per failure cause, offered after repeated losses. */
  tips?: Partial<Record<string, string>>;
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
  /** Record every input for replay. */
  record?: boolean;
  seed?: number;
  /** Challenge op: no assists allowed, results flagged. */
  challenge?: string;
}

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

/** Tools that are held down to work, for the hold-to-toggle assist. */
const HELD_TOOLS: readonly ToolId[] = ['leech', 'brand', 'tincture', 'lens'];

/** One recorded call into the simulation, for exact replays. */
export type LogOp =
  | ['p', number, number, number, number, 0 | 1, 0 | 1, 0 | 1, number]
  | ['u', number]
  | ['t', ToolId]
  | ['c', number]
  | ['q']
  | ['l']
  | ['h'];

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
class CueQueue extends Array<Cue> {
  static get [Symbol.species]() {
    return Array;
  }
  sink: ((c: Cue) => void) | null = null;
  override push(...cs: Cue[]): number {
    if (this.sink) for (const c of cs) this.sink(c);
    return super.push(...cs);
  }
}

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
  popups: Popup[] = [];
  callouts: string[] = [];
  private calloutPri: number[] = [];
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
  tremorT = 0;
  private captured: Entity | null = null;
  /** Entity whose code is running (for tagging spawns and ratings). */
  actor: Entity | null = null;
  /** Increments on every press, so entities can tell one stroke from the next. */
  pressId = 0;
  /** Sounds requested by the simulation; the scene drains and plays them. */
  cues: Cue[];
  /** Everything else the presentation may want, in order (bounded). */
  events: SimEvent[] = [];
  /** One-shot tutorial/story flags any entity may set. */
  flags = new Set<string>();
  /** Story flags decided during play (thrallKept, …). */
  storyFlags = new Set<string>();
  /** Screen shake intensity, decays over time. */
  shake = 0;
  /** Visual effect requests; the scene drains them into its particle system. */
  fx: FxEvent[] = [];
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
  brandLock = 0;
  private fleshBrandT = 0;
  private emptyHoldT = 0;
  private emptyMissed = false;
  private toggleLatch = false;
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
  /** Seconds since the last R-wave. */
  sinceBeat = 0;
  /** Displayed (possibly false) vitals for Sext. */
  shownVitals: number;
  paused = false;
  /** Dialogue insert pausing the simulation (mid-op talking patient). */
  dialogue: string[] = [];
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

  constructor(
    readonly def: OperationDef,
    readonly opts: OperationOptions = {},
  ) {
    Entity.resetIds();
    this.rng = new Rng(opts.seed ?? def.seed ?? 1);
    this.difficulty = opts.difficulty ?? 'surgeon';
    this.assists = { ...NO_ASSISTS, ...(opts.challenge ? {} : opts.assists) };
    this.mods = combineMods(NO_MODS, opts.mods ?? {});
    this.tuning = mergeTuning(def.tuning, this.mods.tuning);
    this.upgrades = new Set(opts.challenge ? [] : (opts.upgrades ?? []));
    this.litanyVariant = opts.litanyVariant ?? 'stillness';
    this.maxVitals = Math.round(this.tuning.vitals.max * (def.constitution === 'frail' ? 0.8 : 1));
    this.vitalsCap = this.maxVitals;
    this.vitals = Math.min(this.maxVitals, def.vitals ?? this.maxVitals);
    this.shownVitals = this.vitals;
    this.minVitals = this.vitals;
    const diff = DIFFICULTIES[this.difficulty];
    this.timeLimit = Math.round(def.timeLimit * diff.time * this.mods.time);
    this.timeLeft = this.timeLimit;
    this.tool = def.tools[0];
    this.litanyAllowed = def.litany === false ? 0 : (def.litanyUses ?? 1);
    this.phaseDelay = this.tuning.flow.intro;
    this.tick = Math.floor(this.tuning.flow.timerWarn) + 1;
    this.salve = this.tuning.salve.capacity;
    this.scripted = (def.events ?? []).map((ev) => ({ ev, fired: false, seen: false }));
    this.log = opts.record ? [] : null;
    const q = new CueQueue();
    q.sink = (c) => this.event({ kind: 'cue', cue: c });
    this.cues = q;
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

  event(e: SimEvent): void {
    this.events.push(e);
    if (this.events.length > 4000) this.events.splice(0, this.events.length - 3000);
  }

  // ------------------------------------------------------------------ scoring

  rate(r: Rating, pos: Vec, label?: string): void {
    const T = this.tuning.scoring;
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
    let pts = Math.round(T[r] * (1 + Math.min(this.combo, T.comboCap) * T.comboStep));
    let capped = false;
    if (origin === 'penalty') pts = 0;
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
    this.popups.push({ text, pos: { ...pos }, t: 0, color: RATING_COLOR[r], rating: capped ? undefined : r, label, combo: this.combo });
    if (r === 'cool') this.emit('gold', pos, 14);
    if (r === 'bad') this.shake = Math.max(this.shake, 2);
    this.cues.push(r);
    this.event({ kind: 'rated', rating: r, label, points: pts, pos: { ...pos }, combo: this.combo, add: origin });
  }

  emit(kind: FxKind, pos: Vec, n = 10, dir?: number, spread?: number, speed?: number): void {
    this.fx.push({ kind, pos: { ...pos }, n, dir, spread, speed });
  }

  stain(pos: Vec, r: number, a = 0.5): void {
    this.stains.push({ x: pos.x, y: pos.y, r, a });
    if (this.stains.length > 160) this.stains.shift();
  }

  popup(text: string, pos: Vec, color = '#e8dcc0'): void {
    this.popups.push({ text, pos: { ...pos }, t: 0, color });
  }

  /** Queue assistant lines. Danger lines jump ahead of instructions, which jump ahead of praise. */
  say(...args: (string | CalloutPriority)[]): void {
    let pri: CalloutPriority = 'instruction';
    const last = args[args.length - 1];
    if (last === 'danger' || last === 'instruction' || last === 'praise') {
      pri = last;
      args = args.slice(0, -1);
    }
    for (const line of args) {
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

  hurt(amount: number, pos?: Vec): void {
    if (this.status !== 'running') return;
    this.vitals = Math.max(this.assists.noFail ? 1 : 0, this.vitals - amount);
    this.minVitals = Math.min(this.minVitals, this.vitals);
    this.shake = Math.min(12, this.shake + amount * 1.5);
    if (pos && amount >= 1) this.popup(`-${Math.round(amount)}`, pos, '#c0392b');
  }

  /** Harm caused by a surgeon's mistake: scaled by the organ's sensitivity. */
  harm(amount: number, pos: Vec): void {
    this.penalties += amount;
    this.hurt(amount * ORGAN_SENSITIVITY[this.organAt(pos)], pos);
  }

  heal(amount: number): void {
    this.vitals = Math.min(this.vitalsCap, this.vitals + amount);
  }

  spawn(...es: Entity[]): void {
    const a = this.actor;
    for (const e of es) {
      if (a && e.spawnedBy === 'content') e.spawnedBy = a.boss || a.spawnedBy === 'boss' ? 'boss' : a.spawnedBy === 'penalty' ? 'penalty' : 'self';
      if (e.boss) this.onBossSpawn(e);
      this.event({ kind: 'spawned', entity: e.constructor.name, id: e.id, origin: e.spawnedBy });
    }
    this.entities.push(...es);
  }

  /** Spawn entities created by the surgeon's own mistake: they never award points. */
  spawnPenalty(...es: Entity[]): void {
    for (const e of es) e.spawnedBy = 'penalty';
    this.spawn(...es);
  }

  private onBossSpawn(e: Entity): void {
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

  canInvokeLitany(): boolean {
    return this.litanyUses < this.litanyAllowed && this.status === 'running' && !this.paused;
  }

  /** Grant another use (Compline: breaking the silence nodes). */
  grantLitany(): void {
    this.litanyAllowed++;
  }

  invokeLitany(): boolean {
    this.log?.push(['l']);
    if (!this.canInvokeLitany()) return false;
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
    this.event({ kind: 'litany', variant: this.litanyVariant, use: this.litanyUses });
    this.event({ kind: 'whisper', total: this.whisper });
    const names = { stillness: 'THE LITANY OF STILLNESS', vigil: 'THE LITANY OF VIGIL', mercy: 'THE LITANY OF MERCY', wrath: 'THE LITANY OF WRATH' } as const;
    this.popup(names[this.litanyVariant], { x: FIELD.cx, y: FIELD.cy - 120 }, '#f5d76e');
    // A rite invoked while a boss is on the table is "at the peak" (XS stays possible).
    if (this.entities.some((e) => e.alive && e.boss)) this.flags.add('litany-peak');
    return true;
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
    const pools = this.entities.filter((e) => e.alive && !e.hidden && e.constructor.name === 'BloodPool') as (Entity & { r: number })[];
    if (!pools.length) {
      this.popup('Nothing for me to hold, Doctor.', this.cursor, '#e8dcc0');
      return false;
    }
    const p = pools.sort((a, b) => b.r - a.r)[0];
    this.ilseUsed = true;
    p.kill();
    this.score = Math.max(0, this.score - 200);
    this.penalties += 200;
    this.say('I have it, Doctor — keep working.', 'instruction');
    this.popup('Ilse assists  −200', p.pos, '#e8dcc0');
    return true;
  }

  /** The previously held instrument, for quick-swap. */
  lastTool: ToolId | null = null;

  setTool(t: ToolId): void {
    this.log?.push(['t', t]);
    if (!this.def.tools.includes(t) || this.tool === t) return;
    this.lastTool = this.tool;
    this.tool = t;
    this.cues.push('select');
    this.event({ kind: 'toolChanged', tool: t });
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

  /** Temporarily disable an instrument (acid, corrosion). */
  disableTool(t: ToolId, seconds: number): void {
    this.disabled.set(t, Math.max(this.disabled.get(t) ?? 0, seconds));
    this.event({ kind: 'toolDisabled', tool: t, seconds });
    if (this.tool === t) this.releaseCapture();
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

  private releaseCapture(): void {
    this.captured = null;
    this.injectT = 0;
    this.toggleLatch = false;
  }

  /** Player input: uses real time so the Litany does not slow the surgeon. */
  handlePointer(ptr: Pointer, dt: number): void {
    this.log?.push(['p', ptr.pos.x, ptr.pos.y, ptr.prev.x, ptr.prev.y, ptr.down ? 1 : 0, ptr.pressed ? 1 : 0, ptr.released ? 1 : 0, dt]);
    if (this.status !== 'running' || this.paused || this.dialogue.length) return;
    dt *= this.assists.gameSpeed;
    this.cursor = { ...ptr.pos };
    // Tremor from a tincture overdose jitters the hand (deterministically).
    if (this.tremorT > 0) {
      const j = this.tuning.tincture.tremorPx;
      ptr = { ...ptr, pos: { x: ptr.pos.x + Math.sin(this.elapsed * 53) * j, y: ptr.pos.y + Math.cos(this.elapsed * 47) * j } };
    }
    // Hold-to-toggle assist: a click latches a held tool on; the next click lets go.
    if (this.assists.holdToggle && HELD_TOOLS.includes(this.tool)) {
      if (ptr.pressed) {
        this.toggleLatch = !this.toggleLatch;
        ptr = { ...ptr, pressed: this.toggleLatch, released: !this.toggleLatch, down: this.toggleLatch };
      } else ptr = { ...ptr, pressed: false, released: false, down: this.toggleLatch };
    }
    const tool = this.tool;
    if (!this.toolUsable(tool)) {
      if (ptr.pressed) this.popup(tool === 'brand' && this.brandLock > 0 ? 'The brand is too hot!' : `${toolInfo(tool).name} is useless for now!`, ptr.pos, '#d98a5f');
      if (ptr.released) this.releaseCapture();
      return;
    }
    if (ptr.down || ptr.pressed) this.telemetryData.tools.add(tool);
    const live = this.visibleEntities().sort((a, b) => b.layer - a.layer);
    // Wrath: the brand works twice as fast on everything it touches.
    const edt = tool === 'brand' && this.wrath ? dt * this.tuning.litany.wrathBrandMult : dt;

    if (ptr.pressed) {
      this.pressId++;
      this.captured = null;
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
        this.emptyHold(ptr, dt, live);
      }
    }

    if (tool === 'lens') {
      for (const e of this.entities) if (e.alive && e.hidden) this.as(e, () => e.onReveal(this, ptr.pos, dt));
    }

    if (tool === 'brand') {
      if (ptr.down) {
        this.brandHeat += dt;
        if (this.brandHeat >= this.tuning.brand.overheatAfter) {
          this.brandLock = this.tuning.brand.overheatLock;
          this.brandHeat = 0;
          this.popup('The brand is white-hot — let it cool!', ptr.pos, '#ff9040');
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
      this.fleshBrandT = 0;
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
        this.hurt(T.brand.fleshHurt * dt);
        this.fleshBrandT += dt;
        this.sayOnce('brand-flesh', 'Careful! The brand is searing healthy flesh!', 'danger');
        if (this.fleshBrandT > T.brand.fleshBurnAfter) {
          this.fleshBrandT = 0;
          this.rate('bad', ptr.pos, 'Scorched');
          this.spawnPenalty(new SimpleBurn(ptr.pos));
        }
      } else this.fleshBrandT = 0;
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
    const before = this.vitals;
    this.heal(T.heal);
    this.cues.push('inject');
    this.popup(`+${T.heal}`, p, '#9fd3a8');
    if (before < T.coolBelow) this.rate('cool', p, 'Stabilised');
    else if (before < T.goodBelow) this.rate('good', p, 'Stabilised');
    else if (before > T.badAbove) {
      this.rate('bad', p, 'Wasteful');
      this.sayOnce('inject-waste', 'He didn’t need that, Doctor. Save the tincture.');
    }
    this.doses.push(this.elapsed);
    this.doses = this.doses.filter((t) => this.elapsed - t <= T.overdoseWindow);
    if (this.doses.length > T.overdoseDoses) {
      this.tremorT = T.tremorTime;
      this.doses = [];
      this.sayOnce('overdose', 'Too much tincture — your hands are shaking!', 'danger');
    }
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
    this.log?.push(['u', dt]);
    if (this.paused) return;
    dt *= this.assists.gameSpeed;
    const T = this.tuning;
    // Presentation timers run in real time.
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.1);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.callouts.length) {
      this.calloutT += dt;
      if (this.calloutT > Math.max(2.5, this.callouts[0].length * 0.055)) {
        this.callouts.shift();
        this.calloutPri.shift();
        this.calloutT = 0;
      }
    }
    if (this.status === 'won' || this.status === 'lost') return;
    if (this.dialogue.length) return;

    this.injectCooldown = Math.max(0, this.injectCooldown - dt);
    this.tremorT = Math.max(0, this.tremorT - dt);
    this.brandLock = Math.max(0, this.brandLock - dt);
    if (this.tool !== 'brand' || this.brandLock > 0) this.brandHeat = Math.max(0, this.brandHeat - dt * T.brand.coolRate);
    for (const [t, s] of this.disabled) {
      if (s - dt <= 0) this.disabled.delete(t);
      else this.disabled.set(t, s - dt);
    }
    this.salveIdle += dt;
    if (this.salveIdle >= T.salve.refillIdle) this.salve = T.salve.capacity;
    if (this.litanyTime > 0) this.litanyTime = Math.max(0, this.litanyTime - dt);
    if (this.riteTime > 0) this.riteTime = Math.max(0, this.riteTime - dt);
    this.graceT = Math.max(0, this.graceT - dt);

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
    for (const e of this.entities) {
      if (!e.alive) continue;
      const edt = e.boss ? bossDt : e.spawnedBy === 'boss' ? wdt * this.mods.addCadence : wdt;
      e.age += edt;
      this.as(e, () => e.update(this, edt));
      if (e.alive) drain += e.drain(this);
      if (e.alive && e.hidden && this.assists.autoLens) {
        const t = (this.hiddenT.get(e) ?? 0) + dt;
        this.hiddenT.set(e, t);
        if (t > AUTO_LENS_AFTER) this.as(e, () => e.reveal(this));
      }
    }
    const frozen = this.inBreather || this.mercy || this.graceT > 0;
    if (!frozen) {
      const total = (drain + (this.def.baseDrain ?? 0)) * this.drainMult;
      if (drain === 0) this.heal(T.vitals.passiveRecovery * wdt);
      this.hurt(total * wdt);
    }
    this.entities = this.entities.filter((e) => e.alive);
    this.minVitals = Math.min(this.minVitals, this.vitals);
    this.shownVitals = this.def.fakeVitals ? this.shownVitals + (Math.max(this.vitals, 55) - this.shownVitals) * Math.min(1, dt * 0.5) : this.vitals;
    this.runScripted();

    if (this.vitals <= 0) return this.lose('The patient has died.', 'vitals');
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

  private heartbeat(dt: number): void {
    const bpm = this.status === 'lost' ? 0 : 58 + (this.maxVitals - this.vitals) * 0.9;
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
        const any = this.entities.some((e) => e.alive && e.constructor.name === ev.when!.cleared);
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
    if (def.callout) this.say(...def.callout);
    this.spawn(...def.spawn(this));
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
      for (const e of left) e.kill();
      this.say('He’s burning up — something was left in the wound! Keep him alive through the fever.', 'danger');
      this.spawn(new WoundFever({ x: FIELD.cx, y: FIELD.cy }));
      this.phase = this.phaseCount - 1;
      return true;
    }
    return false;
  }

  /** Pause the simulation for a mid-operation dialogue insert. */
  interrupt(lines: string[]): void {
    this.dialogue.push(...lines);
  }

  /** Advance the dialogue insert; resumes with a short drain-free grace. */
  advanceDialogue(): void {
    this.dialogue.shift();
    if (!this.dialogue.length) this.graceT = 1;
  }

  /** Record a story flag (branching outcomes). Scoring never depends on these. */
  setStoryFlag(flag: string): void {
    this.storyFlags.add(flag);
    this.event({ kind: 'storyFlag', flag });
  }

  private win(): void {
    const T = this.tuning.scoring;
    this.status = 'won';
    const perSec = this.bossOp ? T.bossTimeBonus : T.timeBonus;
    const time = this.timeLeft < T.timeBonusFloor ? 0 : Math.round(this.timeLeft) * perSec;
    this.bonus = { ...this.bonus, vitals: Math.round(this.vitals) * T.vitalsBonus, time };
    this.score += this.bonus.vitals + this.bonus.time;
    for (const f of this.def.outcomes?.(this) ?? []) this.setStoryFlag(f);
    this.cues.push('bell');
    this.say('The operation is complete.');
    this.event({ kind: 'won', score: this.score });
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
  }

  /** Phase to restart from after a loss, if a checkpoint applies (boss phases only). */
  checkpointPhase(): number | null {
    if (this.status !== 'lost' || !this.bossOp || this.opts.challenge) return null;
    return this.phase >= this.bossPhase && this.bossPhase >= 1 ? this.bossPhase : null;
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
  draw(g: Gfx): void {
    g.line(this.a, this.b, 3, hex('#7a0a10', 0.9));
    for (const m of this.marks) g.rect(m.x - 2, m.y - 2, 4, 4, hex('#efe6c4'));
  }
}

/** Wound-fever from something left inside at closing: survive it. */
export class WoundFever extends Entity {
  private left: number;
  noun = 'the fever';
  constructor(pos: Vec) {
    super(pos);
    this.left = DEFAULT_TUNING.fever.duration;
    this.layer = -3;
  }
  override drain(op: Operation): number {
    return op.tuning.fever.drain;
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
