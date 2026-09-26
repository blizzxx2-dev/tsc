import { packPose } from '../art/portraitRig';
import { drawSeal } from '../ui/seals';
import { FACES, type Face } from '../content/story';
import { curseSource, hourOf } from '../art/curse';
import { VanishFx } from '../art/vanishFx';
import { ExtractionTray } from '../art/extractionTray';
import { scarArt } from '../art/ailmentArt';
import { t as tr, tSource } from '../i18n';
import { formatClock, formatNumber, formatVitals } from '../i18n/format';
import { dist, Rng } from '../core/math';
import { bindHitstop } from '../core/clock';
import { Camera2D } from '../render/camera';
import type { Game, Scene } from '../core/scene';
import { attachBarkDirector } from '../content/barkDirector';
import { flags } from '../content/flags';
import { whisperBand, whisperScore } from '../content/whisper';
import { hex, withAlpha } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { underSkinBulges } from '../render/underSkin';
import { hourCard } from '../art/hourMiniatures';
import { MANIFEST, type AssetId } from '../assets/manifest.gen';
import type { SurfaceMaps } from '../render/gfx';
import { SurfaceSetCache, surfaceSetFor } from '../render/surfaceSets';
import { clawRakeArt, rakeGroups } from '../art/clawRake';
import { drawGrime, drawRain, VENUE_ID, venueLights } from '../render/venues';
import { BloodPool, Bubo, Burn, Embedded, Incision, Laceration, Sigil, surfDisc, surfLine } from '../surgery/entities';
import { EggSac } from '../surgery/lauds';
import { Particles } from '../render/particles';
import { brandMaterial, BrandSmoke } from '../render/brandSmoke';
import { BladeFeedback } from '../render/bladeFeedback';
import { OperationVfx } from './opVfx';
import { drawOrder } from '../render/layers';
import { DecalMaps } from '../render/decals';
import { contentHash } from '../core/replayCodec';
import { rememberReplay, setLiveReplay } from '../platform/lastReplay';
import { BUILD } from '../platform/build';
import { takeLog } from '../surgery/replay';
import { FlashLimiter } from '../render/flashLimiter';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, onBody, LITANY_DURATION, MAX_VITALS, Operation, TINCTURE_COOLDOWN, TINCTURE_TIME, TINCTURE_HEX, type OperationDef, type Popup } from '../surgery/operation';
import { TOOL_INFO, type ToolId } from '../surgery/types';
import { anchorShift, PALETTE, viewRect, VIEW_H, VIEW_W } from '../ui/layout';
import { button, reticle, toolIcon } from '../ui/widgets';
import { giltText, UI, waxSeal } from '../ui/ornaments';
import { RANK_WAX } from './rankArt';
import type { ActionId } from '../input/actions';
import { DamageAggregator, ToolHints } from '../ui/hudPrefs';
import { stackPopup } from '../ui/popupStack';
import { clearOfHud, HUD_SCORE, HUD_TIMER, HUD_VITALS, operationHud } from '../ui/popupPlacement';
import { speciesBlood, tallowBlood } from '../render/organs';
import { VespersMalison } from '../surgery/bosses/vespers';
import { band, caps, heading, heartIcon, phaseSeal, ratingStamp, glass, INK, keycap, meter, numerals, titleRule, well } from '../ui/hudKit';
import { localeInfo } from '../i18n/locales';
import { getLocale } from '../i18n';
import { bloodScale, flashScale, GORE_LEVEL, presentation } from '../render/presentation';
import { highContrast, palette } from '../ui/theme';
import { giltNumerals } from '../ui/ornaments';
import { RATING_INK, starReliquary, vialArt } from '../art/kit';
import { cursorTarget, cursorTint, drawTongsJaws, vialLevel } from '../art/hud';
import { CAST, type CharacterId } from '../content/characters';
import { ASSISTANT_NAME } from '../content/characters';
import { vec3 } from '../render/color';
import { settings } from '../core/settings';
import { OptionsScene } from './options';
import { litanyMode, OperationInput } from '../input/opinput';
import { formatSplit, ghostAt, GHOST_STEP, recordTimeAttack, TimeAttackClock, timeAttackBest, type TimeAttackRun } from '../surgery/timeAttack';
import { anaemia, coldTint, drawBreathFog, frostArea, paleFlesh, paleRough, fever } from '../render/fleshMood';
import { fitText } from '../ui/text';
import { bloodOf, speciesOf, tintBlood } from '../surgery/species';
import { setVfxBlood } from '../art/vfx';
import { SalveFilm } from '../render/salveFilm';
import { RuneScars } from '../render/runeScars';
import { Closures } from '../render/closure';
import { drawInterpolated } from '../render/interp';
import { PetrifyFront } from '../surgery/ailments/vennmark';
import { FrostPatch } from '../surgery/ailments/frost';
import { Gangrene } from '../surgery/ailments/gangrene';
import { addTray, HudLayer, inRect, trayFrame, traySide, traySlot } from '../input/hud';
import { drawGraspOutline } from '../input/hover';
import { HoldToRetry } from '../input/retry';
import { bindings } from '../input/bindings';
import { dragGlyphFor, glyphFor, toolKeyLabel } from '../input/glyphs';
import { bossBarRect, calmWave, drawBossHud, drawLitanyTheft, drawTorpor, ecgCalm, toolBlinded } from '../surgery/bosses/hud';
import { activeBoss } from '../surgery/bosses/base';
import { BossAudio, withBossContext } from './bossAudio';
import { BOSS_OPS, watchEncounters } from '../surgery/bosses/codex';
import { loadProgress, storeProgress } from '../surgery/progress';
import { codexId } from './codex';
import { watchManual } from '../content/manual';
import { operationOptions } from '../surgery/session';
import type { OperationOptions } from '../surgery/operation';
import { drawDebug, drawDialogue, drawDrainArrow, drawFieldOverlays, drawLitanyPractice, drawSecondaryVitals, drawTrayState, drawTutorial } from './gameplayHud';
import { PauseScene, type PauseResult } from './pause';
import { VfxLayer } from '../art/vfx';
import { ComplineLook } from '../art/complineLook';
import { inkFlood } from '../art/outcomeArt';
import { nextTransitionStyle } from '../ui/transition';
import { pushWarp, tissueWarp } from '../art/tissueWarp';
import { drawFieldTool, drawTipDebug } from '../art/toolSprites';

export interface OperationOutcome {
  op: Operation;
  won: boolean;
}

/** The boss HP bar, when a Malison or elite is on the table (popups keep off it too). */
const bossPlates = (op: Operation) => {
  const b = activeBoss(op);
  if (!b) return [];
  const r = bossBarRect(b);
  return [{ x: r.x, y: r.y - 24, w: r.w, h: r.h + 28 }]; // the bar and the Hour's name above it
};

/** 1 → I, 2 → II … for phase banners. */
const roman = (n: number): string => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);

/** Seconds a Salve stroke stays glossy after it is laid (GAM-0043). */
export const SALVE_GLOSS_S = 4;
/** Seconds a frost patch takes to rime over (ENG-0262). */
/** Furthest a Malison's corruption is painted from it, px (ENG-0099). */
export const CURSE_REACH = 360;
export const FROST_GROW_S = 1.5;
/** Tray tips stay above this line, clear of the callout plate (UIX-0051). */
const TIP_FLOOR = 612;

/** The surface set resident across operation scenes (ART-0367). */
const SURFACE_SETS = new SurfaceSetCache();

/** Where the watcher stands (CON-0048): left of the field, clear of the HUD bars and the trays. */
const OBSERVER = { x: 120, y: 520, w: 150, h: 200, watchBelow: 40 };
/** Portrait shader silhouette styles (as src/scenes/backdrop.ts). */
const STYLE_OF: Record<string, number> = { hood: 0, coif: 1, cap: 2, hat: 3, helm: 4, bare: 5 };

export class OperationScene implements Scene {
  op: Operation;
  private paused = false;
  private endT = 0;
  private ctl = new OperationInput();
  private ecg: number[] = new Array(200).fill(0);
  private beatPhase = 0;
  private pulse = 0;
  private corrupt = 0;
  /** Flesh corruption under any Hour's Malison (ART-0183), smoothed like `corrupt`. */
  private fleshCurse = 0;
  /** Exit flipbooks for shards and hexstone (presentation only). */
  private vanish = new VanishFx();
  /** The kidney dish and lead dish with what has been extracted (presentation only). */
  private tray = new ExtractionTray();
  private toolFlash = 0;
  private lastTool: ToolId | null = null;
  private entered = false;
  private hintT = 0;
  /** Vitals-loss popups summed per source (UIX-0049) and the tooltip policy (UIX-0053). */
  private dmg = new DamageAggregator();
  private hints = new ToolHints();
  private idleT = 0;
  /** Phase banner (ART-0078 / UIX-0061): a ribbon that slides in at each phase start. */
  private banner: { phase: number; t: number; boss: boolean | null } | null = null;
  private particles = new Particles();
  /** Persistent field-space decal maps (ENG-0108–0121): blood that stays, dries and is drained away. */
  private decals: DecalMaps | null = null;
  /** The end-of-operation field snapshot has been taken (ENG-0122). */
  private snapped = false;
  /** Seconds until each open wound next weeps onto the blood map (ENG-0113). */
  private weepT = 0;
  /** Radius at which each pool last stained the field. */
  private poolStains = new WeakMap<object, number>();
  /** HUD particles (ENG-0144): COOL sparkle, chain-milestone flare; real time, UI layer. */
  private uiFx = new Particles();
  /** Emitters driven by the operation's state and events (ENG-0133–0142). */
  private vfx = new OperationVfx(() => this.particles);
  /** Procedural VFX over the particles (ART-0275…0293). */
  private artVfx = new VfxLayer(this.particles);
  /** Compline's silence, stolen-Litany ripple and colour restore (ART-0258). */
  private compline = new ComplineLook();
  /** The star that just read, handed to the Litany burn-in when the `litany` event follows. */
  /** Recent pointer positions while the Gut Thread works, for the trailing thread. */
  private threadTrail: { x: number; y: number }[] = [];
  private pendingStar: { pts: { x: number; y: number }[]; c: { x: number; y: number } } | null = null;
  private flashLimit = new FlashLimiter();
  private comboT = 0;
  private lastCombo = 0;
  /** World camera (ENG-0045/0046): pointer input is mapped through it before hit-testing. */
  readonly camera = new Camera2D();
  /** Seeded presentation noise (ECG jitter) so screenshots are reproducible (ENG-0251). */
  private presRng = new Rng(1);
  /** Floating rating/damage text, built from the operation's `popup` events (ENG-0243). */
  private popups: (Popup & { lift?: number })[] = [];
  /** Vitals damage feedback (UIX-0039): a pale bar trailing losses, a green sweep on heals, shaking digits on big hits. */
  private lagV = 100;
  private lagHold = 0;
  private prevV = 100;
  private healFrom = 0;
  private healT = 0;
  private digitShakeT = 0;
  /** Callout panel ghosting (UIX-0057): it fades aside when the hand or a live wound is beneath it. */
  private calloutRect: { x: number; y: number; w: number; h: number } | null = null;
  private calloutGhost = 0;
  /** Score roll-up (UIX-0044): the shown score eases toward the real one. */
  private shownScore = 0;
  /** Hurt rings (UIX-0050): a ring blooms where vitals were lost. */
  private hurtRings: { x: number; y: number; t: number; big: boolean }[] = [];
  /** Combo milestone banner (UIX-0048). */
  private milestone: { combo: number; t: number } | null = null;
  /** Pointer for HUD hover tips (phase seals). */
  private hoverPos = { x: -1, y: -1 };
  /** Low-vitals alarm with hysteresis (UIX-0042): on at 30, off again only above 35. */
  private lowLatch = false;
  /** The Malison intro card (UIX-0063) is shown in full once; later meetings may skip it. */
  private static malisonCardSeen(): boolean {
    try {
      return !!localStorage.getItem('suture-and-steel.seen.malison-card');
    } catch {
      return true;
    }
  }
  private static markMalisonCard(): void {
    try {
      localStorage.setItem('suture-and-steel.seen.malison-card', '1');
    } catch {
      // no storage
    }
  }
  /** Sounds requested since the last tick (deduplicated). */
  private debug = false;
  /** The last 20 callouts, for the pause menu's log (UIX-0060). */
  readonly calloutLog: string[] = [];
  /** Seconds left of the 3-2-1 resume countdown (UIX-0101). */
  private resumeT = 0;
  /** HUD widgets under the pointer take presses before the field does (INP-0047); rebuilt as the HUD is drawn. */
  private hud = new HudLayer();
  /** Litany reliquary rect for the hit-test layer (mirrored in left-handed mode). */
  private litanyRect: { x: number; y: number; w: number; h: number } | null = null;
  /** The Respite button in the HUD (UIX-0102): registered each frame, drawn beside the score plate. */
  private pauseRect = { x: VIEW_W - 16 - 250 - 8 - 44, y: 14, w: 44, h: 44 };
  private pauseHover = 0;
  /** Multi-organ views (GAM-0247): which region the camera frames. */
  private view = 0;
  /** Salve gloss (GAM-0043): where the Salve was spread and when; each spot stays wet for SALVE_GLOSS_S. */
  private gloss: { x: number; y: number; t: number }[] = [];
  /** The Saint's Salve film over salved wounds (ENG-0118). */
  private film = new SalveFilm();
  /** Rune scars under curse sigils (ENG-0266). */
  private runes = new RuneScars();
  /** Stitched cuts drawing shut (ENG-0112). */
  private closures = new Closures();
  /** Frost still standing, 0..1 of the peak frozen area (GAM-0103). */
  private frost = 0;
  private frostPeak = 0;
  /** Time attack (GAM-0217): the live clock, the personal best it races and whether this run beat it. */
  private ta: TimeAttackClock | null = null;
  private ghost: TimeAttackRun | null = null;
  private taBest: boolean | null = null;
  /** Hold `op.retry` for a second to restart a challenge run on the spot (INP-0113). */
  private retry = new HoldToRetry();

  constructor(
    private def: OperationDef,
    private onEnd: (o: OperationOutcome) => void,
    private onQuit: () => void,
    /** Per-run overrides (retry at Novice, checkpoint, challenge rules). */
    private runOpts: OperationOptions = {},
  ) {
    this.op = OperationScene.create(def, runOpts);
    if (runOpts.timeAttack) {
      this.ta = new TimeAttackClock();
      this.ghost = timeAttackBest(def.id);
    }
    this.presRng = new Rng(def.seed ?? 1);
    // Emitter streams seeded from the operation seed (ENG-0131).
    this.particles.seed(this.runOpts.seed ?? this.def.seed ?? 1);
    this.applyBlood();
    this.listen(this.op);
  }

  /** Subscribe the presentation (popups, particles, audio) to the operation's event bus. */
  private listen(op: Operation): void {
    // A wound the sim marks set takes its salve film with it, fading (ENG-0118).
    op.events.on('death', ({ entity }) => {
      this.film.set(entity, op.elapsed);
      this.runes.dispelled(entity, op.elapsed);
      this.closures.closed(entity, op.elapsed);
    });
    op.events.on('popup', (p) => {
      if (!this.dmg.absorb(p.text, p.pos, p.color)) this.addPopup({ ...p, t: 0 });
    });
    this.lagV = this.prevV = op.vitals;
    this.lagHold = this.healT = this.digitShakeT = 0;
    // A BAD lancet stroke jolts the view for 40 ms (GAM-0026).
    op.events.on('rate', ({ rating }) => rating === 'bad' && op.tool === 'lancet' && this.blade.bad());
    op.events.on('hurt', ({ amount, pos }) => {
      this.lagHold = 0.5;
      if (amount >= 5) this.digitShakeT = 0.35;
      if (pos && amount >= 1) this.hurtRings.push({ x: pos.x, y: pos.y, t: 0, big: amount >= 5 });
    });
    this.shownScore = op.score;
    op.events.on('phase', ({ index }) => (this.banner = { phase: index, t: 0, boss: null }));
    op.events.on('fx', (e) => {
      // Gore level (UIX-0155): fewer blood particles when reduced, none when minimal.
      if (e.kind === 'blood') {
        const k = bloodScale(presentation.gore);
        if (k === 0) return;
        if (k < 1) return this.particles.spawn({ ...e, n: Math.max(1, Math.round(e.n * k)) });
      }
      this.particles.spawn(e);
    });
    op.events.on('say', ({ lines }) => {
      this.calloutLog.push(...lines);
      if (this.calloutLog.length > 20) this.calloutLog.splice(0, this.calloutLog.length - 20);
    });
    this.bossAudio.listen(op);
    this.artVfx.listen(op);
    this.ctl.onStar = (trail, ok) => {
      if (ok) this.pendingStar = { pts: trail, c: { x: trail.reduce((a, p) => a + p.x, 0) / trail.length, y: trail.reduce((a, p) => a + p.y, 0) / trail.length } };
      else if (trail.length > 8) this.artVfx.gestureFailed(trail);
      this.artVfx.trailReleased(trail);
    };
    op.events.on('litany', () => {
      const st = this.pendingStar;
      this.pendingStar = null;
      this.artVfx.litanyStart(st?.pts ?? null, st?.c ?? { x: FIELD.cx, y: FIELD.cy - 40 });
    });
    // The first meeting with an Hour opens its codex page.
    watchEncounters(op, (boss) => {
      const p = loadProgress();
      if (p.codex.includes(codexId(boss))) return;
      p.codex.push(codexId(boss));
      storeProgress(p);
    });
    // The Surgeon's Manual opens a page for each instrument and ailment met (GAM-0209).
    watchManual(op, (id) => {
      const p = loadProgress();
      if (p.codex.includes(id)) return;
      p.codex.push(id);
      storeProgress(p);
    });
    if (!this.runOpts.practice) attachBarkDirector(op, { whisper: whisperBand(whisperScore(flags)) });
    this.vfx = new OperationVfx(() => this.particles);
    this.vfx.listen(op, () => bloodScale(presentation.gore));
    // Burns leave scars on the scorch map; hexfire keeps a violet rim (ENG-0117).
    op.events.on('spawn', ({ entity }) => {
      if (!(entity instanceof Burn) || !this.decals) return;
      const t = op.elapsed;
      const { x, y } = entity.pos;
      const r = entity.radius;
      this.decals.stamp({ map: 'scorch', brush: 'splat', x, y, r: r * 1.1, rot: this.presRng.next() * 6.28, value: [entity.source === 'acid' ? 0.35 : 0.7, 0, 0], mode: 'add', t, seed: this.presRng.next() });
      if (entity.source === 'hexfire') this.decals.stamp({ map: 'scorch', brush: 'ring', x, y, r: r * 1.25, value: [0, 1, 0], mode: 'add', t });
    });
    op.events.on('rate', ({ rating, pos }) => rating === 'cool' && this.uiFx.burst('uiSparkle', pos));
    // Replay for bug reports (ENG-0256): live while the operation runs, packed once it ends.
    const header = () => ({ build: BUILD.id, content: contentHash(op.def) });
    setLiveReplay(() => (op.log && this.op === op ? { log: takeLog(op), header: header() } : null));
    const done = () => {
      if (!op.log) return;
      setLiveReplay(null);
      void rememberReplay(takeLog(op), header()).catch(() => undefined);
    };
    op.events.on('win', done);
    op.events.on('lose', done);
  }

  /** Open the "Respite" overlay (UIX-0100). The operation stops updating until it closes. */
  private openPause(game: Game): void {
    this.paused = true;
    this.ctl.suspend(this.op);
    if (game.clock) game.clock.paused = true;
    game.push!(new PauseScene(this.op, this.calloutLog, (r) => this.closePause(r)));
  }
  /** Boss sounds, ambience and adaptive-music hooks (BOS-0008/0017/0020). */
  private bossAudio = new BossAudio();
  /** Cautery smoke and its veil (GAM-0051). */
  private smoke = new BrandSmoke();
  /** Lancet trail, wet parting and the BAD micro-shake (GAM-0026). */
  private blade = new BladeFeedback();

  private closePause(r: PauseResult): void {
    if (r === 'restart') return this.restart();
    if (r === 'abandon') return this.onQuit();
    this.paused = false;
    this.resumeT = settings.resumeCountdown ? 3 : 0;
  }

  /** Apply player assists, difficulty and kit to the operation definition. */
  private static create(def: OperationDef, runOpts: OperationOptions = {}): Operation {
    const d = settings.timerAssist === 1 || runOpts.challenge ? def : { ...def, timeLimit: Math.round(def.timeLimit * settings.timerAssist) };
    // Every run records its inputs (ENG-0256): bug reports carry the replay of the run that went wrong.
    return new Operation(withBossContext(d), { audioOffset: settings.audioOffset, ...operationOptions(def, runOpts), record: true });
  }

  /** Unsubscribes the hitstop binding (ENG-0058); set on the first update that has a clock. */
  private unbindHitstop: (() => void) | null = null;

  dispose(): void {
    this.unbindHitstop?.();
    this.unbindHitstop = null;
    this.bossAudio.dispose();
    this.op.events.clear();
    // Decal maps belong to this operation: free them so VRAM returns to baseline (ENG-0121).
    this.decals?.release();
    this.decals = null;
  }

  exit(game: Game): void {
    // Leaving the operation: never leave the shared clocks paused or slowed.
    if (game.clock) {
      game.clock.paused = false;
      game.clock.worldScale = 1;
    }
  }

  enter(): void {
    OperationScene.live = this;
    if (this.entered) return;
    this.entered = true;
    this.setupViews();
    this.op.say('Instruments ready, Doctor.');
  }

  /** The operation on screen, for the dev hot-reload (CON-0011). */
  static live: OperationScene | null = null;

  /**
   * Dev hot-reload (CON-0011): an edited op data file hands in its fresh definitions; the running
   * operation restarts from the one with its id, on the same seed.
   */
  hotReload(defs: readonly OperationDef[]): boolean {
    const next = defs.find((d) => d.id === this.def.id);
    if (!next) return false;
    this.def = next;
    this.adopt(OperationScene.create(next, this.runOpts));
    this.op.say('The case notes changed — starting again.');
    return true;
  }

  private restart(): void {
    // A repeat attempt skips the bosses’ phase-transition beats (BOS-0004).
    this.def = { ...this.def, skipCinematics: true } as OperationDef;
    this.adopt(OperationScene.create(this.def, this.runOpts));
  }

  /** The def the running operation was built from (with boss context), for snapshots (ENG-0249). */
  get liveDef(): OperationDef {
    return this.op.def;
  }

  /**
   * Take over a different operation of the same case (a restart, or a restored debug snapshot,
   * ENG-0249): presentation state is reset around it.
   */
  adopt(op: Operation): void {
    this.op.events.clear();
    this.op = op;
    if (this.runOpts.timeAttack) {
      this.ta = new TimeAttackClock();
      this.ghost = timeAttackBest(this.def.id);
      this.taBest = null;
    }
    this.presRng = new Rng(this.def.seed ?? 1);
    this.popups.length = 0;
    this.gloss.length = 0;
    this.film.clear();
    this.rimed.clear();
    this.runes.clear();
    this.closures.clear();
    this.frost = this.frostPeak = 0;
    this.listen(this.op);
    this.camera.reset();
    this.particles = new Particles(undefined, this.runOpts.seed ?? this.def.seed ?? 1);
    this.applyBlood();
    this.decals?.reset();
    this.snapped = false;
    this.ctl = new OperationInput();
    this.setupViews();
    this.paused = false;
    this.resumeT = 0;
    this.calloutLog.length = 0;
    this.endT = 0;
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    const op = this.op;

    const pause = this.ctl.pauseRequest(input);
    if (pause && op.status !== 'won' && op.status !== 'lost') {
      if (game.push && game.pop) {
        if (!this.paused) return this.openPause(game);
      } else this.paused = pause === 'pause' ? true : !this.paused;
    }
    if (this.resumeT > 0) {
      // Resume countdown: the world holds still until it runs out.
      this.resumeT = Math.max(0, this.resumeT - dt);
      if (game.clock) game.clock.paused = true;
      return this.ctl.suspend(op);
    }
    op.paused = this.paused;
    // Pause stops sim and world clocks; UI keeps animating (ENG-0057). The Litany scales world time.
    if (game.clock) {
      game.clock.paused = this.paused;
      game.clock.worldScale = op.timeScale;
    }
    if (this.paused) return this.ctl.suspend(op);
    this.camera.update(dt);
    if (input.actPressed('op.debug')) this.debug = !this.debug;
    // Instant retry (INP-0113) is a challenge-mode affordance; story operations restart from the pause menu.
    if (this.runOpts.challenge && this.retry.update(input, dt)) return this.restart();

    // A mid-operation dialogue insert holds everything until read.
    if (op.dialogue.length) {
      if (input.pressed || input.actPressed('litany.key')) op.advanceDialogue();
      op.update(dt);
      return;
    }
    if (input.actPressed('op.assist')) op.ilseAssist();
    if (input.actPressed('op.leechReverse')) op.toggleLeechReverse();
    if (input.actPressed('op.pin')) op.pinGrip();

    // Tool selection, the Litany and every pointer event since last frame, in the order they happened.
    // Samples are mapped from view space into world space through the camera (ENG-0046); under the
    // Moving Cart mutator the field sways, so the pointer is mapped back onto it.
    const sway = op.sway();
    this.ctl.toWorld = (p) => {
      const w = this.camera.toWorld(p, { x: 0, y: 0 });
      return { x: w.x - sway.x, y: w.y - sway.y };
    };
    // HUD hit-test pass (INP-0047): tray slots select, the tray frame and the reliquary swallow, the callout panel is click-through.
    this.hud.clear();
    addTray(this.hud, op.def.tools);
    if (this.litanyRect) this.hud.add({ kind: 'litany', rect: this.litanyRect });
    if (this.calloutRect) this.hud.add({ kind: 'callout', rect: this.calloutRect, clickThrough: true });
    // The Respite button (UIX-0102): a press on it pauses instead of reaching the field.
    const overPause = op.status === 'running' && !this.paused && this.resumeT <= 0 && inRect(input.pos, this.pauseRect, 4);
    this.pauseHover = Math.max(0, Math.min(1, this.pauseHover + (overPause ? dt * 8 : -dt * 6)));
    if (overPause) this.hud.add({ kind: 'pause', rect: this.pauseRect, pad: 4 });
    if (overPause && input.pressed && game.push && game.pop) return this.openPause(game);
    this.ctl.update(op, input, dt, this.hud.hit);
    this.dmg.enabled = settings.damageNumbers;
    this.hints.mode = settings.toolHints;
    for (const p of this.dmg.tick(dt)) this.addPopup({ ...p, t: 0 });
    this.tickVitalsFeedback(dt);
    this.tickCalloutGhost(dt, input.pos);
    if (op.tool !== this.lastTool) {
      this.toolFlash = 1;
      this.hintT = this.hints.selected(op.tool) ? 2.5 : 0;
    }
    // Idle during a guided tutorial: remind what the instrument in hand does.
    this.idleT = input.pressed || input.down ? 0 : this.idleT + dt;
    if (this.hintT <= 0 && this.hints.remind(this.idleT, op.tutorial !== null)) {
      this.hintT = 2.5;
      this.idleT = 0;
    }
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.banner) {
      // Decide on the first frame whether a Malison arrived with the phase.
      if (this.banner.boss === null) this.banner.boss = op.entities.some((e) => e.alive && e.boss);
      this.banner.t += dt;
      if (this.banner.t > 2.2) this.banner.t = Math.min(this.banner.t, 99);
    }
    if (!this.unbindHitstop && game.clock) this.unbindHitstop = bindHitstop(game.clock, op.events);
    // A press skips the title card (UIX-0069) and, once seen, the Malison card (UIX-0063).
    if (input.pressed || input.actPressed('ui.confirm')) {
      if (op.status === 'intro') op.skipIntro();
      if (this.banner?.boss && this.banner.t < 3 && OperationScene.malisonCardSeen()) this.banner.t = 3;
    }
    if (op.combo !== this.lastCombo) {
      this.comboT = 0;
      if (op.combo > this.lastCombo && op.tuning.scoring.comboMilestones.includes(op.combo)) {
        this.milestone = { combo: op.combo, t: 0 };
        this.uiFx.burst('uiFlare', { x: VIEW_W / 2 - 110, y: 130 });
      }
      this.lastCombo = op.combo;
    }
    this.comboT += dt;
    // Presentation timers: score roll-up, hurt rings, milestone banner.
    this.shownScore += (op.score - this.shownScore) * Math.min(1, dt * 9);
    if (Math.abs(op.score - this.shownScore) < 1) this.shownScore = op.score;
    for (const r of this.hurtRings) r.t += dt;
    this.hurtRings = this.hurtRings.filter((r) => r.t < 0.5);
    if (this.milestone && (this.milestone.t += dt) > 2.2) this.milestone = null;
    this.lastTool = op.tool;
    this.toolFlash = Math.max(0, this.toolFlash - dt * 3);

    op.update(dt);
    this.tickGloss(op, input.down);
    // Frost presentation (GAM-0103): the share of the op's peak frost area still frozen.
    const fa = frostArea(op);
    this.frostPeak = Math.max(this.frostPeak, fa);
    this.frost = this.frostPeak > 0 ? fa / this.frostPeak : 0;
    if (this.ta) {
      this.ta.tick(op, dt);
      if (op.status === 'won' && this.taBest === null) this.taBest = recordTimeAttack(op.def.id, this.ta.run(op));
    }

    // Heartbeat drives the ECG trace and the organ swell (the audio director schedules the thump on its QRS).
    // The Litany slows the heart with the rest of the world.
    const bpm = op.status === 'lost' ? 0 : 58 + (MAX_VITALS - op.vitals) * 0.9;
    this.beatPhase += (dt * op.timeScale * bpm) / 60;
    if (this.beatPhase >= 1) this.beatPhase -= 1;
    this.pulse = Math.exp(-this.beatPhase * 8);
    const samples = Math.max(1, Math.round(dt * 120));
    for (let i = 0; i < samples; i++) {
      this.ecg.shift();
      this.ecg.push(bpm === 0 ? 0 : ecgCalm(op) ? calmWave(this.beatPhase) : ecgWave(this.beatPhase) * (op.vitals < 25 ? 0.6 + this.presRng.next() * 0.4 : 1));
    }

    const cursed = op.entities.some((e) => e instanceof Malison || e instanceof MalisonShard) ? 0.7 : op.entities.some((e) => e instanceof Sigil) ? 0.25 : 0;
    this.corrupt += (cursed - this.corrupt) * Math.min(1, dt * 1.5);
    this.fleshCurse += (Math.max(cursed, curseSource(op.entities) ? 0.55 : 0) - this.fleshCurse) * Math.min(1, dt * 1.5);

    // Visual effects arrive as `fx` events; landed droplets become stains. Particles run on world time.
    this.compline.update(op, dt);
    this.artVfx.update(op, { dt, pointer: op.pointer, down: input.down, pulse: this.pulse, reduceMotion: settings.reduceMotion, reduceFlashing: settings.reduceFlashing, gore: bloodScale(presentation.gore) });
    this.particles.update(dt * op.timeScale, (p, kind, size) => {
      if (kind === 'blood' && onBody(p)) op.stain(p, size * 2.6, 0.3);
      // Landed droplets stamp persistent blood (ENG-0114).
      if (kind === 'blood') this.decals?.stamp({ map: 'blood', brush: 'splat', x: p.x, y: p.y, r: size * 2.4, rot: this.presRng.next() * 6.28, value: [0.7, 1, 0], mode: 'add', t: op.elapsed, seed: this.presRng.next() });
    });
    // The lancet's trail and wet parting follow the tip while it is pressed (GAM-0026).
    const cutting = op.status === 'running' && op.tool === 'lancet' && game.input.down;
    this.blade.update(dt, cutting ? op.cursor : null, onBody(op.cursor));
    // Cautery smoke by what is being seared, and the veil it leaves (GAM-0051, cosmetic).
    const searing = op.status === 'running' && op.tool === 'brand' && op.holdingBrand && onBody(op.cursor) ? brandMaterial(op, op.cursor) : null;
    const puffs = this.smoke.update(dt, searing);
    if (puffs > 0) this.particles.spawn({ kind: 'smoke', pos: { ...op.cursor }, n: puffs, dir: -Math.PI / 2, spread: 0.8 });
    this.stampFluids(op, game);
    // Particle quality setting (ENG-0145): budget and non-gameplay emission follow it.
    this.particles.quality = this.uiFx.quality = settings.particleQuality;
    this.uiFx.update(dt, () => {});
    this.vfx.update(op, dt * op.timeScale, { beat: this.beatPhase, pointer: game.input.pos, down: game.input.down, light: { x: FIELD.cx - 220, y: 60 }, starTrail: this.ctl.starTrail, gore: bloodScale(presentation.gore) });

    // op.cues are drained by the audio director (src/audio/director.ts) right after this update.
    // Popups are presentation: they age in real time here, not in the sim.
    let k = 0;
    for (const p of this.popups) {
      p.t += dt;
      if (p.t < 1.1) this.popups[k++] = p;
    }
    this.popups.length = k;

    if (op.status === 'won' || op.status === 'lost') {
      this.endT += dt;
      if (this.endT > 2.2) {
        // A saved patient leaves by the woodcut page turn (ART-0292); a lost one is already under the ink.
        if (op.status === 'won') nextTransitionStyle('page');
        this.onEnd({ op, won: op.status === 'won' });
      }
    }
  }

  /**
   * Pools soak into the field beneath them; the Leech-Pipe erases the blood map under the pipe while
   * it draws a pool off, so the field visibly cleans as the sim removes the blood (ENG-0115).
   */
  private stampFluids(op: Operation, game: Game): void {
    // Created with the first GL frame or tick (headless sims have no renderer and skip decals).
    if (!this.decals && game.gfx?.targets) this.decals = new DecalMaps(game.gfx, game.gfx.shaderQuality);
    const d = this.decals;
    if (!d) return;
    const draining = op.tool === 'leech' && game.input.down && op.status === 'running';
    const t = op.elapsed;
    // Cautery (ENG-0117): the Brand sears where it touches tissue.
    if (op.tool === 'brand' && game.input.down && op.status === 'running' && onBody(game.input.pos))
      d.stamp({ map: 'scorch', brush: 'soft', x: game.input.pos.x, y: game.input.pos.y, r: 11, value: [0.035, 0, 0], mode: 'add', t });
    this.stampStains(op, d);
    // Fresh cuts weep along their length until they are sutured (ENG-0113).
    this.weepT -= op.timeScale / 120;
    const weep = this.weepT <= 0 && op.status === 'running';
    if (weep) this.weepT = 0.35;
    for (const e of op.entities) {
      if (!weep || !e.alive) continue;
      if (e instanceof Laceration && e.bleed > 0) {
        const k = this.presRng.next();
        const ang = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
        d.stamp({ map: 'blood', brush: 'streak', x: e.a.x + (e.b.x - e.a.x) * k, y: e.a.y + (e.b.y - e.a.y) * k, r: 7 + 5 * e.bleed, rot: ang, value: [0.22 * Math.min(2, e.bleed), 1, 0], mode: 'add', t });
      } else if (e instanceof Incision && e.state === 'open' && e.points.length > 1) {
        const i = Math.min(e.points.length - 2, Math.floor(this.presRng.next() * (e.points.length - 1)));
        const a = e.points[i];
        const b = e.points[i + 1];
        d.stamp({ map: 'blood', brush: 'streak', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: 8, rot: Math.atan2(b.y - a.y, b.x - a.x), value: [0.18, 1, 0], mode: 'add', t });
      }
    }
    for (const e of op.entities) {
      if (!(e instanceof BloodPool) || !e.alive || e.ichor !== 'blood') continue;
      // A pool stains the field once as it spreads (each 6 px of growth), not every frame.
      const stained = this.poolStains.get(e) ?? 0;
      if (e.r > stained + 6) {
        this.poolStains.set(e, e.r);
        d.stamp({ map: 'blood', brush: 'soft', x: e.pos.x, y: e.pos.y, r: e.r, value: [0.45, 0.8, 0], mode: 'add', t: op.elapsed });
      }
      // The pipe draws the pool off: its stain fades with it, strongest under the pipe.
      if (draining && dist(e.pos, game.input.pos) < e.r + 12) {
        d.stamp({ map: 'blood', brush: 'soft', x: e.pos.x, y: e.pos.y, r: e.r * 1.15, value: [0.05, 0, 0], mode: 'erase', t: op.elapsed });
        d.stamp({ map: 'blood', brush: 'soft', x: game.input.pos.x, y: game.input.pos.y, r: 34, value: [0.12, 0, 0], mode: 'erase', t: op.elapsed });
        this.poolStains.set(e, Math.min(stained, e.r));
      }
    }
  }

  /** Seconds to the next stain stamp; stone, frost and necrosis are laid at 10 Hz. */
  private stainT = 0;
  /** Frost patches already rimed, with the thaw last seen. */
  private rimed = new Map<object, { thaw: number; grown: number }>();
  /** Seconds each curse source has been painting corruption (ENG-0099). */
  private cursing = new WeakMap<object, number>();
  /** Petrify plates already chiselled out of the stone. */
  private chiselled = new WeakSet<object>();

  /**
   * The stain map (ENG-0261/0262/0264): the petrify front lays granite as it creeps and a cracked
   * plate chisels it out; a frost patch lays rime once and each thaw lifts some of it; gangrene
   * lays necrosis along its line until debrided, then it recedes.
   */
  private stampStains(op: Operation, d: DecalMaps): void {
    this.stainT -= op.timeScale / 120;
    if (this.stainT > 0 || op.status !== 'running') return;
    this.stainT = 0.1;
    const t = op.elapsed;
    for (const e of op.entities) {
      // Curse corruption (ENG-0099): a Malison paints a widening stain of corruption with tendrils; a sigil a small one.
      const malison = e.alive && hourOf(e) !== null;
      if (malison || (e.alive && e instanceof Sigil)) {
        const age = (this.cursing.get(e) ?? 0) + 0.1;
        this.cursing.set(e, age);
        const reach = malison ? Math.min(CURSE_REACH, 60 + age * 14) : Math.min(110, 30 + age * 8);
        d.stamp({ map: 'curse', brush: 'soft', x: e.pos.x, y: e.pos.y, r: reach, value: [malison ? 0.06 : 0.035, 0, 0], mode: 'add', t });
        const a = this.presRng.next() * Math.PI * 2;
        d.stamp({ map: 'curse', brush: 'splat', x: e.pos.x + Math.cos(a) * reach * 0.7, y: e.pos.y + Math.sin(a) * reach * 0.7, r: reach * 0.45, rot: a, value: [0.05, 0, 0], mode: 'add', t, seed: this.presRng.next() });
      }
      if (e instanceof PetrifyFront) {
        if (e.alive) d.stamp({ map: 'stain', brush: 'soft', x: e.frontPos.x, y: e.frontPos.y, r: 30, value: [0.22, 0, 0], mode: 'add', t });
        for (const p of e.plates)
          if (p.cracked && !this.chiselled.has(p)) {
            this.chiselled.add(p);
            d.stamp({ map: 'stain', brush: 'splat', x: p.pos.x, y: p.pos.y, r: 28, value: [0.85, 0, 0], mode: 'erase', t, seed: this.presRng.next() });
          }
      } else if (e instanceof FrostPatch) {
        // Rime grows out from the centre over FROST_GROW_S in dendritic splats (ENG-0262)…
        const rec = this.rimed.get(e) ?? { thaw: e.thaw, grown: 0 };
        if (!this.rimed.has(e)) this.rimed.set(e, rec);
        if (e.alive && rec.grown < 1) {
          rec.grown = Math.min(1, rec.grown + 0.1 / FROST_GROW_S);
          d.stamp({ map: 'stain', brush: 'splat', x: e.pos.x, y: e.pos.y, r: e.radius * (0.35 + 0.8 * rec.grown), rot: rec.grown * 5, value: [0, 0.3, 0], mode: 'add', t, seed: this.presRng.next() });
        }
        // …and each touch of the Brand lifts some of it, leaving meltwater behind.
        if (e.thaw > rec.thaw || !e.alive) {
          const lift = e.alive ? Math.min(1, (e.thaw - rec.thaw) / Math.max(0.05, 1 - rec.thaw)) : 1;
          rec.thaw = e.thaw;
          d.stamp({ map: 'stain', brush: 'soft', x: e.pos.x, y: e.pos.y, r: e.radius * 1.25, value: [0, lift, 0], mode: 'erase', t });
          d.stamp({ map: 'stain', brush: 'soft', x: e.pos.x, y: e.pos.y, r: e.radius * 1.2, value: [0, 0, 0], mode: 'add', t });
        }
      } else if (e instanceof Gangrene && e.alive) {
        const f = e.frontPos;
        const ang = Math.atan2(f.y - e.tip.y, f.x - e.tip.x);
        if (!e.debrided) d.stamp({ map: 'stain', brush: 'streak', x: (e.tip.x + f.x) / 2, y: (e.tip.y + f.y) / 2, r: Math.max(12, Math.hypot(f.x - e.tip.x, f.y - e.tip.y) / 2), rot: ang, value: [0, 0, 0.12], mode: 'add', t });
        else d.stamp({ map: 'stain', brush: 'soft', x: (e.tip.x + f.x) / 2, y: (e.tip.y + f.y) / 2, r: Math.max(20, Math.hypot(f.x - e.tip.x, f.y - e.tip.y) / 2 + 14), value: [0, 0, 0.12], mode: 'erase', t });
      }
    }
  }

  private slot(i: number) {
    return traySlot(i);
  }

  render(g: Gfx, game: Game, alpha = 1): void {
    const op = this.op;
    presentation.creatureFilter = settings.creatureFilter;
    op.calloutPace = localeInfo(getLocale())?.reading ?? 1;
    presentation.gore = GORE_LEVEL[settings.goreLevel];
    presentation.flash = flashScale(settings);
    presentation.pulse = settings.reduceMotion ? 0 : this.pulse;
    const pal = organPalette(op.def);
    const t = g.time;
    const sk = settings.reduceMotion ? 0 : op.shake * settings.shake;
    const sway = op.sway();
    // Trauma shake (ENG-0051): deterministic smooth noise in the post pass; the patient's sway stays as an offset.
    // A BAD lancet stroke adds a 40 ms micro-shake (GAM-0026).
    const micro = this.blade.shakeOffset(settings.reduceMotion ? 0 : settings.shake);
    const shake = { x: sway.x + micro.x, y: sway.y + micro.y };
    const trauma = sk > 0 ? Math.min(1, sk / 12) : undefined;

    // ---------------------------------------------------------------- data layers
    // Entities layer order (ENG-0042): by layer, then spawn order.
    const ents = drawOrder(op.visibleEntities());
    this.decals ??= new DecalMaps(g, g.shaderQuality);
    this.decals.setQuality(g.shaderQuality);
    this.decals.flush();
    // Blood seeps and dries, hexfire creeps: the 10 Hz map update (ENG-0119), on world time.
    this.decals.update(op.elapsed);
    const light = { x: FIELD.cx - 220 + Math.sin(t * 0.7) * 30, y: 60 + Math.sin(t * 1.3) * 10 };
    // Tissue breathing and heartbeat (ART-0298): the flesh, its wounds, fluids and ailments share one warp.
    const warp = tissueWarp(pal.kind, this.pulse, t, settings.reduceMotion);
    // The world camera (ENG-0045; multi-organ views GAM-0247) applies to every world layer from here on.
    g.setCamera(this.camera.isIdentity ? null : this.camera.matrix());
    g.beginLayer('surface');
    pushWarp(g, FIELD.cx, FIELD.cy, warp);
    for (const sc of op.scars) {
      surfLine(g, sc, 7, 0.18, 0.15, 0, 0.1);
      surfLine(g, sc, 12, 0, 0, 0, 0.2);
    }
    for (const st of op.stains) surfDisc(g, st, st.r, 0, st.a);
    for (const e of ents) e.drawSurface(g, op);
    // Parasites under the skin raise travelling bulges (ENG-0265).
    for (const b of underSkinBulges(op.entities, op.elapsed)) surfDisc(g, b, b.r, 0, 0, 0, b.h);
    if (game.input.down && onBody(game.input.pos)) surfDisc(g, game.input.pos, 16, 0.28);
    g.restore();
    g.endLayer();
    g.beginLayer('fluid');
    pushWarp(g, FIELD.cx, FIELD.cy, warp);
    for (const e of ents) e.drawFluid(g, op);
    this.particles.drawFluid(g);
    g.restore();
    g.endLayer();

    // ---------------------------------------------------------------- world
    g.beginWorld();
    const pallor = anaemia(op);
    const curse = curseSource(op.entities);
    const venue = op.def.venue ?? 'hospice';
    // The flesh pass works in view space: map the field through the camera (GAM-0247 region views).
    const cam = this.camera.isIdentity ? null : this.camera;
    const vc = (p: { x: number; y: number }) => (cam ? cam.toView(p, { x: 0, y: 0 }) : p);
    const fz = cam ? cam.zoom : 1;
    g.fleshField({
      center: vc({ x: FIELD.cx, y: FIELD.cy }),
      radii: { x: FIELD.rx * fz, y: FIELD.ry * fz },
      kind: pal.kind,
      // Anaemia (GAM-0119): the flesh pales and dulls as blood volume drains.
      base: paleFlesh(pal.base, pallor),
      deep: paleFlesh(pal.deep, pallor * 0.8),
      vein: pal.vein,
      // The dead have no pulse (ENG-0274).
      pulse: venue === 'forensic' ? 0 : this.pulse,
      venue: VENUE_ID[venue],
      fiber: op.def.fiber,
      fever: fever(op),
      maps: this.surfaceMaps(g, op.def.race ?? 'human', venue),
      warp,
      light: vc(light),
      corrupt: this.fleshCurse,
      corruptAt: curse ? vc(curse.at) : undefined,
      curseMap: this.decals.curseSampler(),
      curse: curse?.look,
      cellSoft: pal.cellSoft,
      rough: paleRough(pal.rough, pallor),
      gore: presentation.gore,
      species: pal.species,
      lights: venueLights(venue, light, FIELD, t, g.displayPrefs.flicker).map((l) => ({ ...l, ...vc(l) })),
    });
    const colours = palette();
    this.decals.drawScorch(t);
    this.decals.drawStain(op.elapsed);
    // While Vespers burns, the blood on the field runs to tallow (ART-0174).
    const tallow = op.entities.some((e) => e.alive && e instanceof VespersMalison) ? 0.75 : 0;
    const blood = tallowBlood(speciesBlood(colours.blood, pal.species), tallow);
    this.decals.drawBlood(op.elapsed, { fresh: vec3(blood), light: { x: (light.x - FIELD.cx) / FIELD.rx, y: -(light.y - FIELD.cy) / FIELD.ry } });
    g.fluidComposite(light, { blood, pus: colours.pus, bile: colours.bile, gore: presentation.gore });
    // Entities, particles and world FX go through the world camera (ENG-0045); endWorld resets it.
    g.setCamera(this.camera.isIdentity ? null : this.camera.matrix());
    this.drawGloss(g, op);
    this.film.draw(g, op.entities, op.elapsed);
    this.runes.draw(g, op.entities, op.elapsed, settings.reduceFlashing);
    this.closures.draw(g, op.elapsed, bloodOf(op.def.race, '#5a0a10'));
    this.tray.update(op.entities, op.elapsed);
    this.tray.draw(g, op.elapsed, { tray: op.def.tools.includes('tongs'), lead: op.entities.some((e) => e instanceof Embedded && e.kind === 'hexstone') });
    // Closed wounds: the sutured scar (ART-0188) over the carved channel; it also appears on the results card.
    for (const sc of op.scars) scarArt(g, sc, 4, 0, presentation.gore === 2 ? 0.5 : 1);
    pushWarp(g, FIELD.cx, FIELD.cy, warp);
    // Between ticks, entities are drawn where they are in between (ENG-0054).
    // Claw rakes read as one blow (ART-0187): a shared torn band under each group of parallel claw cuts.
    const claws = ents.filter((e): e is Laceration => e instanceof Laceration && e.source === 'claw');
    for (const grp of rakeGroups(claws)) clawRakeArt(g, grp, 0, grp[0].id);
    drawInterpolated(ents, settings.reduceMotion ? 1 : alpha, (e) => e.draw(g, op));
    // High contrast: a 2 px ring around everything that takes an instrument.
    if (highContrast()) for (const e of ents) if (e.required) g.arc(e.pos.x, e.pos.y, 28, 2, hex('#ffffff', 0.85), 1);
    // Tongs in hand: outline the graspable the next press would seize (INP-0042).
    if (!this.paused) drawGraspOutline(g, op, this.ctl.toWorld(game.input.pos), bindings.prefs.hitScale, t);
    this.vanish.update(op.entities, op.elapsed);
    this.vanish.draw(g, op.elapsed);
    this.particles.draw(g);
    this.blade.draw(g);
    g.restore();
    this.artVfx.drawWorld(g, op, game.input.pos);

    // Scrying lens: shimmer where something hides.
    if (op.tool === 'lens') {
      g.glow(game.input.pos.x, game.input.pos.y, 90, hex('#8ab8ff', 0.12));
      for (const e of op.entities) {
        if (!e.alive || !e.hidden || dist(e.pos, game.input.pos) > 110) continue;
        g.arc(e.pos.x, e.pos.y, 16 + Math.sin(t * 6) * 4, 2, hex('#b9d7ff', 0.6));
      }
      // Forensic slab (ENG-0274): under the lens the evidence fluoresces a cold teal over everything unresolved.
      if (op.def.venue === 'forensic') {
        g.setBlend('add');
        g.glow(game.input.pos.x, game.input.pos.y, 95, hex('#3fc8b8', 0.14));
        for (const e of op.entities) {
          if (!e.alive || !e.required || dist(e.pos, game.input.pos) > 110) continue;
          g.glow(e.pos.x, e.pos.y, 34, hex('#a8f0e4', 0.5 + 0.2 * Math.sin(t * 4)));
        }
        g.setBlend('alpha');
      }
    }

    this.artVfx.drawLiveTrail(g, this.ctl.starTrail, g.time);

    const soften = flashScale(settings);
    const danger = (op.status === 'running' ? Math.max(0, (35 - op.vitals) / 35) : op.status === 'lost' ? 1 : 0) * soften;
    const litany = op.litanyTime > 0 ? Math.min(1, op.litanyTime, (LITANY_DURATION - op.litanyTime) * 3) * soften : 0;
    const ch2 = op.def.id.startsWith('op2');
    const inverted = this.compline.invertedLitany();
    g.endWorld({
      trauma,
      // Candle-light (CON-0121): the light is a hand-held candle, and follows the cursor.
      spot: op.env.has('candle')
        ? { cx: game.input.pos.x, cy: game.input.pos.y, rx: 230, ry: 210, k: 0.93 }
        : { cx: FIELD.cx, cy: FIELD.cy, rx: FIELD.rx, ry: FIELD.ry, k: 0.62 + 0.25 * soften * (op.entities.find((e): e is Malison => e instanceof Malison && e.alive)?.watching(op.elapsed) ?? 0) },
      litany: inverted ? Math.max(litany, inverted[0] * soften) : litany,
      danger,
      silence: this.compline.silence,
      shake,
      // Bloom preset (ENG-0149): the Malison fights glow harder than ordinary cases.
      bloom: this.corrupt > 0.5 ? 'malison' : 'operation',
      chroma: (this.corrupt * 1.2 + danger * 0.8 + Math.min(1, op.shake / 10) * 0.6) * soften,
      // Per-location grade (ENG-0153): the op's own, else its venue's, else the chapter's.
      lutA: op.def.grade ?? (op.def.venue === 'field' ? 'night' : op.def.venue === 'forensic' ? 'street' : ch2 ? 'dawn' : 'candle'),
      lutB: danger > 0.5 ? 'failing' : 'curse',
      lutMix: Math.max(this.corrupt * 0.8, danger > 0.5 ? (danger - 0.5) * 1.2 : 0),
      beat: this.pulse,
      curse: this.corrupt * 0.9 * soften,
      outcome: [op.status === 'lost' ? Math.min(1, this.endT / 2) : 0, Math.max(op.status === 'won' ? Math.min(1, this.endT / 1.2) : 0, this.compline.restore * 0.8)],
      litanyCenter: this.ctl.litanyCenter,
      lens: op.tool === 'lens' ? [game.input.pos.x, game.input.pos.y, 95, 1] : undefined,
      refract: this.hexRefraction(),
      shimmer: settings.reduceMotion ? [] : this.heatShimmer(),
      litanyAge: inverted ? inverted[1] : op.litanyTime > 0 ? LITANY_DURATION - op.litanyTime : 10,
      hurt: (() => {
        const age = op.elapsed - op.lastHurt.at;
        const k = this.flashLimit.filter(Math.max(0, 1 - age / 0.45) * Math.min(1, op.lastHurt.amount / 6) * soften, 1 / 60);
        return [op.lastHurt.x - VIEW_W / 2, -(op.lastHurt.y - 360), k] as [number, number, number];
      })(),
      tint: coldTint(ch2 ? [0.95, 0.98, 1.05] : [1.03, 0.99, 0.94], this.frost),
      lift: ch2 ? [0.0, 0.004, 0.012] : [0.012, 0.004, 0.0],
    });

    // Field snapshot (ENG-0122): the finished field, for the results screen and the slot thumbnail.
    if (!this.snapped && (op.status === 'won' || op.status === 'lost') && this.endT > 0.9) {
      this.snapped = true;
      g.snapshotWorld();
    }

    // ---------------------------------------------------------------- UI
    // Field triage (ENG-0272): rain streaks down the view and grime gathers at its edges.
    if (op.def.venue === 'field') {
      drawGrime(g, VIEW_W, 720, 3);
      drawRain(g, t, 1, VIEW_W, 720, settings.reduceMotion);
    }
    this.artVfx.drawScreen(g, op, viewRect(), { x: 16, y: 14 + anchorShift('top'), w: 316, h: 86 });
    drawFieldOverlays(g, op);
    // Brand smoke hangs over the field for a moment after heavy searing (GAM-0051).
    if (this.smoke.veil > 0.01) g.glow(op.cursor.x, op.cursor.y - 30, 260, hex('#9a9088', this.smoke.veil * 0.45));
    if (!settings.minimalHud) this.drawThreatRings(g);
    this.drawObserver(g, t);
    drawTutorial(g, op);
    // WorldUI (ENG-0044): popups and hurt rings after post, through the world camera.
    g.setCamera(this.camera.isIdentity ? null : this.camera.matrix());
    this.drawPopups(g);
    g.setCamera(null);
    // HUD bars anchor to the visible top/bottom edges on 16:10 and 4:3 (ENG-0184).
    g.save();
    g.translate(0, anchorShift('top'));
    drawBreathFog(g, this.frost, t, viewRect(), settings.reduceMotion);
    this.drawEdgeArrows(g);
    this.drawHud(g);
    g.restore();
    this.drawTray(g);
    this.drawPauseButton(g);
    g.save();
    g.translate(0, anchorShift('bottom'));
    this.drawCallout(g, t);
    // A trial's rules, as seals in the corner under the vitals (UIX-0187).
    let sx = 20;
    for (const seal of op.opts.seals ?? []) {
      if (sx > 420) break;
      sx += drawSeal(g, sx, 120, seal) + 6;
    }
    g.restore();
    drawTrayState(g, op, (i) => this.slot(i), game.input);
    if (this.debug) drawDebug(g, op);
    if (drawLitanyPractice(g, op, game.input)) op.skipPractice();
    drawDialogue(g, op, game.input);

    // Title cards: a dark band across the field with a tracked Cinzel title and a lozenge rule.
    const card = (title: string, sub: string | null, a: number, top: string, bottom: string) => {
      const vr = viewRect();
      band(g, 296, 128, a, vr.x, vr.w);
      g.text(title.toUpperCase(), VIEW_W / 2, 356, { size: 46, font: 'display', color: hex(top, a), color2: hex(bottom, a), align: 'center', tracking: 0.14, shadow: hex('#000000', 0.9 * a), soft: true });
      titleRule(g, VIEW_W / 2, 374, 460, a);
      if (sub) g.text(sub, VIEW_W / 2, 404, { size: 21, font: 'italic', color: hex(INK.text, a), align: 'center', shadow: hex('#000000', 0.9 * a), soft: true });
    };
    if (op.status === 'intro') {
      const ia = Math.min(1, op.elapsed * 3);
      card(op.def.title, op.def.patient, ia, INK.goldHi, INK.gold);
      // Time allowed and the first instrument, with a skip hint (UIX-0069).
      numerals(g, formatClock(op.def.timeLimit), VIEW_W / 2 - 40, 440, 20, '#ffffff', '#d8ccb4', 'right', ia);
      toolIcon(g, op.def.tools[0], VIEW_W / 2 + 10, 434, 0.5, t);
      caps(g, tr('hud.intro.skip'), VIEW_W / 2, 470, 11, hex(INK.dim, ia), 'center');
    }
    // Win: the card rises and a wax seal presses at 0.6 s; loss: the band bleeds in as ink spreads (UIX-0070).
    if (op.status === 'won') {
      const k = Math.min(1, this.endT / 0.5);
      card(tr('hud.op_complete'), null, k, INK.goldHi, INK.gold);
      const sk = Math.max(0, Math.min(1, (this.endT - 0.6) / 0.25));
      if (sk > 0) {
        const sr = 30 * (settings.reduceMotion ? 1 : 1.5 - 0.5 * sk);
        waxSeal(g, VIEW_W / 2 + 300, 350, sr, RANK_WAX[op.rank()]);
        g.text(op.rank(), VIEW_W / 2 + 300, 362, { size: op.rank() === 'XS' ? 24 : 30, font: 'display', color: hex('#ffe8c0', sk), color2: hex('#f0b070', sk), align: 'center', shadow: hex('#2a0204', 0.8) });
      }
    }
    if (op.status === 'lost') {
      const k = Math.min(1, this.endT / 0.9);
      const vr2 = viewRect();
      // Ink spreading from the centre of the band.
      for (let i = 0; i < 6; i++) g.circle(VIEW_W / 2 + (i - 2.5) * 90, 356 + Math.sin(i * 2.1) * 20, (30 + i * 8) * k, hex('#1a0406', 0.35 * k));
      g.rect(vr2.x, 296, vr2.w, 128, hex('#2a0608', 0.25 * k));
      // Ink floods in from the edges until a Dance-of-Death skeleton stands in it (ART-0292).
      inkFlood(g, vr2, this.endT, settings.reduceMotion);
      card(tr('hud.patient_lost'), tSource(op.lostReason), k, '#ffb0a8', '#c0282c');
    }

    if (this.paused && !game.push) this.drawPause(g, game);
    if (this.resumeT > 0) {
      const n = Math.ceil(this.resumeT);
      const f = this.resumeT - Math.floor(this.resumeT);
      giltText(g, formatNumber(n), VIEW_W / 2, 400, { size: 120 * (0.85 + 0.15 * f), align: 'center' });
    }
    this.ctl.draw(g, op, this.paused);

    // Cursor: reticle at the tip with the instrument beside it.
    const p = game.input.pos;
    this.hoverPos = p;
    if (op.tool === 'tincture' && op.injectT > 0) g.arc(p.x, p.y, 18, 3, hex(PALETTE.good), op.injectT / TINCTURE_TIME);
    this.drawHoldRing(g, p);
    drawTorpor(g, op, p, viewRect());
    // In use on the field, the instrument itself is drawn with its tip on the pointer (ART-0269/0270); otherwise its icon rides beside.
    const working = game.input.down && op.status === 'running' && !this.paused && onBody(this.ctl.toWorld(p));
    if (op.tool === 'thread' && working) {
      this.threadTrail.push({ x: p.x, y: p.y });
      if (this.threadTrail.length > 24) this.threadTrail.shift();
    } else this.threadTrail.length = 0;
    if (working) drawFieldTool(g, op.tool, p, { closed: !!op.held, heat: Math.min(1, 0.45 + op.brandHeat / 3), trail: this.threadTrail, tint: TINCTURE_HEX[op.tinctureColor] }, t);
    else toolIcon(g, op.tool, p.x + 20, p.y - 20, 0.8 + this.toolFlash * 0.3, t);
    if (this.debug) drawTipDebug(g, op.tool, p);
    if (op.tool === 'tongs' && !working) drawTongsJaws(g, p, op.held !== null);
    const aim = op.status === 'running' && !this.paused ? cursorTarget(op, p) : { kind: 'none' as const };
    const cpal = palette();
    const tint = aim.kind === 'valid' ? '#9fe0a8' : aim.kind === 'needs' ? '#ff9a6a' : cursorTint(op, p);
    reticle(g, p, settings.colorFilter === 'none' ? tint : tint === '#9fe0a8' ? cpal.validTarget : tint === '#ff5a4a' ? cpal.wrongTarget : tint);
    // Shape as well as colour (UIX-0054/0147): a ring round a valid target, a cross and the instrument it needs otherwise.
    const cs = settings.cursorSize;
    if (aim.kind === 'valid') {
      g.arc(p.x, p.y, 21 * cs, 3.5, hex('#000000', 0.6));
      g.arc(p.x, p.y, 21 * cs, 1.8, hex(settings.colorFilter === 'none' ? '#9fe0a8' : cpal.validTarget, 0.95));
    } else if (aim.kind === 'needs') {
      const d = 7 * cs;
      for (const [w, c] of [[4, hex('#000000', 0.6)], [2, hex('#ffb08a', 0.95)]] as const) {
        g.line({ x: p.x + 16 * cs - d, y: p.y + 16 * cs - d }, { x: p.x + 16 * cs + d, y: p.y + 16 * cs + d }, w, c);
        g.line({ x: p.x + 16 * cs + d, y: p.y + 16 * cs - d }, { x: p.x + 16 * cs - d, y: p.y + 16 * cs + d }, w, c);
      }
      toolIcon(g, aim.tool, p.x - 30, p.y + 30, 0.55, t, 'disabled');
      caps(g, tr('hud.needs', { tool: tr(`tool.${aim.tool}.name`) }), p.x - 8, p.y + 52, 12, hex('#ffd8c0', 0.95));
    }
    // Precision modifier held (INP-0067): a fine ring round the reticle. Hold-to-retry (INP-0113): a ring that fills.
    if (game.input.act('op.precision')) g.arc(p.x, p.y, 26 * cs, 1.2, hex(INK.goldHi, 0.8));
    this.retry.draw(g, p);
    g.endFrame();
  }

  /** New popups stack above recent neighbours instead of printing over them (UIX-0047). */
  private addPopup(p: Popup & { lift?: number }): void {
    stackPopup(this.popups, p);
    this.popups.push(p);
  }

  private tickCalloutGhost(dt: number, hand: { x: number; y: number }): void {
    const r = this.calloutRect;
    const under = (p: { x: number; y: number }, pad: number) => !!r && p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
    const covered = !!r && (under(hand, 24) || this.op.entities.some((e) => e.alive && !e.hidden && e.required && under(e.pos, 20)));
    this.calloutGhost = Math.max(0, Math.min(1, this.calloutGhost + (covered ? dt * 6 : -dt * 3)));
  }

  private tickVitalsFeedback(dt: number): void {
    const v = this.op.vitals;
    if (v > this.prevV + 0.5) {
      // A heal: sweep green from where it was.
      if (this.healT <= 0) this.healFrom = this.prevV;
      this.healT = 0.8;
    }
    this.prevV = v;
    this.healT = Math.max(0, this.healT - dt);
    this.digitShakeT = Math.max(0, this.digitShakeT - dt);
    if (v >= this.lagV) this.lagV = v;
    else if (this.lagHold > 0) this.lagHold -= dt;
    else this.lagV = Math.max(v, this.lagV - dt * 45);
  }

  private drawHud(g: Gfx): void {
    const op = this.op;
    const t = g.time;
    const pal = palette();
    const vcol = op.vitals > 60 ? pal.vitalsGood : op.vitals > 30 ? pal.vitalsWarn : pal.vitalsDanger;
    const plateK = pal.plate > 0 ? 1.15 : 1;

    // ---- Vitals: label, big numeral, pulse trace in a recessed window, and a blood meter.
    const V = { ...HUD_VITALS };
    glass(g, V, { strength: plateK });
    caps(g, tr('hud.vitals'), V.x + 34, V.y + 22, 11);
    heartIcon(g, V.x + 22, V.y + 18, 7, op.status === 'lost' ? 'dead' : op.vitals > 60 ? 'good' : op.vitals > 30 ? 'warn' : 'danger', settings.reduceMotion ? 1 : this.beatPhase % 1);
    if (op.vitals <= 30) this.lowLatch = true;
    else if (op.vitals >= 35) this.lowLatch = false;
    const low = this.lowLatch;
    const beat = settings.reduceMotion ? 0 : this.pulse;
    const jig = this.digitShakeT > 0 && !settings.reduceMotion ? 2 * Math.sin(g.time * 90) : 0;
    g.text(formatVitals(op.displayVitals()), V.x + 16 + jig, V.y + 64 + jig * 0.5, { size: 42, font: 'display', color: hex('#ffffff'), color2: hex(vcol), tracking: 0.04, shadow: hex('#000000', 0.85), soft: true });
    drawDrainArrow(g, op, V.x + 96, V.y + 38);
    // Pulse window: a phosphor trace in a dark well.
    const W = { x: V.x + 118, y: V.y + 14, w: V.w - 132, h: 46 };
    well(g, W);
    g.pushClip(W);
    for (let i = 1; i < 6; i++) g.rect(W.x + (W.w * i) / 6, W.y + 2, 1, W.h - 4, hex('#c9a55c', 0.07));
    g.rect(W.x + 2, W.y + W.h * 0.62, W.w - 4, 1, hex('#c9a55c', 0.08));
    const pts = this.ecg.map((v, i) => ({ x: W.x + 3 + (i / Math.max(1, this.ecg.length - 1)) * (W.w - 6), y: W.y + W.h * 0.62 - v * W.h * 0.5 }));
    const tcol = low ? '#ff5a4a' : '#ff8a6a';
    g.polyline(pts, 5, hex(tcol, 0.12));
    g.polyline(pts, 2.4, hex(tcol, 0.35));
    g.polyline(pts, 1.2, hex('#ffe0d0', 0.95));
    const head = pts[pts.length - 1];
    if (head) g.glow(head.x, head.y, 10, hex('#ff6a4a', 0.5));
    g.popClip();
    const M = { x: V.x + 18, y: V.y + V.h - 16, w: V.w - 32, h: 6 };
    meter(g, M, op.vitals / op.maxVitals, low ? '#ff4a3a' : '#e0443c', low ? '#7a0c10' : '#8a1016', 10);
    const px = (f: number) => M.x + 1 + (M.w - 2) * Math.max(0, Math.min(1, f / op.maxVitals));
    // The pale lag bar: what was just lost, draining away after half a second.
    if (this.lagV > op.vitals + 0.3) g.rect(px(op.vitals), M.y + 1, px(this.lagV) - px(op.vitals), M.h - 2, hex('#f4dcc8', 0.75));
    // A heal sweeps green across what came back.
    if (this.healT > 0 && op.vitals > this.healFrom) {
      const a = Math.min(1, this.healT / 0.4);
      g.rect(px(this.healFrom), M.y - 1, px(op.vitals) - px(this.healFrom), M.h + 2, hex('#8fe0a0', 0.55 * a));
      g.glow(px(op.vitals), M.y + M.h / 2, 14, hex('#9ff0b0', 0.5 * a));
    }
    if (low) g.plate(V.x, V.y, V.w, V.h, { radius: 3, top: hex('#000000', 0), border: hex('#ff3a2a', 0.35 + 0.35 * beat), borderW: 1.5, bevel: 0, shadow: [0, 0, 0], glow: hex('#ff2a1a', 0.25 + 0.3 * beat), glowR: 14 });
    drawSecondaryVitals(g, op, V.x + 18, V.y + V.h + 22);

    // ---- Operation title, the clock, and phase lozenges: a chamfered plate at top centre.
    const T = { ...HUD_TIMER };
    glass(g, T, { chamfer: true, radius: 12, strength: plateK });
    caps(g, op.def.title, VIEW_W / 2, T.y + 22, 11, hex(INK.dim), 'center');
    const lowT = op.timeLeft < op.tuning.flow.timerWarn && op.status === 'running';
    const flash = lowT && Math.sin(t * 8) > 0;
    const [ct, cb] = op.litanyTime > 0 ? [INK.goldHi, INK.gold] : lowT ? (flash ? ['#ffd0c0', '#ff4a3a'] : ['#ff9a8a', '#a0201a']) : ['#ffffff', '#d8ccb4'];
    numerals(g, formatClock(op.timeLeft), VIEW_W / 2, T.y + 58, 30, ct, cb, 'center');
    // Sand-time as a thin meter along the plate's foot.
    const tf = op.timeLeft / op.def.timeLimit;
    g.rect(T.x + 22, T.y + T.h - 7, (T.w - 44) * tf, 1.5, hex(lowT ? '#ff5a4a' : INK.gilt, 0.8));
    this.drawBanner(g);
    this.uiFx.draw(g, 'UI');
    // Minimal HUD (UIX-0071): vitals, timer, tray and Litany only.
    if (settings.minimalHud) return;
    // Phase seals (UIX-0045): pressed once done, lit while current; hovering names the phase's objective.
    let tipPhase = -1;
    for (let i = 0; i < op.phaseCount; i++) {
      const bx = VIEW_W / 2 - ((op.phaseCount - 1) * 22) / 2 + i * 22;
      const by = T.y + T.h + 13;
      phaseSeal(g, bx, by, i === op.phase ? 6 : 5, i < op.phase ? 'done' : i === op.phase ? 'current' : 'todo', t);
      if (Math.abs(this.hoverPos.x - bx) < 11 && Math.abs(this.hoverPos.y - by) < 11) tipPhase = i;
    }
    if (tipPhase >= 0) {
      const obj = op.def.phases[tipPhase]?.objective;
      const lbl = tr('hud.banner.phase', { n: roman(tipPhase + 1) });
      const body = tipPhase > op.phase ? tr('hud.phase.sealed') : obj ? tSource(obj) : lbl;
      const bw = Math.min(360, g.measure(body, 16, 'body') + 32);
      const bx = VIEW_W / 2 - bw / 2;
      const by = T.y + T.h + 30;
      glass(g, { x: bx, y: by, w: bw, h: 44 });
      caps(g, lbl, bx + 16, by + 16, 10, hex(INK.gold));
      g.text(body, bx + 16, by + 34, { size: 16, color: hex(INK.text), shadow: false });
    }
    drawBossHud(g, op);
    if (this.ta) this.drawTimeAttack(g);
    if (op.vitals2 !== null) this.drawSecondPatient(g);

    // ---- Score, patient and chain: right.
    const S = { ...HUD_SCORE };
    glass(g, S, { strength: plateK });
    caps(g, tr('hud.score'), S.x + S.w - 18, S.y + 22, 11, hex(INK.dim), 'right');
    // A long patient name is cut with an ellipsis before it reaches the SCORE label (never shrunk below 16 px).
    const nameRoom = S.w - 36 - g.measure(tr('hud.score').toUpperCase(), 11, 'display', 0.2) - 14;
    let patient = op.def.patient;
    while (patient.length > 4 && g.measure(patient, 16, 'italic') > nameRoom) patient = patient.slice(0, -2).trimEnd() + '…';
    g.text(patient, S.x + 18, S.y + 24, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
    const rolling = Math.abs(op.score - this.shownScore) >= 1;
    numerals(g, formatNumber(Math.round(this.shownScore)), S.x + S.w - 18, S.y + 58, 30, rolling ? '#ffffff' : INK.goldHi, INK.gold, 'right');
    if (op.combo > 1) {
      const pop = 1 + Math.max(0, 0.3 - (this.comboT ?? 0)) * 1.2;
      // Combo tiers (UIX-0044): brass ×2–4, gold ×5–9, gilt and glowing ×10–19, blazing ×20+.
      const tier = op.combo >= 20 ? 3 : op.combo >= 10 ? 2 : op.combo >= 5 ? 1 : 0;
      const pulse = settings.reduceMotion ? 0 : 0.5 + 0.5 * Math.sin(t * (tier === 3 ? 9 : 4));
      const [ct, cb] = [
        ['#e8d0a8', '#a08050'],
        [INK.goldHi, INK.gold],
        ['#fff4d0', INK.goldHi],
        ['#ffffff', '#ffd070'],
      ][tier];
      const C = { x: S.x + S.w - 128, y: S.y + S.h + 10, w: 128, h: 34 };
      glass(g, C, { glow: tier >= 2 ? hex(tier === 3 ? '#ffb040' : INK.gold, 0.25 + 0.2 * pulse) : tier === 1 ? hex(INK.gold, 0.18) : undefined, glowR: 12 + tier * 4, border: tier >= 2 ? hex(INK.goldHi, 0.9) : undefined });
      caps(g, tr(tier === 3 ? 'hud.chain.blazing' : tier === 2 ? 'hud.chain.gilt' : 'hud.chain'), C.x + 14, C.y + 22, 10, hex(tier >= 2 ? INK.gold : INK.dim));
      numerals(g, `×${op.combo}`, C.x + C.w - 14, C.y + 25, 22 * Math.min(1.25, pop), ct, cb, 'right');
    }
    // Combo milestone banner (UIX-0048): a short gilt band under the clock.
    if (this.milestone && !settings.minimalHud) {
      const m = this.milestone;
      const a = Math.min(1, m.t * 4) * Math.max(0, Math.min(1, (2.2 - m.t) / 0.4));
      const label = tr('hud.chain.milestone', { combo: m.combo });
      const w = g.measure(label.toUpperCase(), 14, 'display', 0.2) + 60;
      const y = T.y + T.h + 42;
      band(g, y - 14, 30, a * 0.8, VIEW_W / 2 - w / 2, w);
      g.text(label.toUpperCase(), VIEW_W / 2, y + 5, { size: 14, font: 'display', color: hex('#fff4d0', a), color2: hex(INK.gold, a), align: 'center', tracking: 0.2, shadow: hex('#000000', 0.9 * a), soft: true });
    }
  }

  private drawBanner(g: Gfx): void {
    const b = this.banner;
    if (!b) return;
    const objective = this.op.def.phases[b.phase]?.objective;
    // The objective stays as a small line under the phase lozenges for the rest of the phase.
    if (objective && b.t > 2 && !settings.minimalHud) g.text(tSource(objective), VIEW_W / 2, 124, { size: 16, font: 'italic', color: hex(INK.text, 0.85), align: 'center', shadow: hex('#000000', 0.9), soft: true });
    const hold = b.boss ? 3 : 2;
    if (b.t > hold || (b.phase === 0 && !b.boss && !objective)) return;
    const still = settings.reduceMotion;
    const inK = still ? 1 : Math.min(1, b.t / 0.35);
    const a = (b.t < hold - 0.3 ? 1 : Math.max(0, 1 - (b.t - (hold - 0.3)) / 0.3)) * inK;
    if (b.boss && b.t > hold - 0.1) OperationScene.markMalisonCard();
    const ease = 1 - (1 - inK) ** 3;
    const vr = viewRect();
    const title = b.boss ? tr('hud.banner.malison') : tr('hud.banner.phase', { n: roman(b.phase + 1) });
    const y = 196;
    band(g, y - 44, 96, a, vr.x, vr.w);
    const spread = 0.12 + 0.1 * ease;
    g.text(title.toUpperCase(), VIEW_W / 2, y + 6, { size: 38, font: 'display', color: hex(b.boss ? '#f0dcff' : INK.goldHi, a), color2: hex(b.boss ? INK.curse : INK.gold, a), align: 'center', tracking: spread, shadow: hex('#000000', 0.9 * a), soft: true });
    titleRule(g, VIEW_W / 2, y + 20, 420 * (0.6 + 0.4 * ease), a);
    if (b.boss) {
      const hour = BOSS_OPS[this.op.def.id];
      const sub = hour ? tr(`codex.${hour}.title`) : null;
      g.glow(VIEW_W / 2, y - 6, 220 * ease, hex(INK.curse, 0.18 * a));
      if (sub) g.text(sub, VIEW_W / 2, y + 44, { size: 19, font: 'italic', color: hex('#e0c8ff', a), align: 'center', shadow: hex('#000000', 0.9 * a), soft: true });
      // The Hour's Book-of-Hours card rises beside the banner (ART-0234…0259): its intro splash.
      if (hour && hour !== 'office') {
        const cw = 200;
        const ch = 300;
        // Slides in from the margin and back out as the banner fades (the batcher has no global alpha).
        // Right margin, clear of the instrument tray on the left.
        const cx = vr.x + vr.w - 60 - cw + (1 - Math.min(ease, a)) * (cw + 80);
        if (cx < vr.x + vr.w) hourCard(g, { x: cx, y: 250, w: cw, h: ch }, hour, sub ?? hour, g.time);
      }
      if (OperationScene.malisonCardSeen()) caps(g, tr('hud.intro.skip'), VIEW_W / 2, y + 70, 10, hex(INK.dim, a), 'center');
    } else if (objective) g.text(tSource(objective), VIEW_W / 2, y + 44, { size: 19, font: 'italic', color: hex(INK.text, a), align: 'center', shadow: hex('#000000', 0.9 * a), soft: true });
  }

  /** Threat timers (UIX-0062): a ring closes round anything ripening toward a burst or a hatch. */
  private drawThreatRings(g: Gfx): void {
    const op = this.op;
    for (const e of op.entities) {
      if (!e.alive || e.hidden) continue;
      let left = -1;
      let r = 0;
      if (e instanceof Bubo) {
        const tb = e.timeToBurst(op);
        if (Number.isFinite(tb)) {
          left = Math.max(0, Math.min(1, tb / op.tuning.bubo.swellTime));
          r = e.maxR + 10;
        }
      } else if (e instanceof EggSac) {
        left = e.hatchFrac;
        r = 34;
      }
      if (left < 0 || left > 0.85) continue;
      const urgent = left < 0.25;
      const c = urgent ? '#ff5a4a' : '#e0b060';
      const pulse = urgent && !settings.reduceMotion ? 0.6 + 0.4 * Math.sin(g.time * 10) : 0.85;
      g.arc(e.pos.x, e.pos.y, r, 1.2, hex('#000000', 0.5));
      g.arc(e.pos.x, e.pos.y, r, 2.2, hex(c, pulse), left);
    }
  }

  /** Hold rings at the cursor (UIX-0055): the brand's heat and the Lens's reveal, beside the tincture's dose. */
  private drawHoldRing(g: Gfx, p: { x: number; y: number }): void {
    const op = this.op;
    if (op.tool === 'brand' && op.holdingBrand && op.brandHeat > 0.05) {
      const f = op.brandHeat / op.tuning.brand.overheatAfter;
      g.arc(p.x, p.y, 18, 3, hex(f > 0.75 ? '#ff5a3a' : '#ffb060', 0.9), f);
    } else if (op.tool === 'lens') {
      let best = 0;
      for (const e of op.entities) if (e.alive && e.hidden && e.revealProgress > best && dist(e.pos, p) < 90) best = e.revealProgress;
      if (best > 0) g.arc(p.x, p.y, 18, 3, hex('#9fd3ff', 0.9), Math.min(1, best / op.tuning.lens.reveal));
    }
  }

  /** Star vertices found so far in the Litany stroke (UIX-0067), lit round the reliquary. */
  private starVertices(): number {
    const pts = this.ctl.starTrail;
    if (pts.length < 12) return 0;
    const w = 4;
    let corners = 0;
    let last = -10;
    for (let i = w; i < pts.length - w; i++) {
      const a = pts[i - w];
      const b = pts[i];
      const c = pts[i + w];
      const v1 = { x: b.x - a.x, y: b.y - a.y };
      const v2 = { x: c.x - b.x, y: c.y - b.y };
      const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
      if (cos < 0.1 && i - last > w + 1) {
        corners++;
        last = i;
      }
    }
    return Math.min(5, corners);
  }

  /** The tool slot under the pointer, or -1 (UIX-0051 hover tip). */
  private hoverSlot(): number {
    const n = this.op.def.tools.length;
    for (let i = 0; i < n; i++) if (inRect(this.hoverPos, this.slot(i))) return i;
    return -1;
  }

  /**
   * Time attack HUD (GAM-0217): under the timer plate, the live clear time with the split against
   * the personal best, and a small graph of this run's vitals over the best run's ghost trace.
   */
  private drawTimeAttack(g: Gfx): void {
    const ta = this.ta!;
    const op = this.op;
    const ghost = this.ghost;
    const r = { x: HUD_TIMER.x, y: HUD_TIMER.y + HUD_TIMER.h + 8, w: HUD_TIMER.w, h: 96 };
    glass(g, r);
    caps(g, tr('hud.timeattack'), r.x + 14, r.y + 18, 11, hex(INK.gold));
    g.text(formatSplit(ta.time), r.x + r.w - 14, r.y + 22, { size: 20, font: 'display', color: hex(INK.goldHi), align: 'right', shadow: false });
    if (ghost) {
      const d = ta.time - Math.min(ta.time, ghost.time);
      const ahead = ta.time <= ghost.time;
      const label = ahead ? tr('hud.timeattack.best', { t: formatSplit(ghost.time) }) : tr('hud.timeattack.behind', { t: `+${formatSplit(d)}` });
      g.text(label, r.x + 14, r.y + 40, { size: 16, font: 'italic', color: hex(ahead ? INK.dim : '#ff9a6a'), shadow: false });
    } else g.text(tr('hud.timeattack.first'), r.x + 14, r.y + 40, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
    // The graph: time runs left to right over the longer of the two runs.
    const gr = { x: r.x + 14, y: r.y + 50, w: r.w - 28, h: 38 };
    g.rect(gr.x, gr.y, gr.w, gr.h, hex('#050303', 0.55));
    const span = Math.max(10, ghost?.time ?? 0, ta.time);
    const X = (t: number) => gr.x + (t / span) * gr.w;
    const Y = (v: number) => gr.y + gr.h - Math.max(0, Math.min(1, v)) * gr.h;
    if (ghost) {
      const pts = [];
      for (let t = 0; t <= ghost.time; t += GHOST_STEP) pts.push({ x: X(t), y: Y(ghostAt(ghost, t)) });
      pts.push({ x: X(ghost.time), y: Y(ghostAt(ghost, ghost.time)) });
      g.polyline(pts, 1.5, hex('#c8c0b0', 0.45));
      g.rect(X(ghost.time) - 0.5, gr.y, 1, gr.h, hex(INK.gilt, 0.6));
    }
    const live = ta.vitals.map((v, i) => ({ x: X(i * GHOST_STEP), y: Y(v) }));
    live.push({ x: X(ta.time), y: Y(op.vitals / op.maxVitals) });
    if (live.length > 1) g.polyline(live, 2, hex('#e04040', 0.95));
    if (this.taBest) caps(g, tr('hud.timeattack.new_best'), r.x + r.w / 2, r.y + r.h + 20, 14, hex(INK.goldHi), 'center');
  }

  /** Real-surface detail maps (CC0 scans): loaded once, tiled; the flesh pass waits until they are ready. */
  private maps: SurfaceMaps | null = null;
  private mapsKey = '';
  /** One surface set resident (ART-0367): entering an op with another species' set frees the last one. */
  private surfaceMaps(g: Gfx, race: string, venue: string): SurfaceMaps | undefined {
    const set = surfaceSetFor(race, venue, g.shaderQuality);
    const key = set ? Object.values(set).join('|') : 'none';
    if (key !== this.mapsKey) {
      this.mapsKey = key;
      const urls = set ? Object.values(set).map((id: AssetId) => import.meta.env.BASE_URL + MANIFEST[id].url) : [];
      SURFACE_SETS.swap(urls, (u) => g.releaseImage(u));
      this.maps = set && {
        skin: g.image(urls[0], { repeat: true }),
        tone: g.image(urls[1], { repeat: true }),
        linen: g.image(urls[2], { repeat: true }),
        wood: g.image(urls[3], { repeat: true }),
      };
    }
    return this.maps ?? undefined;
  }

  /** Heat shimmer over hot dragon-breath burns (ENG-0263), fading as they cool. */
  heatShimmer(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    const cam = this.camera.isIdentity ? null : this.camera;
    for (const e of this.op.entities) {
      if (out.length >= 4 || !(e instanceof Burn) || e.hidden) continue;
      const h = e.heat(this.op.elapsed);
      if (h < 0.05) continue;
      const v = cam ? cam.toView(e.pos, { x: 0, y: 0 }) : e.pos;
      out.push([v.x, v.y, e.radiusNow * 1.3 * (cam ? cam.zoom : 1), h]);
    }
    return out;
  }

  /** Hexstone refraction regions (ENG-0106): each visible stone bends the flesh behind it; stilled stones less. */
  private hexRefraction(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    const cam = this.camera.isIdentity ? null : this.camera;
    for (const e of this.op.entities) {
      if (out.length >= 6 || !e.alive || e.hidden || !(e instanceof Embedded) || e.kind !== 'hexstone') continue;
      const v = cam ? cam.toView(e.pos, { x: 0, y: 0 }) : e.pos;
      out.push([v.x, v.y, e.spec.len * 0.9 * (cam ? cam.zoom : 1), e.calmed ? 0.25 : 0.55]);
    }
    // Ice bends the flesh a little too (ENG-0262), less as it thaws.
    for (const e of this.op.entities) {
      if (out.length >= 6 || !e.alive || !(e instanceof FrostPatch)) continue;
      const v = cam ? cam.toView(e.pos, { x: 0, y: 0 }) : e.pos;
      out.push([v.x, v.y, e.radius * (cam ? cam.zoom : 1), 0.18 * (1 - e.thaw)]);
    }
    return out;
  }

  /** One blood colour for the patient's species across particles and drawn effects (ENG-0096). */
  private applyBlood(): void {
    const look = speciesOf(this.def.race).look;
    this.particles.setBloodTint((c) => tintBlood(c, look));
    setVfxBlood(tintBlood('#6a0208', look));
  }

  /** Lay salve gloss where the Salve is being spread, and let spots older than SALVE_GLOSS_S go. */
  private tickGloss(op: Operation, down: boolean): void {
    const now = op.elapsed;
    if (op.status === 'running' && op.tool === 'salve' && down && onBody(op.cursor)) {
      const last = this.gloss[this.gloss.length - 1];
      if (!last || Math.hypot(last.x - op.cursor.x, last.y - op.cursor.y) > 9) this.gloss.push({ x: op.cursor.x, y: op.cursor.y, t: now });
      else last.t = now;
      if (this.gloss.length > 200) this.gloss.shift();
    }
    let w = 0;
    for (const s of this.gloss) if (now - s.t < SALVE_GLOSS_S) this.gloss[w++] = s;
    this.gloss.length = w;
  }

  /**
   * Salve gloss (GAM-0043): a pale, wet film with a lamp highlight over every spot the Salve
   * touched, holding its shine for 4 s after the last stroke over it, then drying off.
   */
  private drawGloss(g: Gfx, op: Operation): void {
    for (const s of this.gloss) {
      const age = op.elapsed - s.t;
      const k = age < SALVE_GLOSS_S - 1 ? 1 : Math.max(0, SALVE_GLOSS_S - age);
      g.circleGrad(s.x, s.y, 20, hex('#f2ead2', 0.2 * k), hex('#f2ead2', 0));
      g.circle(s.x - 5, s.y - 6, 2.2, hex('#ffffff', 0.4 * k));
    }
  }

  /**
   * Triage (GAM-0248): the second patient's plate between the vitals and the timer — name, vitals
   * and a meter — lit gold while their cot is the one in view.
   */
  private drawSecondPatient(g: Gfx): void {
    const op = this.op;
    const v = op.vitals2 ?? 0;
    const r = { x: HUD_VITALS.x + HUD_VITALS.w + 8, y: HUD_VITALS.y, w: 150, h: HUD_VITALS.h };
    const inView = this.view === 1;
    glass(g, r, { strength: inView ? 1.2 : 1 });
    if (inView) g.rect(r.x + 2, r.y + r.h - 4, r.w - 4, 2, hex(INK.gold, 0.8));
    const name = op.def.second?.patient ?? '';
    fitText(g, 'patient2', name, r.x + 12, r.y + 22, r.w - 24, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
    const col = v > 60 ? palette().vitalsGood : v > 30 ? palette().vitalsWarn : palette().vitalsDanger;
    numerals(g, formatNumber(Math.ceil(v)), r.x + 12, r.y + 62, 30, col, col, 'left');
    meter(g, { x: r.x + 70, y: r.y + 50, w: r.w - 84, h: 8 }, v / op.maxVitals, col, col);
  }

  /** Multi-organ fields (GAM-0247): with two or more regions, the camera frames one at a time. */
  private get views(): readonly { x: number; y: number; rx: number; ry: number }[] {
    const r = this.op.def.regions ?? [];
    return r.length >= 2 ? r : [];
  }

  /** Frame region `i`, magnified to fill the view (instantly on setup, eased on Tab). */
  private frameView(i: number, seconds: number): void {
    const r = this.views[i];
    if (!r) return;
    this.view = i;
    const zoom = Math.max(1, Math.min(2, Math.min((VIEW_W * 0.78) / (2 * r.rx), (VIEW_H * 0.72) / (2 * r.ry))));
    if (seconds <= 0) {
      this.camera.x = r.x;
      this.camera.y = r.y;
      this.camera.zoom = zoom;
    } else this.camera.focus({ x: r.x, y: r.y }, zoom, seconds);
  }

  private setupViews(): void {
    if (!this.views.length) {
      this.ctl.onSwitchView = null;
      return;
    }
    this.frameView(0, 0);
    this.ctl.onSwitchView = () => this.frameView((this.view + 1) % this.views.length, settings.reduceMotion ? 0 : 0.35);
  }

  /**
   * Edge arrows (GAM-0247): everything still draining off-screen is pointed at from the edge of
   * the view, reddening with how hard it drains.
   */
  private drawEdgeArrows(g: Gfx): void {
    if (!this.views.length) return;
    const op = this.op;
    const m = 34;
    for (const e of op.entities) {
      if (!e.alive || e.hidden) continue;
      const d = e.drain(op);
      if (d <= 0) continue;
      const v = this.camera.toView(e.pos, { x: 0, y: 0 });
      if (v.x > m && v.x < VIEW_W - m && v.y > m && v.y < VIEW_H - m) continue;
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const ang = Math.atan2(v.y - cy, v.x - cx);
      // Walk from the centre toward it until the margin box.
      const k = Math.min(Math.abs((VIEW_W / 2 - m) / (Math.cos(ang) || 1e-6)), Math.abs((VIEW_H / 2 - m) / (Math.sin(ang) || 1e-6)));
      const p = { x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k };
      const heat = Math.min(1, d / 1.2);
      const col = hex(heat > 0.5 ? '#ff5a4a' : '#f0c070', 0.75 + 0.25 * Math.sin(op.elapsed * 6));
      const tip = { x: p.x + Math.cos(ang) * 14, y: p.y + Math.sin(ang) * 14 };
      const l = { x: p.x + Math.cos(ang + 2.4) * 12, y: p.y + Math.sin(ang + 2.4) * 12 };
      const r = { x: p.x + Math.cos(ang - 2.4) * 12, y: p.y + Math.sin(ang - 2.4) * 12 };
      g.tri(tip.x, tip.y, l.x, l.y, r.x, r.y, col);
    }
    caps(g, tr('hud.view_switch', { key: glyphFor('tool.quickSwap').split(' / ')[0] }), VIEW_W / 2, VIEW_H - 112, 12, hex(INK.gold, 0.8), 'center');
  }

  /** The Respite button (UIX-0102): a small glass cap with a pause glyph beside the score plate. */
  private drawPauseButton(g: Gfx): void {
    const op = this.op;
    if (op.status !== 'running') return;
    const r = this.pauseRect;
    const h = settings.reduceMotion ? (this.pauseHover > 0.5 ? 1 : 0) : this.pauseHover;
    g.plate(r.x, r.y, r.w, r.h, {
      radius: 4,
      top: hex(h > 0 ? '#2a2016' : '#16110d', 0.92),
      bottom: hex('#0a0806', 0.92),
      border: hex(INK.gilt, 0.55 + 0.4 * h),
      borderW: 1 + 0.4 * h,
      bevel: 0.5,
      shadow: [0.5, 6, 2],
      glow: h > 0 ? hex(INK.gold, 0.25 * h) : undefined,
      glowR: 12,
    });
    const c = hex(h > 0 ? INK.goldHi : INK.gold, 0.9);
    g.rect(r.x + 15, r.y + 13, 5, 18, c);
    g.rect(r.x + 24, r.y + 13, 5, 18, c);
    if (h > 0.3) {
      const label = tr('hud.pause.title');
      const kc = glyphFor('pause');
      const w = Math.round(g.measure(label, 12, 'display') * 1.1) + 24 + 46;
      const tip = { x: r.x + r.w / 2 - w / 2, y: r.y + r.h + 8, w, h: 30 };
      glass(g, tip, { alpha: h });
      caps(g, label, tip.x + 12, tip.y + 20, 12, hex(INK.gold, h));
      keycap(g, kc, tip.x + tip.w - 40, tip.y + 8, 11, h);
    }
  }

  /** A tool tip beside a tray slot: name, hint and the binding (UIX-0051). */
  private drawToolTip(g: Gfx, id: ToolId, r: { x: number; y: number; w: number; h: number }, a: number): void {
    const mirrored = traySide() === 'right';
    const ts = settings.textScale;
    const hint = tr(`tool.${id}.hint`);
    const hs = Math.round(16 * ts);
    const w = Math.round(290 * ts);
    const lines = g.wrap(hint, w - 32, hs);
    // The tip sits beside the tray, on the field side (left of a mirrored tray).
    const th = Math.round(40 * ts + lines.length * hs * 1.25 + 12);
    // Low slots lift their tip clear of the callout plate at the bottom of the screen.
    const tip = { x: mirrored ? r.x - 20 - w : r.x + r.w + 20, y: Math.min(r.y - 4, TIP_FLOOR - th), w, h: th };
    glass(g, tip, { alpha: a });
    const ay = Math.min(r.y + r.h / 2, tip.y + tip.h - 12);
    if (mirrored) g.tri(tip.x + tip.w, ay - 7, tip.x + tip.w, ay + 7, tip.x + tip.w + 8, ay, hex(INK.gilt, 0.75 * a));
    else g.tri(tip.x, ay - 7, tip.x, ay + 7, tip.x - 8, ay, hex(INK.gilt, 0.75 * a));
    caps(g, tr(`tool.${id}.name`), tip.x + 16, tip.y + 24 * ts, Math.round(13 * ts), hex(INK.gold, a));
    if (a > 0.3) keycap(g, glyphFor(`tool.select.${TOOL_INFO.findIndex((ti) => ti.id === id) + 1}` as ActionId), tip.x + tip.w - 40, tip.y + 20 * ts, 11, a);
    g.textBlock(hint, tip.x + 16, tip.y + 34 * ts + hs * 0.75, tip.w - 32, { size: hs, color: hex(INK.text, a), shadow: false }, 1.25);
  }

  private drawTray(g: Gfx): void {
    const op = this.op;
    const mirrored = traySide() === 'right';
    const frame = trayFrame(op.def.tools.length);
    // The tray shudders when a hotkey names an instrument the kit lacks (INP-0048).
    const shake = this.ctl.trayShake > 0 && !settings.reduceMotion ? Math.sin(this.ctl.trayShake * 40) * 5 * this.ctl.trayShake : 0;
    const hover = this.hoverSlot();
    g.save();
    g.translate(shake, 0);
    glass(g, frame, { strength: palette().plate > 0 ? 1.15 : 1 });
    op.def.tools.forEach((id, i) => {
      const s = this.slot(i);
      const sel = op.tool === id;
      // The selected slot slides 8 px out of the frame towards the field (UIX-0051); hover lifts a slot 3 px.
      const out = sel ? 8 : hover === i ? 3 : 0;
      const r = { x: s.x + (mirrored ? -out : out), y: s.y, w: s.w, h: s.h };
      g.plate(r.x, r.y, r.w, r.h, {
        radius: 3,
        top: hex(sel ? '#3a2c1c' : hover === i ? '#221a12' : '#16110d', 0.95),
        bottom: hex(sel ? '#1e150d' : '#0a0806', 0.95),
        border: hex(sel ? INK.gold : hover === i ? INK.gilt : '#5a4a34', sel ? 1 : 0.7),
        borderW: sel ? 1.6 : 1,
        inset: sel ? hex('#fff1c4', 0.18) : undefined,
        insetD: 3,
        bevel: sel ? 0.9 : 0.5,
        shadow: [0.5, 6 + out * 0.5, 2],
        glow: sel ? hex(INK.gold, 0.3) : undefined,
        glowR: 12,
      });
      toolIcon(g, id, r.x + r.w / 2 + 2, r.y + r.h / 2 + 2, sel ? 1.12 : 1.02, g.time, sel ? 'selected' : 'idle');
      // Key number: small engraved numeral in the corner.
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === id) + 1), r.x + 8, r.y + 16, { size: 12, font: 'display', tracking: 0.05, color: hex(sel ? INK.goldHi : INK.dim), shadow: hex('#000000', 0.8) });
      if (toolBlinded(op, id)) g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, hex('#8a8a8a', 0.6));
      // Brand heat (UIX-0051): the slot glows from ember to white as the iron nears overheating.
      if (id === 'brand' && op.brandHeat > 0) {
        const h = Math.min(1, op.brandHeat / op.tuning.brand.overheatAfter);
        g.glow(r.x + r.w / 2, r.y + r.h / 2, 26 + 10 * h, hex(h > 0.75 ? '#ffe0b0' : '#ff7a2a', 0.25 + 0.45 * h));
      }
      if (id === 'tincture' && op.injectCooldown > 0) {
        // Cooldown as a radial wipe (UIX-0051): a dark disc that unwinds clockwise as the vial refills.
        const f = op.injectCooldown / TINCTURE_COOLDOWN;
        g.arc(r.x + r.w / 2, r.y + r.h / 2, 15, 30, hex('#000000', 0.55), f);
        g.arc(r.x + r.w / 2, r.y + r.h / 2, 29, 2, hex(INK.gold, 0.6), 1 - f);
        vialArt(g, r.x + r.w - 12, r.y + r.h / 2 + 2, 26, vialLevel(f), f > 0.97);
      }
    });
    g.restore();

    // Tool name + hint: a plate beside the selected slot that fades after a switch, or beside a hovered slot.
    if (hover >= 0 && op.def.tools[hover] !== op.tool && op.status === 'running' && !this.paused) {
      const s = this.slot(hover);
      this.drawToolTip(g, op.def.tools[hover]!, { x: s.x + (mirrored ? -3 : 3), y: s.y, w: s.w, h: s.h }, 1);
    } else if (this.hintT > 0) {
      const s = this.slot(op.def.tools.indexOf(op.tool));
      this.drawToolTip(g, op.tool, { x: s.x + (mirrored ? -8 : 8), y: s.y, w: s.w, h: s.h }, Math.min(1, this.hintT));
    }

    // Litany reliquary (only once the rite has been learned), bottom right — bottom left when the tray is mirrored.
    if (op.def.litany === false) {
      this.litanyRect = null;
      return;
    }
    const lx = mirrored ? 60 : VIEW_W - 60;
    const ly = 664 + anchorShift('bottom');
    this.litanyRect = { x: lx - 40, y: ly - 40, w: 80, h: 80 };
    const ready = op.canInvokeLitany();
    g.plate(lx - 40, ly - 40, 80, 80, { radius: 40, top: hex('#1a1411', 0.88), bottom: hex('#0a0807', 0.92), border: hex(ready ? INK.gold : '#5a4a34', 0.9), borderW: 1.4, bevel: 0.7, shadow: [0.6, 14, 4], glow: ready ? hex(INK.gold, 0.22) : undefined, glowR: 16 });
    // Vertices found so far while the star is being drawn: five points light up round the reliquary.
    if (this.ctl.starTrail.length > 1) {
      const n = this.starVertices();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const on = i < n;
        g.circle(lx + Math.cos(ang) * 36, ly + Math.sin(ang) * 36, on ? 3.5 : 2, hex(on ? INK.goldHi : '#5a4a34', on ? 1 : 0.8));
        if (on) g.glow(lx + Math.cos(ang) * 36, ly + Math.sin(ang) * 36, 10, hex(INK.gold, 0.5));
      }
    }
    starReliquary(g, lx, ly, 28, { fill: op.litanyTime > 0 ? op.litanyTime / LITANY_DURATION : ready ? 1 : 0, spent: !ready && op.litanyTime <= 0, glint: ready, active: op.litanyTime > 0 });
    // Last two seconds of Stillness (UIX-0068): the reliquary flickers and the caption counts down.
    if (op.litanyTime > 0 && op.litanyTime < 2) {
      const fl = settings.reduceFlashing || settings.reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(g.time * 14);
      g.arc(lx, ly, 36, 2, hex('#ffd070', 0.9 * fl));
      caps(g, tr('hud.litany.ending', { s: Math.ceil(op.litanyTime) }), lx - 52, ly + 34, 11, hex('#ffd070', fl), 'right');
    }
    drawLitanyTheft(g, op, lx, ly);
    const label = ready ? { draw: `${dragGlyphFor('litany.draw')} ★`, key: glyphFor('litany.key'), both: `${dragGlyphFor('litany.draw')} ★ / ${glyphFor('litany.key')}` }[litanyMode()] : op.litanyTime > 0 ? tr('hud.litany.active') : tr('hud.litany.spent');
    const tx = mirrored ? lx + 52 : lx - 52;
    const align = mirrored ? 'left' : 'right';
    caps(g, tr('hud.litany'), tx, ly - 8, 11, hex(ready ? INK.gold : INK.faint), align);
    g.text(label, tx, ly + 14, { size: 16, font: 'italic', color: hex(ready ? INK.text : INK.faint, 0.9), align, shadow: hex('#000000', 0.8), soft: true });
  }

  private drawCallout(g: Gfx, t: number): void {
    const line = this.op.callouts[0];
    if (!line) {
      this.calloutRect = null;
      return;
    }
    // Text scale (UIX-0148): the plate grows upward and wraps rather than overflowing.
    const ts = settings.textScale;
    const size = Math.round(19 * ts);
    const textW = 700;
    const text = tSource(line, { gender: this.op.def.patientGender ?? 'unknown' });
    const lines = g.wrap(text, textW, size).length;
    const h = Math.max(78, 44 + lines * size * 1.3);
    const r = { x: VIEW_W / 2 - 400, y: 704 - h, w: 800, h };
    this.calloutRect = r;
    // The panel never takes clicks (they fall through to the field); over the hand or a wound it ghosts aside.
    const vis = 1 - 0.72 * this.calloutGhost;
    glass(g, r, { strength: vis });
    if (vis < 0.5) {
      g.textBlock(text.slice(0, Math.floor(this.op.calloutT * 60 * settings.textSpeed)), r.x + 94, r.y + 34 + size * 0.8, textW, { size, color: hex(INK.text, 0.55), shadow: false }, 1.3);
      return;
    }
    // Portrait in a gilt ring on the plate's left.
    const mx = r.x + 46;
    const my = r.y + r.h / 2;
    g.plate(mx - 32, my - 32, 64, 64, { radius: 32, top: hex('#1e2a24'), bottom: hex('#0c1210'), border: hex(INK.gilt, 0.9), borderW: 1.5, bevel: 0.5, shadow: [0.5, 8, 2] });
    const talking = this.op.calloutT * 60 < line.length;
    g.pushClip({ x: mx - 30, y: my - 30, w: 60, h: 60 });
    // Whoever calls the phases (CON-0190): Sister Ilse, or Orsa while Ilse is on the table.
    const aide = CAST[(this.op.def.assistant ?? 'ilse') as CharacterId] ?? CAST.ilse;
    // The bust's face follows the line (UIX-0059): alarmed on a danger call, kind on praise, and
    // worried whenever the patient is failing; she blinks every few seconds.
    const pri = this.op.calloutPriority;
    const face: Face = pri === 0 ? 'afraid' : pri === 2 ? 'kind' : this.op.vitals < 30 ? 'worried' : 'neutral';
    const blinkPhase = (t + 0.7) % 3.7;
    const pose = packPose({ prev: FACES.indexOf(face), next: FACES.indexOf(face), blend: 1, blink: blinkPhase < 0.12 ? 1 : 0, mouth: talking ? 0.5 + 0.5 * Math.sin(t * 16) : 0, lit: 1 });
    g.portrait(mx - 36, my - 40, 72, 92, {
      style: 1,
      rim: vec3(aide.color),
      cloth: vec3(aide.cloth ?? '#3e454e'),
      skin: vec3(aide.skin ?? '#d8b098'),
      active: pose.active,
      seed: 3,
      talk: pose.talk,
    });
    g.popClip();
    caps(g, this.op.def.assistant ? aide.name : ASSISTANT_NAME, r.x + 94, r.y + 26, 11, hex(INK.gold));
    // Keyed callouts are translated with the patient's grammatical gender for ICU select (LOC-0014).
    const shown = text.slice(0, Math.floor(this.op.calloutT * 60 * settings.textSpeed));
    g.textBlock(shown, r.x + 94, r.y + 34 + size * 0.8, textW, { size, color: hex(INK.text), shadow: hex('#000000', 0.8), soft: true }, 1.3);
  }

  /**
   * The watcher at the field's edge (CON-0048): Inquisitor Stroh at the Tanners' Rows, a dim bust
   * outside the lamp's reach, rim-lit in his colour. He only looks up when the patient is failing.
   */
  private drawObserver(g: Gfx, t: number): void {
    const who = this.op.def.observer ? CAST[this.op.def.observer as CharacterId] : undefined;
    if (!who) return;
    const O = OBSERVER;
    const bob = settings.reduceMotion ? 0 : Math.sin(t * 0.7) * 2;
    const x = O.x;
    const y = O.y + bob;
    g.glow(x, y - O.h * 0.45, O.w, hex(who.color, 0.06));
    const lit = this.op.vitals < O.watchBelow ? 0.45 : 0.18;
    g.portrait(x - O.w / 2, y - O.h, O.w, O.h, {
      style: STYLE_OF[who.silhouette] ?? 3,
      rim: vec3(who.color),
      cloth: vec3(who.cloth ?? '#161214'),
      skin: vec3(who.skin ?? '#c0a090'),
      active: lit,
      seed: who.name.length * 1.7,
      talk: 0,
      beard: who.beard ?? 0,
      hair: vec3(who.hair ?? '#1a1210'),
    });
  }

  private drawPopups(g: Gfx): void {
    const still = settings.reduceMotion;
    // Hurt rings (UIX-0050): a red ring blooms out of the spot that bled.
    for (const r of this.hurtRings) {
      const k = still ? 0.6 : r.t / 0.5;
      const a = 1 - k;
      g.arc(r.x, r.y, (r.big ? 18 : 12) + k * (r.big ? 34 : 22), r.big ? 3 : 2, hex('#ff5a4a', 0.8 * a));
      if (r.big) g.glow(r.x, r.y, 30 + k * 20, hex('#ff2a1a', 0.3 * a));
    }
    // Popups step off the HUD plates (GAM-0144): never under the vitals, clock, score, chain, tray or reliquary.
    const hud = this.popups.length ? operationHud({ tools: this.op.def.tools.length, traySide: traySide(), litany: this.op.def.litany !== false, callout: !!this.calloutRect, extra: [this.pauseRect, ...bossPlates(this.op)] }) : [];
    for (const p of this.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      // Reduced Motion: popups neither rise nor pop (UIX-0152).
      const rise = still ? 0 : p.t * 40;
      const { x, y } = clearOfHud(p.pos.x, p.pos.y - 26 - rise - (p.lift ?? 0), hud);
      if (!p.rating) {
        if (/^[+\-×\d]/.test(p.text)) giltNumerals(g, p.text, x, y, 20, a);
        else g.text(tSource(p.text), x, y, { size: 20, color: withAlpha(hex(p.color), a), align: 'center' });
        continue;
      }
      const pop = still ? 1 : 1 + Math.max(0, 0.22 - p.t) * 2.2;
      const word = tr(`rating.${p.rating}`);
      // Colour filters swap the stamp inks; the stamp shapes and tilt still tell the ratings apart (UIX-0147).
      ratingStamp(g, p.rating, word, x, y, still ? 1 : p.t, a, settings.colorFilter === 'none' ? RATING_INK[p.rating] : palette()[p.rating], 30);
      if (p.label) g.text(tSource(p.label), x, y - 36 * pop, { size: 16, font: 'italic', color: hex(UI.parch, a * 0.9), align: 'center' });
      if (p.combo && p.combo > 1 && (p.rating === 'cool' || p.rating === 'good')) g.text(tr('hud.chain_combo', { combo: p.combo }), x, y + 20, { size: 16, color: hex(UI.gilt, a * 0.9), align: 'center' });
    }
  }

  private drawPause(g: Gfx, game: Game): void {
    const vr = viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.3));
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.4));
    glass(g, { x: 430, y: 150, w: 420, h: 400 }, { strength: 1.12 });
    heading(g, tr('hud.pause.title'), VIEW_W / 2, 214, 280, 1, 28);
    if (button(g, game.input, tr('hud.pause.resume'), VIEW_W / 2, 310)) this.paused = false;
    if (button(g, game.input, tr('hud.pause.restart'), VIEW_W / 2, 370)) this.restart();
    if (button(g, game.input, tr('hud.pause.options'), VIEW_W / 2, 430)) {
      // Options is an overlay over the live (paused) operation (ENG-0063).
      if (game.push && game.pop) game.push(new OptionsScene(() => game.pop!(), 'overlay'));
      else game.go(new OptionsScene(() => game.go(this)));
    }
    if (button(g, game.input, tr('hud.pause.abandon'), VIEW_W / 2, 490)) this.onQuit();
  }
}

/** One heartbeat, phase 0..1 → amplitude (P wave, QRS spike, T wave). */
export function ecgWave(ph: number): number {
  const bump = (c: number, w: number, h: number) => h * Math.exp(-(((ph - c) / w) ** 2));
  return bump(0.1, 0.025, 0.12) - bump(0.19, 0.008, 0.15) + bump(0.21, 0.01, 1) - bump(0.235, 0.01, 0.3) + bump(0.42, 0.05, 0.25);
}


// Dev hot-reload (CON-0011): an op data file that is edited re-runs and hands its fresh definitions
// here (see the self-accepting modules under src/content/ops); the running operation restarts
// with its new definition and the same seed, within the second Vite takes to rebuild.
if (import.meta.hot) {
  (globalThis as { __opHotReload?: (m: unknown) => void }).__opHotReload = (m) => {
    const defs = m ? Object.values(m as Record<string, unknown>).filter((v): v is OperationDef => !!v && typeof v === 'object' && 'phases' in v && 'id' in v) : [];
    OperationScene.live?.hotReload(defs);
  };
}
