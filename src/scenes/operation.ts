import type { Cue } from '../core/audio';
import { dist, Rng, type Vec } from '../core/math';
import { Camera2D } from '../render/camera';
import type { Game, Scene } from '../core/scene';
import { hex, withAlpha } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { Sigil, surfDisc, surfLine } from '../surgery/entities';
import { Particles } from '../render/particles';
import { FlashLimiter } from '../render/flashLimiter';
import { isStar } from '../surgery/gesture';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, onBody, LITANY_DURATION, MAX_VITALS, Operation, TINCTURE_COOLDOWN, TINCTURE_TIME, type OperationDef, type Popup } from '../surgery/operation';
import { TOOL_INFO, toolInfo, type Pointer, type ToolId } from '../surgery/types';
import { anchorShift, PALETTE, viewRect, VIEW_W } from '../ui/layout';
import { button, inRect, reticle, star, toolIcon } from '../ui/widgets';
import { banner, brassBorder, divider, giltText, hourglass, leatherPanel, medallion, plaque, scroll, UI, waxSeal } from '../ui/ornaments';
import { CAST } from '../content/characters';
import { ASSISTANT_NAME } from '../content/characters';
import { vec3, type RGBA } from '../render/color';
import { settings } from '../core/settings';
import { OptionsScene } from './options';

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
  private starTrail: Vec[] = [];
  private ecg: number[] = new Array(200).fill(0);
  private beatPhase = 0;
  private pulse = 0;
  private corrupt = 0;
  private toolFlash = 0;
  private lastTool: ToolId | null = null;
  private entered = false;
  private hintT = 0;
  private particles = new Particles();
  private litanyCenter: [number, number] = [0.5, 0.5];
  private flashLimit = new FlashLimiter();
  private comboT = 0;
  private lastCombo = 0;
  /** World camera (ENG-0045/0046): pointer input is mapped through it before hit-testing. */
  readonly camera = new Camera2D();
  private worldPtr: Vec[] = [];
  /** Seeded presentation noise (ECG jitter) so screenshots are reproducible (ENG-0251). */
  private presRng = new Rng(1);
  /** Floating rating/damage text, built from the operation's `popup` events (ENG-0243). */
  private popups: Popup[] = [];
  /** Sounds requested since the last tick (deduplicated). */
  private pendingCues = new Set<Cue>();

  constructor(
    private def: OperationDef,
    private onEnd: (o: OperationOutcome) => void,
    private onQuit: () => void,
  ) {
    this.op = OperationScene.create(def);
    this.presRng = new Rng(def.seed ?? 1);
    this.listen(this.op);
  }

  /** Subscribe the presentation (popups, particles, audio) to the operation's event bus. */
  private listen(op: Operation): void {
    op.events.on('popup', (p) => this.popups.push({ ...p, t: 0 }));
    op.events.on('fx', (e) => this.particles.spawn(e));
    op.events.on('cue', (c) => this.pendingCues.add(c));
  }

  /** Apply player assists to the operation definition. */
  private static create(def: OperationDef): Operation {
    return new Operation(settings.timerAssist === 1 ? def : { ...def, timeLimit: Math.round(def.timeLimit * settings.timerAssist) });
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
    this.op = OperationScene.create(this.def);
    this.presRng = new Rng(this.def.seed ?? 1);
    this.popups.length = 0;
    this.pendingCues.clear();
    this.listen(this.op);
    this.camera.reset();
    this.particles = new Particles();
    this.paused = false;
    this.endT = 0;
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    const op = this.op;

    if (input.keyPressed('Escape') && op.status !== 'won' && op.status !== 'lost') this.paused = !this.paused;
    // Pause stops sim and world clocks; UI keeps animating (ENG-0057). The Litany scales world time.
    if (game.clock) {
      game.clock.paused = this.paused;
      game.clock.worldScale = op.timeScale;
    }
    if (this.paused) return;
    this.camera.update(dt);

    // Tool selection: hotkeys, wheel, or clicking the tray.
    for (const t of TOOL_INFO) if (input.keyPressed(t.code)) op.setTool(t.id);
    if (input.wheel) op.cycleTool(input.wheel);
    if (input.keyPressed('KeyQ')) op.cycleTool(-1);
    if (input.keyPressed('KeyE')) op.cycleTool(1);
    if (input.keyPressed('Tab')) op.quickSwap();
    let trayClick = false;
    op.def.tools.forEach((id, i) => {
      if (input.pressed && inRect(input.pos, this.slot(i))) {
        op.setTool(id);
        trayClick = true;
      }
    });
    if (op.tool !== this.lastTool) {
      this.toolFlash = 1;
      this.hintT = 2.5;
    }
    this.hintT = Math.max(0, this.hintT - dt);
    if (op.combo !== this.lastCombo) {
      this.comboT = 0;
      this.lastCombo = op.combo;
    }
    this.comboT += dt;
    this.lastTool = op.tool;
    this.toolFlash = Math.max(0, this.toolFlash - dt * 3);

    // Litany: draw a star with the right mouse button (or press Space with the assist on).
    if (settings.litanyKey && input.keyPressed('Space')) {
      if (!op.invokeLitany() && op.def.litany !== false) op.popup(op.litanyUsed ? 'The Litany is spent.' : 'Not now.', input.pos, PALETTE.inkDim);
    }
    if (input.rightDown) this.starTrail.push({ ...input.pos });
    else if (this.starTrail.length) {
      if (isStar(this.starTrail)) {
        const cx = this.starTrail.reduce((a, p) => a + p.x, 0) / this.starTrail.length;
        const cy = this.starTrail.reduce((a, p) => a + p.y, 0) / this.starTrail.length;
        this.litanyCenter = [cx / VIEW_W, 1 - cy / 720];
        if (!op.invokeLitany()) op.popup(op.litanyUsed ? 'The Litany is spent.' : 'Not now.', input.pos, PALETTE.inkDim);
      } else if (this.starTrail.length > 8) op.popup('The sign falters…', input.pos, PALETTE.inkDim);
      this.starTrail = [];
    }

    // Replay every pointer sample since last frame so fast zig-zags aren't lost at low frame rates.
    // Samples are mapped from view space into world space through the camera (ENG-0046).
    const path = this.toWorldPath(input.path);
    const down = input.down && !trayClick && !input.rightDown;
    let prev = this.camera.toWorld(input.prev);
    path.forEach((pos, i) => {
      const ptr: Pointer = {
        pos,
        prev,
        down: down || (input.released && i < path.length - 1),
        pressed: input.pressed && !trayClick && i === 0,
        released: input.released && i === path.length - 1,
      };
      if (pos.x > TRAY.x + TRAY.w + 10 || !ptr.pressed) op.handlePointer(ptr, dt / path.length);
      prev = pos;
    });
    op.update(dt);

    // Heartbeat drives the ECG trace, the organ swell and (when failing) an audible thump.
    const bpm = op.status === 'lost' ? 0 : 58 + (MAX_VITALS - op.vitals) * 0.9;
    this.beatPhase += (dt * bpm) / 60;
    if (this.beatPhase >= 1) {
      this.beatPhase -= 1;
      if (op.vitals < 45 && op.status === 'running') game.audio.play('heartbeat');
    }
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

    for (const c of this.pendingCues) game.audio.play(c);
    this.pendingCues.clear();
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

  /** Map view-space pointer samples to world space, reusing buffers (no per-tick allocation). */
  private toWorldPath(path: Vec[]): Vec[] {
    const out = this.worldPtr;
    while (out.length < path.length) out.push({ x: 0, y: 0 });
    for (let i = 0; i < path.length; i++) this.camera.toWorld(path[i], out[i]);
    out.length = path.length;
    return out;
  }

  private slot(i: number) {
    return { x: TRAY.x, y: TRAY.y + i * (TRAY.h + TRAY.gap), w: TRAY.w, h: TRAY.h };
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    const pal = organPalette(op.def);
    const t = g.time;
    const sk = op.shake * settings.shake;
    const shake = sk > 0 ? { x: (Math.random() - 0.5) * sk, y: (Math.random() - 0.5) * sk } : { x: 0, y: 0 };

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
      lights: [
        { x: light.x, y: light.y, h: 1.1, i: 1.1, col: [0.95, 0.9, 0.82] },
        { x: FIELD.cx - FIELD.rx - 60, y: FIELD.cy + 120, h: 0.35, i: 0.45 * (0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 4.1)), col: [1.0, 0.6, 0.3] },
        { x: FIELD.cx + FIELD.rx + 60, y: FIELD.cy - 60, h: 0.35, i: 0.4 * (0.85 + 0.15 * Math.sin(t * 8.1 + 2.0) * Math.sin(t * 3.3)), col: [1.0, 0.62, 0.32] },
      ],
    });
    g.fluidComposite(light);
    for (const e of ents) e.draw(g, op);
    this.particles.draw(g);

    // Scrying lens: shimmer where something hides.
    if (op.tool === 'lens') {
      g.glow(game.input.pos.x, game.input.pos.y, 90, hex('#8ab8ff', 0.12));
      for (const e of op.entities) {
        if (!e.alive || !e.hidden || dist(e.pos, game.input.pos) > 110) continue;
        g.arc(e.pos.x, e.pos.y, 16 + Math.sin(t * 6) * 4, 2, hex('#b9d7ff', 0.6));
      }
    }

    if (this.starTrail.length > 1) {
      g.setBlend('add');
      g.polyline(this.starTrail, 8, hex('#f5d76e', 0.25));
      g.polyline(this.starTrail, 3, hex('#fff0b0', 0.9));
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
      litanyCenter: this.litanyCenter,
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

    if (op.status === 'intro') {
      const a = Math.min(1, op.elapsed * 3);
      banner(g, VIEW_W / 2, 300, 520, 70);
      giltText(g, op.def.title, VIEW_W / 2, 350, { size: 50 * (0.9 + 0.1 * a), align: 'center' });
      g.text(op.def.patient, VIEW_W / 2, 400, { size: 24, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    }
    if (op.status === 'won') {
      banner(g, VIEW_W / 2, 310, 620, 76);
      giltText(g, 'Operation Complete', VIEW_W / 2, 364, { size: 56, align: 'center' });
    }
    if (op.status === 'lost') {
      banner(g, VIEW_W / 2, 300, 620, 76, '#1a0a0a');
      g.text('The Patient Is Lost', VIEW_W / 2, 354, { size: 54, font: 'display', color: hex('#e04848'), color2: hex('#7a0c10'), align: 'center' });
      g.text(op.lostReason, VIEW_W / 2, 410, { size: 24, font: 'italic', color: hex(UI.parch), align: 'center' });
    }

    if (this.paused) this.drawPause(g, game);

    // Cursor: reticle at the tip with the instrument beside it.
    const p = game.input.pos;
    if (op.tool === 'tincture' && op.injectT > 0) g.arc(p.x, p.y, 18, 3, hex(PALETTE.good), op.injectT / TINCTURE_TIME);
    toolIcon(g, op.tool, p.x + 20, p.y - 20, 0.8 + this.toolFlash * 0.3, t);
    reticle(g, p);
    g.endFrame();
  }

  private drawHud(g: Gfx): void {
    const op = this.op;
    const t = g.time;
    const vcol = op.vitals > 60 ? '#8fe0a0' : op.vitals > 30 ? '#f0c060' : '#ff5040';

    // ---- Vitals: heart medallion, engraved number, blood tube and a phosphor pulse-glass.
    leatherPanel(g, { x: 14, y: 10, w: 410, h: 72 }, { corners: false });
    const beat = 1 + this.pulse * 0.18;
    medallion(g, 52, 46, 27, hex('#240608'));
    heart(g, 52, 48, 14 * beat, hex(op.vitals > 30 ? '#c0182a' : '#ff3030'));
    g.glow(52, 48, 30 * beat, hex('#ff2030', 0.15 + this.pulse * 0.25));
    g.text('VITALS', 92, 30, { size: 13, color: hex(UI.brass), shadow: false });
    g.text(String(Math.ceil(op.vitals)).padStart(2, '0'), 92, 64, { size: 38, font: 'body', color: hex('#ffffff'), color2: hex(vcol), shadow: hex('#000000', 0.9) });
    // Blood tube.
    const tube = { x: 92, y: 71, w: 52, h: 5 };
    g.rect(tube.x, tube.y, tube.w, tube.h, hex('#000000', 0.7));
    g.rectGrad(tube.x, tube.y, (tube.w * op.vitals) / MAX_VITALS, tube.h, hex('#e03040'), hex('#6a0810'));
    g.rectLine(tube.x - 1, tube.y - 1, tube.w + 2, tube.h + 2, 1, hex(UI.brass, 0.7));
    // Pulse-glass.
    g.rectGrad(ECG.x, ECG.y, ECG.w, ECG.h, hex('#04120a'), hex('#020805'));
    for (let gx = ECG.x + 16; gx < ECG.x + ECG.w; gx += 16) g.rect(gx, ECG.y, 1, ECG.h, hex('#1a3a24', 0.5));
    for (let gy = ECG.y + 11; gy < ECG.y + ECG.h; gy += 11) g.rect(ECG.x, gy, ECG.w, 1, hex('#1a3a24', 0.5));
    const pts: Vec[] = this.ecg.map((v, i) => ({ x: ECG.x + 3 + (i / (this.ecg.length - 1)) * (ECG.w - 6), y: ECG.y + ECG.h * 0.64 - v * ECG.h * 0.5 }));
    g.setBlend('add');
    g.polyline(pts, 5, hex(vcol, 0.18));
    g.polyline(pts, 2, hex(vcol, 0.95));
    const head = pts[pts.length - 1];
    g.circleGrad(head.x, head.y, 8, hex(vcol, 0.8), hex(vcol, 0));
    g.setBlend('alpha');
    g.rectGrad(ECG.x, ECG.y, ECG.w, ECG.h * 0.4, hex('#ffffff', 0.06), hex('#ffffff', 0));
    brassBorder(g, ECG, 3);

    // ---- Title banner, hourglass timer and phase beads.
    banner(g, VIEW_W / 2, 6, 360, 30);
    giltText(g, op.def.title, VIEW_W / 2, 28, { size: 20, align: 'center' });
    const pl = { x: VIEW_W / 2 - 78, y: 40, w: 156, h: 40 };
    plaque(g, pl);
    hourglass(g, pl.x + 26, pl.y + 20, 26, op.timeLeft / op.def.timeLimit, t);
    const mm = Math.floor(op.timeLeft / 60);
    const ss = Math.floor(op.timeLeft % 60);
    const low = op.timeLeft < 20 && op.status === 'running';
    const tcol = op.litanyTime > 0 ? UI.gilt : low ? (Math.sin(t * 8) > 0 ? '#ff5040' : '#a02018') : UI.parch;
    g.text(`${mm}:${String(ss).padStart(2, '0')}`, pl.x + 98, pl.y + 31, { size: 28, color: hex(tcol), align: 'center' });
    for (let i = 0; i < op.phaseCount; i++) {
      const bx = VIEW_W / 2 - ((op.phaseCount - 1) * 16) / 2 + i * 16;
      const done = i < op.phase;
      const cur = i === op.phase;
      g.circle(bx, 92, cur ? 5.5 : 4.5, hex('#000000', 0.5));
      g.circleGrad(bx, 91, cur ? 5 : 4, hex(done ? UI.gilt : cur ? '#e8c8a0' : '#4a3a28'), hex(done ? UI.giltLo : cur ? '#8a6a48' : '#241a10'));
    }

    // ---- Score and chain.
    leatherPanel(g, { x: VIEW_W - 280, y: 10, w: 266, h: 72 }, { corners: false });
    g.text(op.def.patient, VIEW_W - 30, 30, { size: 15, font: 'italic', color: hex(UI.parchLo), align: 'right', shadow: false });
    giltText(g, String(op.score), VIEW_W - 30, 68, { size: 34, font: 'body', align: 'right' });
    if (op.combo > 1) {
      const pop = 1 + Math.max(0, 0.3 - (this.comboT ?? 0)) * 1.2;
      waxSeal(g, VIEW_W - 238, 46, 24 * pop, UI.wax);
      g.text(`×${op.combo}`, VIEW_W - 238, 54, { size: 22 * pop, color: hex('#ffe0c0'), align: 'center', shadow: hex('#3a0406', 0.8) });
      g.text('chain', VIEW_W - 238, 80, { size: 12, font: 'italic', color: hex(UI.brass), align: 'center', shadow: false });
    }
  }

  private drawTray(g: Gfx): void {
    const op = this.op;
    const n = op.def.tools.length;
    leatherPanel(g, { x: TRAY.x - 6, y: TRAY.y - 8, w: TRAY.w + 12, h: n * (TRAY.h + TRAY.gap) + 10 }, { corners: false, border: 3 });
    op.def.tools.forEach((id, i) => {
      const r = this.slot(i);
      const sel = op.tool === id;
      const ox = sel ? 4 : 0;
      // Recessed pocket.
      g.rectGrad(r.x + 2, r.y + 2, r.w - 4, r.h - 4, hex('#0a0504'), hex('#1e0e0a'));
      g.rect(r.x + 2, r.y + 2, r.w - 4, 3, hex('#000000', 0.5));
      if (sel) {
        g.glow(r.x + r.w / 2 + ox, r.y + r.h / 2, 46, hex('#ffb050', 0.22));
        brassBorder(g, { x: r.x + 2 + ox, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, 2);
      }
      toolIcon(g, id, r.x + r.w / 2 + 6 + ox, r.y + r.h / 2 + 1, sel ? 1.05 : 0.82, g.time);
      // Engraved key tag.
      g.circleGrad(r.x + 13, r.y + 14, 10, hex(sel ? UI.brassHi : '#c8a050'), hex(UI.brassLo));
      g.text(toolInfo(id).key, r.x + 13, r.y + 20, { size: 17, color: hex('#140a02'), align: 'center', shadow: false });
      if (id === 'tincture' && op.injectCooldown > 0) {
        const f = op.injectCooldown / TINCTURE_COOLDOWN;
        g.rect(r.x + 2, r.y + 2 + (r.h - 4) * (1 - f), r.w - 4, (r.h - 4) * f, hex('#000000', 0.65));
      }
    });

    // Tool name + hint: a tooltip beside the selected slot that fades after a switch.
    if (this.hintT > 0) {
      const info = toolInfo(op.tool);
      const r = this.slot(op.def.tools.indexOf(op.tool));
      const a = Math.min(1, this.hintT);
      const tip = { x: r.x + r.w + 14, y: r.y + 2, w: 250, h: r.h - 4 };
      g.rect(tip.x + 3, tip.y + 4, tip.w, tip.h, hex('#000000', 0.4 * a));
      g.rectGrad(tip.x, tip.y, tip.w, tip.h, hex('#ecdcb4', 0.95 * a), hex('#cdb688', 0.95 * a));
      g.tri(tip.x, tip.y + tip.h / 2 - 7, tip.x, tip.y + tip.h / 2 + 7, tip.x - 8, tip.y + tip.h / 2, hex('#ddc9a0', 0.95 * a));
      g.text(info.name, tip.x + 10, tip.y + 19, { size: 17, color: hex('#6a0a10', a), shadow: false });
      g.textBlock(info.hint, tip.x + 10, tip.y + 35, tip.w - 20, { size: 13, color: hex(UI.inkDark, a), shadow: false }, 1.15);
    }

    // Litany medallion (only once the rite has been learned).
    if (op.def.litany === false) return;
    const lx = 54;
    const ly = 674 + anchorShift('bottom');
    const ready = op.canInvokeLitany();
    medallion(g, lx, ly, 30, hex(ready ? '#2a1a06' : '#120a08'));
    if (ready) g.glow(lx, ly, 48, hex(UI.gilt, 0.2 + 0.1 * Math.sin(g.time * 3)));
    star(g, lx, ly + 1, 19, ready ? hex(UI.gilt) : hex('#3a3024'));
    if (op.litanyTime > 0) {
      g.glow(lx, ly, 60, hex(UI.gilt, 0.35));
      g.arc(lx, ly, 34, 4, hex(UI.gilt), op.litanyTime / LITANY_DURATION);
    }
    const label = ready ? (settings.litanyKey ? 'Space' : 'Right-drag ★') : op.litanyTime > 0 ? 'Stillness' : 'Spent';
    g.text(label, lx + 42, ly + 6, { size: 14, font: 'italic', color: hex(ready ? UI.gilt : UI.parchLo, 0.9) });
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
    const r = { x: mx + 44, y: 652, w: 840, h: 50 };
    scroll(g, r);
    g.text(ASSISTANT_NAME, r.x + 16, r.y + 20, { size: 15, color: hex('#6a0a10'), shadow: false });
    const shown = line.slice(0, Math.floor(this.op.calloutT * 60));
    g.text(shown, r.x + 16, r.y + 41, { size: 19, color: hex(UI.inkDark), shadow: false });
  }

  private drawPopups(g: Gfx): void {
    for (const p of this.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      const rise = p.t * 40;
      const x = p.pos.x;
      const y = p.pos.y - 26 - rise;
      if (!p.rating) {
        g.text(p.text, x, y, { size: 20, color: withAlpha(hex(p.color), a), align: 'center' });
        continue;
      }
      const pop = 1 + Math.max(0, 0.22 - p.t) * 2.2;
      const word = { cool: 'Cool', good: 'Good', bad: 'Bad', miss: 'Miss' }[p.rating];
      const [c1, c2] = {
        cool: [UI.gilt, UI.giltLo],
        good: ['#e8f0f0', '#8aa0a8'],
        bad: ['#e0955a', '#7a3a14'],
        miss: ['#ff5a5a', '#6a0808'],
      }[p.rating];
      if (p.rating === 'cool') {
        g.glow(x, y - 12, 60 * pop, hex(UI.gilt, 0.28 * a));
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + p.t * 2;
          g.line({ x: x + Math.cos(ang) * 22 * pop, y: y - 12 + Math.sin(ang) * 14 * pop }, { x: x + Math.cos(ang) * 40 * pop, y: y - 12 + Math.sin(ang) * 24 * pop }, 1.5, hex(UI.gilt, 0.5 * a));
        }
      }
      g.text(word, x, y, { size: 34 * pop, font: 'display', color: hex(c1, a), color2: hex(c2, a), align: 'center', shadow: hex('#0a0402', 0.85 * a) });
      if (p.label) g.text(p.label, x, y - 36 * pop, { size: 16, font: 'italic', color: hex(UI.parch, a * 0.9), align: 'center' });
      if (p.combo && p.combo > 1 && (p.rating === 'cool' || p.rating === 'good')) g.text(`chain ×${p.combo}`, x, y + 20, { size: 15, color: hex(UI.gilt, a * 0.9), align: 'center' });
    }
  }

  private drawPause(g: Gfx, game: Game): void {
    const vr = viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.6));
    leatherPanel(g, { x: 430, y: 150, w: 420, h: 400 });
    giltText(g, 'Respite', VIEW_W / 2, 222, { size: 50, align: 'center' });
    divider(g, VIEW_W / 2, 248, 260);
    if (button(g, game.input, 'Resume', VIEW_W / 2, 310)) this.paused = false;
    if (button(g, game.input, 'Begin Again', VIEW_W / 2, 370)) this.restart();
    if (button(g, game.input, 'Options', VIEW_W / 2, 430)) {
      // Options is an overlay over the live (paused) operation (ENG-0063).
      if (game.push && game.pop) game.push(new OptionsScene(() => game.pop!(), 'overlay'));
      else game.go(new OptionsScene(() => game.go(this)));
    }
    if (button(g, game.input, 'Abandon the Patient', VIEW_W / 2, 490)) this.onQuit();
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
