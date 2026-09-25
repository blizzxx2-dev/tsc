import { t as tr, tSource } from '../i18n';
import { formatClock, formatNumber, formatVitals } from '../i18n/format';
import { dist, Rng } from '../core/math';
import { Camera2D } from '../render/camera';
import type { Game, Scene } from '../core/scene';
import { hex, withAlpha } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { Sigil, surfDisc, surfLine } from '../surgery/entities';
import { Particles } from '../render/particles';
import { FlashLimiter } from '../render/flashLimiter';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, onBody, LITANY_DURATION, MAX_VITALS, Operation, TINCTURE_COOLDOWN, TINCTURE_TIME, type OperationDef, type Popup } from '../surgery/operation';
import { TOOL_INFO, toolInfo, type ToolId } from '../surgery/types';
import { anchorShift, PALETTE, viewRect, VIEW_W } from '../ui/layout';
import { button, inRect, reticle, toolIcon } from '../ui/widgets';
import { giltText, UI } from '../ui/ornaments';
import type { ActionId } from '../input/actions';
import { DamageAggregator, ToolHints } from '../ui/hudPrefs';
import { band, caps, heading, ratingCallout, diamond, glass, INK, keycap, meter, numerals, titleRule, well } from '../ui/hudKit';
import { localeInfo } from '../i18n/locales';
import { getLocale } from '../i18n';
import { bloodScale, GORE_LEVEL, presentation } from '../render/presentation';
import { highContrast, palette } from '../ui/theme';
import { giltNumerals } from '../ui/ornaments';
import { RATING_INK, starReliquary, vialArt } from '../art/kit';
import { cursorTint, vialLevel } from '../art/hud';
import { CAST } from '../content/characters';
import { ASSISTANT_NAME } from '../content/characters';
import { vec3 } from '../render/color';
import { settings } from '../core/settings';
import { OptionsScene } from './options';
import { litanyMode, OperationInput } from '../input/opinput';
import { dragGlyphFor, glyphFor, toolKeyLabel } from '../input/glyphs';
import { operationOptions } from '../surgery/session';
import type { OperationOptions } from '../surgery/operation';
import { drawDebug, drawDialogue, drawDrainArrow, drawFieldOverlays, drawLitanyPractice, drawSecondaryVitals, drawTrayState, drawTutorial } from './gameplayHud';
import { PauseScene, type PauseResult } from './pause';

export interface OperationOutcome {
  op: Operation;
  won: boolean;
}

const TRAY = { x: 24, y: 124, w: 64, h: 60, gap: 8 };

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
  private flashLimit = new FlashLimiter();
  private comboT = 0;
  private lastCombo = 0;
  /** World camera (ENG-0045/0046): pointer input is mapped through it before hit-testing. */
  readonly camera = new Camera2D();
  /** Seeded presentation noise (ECG jitter) so screenshots are reproducible (ENG-0251). */
  private presRng = new Rng(1);
  /** Floating rating/damage text, built from the operation's `popup` events (ENG-0243). */
  private popups: Popup[] = [];
  /** Sounds requested since the last tick (deduplicated). */
  private debug = false;
  /** The last 20 callouts, for the pause menu's log (UIX-0060). */
  readonly calloutLog: string[] = [];
  /** Seconds left of the 3-2-1 resume countdown (UIX-0101). */
  private resumeT = 0;

  constructor(
    private def: OperationDef,
    private onEnd: (o: OperationOutcome) => void,
    private onQuit: () => void,
    /** Per-run overrides (retry at Novice, checkpoint, challenge rules). */
    private runOpts: OperationOptions = {},
  ) {
    this.op = OperationScene.create(def, runOpts);
    this.presRng = new Rng(def.seed ?? 1);
    this.listen(this.op);
  }

  /** Subscribe the presentation (popups, particles, audio) to the operation's event bus. */
  private listen(op: Operation): void {
    op.events.on('popup', (p) => {
      if (!this.dmg.absorb(p.text, p.pos, p.color)) this.popups.push({ ...p, t: 0 });
    });
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
  }

  /** Open the "Respite" overlay (UIX-0100). The operation stops updating until it closes. */
  private openPause(game: Game): void {
    this.paused = true;
    this.ctl.suspend(this.op);
    if (game.clock) game.clock.paused = true;
    game.push!(new PauseScene(this.op, this.calloutLog, (r) => this.closePause(r)));
  }

  private closePause(r: PauseResult): void {
    if (r === 'restart') return this.restart();
    if (r === 'abandon') return this.onQuit();
    this.paused = false;
    this.resumeT = settings.resumeCountdown ? 3 : 0;
  }

  /** Apply player assists, difficulty and kit to the operation definition. */
  private static create(def: OperationDef, runOpts: OperationOptions = {}): Operation {
    const d = settings.timerAssist === 1 || runOpts.challenge ? def : { ...def, timeLimit: Math.round(def.timeLimit * settings.timerAssist) };
    return new Operation(d, operationOptions(def, runOpts));
  }

  dispose(): void {
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
    this.op = OperationScene.create(this.def, this.runOpts);
    this.presRng = new Rng(this.def.seed ?? 1);
    this.popups.length = 0;
    this.listen(this.op);
    this.camera.reset();
    this.particles = new Particles();
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
    this.ctl.update(op, input, dt, (p) => {
      const i = op.def.tools.findIndex((_, k) => inRect(p, this.slot(k)));
      return i >= 0 ? op.def.tools[i] : p.x <= TRAY.x + TRAY.w + 10 ? 'consume' : null;
    });
    this.dmg.enabled = settings.damageNumbers;
    this.hints.mode = settings.toolHints;
    for (const p of this.dmg.tick(dt)) this.popups.push({ ...p, t: 0 });
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
    if (op.combo !== this.lastCombo) {
      this.comboT = 0;
      this.lastCombo = op.combo;
    }
    this.comboT += dt;
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
      this.ecg.push(bpm === 0 ? 0 : ecgWave(this.beatPhase) * (op.vitals < 25 ? 0.6 + this.presRng.next() * 0.4 : 1));
    }

    const cursed = op.entities.some((e) => e instanceof Malison || e instanceof MalisonShard) ? 0.7 : op.entities.some((e) => e instanceof Sigil) ? 0.25 : 0;
    this.corrupt += (cursed - this.corrupt) * Math.min(1, dt * 1.5);

    // Visual effects arrive as `fx` events; landed droplets become stains. Particles run on world time.
    this.particles.update(dt * op.timeScale, (p, kind, size) => {
      if (kind === 'blood' && onBody(p)) op.stain(p, size * 2.6, 0.3);
    });
    if (op.litanyTime > 0 && Math.random() < dt * 30) this.particles.spawn({ kind: 'dust', pos: { x: FIELD.cx + (Math.random() - 0.5) * FIELD.rx * 2, y: FIELD.cy + (Math.random() - 0.5) * FIELD.ry * 2 }, n: 1 });

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
    return { x: TRAY.x, y: TRAY.y + i * (TRAY.h + TRAY.gap), w: TRAY.w, h: TRAY.h };
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
    const shake = sk > 0 ? { x: (Math.random() - 0.5) * sk + sway.x, y: (Math.random() - 0.5) * sk + sway.y } : sway;

    // ---------------------------------------------------------------- data layers
    const ents = op.visibleEntities().sort((a, b) => a.layer - b.layer);
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
      lights: [
        { x: light.x, y: light.y, h: 1.1, i: 1.1, col: [0.95, 0.9, 0.82] },
        { x: FIELD.cx - FIELD.rx - 60, y: FIELD.cy + 120, h: 0.35, i: 0.45 * (0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 4.1)), col: [1.0, 0.6, 0.3] },
        { x: FIELD.cx + FIELD.rx + 60, y: FIELD.cy - 60, h: 0.35, i: 0.4 * (0.85 + 0.15 * Math.sin(t * 8.1 + 2.0) * Math.sin(t * 3.3)), col: [1.0, 0.62, 0.32] },
      ],
    });
    const colours = palette();
    g.fluidComposite(light, { blood: colours.blood, pus: colours.pus, bile: colours.bile, gore: presentation.gore });
    for (const e of ents) e.draw(g, op);
    // High contrast: a 2 px ring around everything that takes an instrument.
    if (highContrast()) for (const e of ents) if (e.required) g.arc(e.pos.x, e.pos.y, 28, 2, hex('#ffffff', 0.85), 1);
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
    drawTutorial(g, op);
    this.drawPopups(g);
    // HUD bars anchor to the visible top/bottom edges on 16:10 and 4:3 (ENG-0184).
    g.save();
    g.translate(0, anchorShift('top'));
    this.drawHud(g);
    g.restore();
    this.drawTray(g);
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
    if (op.status === 'intro') card(op.def.title, op.def.patient, Math.min(1, op.elapsed * 3), INK.goldHi, INK.gold);
    if (op.status === 'won') card(tr('hud.op_complete'), null, 1, INK.goldHi, INK.gold);
    if (op.status === 'lost') card(tr('hud.patient_lost'), tSource(op.lostReason), 1, '#ffb0a8', '#c0282c');

    if (this.paused && !game.push) this.drawPause(g, game);
    if (this.resumeT > 0) {
      const n = Math.ceil(this.resumeT);
      const f = this.resumeT - Math.floor(this.resumeT);
      giltText(g, formatNumber(n), VIEW_W / 2, 400, { size: 120 * (0.85 + 0.15 * f), align: 'center' });
    }
    this.ctl.draw(g, op, this.paused);

    // Cursor: reticle at the tip with the instrument beside it.
    const p = game.input.pos;
    if (op.tool === 'tincture' && op.injectT > 0) g.arc(p.x, p.y, 18, 3, hex(PALETTE.good), op.injectT / TINCTURE_TIME);
    toolIcon(g, op.tool, p.x + 20, p.y - 20, 0.8 + this.toolFlash * 0.3, t);
    const tint = cursorTint(op, p);
    const cpal = palette();
    reticle(g, p, settings.colorFilter === 'none' ? tint : tint === '#9fe0a8' ? cpal.validTarget : tint === '#ff5a4a' ? cpal.wrongTarget : tint);
    g.endFrame();
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
    caps(g, tr('hud.vitals'), V.x + 18, V.y + 22, 11);
    const low = op.vitals <= 30;
    const beat = settings.reduceMotion ? 0 : this.pulse;
    g.text(formatVitals(op.displayVitals()), V.x + 16, V.y + 64, { size: 42, font: 'display', color: hex('#ffffff'), color2: hex(vcol), tracking: 0.04, shadow: hex('#000000', 0.85), soft: true });
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
    meter(g, { x: V.x + 18, y: V.y + V.h - 16, w: V.w - 32, h: 6 }, op.vitals / op.maxVitals, low ? '#ff4a3a' : '#e0443c', low ? '#7a0c10' : '#8a1016', 10);
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
    // Minimal HUD (UIX-0071): vitals, timer, tray and Litany only.
    if (settings.minimalHud) return;
    for (let i = 0; i < op.phaseCount; i++) {
      const bx = VIEW_W / 2 - ((op.phaseCount - 1) * 18) / 2 + i * 18;
      const done = i < op.phase;
      const cur = i === op.phase;
      diamond(g, bx, T.y + T.h + 12, cur ? 5 : 4, hex(done ? INK.gold : cur ? INK.goldHi : '#3a3024'), hex('#000000', 0.7));
      if (cur) g.glow(bx, T.y + T.h + 12, 12, hex(INK.gold, 0.25));
    }

    // ---- Score, patient and chain: right.
    const S = { x: VIEW_W - 16 - 250, y: 14, w: 250, h: 70 };
    glass(g, S, { strength: plateK });
    caps(g, tr('hud.score'), S.x + S.w - 18, S.y + 22, 11, hex(INK.dim), 'right');
    g.text(op.def.patient, S.x + 18, S.y + 24, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
    numerals(g, formatNumber(op.score), S.x + S.w - 18, S.y + 58, 30, INK.goldHi, INK.gold, 'right');
    if (op.combo > 1) {
      const pop = 1 + Math.max(0, 0.3 - (this.comboT ?? 0)) * 1.2;
      const C = { x: S.x + S.w - 128, y: S.y + S.h + 10, w: 128, h: 34 };
      glass(g, C, { glow: hex(INK.gold, 0.18), glowR: 12 });
      caps(g, tr('hud.chain'), C.x + 14, C.y + 22, 10, hex(INK.dim));
      numerals(g, `×${op.combo}`, C.x + C.w - 14, C.y + 25, 22 * Math.min(1.25, pop), INK.goldHi, INK.gold, 'right');
    }
  }

  private drawBanner(g: Gfx): void {
    const b = this.banner;
    if (!b) return;
    const objective = this.op.def.phases[b.phase]?.objective;
    // The objective stays as a small line under the phase lozenges for the rest of the phase.
    if (objective && b.t > 2 && !settings.minimalHud) g.text(tSource(objective), VIEW_W / 2, 124, { size: 16, font: 'italic', color: hex(INK.text, 0.85), align: 'center', shadow: hex('#000000', 0.9), soft: true });
    if (b.t > 2 || (b.phase === 0 && !b.boss && !objective)) return;
    const still = settings.reduceMotion;
    const inK = still ? 1 : Math.min(1, b.t / 0.35);
    const a = (b.t < 1.7 ? 1 : Math.max(0, 1 - (b.t - 1.7) / 0.3)) * inK;
    const ease = 1 - (1 - inK) ** 3;
    const vr = viewRect();
    const title = b.boss ? tr('hud.banner.malison') : tr('hud.banner.phase', { n: roman(b.phase + 1) });
    const y = 196;
    band(g, y - 44, 96, a, vr.x, vr.w);
    const spread = 0.12 + 0.1 * ease;
    g.text(title.toUpperCase(), VIEW_W / 2, y + 6, { size: 38, font: 'display', color: hex(b.boss ? '#f0dcff' : INK.goldHi, a), color2: hex(b.boss ? INK.curse : INK.gold, a), align: 'center', tracking: spread, shadow: hex('#000000', 0.9 * a), soft: true });
    titleRule(g, VIEW_W / 2, y + 20, 420 * (0.6 + 0.4 * ease), a);
    if (objective) g.text(tSource(objective), VIEW_W / 2, y + 44, { size: 19, font: 'italic', color: hex(INK.text, a), align: 'center', shadow: hex('#000000', 0.9 * a), soft: true });
  }

  private drawTray(g: Gfx): void {
    const op = this.op;
    const n = op.def.tools.length;
    const frame = { x: TRAY.x - 8, y: TRAY.y - 8, w: TRAY.w + 16, h: n * (TRAY.h + TRAY.gap) - TRAY.gap + 16 };
    glass(g, frame, { strength: palette().plate > 0 ? 1.15 : 1 });
    op.def.tools.forEach((id, i) => {
      const r = this.slot(i);
      const sel = op.tool === id;
      g.plate(r.x, r.y, r.w, r.h, {
        radius: 3,
        top: hex(sel ? '#3a2c1c' : '#16110d', 0.95),
        bottom: hex(sel ? '#1e150d' : '#0a0806', 0.95),
        border: hex(sel ? INK.gold : '#5a4a34', sel ? 1 : 0.7),
        borderW: sel ? 1.6 : 1,
        inset: sel ? hex('#fff1c4', 0.18) : undefined,
        insetD: 3,
        bevel: sel ? 0.9 : 0.5,
        shadow: [0.5, 6, 2],
        glow: sel ? hex(INK.gold, 0.3) : undefined,
        glowR: 12,
      });
      toolIcon(g, id, r.x + r.w / 2 + 2, r.y + r.h / 2 + 2, sel ? 1.12 : 1.02, g.time, sel ? 'selected' : 'idle');
      // Key number: small engraved numeral in the corner.
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === id) + 1), r.x + 8, r.y + 16, { size: 12, font: 'display', tracking: 0.05, color: hex(sel ? INK.goldHi : INK.dim), shadow: hex('#000000', 0.8) });
      if (id === 'tincture' && op.injectCooldown > 0) {
        const f = op.injectCooldown / TINCTURE_COOLDOWN;
        g.rect(r.x + 2, r.y + 2 + (r.h - 4) * (1 - f), r.w - 4, (r.h - 4) * f, hex('#000000', 0.5));
        vialArt(g, r.x + r.w - 12, r.y + r.h / 2 + 2, 26, vialLevel(f), f > 0.97);
      }
    });

    // Tool name + hint: a plate beside the selected slot that fades after a switch.
    if (this.hintT > 0) {
      const info = toolInfo(op.tool);
      const r = this.slot(op.def.tools.indexOf(op.tool));
      const a = Math.min(1, this.hintT);
      const ts = settings.textScale;
      const hint = tr(`tool.${info.id}.hint`);
      const hs = Math.round(16 * ts);
      const w = Math.round(290 * ts);
      const lines = g.wrap(hint, w - 32, hs).length;
      const tip = { x: r.x + r.w + 20, y: r.y - 4, w, h: Math.round(40 * ts + lines * hs * 1.25 + 12) };
      glass(g, tip, { alpha: a });
      g.tri(tip.x, r.y + r.h / 2 - 7, tip.x, r.y + r.h / 2 + 7, tip.x - 8, r.y + r.h / 2, hex(INK.gilt, 0.75 * a));
      caps(g, tr(`tool.${info.id}.name`), tip.x + 16, tip.y + 24 * ts, Math.round(13 * ts), hex(INK.gold, a));
      if (a > 0.3) keycap(g, glyphFor(`tool.select.${TOOL_INFO.findIndex((ti) => ti.id === info.id) + 1}` as ActionId), tip.x + tip.w - 40, tip.y + 20 * ts, 11, a);
      g.textBlock(hint, tip.x + 16, tip.y + 34 * ts + hs * 0.75, tip.w - 32, { size: hs, color: hex(INK.text, a), shadow: false }, 1.25);
    }

    // Litany reliquary (only once the rite has been learned), bottom right.
    if (op.def.litany === false) return;
    const lx = VIEW_W - 60;
    const ly = 664 + anchorShift('bottom');
    const ready = op.canInvokeLitany();
    g.plate(lx - 40, ly - 40, 80, 80, { radius: 40, top: hex('#1a1411', 0.88), bottom: hex('#0a0807', 0.92), border: hex(ready ? INK.gold : '#5a4a34', 0.9), borderW: 1.4, bevel: 0.7, shadow: [0.6, 14, 4], glow: ready ? hex(INK.gold, 0.22) : undefined, glowR: 16 });
    starReliquary(g, lx, ly, 28, { fill: op.litanyTime > 0 ? op.litanyTime / LITANY_DURATION : ready ? 1 : 0, spent: !ready && op.litanyTime <= 0, glint: ready, active: op.litanyTime > 0 });
    const label = ready ? { draw: `${dragGlyphFor('litany.draw')} ★`, key: glyphFor('litany.key'), both: `${dragGlyphFor('litany.draw')} ★ / ${glyphFor('litany.key')}` }[litanyMode()] : op.litanyTime > 0 ? tr('hud.litany.active') : tr('hud.litany.spent');
    caps(g, tr('hud.litany'), lx - 52, ly - 8, 11, hex(ready ? INK.gold : INK.faint), 'right');
    g.text(label, lx - 52, ly + 14, { size: 16, font: 'italic', color: hex(ready ? INK.text : INK.faint, 0.9), align: 'right', shadow: hex('#000000', 0.8), soft: true });
  }

  private drawCallout(g: Gfx, t: number): void {
    const line = this.op.callouts[0];
    if (!line) return;
    // Text scale (UIX-0148): the plate grows upward and wraps rather than overflowing.
    const ts = settings.textScale;
    const size = Math.round(19 * ts);
    const textW = 700;
    const text = tSource(line, { gender: this.op.def.patientGender ?? 'unknown' });
    const lines = g.wrap(text, textW, size).length;
    const h = Math.max(78, 44 + lines * size * 1.3);
    const r = { x: VIEW_W / 2 - 400, y: 704 - h, w: 800, h };
    glass(g, r);
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
    for (const p of this.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      // Reduced Motion: popups neither rise nor pop (UIX-0152).
      const rise = still ? 0 : p.t * 40;
      const x = p.pos.x;
      const y = p.pos.y - 26 - rise;
      if (!p.rating) {
        if (/^[+\-×\d]/.test(p.text)) giltNumerals(g, p.text, x, y, 20, a);
        else g.text(tSource(p.text), x, y, { size: 20, color: withAlpha(hex(p.color), a), align: 'center' });
        continue;
      }
      const pop = still ? 1 : 1 + Math.max(0, 0.22 - p.t) * 2.2;
      const word = tr(`rating.${p.rating}`);
      // Colour filters swap the stamp inks; the stamp shapes and tilt still tell the ratings apart (UIX-0147).
      ratingCallout(g, word, x, y, still ? 1 : p.t, a, settings.colorFilter === 'none' ? RATING_INK[p.rating] : palette()[p.rating], 30);
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

