import { t as tr, tSource } from '../i18n';
import { formatClock, formatNumber, formatVitals } from '../i18n/format';
import { dist, Rng } from '../core/math';
import { bindHitstop } from '../core/clock';
import { Camera2D } from '../render/camera';
import type { Game, Scene } from '../core/scene';
import { attachBarkDirector } from '../content/barkDirector';
import { hex, withAlpha } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { Bubo, Sigil, surfDisc, surfLine } from '../surgery/entities';
import { EggSac } from '../surgery/lauds';
import { Particles } from '../render/particles';
import { OperationVfx } from './opVfx';
import { drawOrder } from '../render/layers';
import { contentHash } from '../core/replayCodec';
import { rememberReplay, setLiveReplay } from '../platform/lastReplay';
import { BUILD } from '../platform/build';
import { takeLog } from '../surgery/replay';
import { FlashLimiter } from '../render/flashLimiter';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, onBody, LITANY_DURATION, MAX_VITALS, Operation, TINCTURE_COOLDOWN, TINCTURE_TIME, type OperationDef, type Popup } from '../surgery/operation';
import { TOOL_INFO, type ToolId } from '../surgery/types';
import { anchorShift, PALETTE, viewRect, VIEW_W } from '../ui/layout';
import { button, reticle, toolIcon } from '../ui/widgets';
import { giltText, UI, waxSeal } from '../ui/ornaments';
import { RANK_WAX } from './rankArt';
import type { ActionId } from '../input/actions';
import { DamageAggregator, ToolHints } from '../ui/hudPrefs';
import { stackPopup } from '../ui/popupStack';
import { speciesBlood } from '../render/organs';
import { band, caps, heading, heartIcon, phaseSeal, ratingStamp, glass, INK, keycap, meter, numerals, titleRule, well } from '../ui/hudKit';
import { localeInfo } from '../i18n/locales';
import { getLocale } from '../i18n';
import { bloodScale, GORE_LEVEL, presentation } from '../render/presentation';
import { highContrast, palette } from '../ui/theme';
import { giltNumerals } from '../ui/ornaments';
import { RATING_INK, starReliquary, vialArt } from '../art/kit';
import { cursorTarget, cursorTint, vialLevel } from '../art/hud';
import { CAST } from '../content/characters';
import { ASSISTANT_NAME } from '../content/characters';
import { vec3 } from '../render/color';
import { settings } from '../core/settings';
import { OptionsScene } from './options';
import { litanyMode, OperationInput } from '../input/opinput';
import { addTray, HudLayer, inRect, trayFrame, traySide, traySlot } from '../input/hud';
import { drawGraspOutline } from '../input/hover';
import { HoldToRetry } from '../input/retry';
import { bindings } from '../input/bindings';
import { dragGlyphFor, glyphFor, toolKeyLabel } from '../input/glyphs';
import { calmWave, drawBossHud, drawLitanyTheft, drawTorpor, ecgCalm, toolBlinded } from '../surgery/bosses/hud';
import { BossAudio, withBossAssists } from './bossAudio';
import { BOSS_OPS, watchEncounters } from '../surgery/bosses/codex';
import { loadProgress, storeProgress } from '../surgery/progress';
import { codexId } from './codex';
import { operationOptions } from '../surgery/session';
import type { OperationOptions } from '../surgery/operation';
import { drawDebug, drawDialogue, drawDrainArrow, drawFieldOverlays, drawLitanyPractice, drawSecondaryVitals, drawTrayState, drawTutorial } from './gameplayHud';
import { PauseScene, type PauseResult } from './pause';

export interface OperationOutcome {
  op: Operation;
  won: boolean;
}

/** 1 → I, 2 → II … for phase banners. */
const roman = (n: number): string => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n);

export class OperationScene implements Scene {
  op: Operation;
  private paused = false;
  private endT = 0;
  private ctl = new OperationInput();
  private ecg: number[] = new Array(200).fill(0);
  private beatPhase = 0;
  private pulse = 0;
  private corrupt = 0;
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
  /** HUD particles (ENG-0144): COOL sparkle, chain-milestone flare; real time, UI layer. */
  private uiFx = new Particles();
  /** Emitters driven by the operation's state and events (ENG-0133–0142). */
  private vfx = new OperationVfx(() => this.particles);
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
    this.presRng = new Rng(def.seed ?? 1);
    // Emitter streams seeded from the operation seed (ENG-0131).
    this.particles.seed(this.runOpts.seed ?? this.def.seed ?? 1);
    this.listen(this.op);
  }

  /** Subscribe the presentation (popups, particles, audio) to the operation's event bus. */
  private listen(op: Operation): void {
    op.events.on('popup', (p) => {
      if (!this.dmg.absorb(p.text, p.pos, p.color)) this.addPopup({ ...p, t: 0 });
    });
    this.lagV = this.prevV = op.vitals;
    this.lagHold = this.healT = this.digitShakeT = 0;
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
    // The first meeting with an Hour opens its codex page.
    watchEncounters(op, (boss) => {
      const p = loadProgress();
      if (p.codex.includes(codexId(boss))) return;
      p.codex.push(codexId(boss));
      storeProgress(p);
    });
    if (!this.runOpts.practice) attachBarkDirector(op);
    this.vfx = new OperationVfx(() => this.particles);
    this.vfx.listen(op, () => bloodScale(presentation.gore));
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
    return new Operation(withBossAssists(d), { ...operationOptions(def, runOpts), record: true });
  }

  /** Unsubscribes the hitstop binding (ENG-0058); set on the first update that has a clock. */
  private unbindHitstop: (() => void) | null = null;

  dispose(): void {
    this.unbindHitstop?.();
    this.unbindHitstop = null;
    this.bossAudio.dispose();
    this.op.events.clear();
  }

  exit(game: Game): void {
    // Leaving the operation: never leave the shared clocks paused or slowed.
    if (game.clock) {
      game.clock.paused = false;
      game.clock.worldScale = 1;
    }
  }

  enter(): void {
    if (this.entered) return;
    this.entered = true;
    this.op.say('Instruments ready, Doctor.');
  }

  private restart(): void {
    this.op.events.clear();
    // A repeat attempt skips the bosses’ phase-transition beats (BOS-0004).
    this.def = { ...this.def, skipCinematics: true } as OperationDef;
    this.op = OperationScene.create(this.def, this.runOpts);
    this.presRng = new Rng(this.def.seed ?? 1);
    this.popups.length = 0;
    this.listen(this.op);
    this.camera.reset();
    this.particles = new Particles(undefined, this.runOpts.seed ?? this.def.seed ?? 1);
    this.ctl = new OperationInput();
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

    // Visual effects arrive as `fx` events; landed droplets become stains. Particles run on world time.
    this.particles.update(dt * op.timeScale, (p, kind, size) => {
      if (kind === 'blood' && onBody(p)) op.stain(p, size * 2.6, 0.3);
    });
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
      if (this.endT > 2.2) this.onEnd({ op, won: op.status === 'won' });
    }
  }

  private slot(i: number) {
    return traySlot(i);
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    presentation.creatureFilter = settings.creatureFilter;
    op.calloutPace = localeInfo(getLocale())?.reading ?? 1;
    presentation.gore = GORE_LEVEL[settings.goreLevel];
    const pal = organPalette(op.def);
    const t = g.time;
    const sk = settings.reduceMotion ? 0 : op.shake * settings.shake;
    const sway = op.sway();
    // Trauma shake (ENG-0051): deterministic smooth noise in the post pass; the patient's sway stays as an offset.
    const shake = sway;
    const trauma = sk > 0 ? Math.min(1, sk / 12) : undefined;

    // ---------------------------------------------------------------- data layers
    // Entities layer order (ENG-0042): by layer, then spawn order.
    const ents = drawOrder(op.visibleEntities());
    const light = { x: FIELD.cx - 220 + Math.sin(t * 0.7) * 30, y: 60 + Math.sin(t * 1.3) * 10 };
    g.beginLayer('surface');
    for (const sc of op.scars) {
      surfLine(g, sc, 7, 0.18, 0.15, 0, 0.1);
      surfLine(g, sc, 12, 0, 0, 0, 0.2);
    }
    for (const st of op.stains) surfDisc(g, st, st.r, 0, st.a);
    for (const e of ents) e.drawSurface(g, op);
    if (game.input.down && onBody(game.input.pos)) surfDisc(g, game.input.pos, 16, 0.28);
    g.endLayer();
    g.beginLayer('fluid');
    for (const e of ents) e.drawFluid(g, op);
    this.particles.drawFluid(g);
    g.endLayer();

    // ---------------------------------------------------------------- world
    g.beginWorld();
    g.fleshField({
      center: { x: FIELD.cx, y: FIELD.cy },
      radii: { x: FIELD.rx, y: FIELD.ry },
      kind: pal.kind,
      base: pal.base,
      deep: pal.deep,
      vein: pal.vein,
      pulse: this.pulse,
      light,
      corrupt: this.corrupt,
      cellSoft: pal.cellSoft,
      rough: pal.rough,
      gore: presentation.gore,
      species: pal.species,
      lights: [
        { x: light.x, y: light.y, h: 1.1, i: 1.1, col: [0.95, 0.9, 0.82] },
        { x: FIELD.cx - FIELD.rx - 60, y: FIELD.cy + 120, h: 0.35, i: 0.45 * (0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 4.1)), col: [1.0, 0.6, 0.3] },
        { x: FIELD.cx + FIELD.rx + 60, y: FIELD.cy - 60, h: 0.35, i: 0.4 * (0.85 + 0.15 * Math.sin(t * 8.1 + 2.0) * Math.sin(t * 3.3)), col: [1.0, 0.62, 0.32] },
      ],
    });
    const colours = palette();
    g.fluidComposite(light, { blood: speciesBlood(colours.blood, pal.species), pus: colours.pus, bile: colours.bile, gore: presentation.gore });
    // Entities, particles and world FX go through the world camera (ENG-0045); endWorld resets it.
    g.setCamera(this.camera.isIdentity ? null : this.camera.matrix());
    for (const e of ents) e.draw(g, op);
    // High contrast: a 2 px ring around everything that takes an instrument.
    if (highContrast()) for (const e of ents) if (e.required) g.arc(e.pos.x, e.pos.y, 28, 2, hex('#ffffff', 0.85), 1);
    // Tongs in hand: outline the graspable the next press would seize (INP-0042).
    if (!this.paused) drawGraspOutline(g, op, this.ctl.toWorld(game.input.pos), bindings.prefs.hitScale, t);
    this.particles.draw(g);

    // Scrying lens: shimmer where something hides.
    if (op.tool === 'lens') {
      g.glow(game.input.pos.x, game.input.pos.y, 90, hex('#8ab8ff', 0.12));
      for (const e of op.entities) {
        if (!e.alive || !e.hidden || dist(e.pos, game.input.pos) > 110) continue;
        g.arc(e.pos.x, e.pos.y, 16 + Math.sin(t * 6) * 4, 2, hex('#b9d7ff', 0.6));
      }
    }

    if (this.ctl.starTrail.length > 1) {
      g.setBlend('add');
      g.polyline(this.ctl.starTrail, 8, hex('#f5d76e', 0.25));
      g.polyline(this.ctl.starTrail, 3, hex('#fff0b0', 0.9));
      g.setBlend('alpha');
    }

    const soften = settings.reduceFlashing ? 0.35 : 1;
    const danger = (op.status === 'running' ? Math.max(0, (35 - op.vitals) / 35) : op.status === 'lost' ? 1 : 0) * soften;
    const litany = op.litanyTime > 0 ? Math.min(1, op.litanyTime, (LITANY_DURATION - op.litanyTime) * 3) * soften : 0;
    const ch2 = op.def.id.startsWith('op2');
    g.endWorld({
      trauma,
      spot: { cx: FIELD.cx, cy: FIELD.cy, rx: FIELD.rx, ry: FIELD.ry, k: 0.62 },
      litany,
      danger,
      shake,
      bloom: 0.7,
      chroma: (this.corrupt * 1.2 + danger * 0.8 + Math.min(1, op.shake / 10) * 0.6) * soften,
      lutA: ch2 ? 'dawn' : 'candle',
      lutB: danger > 0.5 ? 'failing' : 'curse',
      lutMix: Math.max(this.corrupt * 0.8, danger > 0.5 ? (danger - 0.5) * 1.2 : 0),
      beat: this.pulse,
      curse: this.corrupt * 0.9 * soften,
      outcome: [op.status === 'lost' ? Math.min(1, this.endT / 2) : 0, op.status === 'won' ? Math.min(1, this.endT / 1.2) : 0],
      litanyCenter: this.ctl.litanyCenter,
      lens: op.tool === 'lens' ? [game.input.pos.x, game.input.pos.y, 95, 1] : undefined,
      litanyAge: op.litanyTime > 0 ? LITANY_DURATION - op.litanyTime : 10,
      hurt: (() => {
        const age = op.elapsed - op.lastHurt.at;
        const k = this.flashLimit.filter(Math.max(0, 1 - age / 0.45) * Math.min(1, op.lastHurt.amount / 6) * soften, 1 / 60);
        return [op.lastHurt.x - VIEW_W / 2, -(op.lastHurt.y - 360), k] as [number, number, number];
      })(),
      tint: ch2 ? [0.95, 0.98, 1.05] : [1.03, 0.99, 0.94],
      lift: ch2 ? [0.0, 0.004, 0.012] : [0.012, 0.004, 0.0],
    });

    // ---------------------------------------------------------------- UI
    drawFieldOverlays(g, op);
    if (!settings.minimalHud) this.drawThreatRings(g);
    drawTutorial(g, op);
    // WorldUI (ENG-0044): popups and hurt rings after post, through the world camera.
    g.setCamera(this.camera.isIdentity ? null : this.camera.matrix());
    this.drawPopups(g);
    g.setCamera(null);
    // HUD bars anchor to the visible top/bottom edges on 16:10 and 4:3 (ENG-0184).
    g.save();
    g.translate(0, anchorShift('top'));
    this.drawHud(g);
    g.restore();
    this.drawTray(g);
    this.drawPauseButton(g);
    g.save();
    g.translate(0, anchorShift('bottom'));
    this.drawCallout(g, t);
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
    toolIcon(g, op.tool, p.x + 20, p.y - 20, 0.8 + this.toolFlash * 0.3, t);
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
    const V = { x: 16, y: 14, w: 316, h: 86 };
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
    const T = { x: VIEW_W / 2 - 130, y: 14, w: 260, h: 70 };
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

    // ---- Score, patient and chain: right.
    const S = { x: VIEW_W - 16 - 250, y: 14, w: 250, h: 70 };
    glass(g, S, { strength: plateK });
    caps(g, tr('hud.score'), S.x + S.w - 18, S.y + 22, 11, hex(INK.dim), 'right');
    g.text(op.def.patient, S.x + 18, S.y + 24, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
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
    const tip = { x: mirrored ? r.x - 20 - w : r.x + r.w + 20, y: r.y - 4, w, h: Math.round(40 * ts + lines.length * hs * 1.25 + 12) };
    glass(g, tip, { alpha: a });
    if (mirrored) g.tri(tip.x + tip.w, r.y + r.h / 2 - 7, tip.x + tip.w, r.y + r.h / 2 + 7, tip.x + tip.w + 8, r.y + r.h / 2, hex(INK.gilt, 0.75 * a));
    else g.tri(tip.x, r.y + r.h / 2 - 7, tip.x, r.y + r.h / 2 + 7, tip.x - 8, r.y + r.h / 2, hex(INK.gilt, 0.75 * a));
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
    g.portrait(mx - 36, my - 40, 72, 92, {
      style: 1,
      rim: vec3(CAST.ilse.color),
      cloth: vec3(CAST.ilse.cloth ?? '#3e454e'),
      skin: vec3(CAST.ilse.skin ?? '#d8b098'),
      active: 1,
      seed: 3,
      talk: talking ? 0.5 + 0.5 * Math.sin(t * 16) : 0,
    });
    g.popClip();
    caps(g, ASSISTANT_NAME, r.x + 94, r.y + 26, 11, hex(INK.gold));
    // Keyed callouts are translated with the patient's grammatical gender for ICU select (LOC-0014).
    const shown = text.slice(0, Math.floor(this.op.calloutT * 60 * settings.textSpeed));
    g.textBlock(shown, r.x + 94, r.y + 34 + size * 0.8, textW, { size, color: hex(INK.text), shadow: hex('#000000', 0.8), soft: true }, 1.3);
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
    for (const p of this.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      // Reduced Motion: popups neither rise nor pop (UIX-0152).
      const rise = still ? 0 : p.t * 40;
      const x = p.pos.x;
      const y = p.pos.y - 26 - rise - (p.lift ?? 0);
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

