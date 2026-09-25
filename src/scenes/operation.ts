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
import { banner, divider, giltText, hourglass, leatherPanel, medallion, plaque, scroll, UI } from '../ui/ornaments';
import { buttonSurface } from '../ui/widgets';
import { DamageAggregator, ToolHints } from '../ui/hudPrefs';
import { bloodScale, GORE_LEVEL, presentation } from '../render/presentation';
import { highContrast, palette } from '../ui/theme';
import { giltNumerals, snuffedVeil } from '../ui/ornaments';
import { ledgerArt, ratingStamp, ribbonArt, starReliquary, tallyRibbon, tinctureGauge, trayPocketArt, vialArt } from '../art/kit';
import { cursorTint, quillTrace, vialLevel } from '../art/hud';
import { CAST } from '../content/characters';
import { ASSISTANT_NAME } from '../content/characters';
import { vec3, type RGBA } from '../render/color';
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

const TRAY = { x: 14, y: 106, w: 88, h: 58, gap: 6 };
const ECG = { x: 160, y: 20, w: 252, h: 52 };

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

    if (op.status === 'intro') {
      const a = Math.min(1, op.elapsed * 3);
      banner(g, VIEW_W / 2, 300, 520, 70);
      giltText(g, op.def.title, VIEW_W / 2, 350, { size: 50 * (0.9 + 0.1 * a), align: 'center' });
      g.text(op.def.patient, VIEW_W / 2, 400, { size: 24, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    }
    if (op.status === 'won') {
      banner(g, VIEW_W / 2, 310, 620, 76);
      giltText(g, tr('hud.op_complete'), VIEW_W / 2, 364, { size: 56, align: 'center' });
    }
    if (op.status === 'lost') {
      banner(g, VIEW_W / 2, 300, 620, 76, '#1a0a0a');
      g.text(tr('hud.patient_lost'), VIEW_W / 2, 354, { size: 54, font: 'display', color: hex('#e04848'), color2: hex('#7a0c10'), align: 'center' });
      g.text(tSource(op.lostReason), VIEW_W / 2, 410, { size: 24, font: 'italic', color: hex(UI.parch), align: 'center' });
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

    // ---- Vitals: heart medallion, engraved number, blood tube and a phosphor pulse-glass.
    leatherPanel(g, { x: 14, y: 10, w: 410, h: 72 }, { corners: false });
    const beat = 1 + this.pulse * 0.18;
    medallion(g, 52, 46, 27, hex('#240608'));
    heart(g, 52, 48, 14 * beat, hex(op.vitals > 30 ? '#c0182a' : '#ff3030'));
    g.glow(52, 48, 30 * (settings.reduceMotion ? 1 : beat), hex('#ff2030', settings.reduceMotion ? 0.25 : 0.15 + this.pulse * 0.25));
    // High contrast (UIX-0149): solid plates behind the HUD's numbers.
    if (pal.plate > 0) {
      g.rect(86, 16, 64, 56, hex('#000000', pal.plate));
      g.rect(VIEW_W / 2 - 20, 44, 96, 34, hex('#000000', pal.plate));
      if (!settings.minimalHud) g.rect(VIEW_W - 200, 44, 184, 34, hex('#000000', pal.plate));
    }
    g.text(tr('hud.vitals'), 92, 30, { size: 16, color: hex(UI.brass), shadow: false });
    g.text(formatVitals(op.displayVitals()), 92, 64, { size: 38, font: 'body', color: hex('#ffffff'), color2: hex(vcol), shadow: hex('#000000', 0.9) });
    drawDrainArrow(g, op, 146, 50);
    drawSecondaryVitals(g, op, 160, 80);
    tinctureGauge(g, { x: 88, y: 66, w: 64, h: 13 }, op.vitals / op.maxVitals, op.vitals < 30 ? 1 - op.vitals / 30 : 0, this.pulse);
    quillTrace(g, ECG, this.ecg, op.vitals, t);

    // ---- Title banner, hourglass timer and phase beads.
    banner(g, VIEW_W / 2, 6, 360, 30);
    giltText(g, op.def.title, VIEW_W / 2, 28, { size: 20, align: 'center' });
    const pl = { x: VIEW_W / 2 - 78, y: 40, w: 156, h: 40 };
    plaque(g, pl);
    hourglass(g, pl.x + 26, pl.y + 20, 26, op.timeLeft / op.def.timeLimit, t);
    const low = op.timeLeft < op.tuning.flow.timerWarn && op.status === 'running';
    const tcol = op.litanyTime > 0 ? UI.gilt : low ? (Math.sin(t * 8) > 0 ? '#ff5040' : '#a02018') : UI.parch;
    g.text(formatClock(op.timeLeft), pl.x + 98, pl.y + 31, { size: 28, color: hex(tcol), align: 'center' });
    // Minimal HUD (UIX-0071): vitals, timer, tray and Litany only.
    if (settings.minimalHud) return;
    for (let i = 0; i < op.phaseCount; i++) {
      const bx = VIEW_W / 2 - ((op.phaseCount - 1) * 16) / 2 + i * 16;
      const done = i < op.phase;
      const cur = i === op.phase;
      g.circle(bx, 92, cur ? 5.5 : 4.5, hex('#000000', 0.5));
      g.circleGrad(bx, 91, cur ? 5 : 4, hex(done ? UI.gilt : cur ? '#e8c8a0' : '#4a3a28'), hex(done ? UI.giltLo : cur ? '#8a6a48' : '#241a10'));
    }

    // ---- Score and chain.
    leatherPanel(g, { x: VIEW_W - 280, y: 10, w: 266, h: 72 }, { corners: false });
    g.text(op.def.patient, VIEW_W - 30, 30, { size: 16, font: 'italic', color: hex(UI.parchLo), align: 'right', shadow: false });
    giltText(g, formatNumber(op.score), VIEW_W - 30, 68, { size: 34, font: 'body', align: 'right' });
    if (op.combo > 1) {
      const pop = 1 + Math.max(0, 0.3 - (this.comboT ?? 0)) * 1.2;
      tallyRibbon(g, VIEW_W - 150, 100, 190 * Math.min(1.1, pop), 26, op.combo);
      g.text(tr('hud.combo', { combo: op.combo }), VIEW_W - 238, 54, { size: 22 * pop, color: hex('#ffe0c0'), align: 'center', shadow: hex('#3a0406', 0.8) });
      g.text(tr('hud.chain'), VIEW_W - 238, 80, { size: 16, font: 'italic', color: hex(UI.brass), align: 'center', shadow: false });
    }
  }

  private drawTray(g: Gfx): void {
    const op = this.op;
    const n = op.def.tools.length;
    leatherPanel(g, { x: TRAY.x - 6, y: TRAY.y - 8, w: TRAY.w + 12, h: Math.max(n, 8) * (TRAY.h + TRAY.gap) + 10 }, { corners: false, border: 3 });
    for (let i = n; i < 8; i++) trayPocketArt(g, { x: TRAY.x + 2, y: TRAY.y + i * (TRAY.h + TRAY.gap) + 2, w: TRAY.w - 4, h: TRAY.h - 4 }, false);
    op.def.tools.forEach((id, i) => {
      const r = this.slot(i);
      const sel = op.tool === id;
      const ox = sel ? 4 : 0;
      trayPocketArt(g, { x: r.x + 2 + ox, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, sel);
      toolIcon(g, id, r.x + r.w / 2 + 6 + ox, r.y + r.h / 2 + 1, sel ? 1.05 : 0.82, g.time, sel ? 'selected' : 'idle');
      // Engraved key tag.
      g.circleGrad(r.x + 13, r.y + 14, 10, hex(sel ? UI.brassHi : '#c8a050'), hex(UI.brassLo));
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === id) + 1), r.x + 13, r.y + 20, { size: 17, color: hex('#140a02'), align: 'center', shadow: false });
      if (id === 'tincture' && op.injectCooldown > 0) {
        const f = op.injectCooldown / TINCTURE_COOLDOWN;
        g.rect(r.x + 2, r.y + 2 + (r.h - 4) * (1 - f), r.w - 4, (r.h - 4) * f, hex('#000000', 0.45));
        vialArt(g, r.x + r.w - 13, r.y + r.h / 2 + 2, 30, vialLevel(f), f > 0.97);
      }
    });

    // Tool name + hint: a tooltip beside the selected slot that fades after a switch.
    if (this.hintT > 0) {
      const info = toolInfo(op.tool);
      const r = this.slot(op.def.tools.indexOf(op.tool));
      const a = Math.min(1, this.hintT);
      const ts = settings.textScale;
      const tip = { x: r.x + r.w + 14, y: r.y + 2, w: Math.round(250 * ts), h: Math.round((r.h - 4) * (0.4 + 0.6 * ts * ts)) };
      g.rect(tip.x + 3, tip.y + 4, tip.w, tip.h, hex('#000000', 0.4 * a));
      g.rectGrad(tip.x, tip.y, tip.w, tip.h, hex('#ecdcb4', 0.95 * a), hex('#cdb688', 0.95 * a));
      g.tri(tip.x, tip.y + tip.h / 2 - 7, tip.x, tip.y + tip.h / 2 + 7, tip.x - 8, tip.y + tip.h / 2, hex('#ddc9a0', 0.95 * a));
      g.text(tr(`tool.${info.id}.name`), tip.x + 10, tip.y + 19 * ts, { size: Math.round(17 * ts), color: hex('#6a0a10', a), shadow: false });
      g.textBlock(tr(`tool.${info.id}.hint`), tip.x + 10, tip.y + 35 * ts, tip.w - 20, { size: Math.round(13 * ts), color: hex(UI.inkDark, a), shadow: false }, 1.15);
    }

    // Litany medallion (only once the rite has been learned).
    if (op.def.litany === false) return;
    const lx = 54;
    const ly = 674 + anchorShift('bottom');
    const ready = op.canInvokeLitany();
    starReliquary(g, lx, ly, 32, { fill: op.litanyTime > 0 ? op.litanyTime / LITANY_DURATION : ready ? 1 : 0, spent: !ready && op.litanyTime <= 0, glint: ready, active: op.litanyTime > 0 });
    const label = ready ? { draw: `${dragGlyphFor('litany.draw')} ★`, key: glyphFor('litany.key'), both: `${dragGlyphFor('litany.draw')} ★ / ${glyphFor('litany.key')}` }[litanyMode()] : op.litanyTime > 0 ? tr('hud.litany.active') : tr('hud.litany.spent');
    g.text(label, lx + 42, ly + 6, { size: 16, font: 'italic', color: hex(ready ? UI.gilt : UI.parchLo, 0.9) });
  }

  private drawCallout(g: Gfx, t: number): void {
    const line = this.op.callouts[0];
    if (!line) return;
    const mx = 238;
    const my = 676;
    medallion(g, mx, my, 30, hex('#1a2a20'));
    const talking = this.op.calloutT * 60 < line.length;
    g.portrait(mx - 34, my - 44, 68, 86, {
      style: 1,
      rim: vec3(CAST.ilse.color),
      cloth: vec3(CAST.ilse.cloth ?? '#3e454e'),
      skin: vec3(CAST.ilse.skin ?? '#d8b098'),
      active: 1,
      seed: 3,
      talk: talking ? 0.5 + 0.5 * Math.sin(t * 16) : 0,
    });
    // Text scale (UIX-0148): the callout grows upward and wraps rather than overflowing.
    const ts = settings.textScale;
    const size = Math.round(19 * ts);
    const lines = Math.ceil(g.measure(line, size) / 800);
    const h = Math.max(50, 30 + lines * size * 1.3);
    const r = { x: mx + 44, y: 702 - h, w: 840, h };
    scroll(g, r);
    g.text(ASSISTANT_NAME, r.x + 16, r.y + 20, { size: 16, color: hex('#6a0a10'), shadow: false });
    const shown = line.slice(0, Math.floor(this.op.calloutT * 60 * settings.textSpeed));
    g.textBlock(shown, r.x + 16, r.y + 22 + size, 808, { size, color: hex(UI.inkDark), shadow: false }, 1.3);
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
      ratingStamp(g, p.rating, word, x, y, still ? 1 : p.t, a, 30, settings.colorFilter === 'none' ? undefined : palette()[p.rating]);
      if (p.label) g.text(tSource(p.label), x, y - 36 * pop, { size: 16, font: 'italic', color: hex(UI.parch, a * 0.9), align: 'center' });
      if (p.combo && p.combo > 1 && (p.rating === 'cool' || p.rating === 'good')) g.text(tr('hud.chain_combo', { combo: p.combo }), x, y + 20, { size: 16, color: hex(UI.gilt, a * 0.9), align: 'center' });
    }
  }

  private drawPause(g: Gfx, game: Game): void {
    const vr = viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.3));
    snuffedVeil(g, VIEW_W, 720, g.time);
    ledgerArt(g, { x: 430, y: 150, w: 420, h: 400 });
    ribbonArt(g, VIEW_W / 2, 186, 330, 44, '#4a0a0e');
    buttonSurface('parchment');
    giltText(g, tr('hud.pause.title'), VIEW_W / 2, 222, { size: 50, align: 'center' });
    divider(g, VIEW_W / 2, 248, 260);
    if (button(g, game.input, tr('hud.pause.resume'), VIEW_W / 2, 310)) this.paused = false;
    if (button(g, game.input, tr('hud.pause.restart'), VIEW_W / 2, 370)) this.restart();
    if (button(g, game.input, tr('hud.pause.options'), VIEW_W / 2, 430)) {
      // Options is an overlay over the live (paused) operation (ENG-0063).
      if (game.push && game.pop) game.push(new OptionsScene(() => game.pop!(), 'overlay'));
      else game.go(new OptionsScene(() => game.go(this)));
    }
    if (button(g, game.input, tr('hud.pause.abandon'), VIEW_W / 2, 490)) this.onQuit();
    buttonSurface('dark');
  }
}

/** One heartbeat, phase 0..1 → amplitude (P wave, QRS spike, T wave). */
export function ecgWave(ph: number): number {
  const bump = (c: number, w: number, h: number) => h * Math.exp(-(((ph - c) / w) ** 2));
  return bump(0.1, 0.025, 0.12) - bump(0.19, 0.008, 0.15) + bump(0.21, 0.01, 1) - bump(0.235, 0.01, 0.3) + bump(0.42, 0.05, 0.25);
}

/** A stylised heart, for the vitals medallion. */
function heart(g: Gfx, x: number, y: number, s: number, c: RGBA): void {
  g.circle(x - s * 0.5, y - s * 0.3, s * 0.55, c);
  g.circle(x + s * 0.5, y - s * 0.3, s * 0.55, c);
  g.tri(x - s * 1.02, y - s * 0.15, x + s * 1.02, y - s * 0.15, x, y + s * 1.0, c);
  g.circle(x - s * 0.55, y - s * 0.45, s * 0.18, hex('#ffffff', 0.35));
}
