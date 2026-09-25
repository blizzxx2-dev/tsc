import type { Cue } from '../core/audio';
import { dist, type Vec } from '../core/math';
import type { Game, Scene } from '../core/scene';
import { hex, withAlpha } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { Sigil } from '../surgery/entities';
import { isStar } from '../surgery/gesture';
import { Malison, MalisonShard } from '../surgery/malison';
import { FIELD, LITANY_DURATION, MAX_VITALS, Operation, TINCTURE_COOLDOWN, TINCTURE_TIME, type OperationDef } from '../surgery/operation';
import { TOOL_INFO, toolInfo, type Pointer, type ToolId } from '../surgery/types';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle, star, toolIcon } from '../ui/widgets';
import { ASSISTANT_NAME } from '../content/characters';

export interface OperationOutcome {
  op: Operation;
  won: boolean;
}

const TRAY = { x: 12, y: 96, w: 88, h: 60, gap: 6 };
const ECG = { x: 150, y: 10, w: 250, h: 44 };

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

  constructor(
    private def: OperationDef,
    private onEnd: (o: OperationOutcome) => void,
    private onQuit: () => void,
  ) {
    this.op = new Operation(def);
  }

  enter(): void {
    this.op.say('Instruments ready, Doctor.');
  }

  private restart(): void {
    this.op = new Operation(this.def);
    this.paused = false;
    this.endT = 0;
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    const op = this.op;

    if (input.keyPressed('Escape') && op.status !== 'won' && op.status !== 'lost') this.paused = !this.paused;
    if (this.paused) return;

    // Tool selection: hotkeys, wheel, or clicking the tray.
    for (const t of TOOL_INFO) if (input.keyPressed(t.code)) op.setTool(t.id);
    if (input.wheel) op.cycleTool(input.wheel);
    if (input.keyPressed('KeyQ')) op.cycleTool(-1);
    if (input.keyPressed('KeyE')) op.cycleTool(1);
    let trayClick = false;
    op.def.tools.forEach((id, i) => {
      if (input.pressed && inRect(input.pos, this.slot(i))) {
        op.setTool(id);
        trayClick = true;
      }
    });
    if (op.tool !== this.lastTool) this.toolFlash = 1;
    this.lastTool = op.tool;
    this.toolFlash = Math.max(0, this.toolFlash - dt * 3);

    // Litany: draw a star with the right mouse button.
    if (input.rightDown) this.starTrail.push({ ...input.pos });
    else if (this.starTrail.length) {
      if (isStar(this.starTrail)) {
        if (!op.invokeLitany()) op.popup(op.litanyUsed ? 'The Litany is spent.' : 'Not now.', input.pos, PALETTE.inkDim);
      } else if (this.starTrail.length > 8) op.popup('The sign falters…', input.pos, PALETTE.inkDim);
      this.starTrail = [];
    }

    // Replay every pointer sample since last frame so fast zig-zags aren't lost at low frame rates.
    const path = input.path;
    const down = input.down && !trayClick && !input.rightDown;
    let prev = input.prev;
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
      this.ecg.push(bpm === 0 ? 0 : ecgWave(this.beatPhase) * (op.vitals < 25 ? 0.6 + Math.random() * 0.4 : 1));
    }

    const cursed = op.entities.some((e) => e instanceof Malison || e instanceof MalisonShard) ? 0.7 : op.entities.some((e) => e instanceof Sigil) ? 0.25 : 0;
    this.corrupt += (cursed - this.corrupt) * Math.min(1, dt * 1.5);

    const played = new Set<Cue>();
    for (const c of op.cues) if (!played.has(c)) {
      played.add(c);
      game.audio.play(c);
    }
    op.cues.length = 0;

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
    const pal = organPalette(op.def);
    const t = g.time;
    const shake = op.shake > 0 ? { x: (Math.random() - 0.5) * op.shake, y: (Math.random() - 0.5) * op.shake } : { x: 0, y: 0 };

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
      light: { x: FIELD.cx - 220 + Math.sin(t * 0.7) * 30, y: 60 + Math.sin(t * 1.3) * 10 },
      corrupt: this.corrupt,
    });
    const ents = op.visibleEntities().sort((a, b) => a.layer - b.layer);
    for (const e of ents) e.draw(g, op);

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

    const danger = op.status === 'running' ? Math.max(0, (35 - op.vitals) / 35) : op.status === 'lost' ? 1 : 0;
    g.endWorld({ litany: op.litanyTime > 0 ? Math.min(1, op.litanyTime, (LITANY_DURATION - op.litanyTime) * 3) : 0, danger, shake, bloom: 0.7 });

    // ---------------------------------------------------------------- UI
    this.drawPopups(g);
    this.drawHud(g);
    this.drawTray(g);
    this.drawCallout(g);

    if (op.status === 'intro') {
      g.text(op.def.title, VIEW_W / 2, 330, { size: 54, font: 'display', color: hex(PALETTE.ink), align: 'center' });
      g.text('Let us begin.', VIEW_W / 2, 380, { size: 26, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    }
    if (op.status === 'won') g.text('Operation Complete', VIEW_W / 2, 360, { size: 64, font: 'display', color: hex(PALETTE.gold), align: 'center' });
    if (op.status === 'lost') {
      g.text('The Patient Is Lost', VIEW_W / 2, 350, { size: 60, font: 'display', color: hex('#d04040'), align: 'center' });
      g.text(op.lostReason, VIEW_W / 2, 400, { size: 26, font: 'italic', align: 'center' });
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
    panel(g, { x: -4, y: -4, w: VIEW_W + 8, h: 68 });
    const vcol = op.vitals > 60 ? PALETTE.good : op.vitals > 30 ? '#e8c060' : '#e05040';
    g.text('VITALS', 18, 26, { size: 16, color: hex(PALETTE.inkDim) });
    g.text(String(Math.ceil(op.vitals)).padStart(2, '0'), 18, 54, { size: 34, color: hex(vcol) });
    g.rect(78, 44, 60, 8, hex('#000000', 0.5));
    g.rect(78, 44, (60 * op.vitals) / MAX_VITALS, 8, hex(vcol));

    // ECG trace.
    g.rect(ECG.x, ECG.y, ECG.w, ECG.h, hex('#051008', 0.9));
    const pts: Vec[] = this.ecg.map((v, i) => ({ x: ECG.x + (i / (this.ecg.length - 1)) * ECG.w, y: ECG.y + ECG.h * 0.62 - v * ECG.h * 0.5 }));
    g.polyline(pts, 2, hex(vcol, 0.9));
    g.rectLine(ECG.x, ECG.y, ECG.w, ECG.h, 1, hex(PALETTE.panelEdge));

    // Title, phase, timer.
    const mm = Math.floor(op.timeLeft / 60);
    const ss = Math.floor(op.timeLeft % 60);
    const tcol = op.timeLeft < 20 ? '#e05040' : PALETTE.ink;
    g.text(op.def.title, VIEW_W / 2, 24, { size: 18, color: hex(PALETTE.inkDim), align: 'center' });
    g.text(`${mm}:${String(ss).padStart(2, '0')}`, VIEW_W / 2, 54, { size: 30, color: hex(op.litanyTime > 0 ? PALETTE.gold : tcol), align: 'center' });
    for (let i = 0; i < op.phaseCount; i++) {
      const done = i < op.phase;
      const cur = i === op.phase;
      g.circle(VIEW_W / 2 + 70 + i * 14, 45, cur ? 5 : 4, hex(done ? PALETTE.gold : cur ? PALETTE.ink : '#4a4030'));
    }

    g.text(`${op.score}`, VIEW_W - 20, 32, { size: 26, color: hex(PALETTE.ink), align: 'right' });
    if (op.combo > 1) g.text(`Chain ×${op.combo}`, VIEW_W - 20, 56, { size: 18, color: hex(PALETTE.gold), align: 'right' });
    g.text(op.def.patient, VIEW_W - 180, 32, { size: 16, color: hex(PALETTE.inkDim), align: 'right' });
  }

  private drawTray(g: Gfx): void {
    const op = this.op;
    op.def.tools.forEach((id, i) => {
      const r = this.slot(i);
      const sel = op.tool === id;
      g.rectGrad(r.x, r.y, r.w, r.h, hex(sel ? '#3a2a18' : '#1a130e', 0.92), hex(sel ? '#241a10' : '#0e0a08', 0.92));
      g.rectLine(r.x, r.y, r.w, r.h, sel ? 2 : 1, hex(sel ? PALETTE.gold : PALETTE.panelEdge));
      toolIcon(g, id, r.x + r.w / 2 + 6, r.y + r.h / 2, sel ? 1 : 0.85, g.time);
      g.text(toolInfo(id).key, r.x + 6, r.y + 18, { size: 14, color: hex(sel ? PALETTE.gold : PALETTE.inkDim), shadow: false });
      if (id === 'tincture' && op.injectCooldown > 0) {
        const f = op.injectCooldown / TINCTURE_COOLDOWN;
        g.rect(r.x, r.y + r.h * (1 - f), r.w, r.h * f, hex('#000000', 0.6));
      }
    });
    const info = toolInfo(op.tool);
    const ty = TRAY.y + op.def.tools.length * (TRAY.h + TRAY.gap) + 12;
    g.text(info.name, TRAY.x, ty, { size: 16, color: hex(PALETTE.gold) });
    g.textBlock(info.hint, TRAY.x, ty + 20, 110, { size: 13, color: hex(PALETTE.inkDim) }, 1.25);

    // Litany indicator (only once the rite has been learned).
    if (op.def.litany === false) return;
    const lx = 56;
    const ly = 676;
    const ready = op.canInvokeLitany();
    if (ready) g.glow(lx, ly, 34, hex(PALETTE.gold, 0.25 + 0.1 * Math.sin(g.time * 3)));
    star(g, lx, ly, 18, hex(ready ? PALETTE.gold : '#4a4030'));
    if (op.litanyTime > 0) g.arc(lx, ly, 26, 3, hex(PALETTE.gold), op.litanyTime / LITANY_DURATION);
    g.text(ready ? 'Right-drag ★' : op.litanyTime > 0 ? 'Stillness' : 'Spent', lx, ly + 36, { size: 12, color: hex(PALETTE.inkDim), align: 'center' });
  }

  private drawCallout(g: Gfx): void {
    const line = this.op.callouts[0];
    if (!line) return;
    const r = { x: 150, y: 650, w: 980, h: 58 };
    panel(g, r, 0.88);
    g.text(`${ASSISTANT_NAME}:`, r.x + 16, r.y + 36, { size: 20, color: hex(PALETTE.gold) });
    const shown = line.slice(0, Math.floor(this.op.calloutT * 60));
    g.text(shown, r.x + 150, r.y + 36, { size: 20, color: hex(PALETTE.ink) });
  }

  private drawPopups(g: Gfx): void {
    for (const p of this.op.popups) {
      const a = Math.min(1, (1.1 - p.t) * 3);
      const scale = 1 + Math.max(0, 0.25 - p.t) * 1.5;
      g.text(p.text, p.pos.x, p.pos.y - 24 - p.t * 40, { size: 22 * scale, color: withAlpha(hex(p.color), a), align: 'center' });
    }
  }

  private drawPause(g: Gfx, game: Game): void {
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.6));
    panel(g, { x: 440, y: 200, w: 400, h: 320 });
    g.text('Respite', VIEW_W / 2, 260, { size: 44, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    if (button(g, game.input, 'Resume', VIEW_W / 2, 330)) this.paused = false;
    if (button(g, game.input, 'Begin Again', VIEW_W / 2, 390)) this.restart();
    if (button(g, game.input, 'Abandon the Patient', VIEW_W / 2, 450)) this.onQuit();
  }
}

/** One heartbeat, phase 0..1 → amplitude (P wave, QRS spike, T wave). */
export function ecgWave(ph: number): number {
  const bump = (c: number, w: number, h: number) => h * Math.exp(-(((ph - c) / w) ** 2));
  return bump(0.1, 0.025, 0.12) - bump(0.19, 0.008, 0.15) + bump(0.21, 0.01, 1) - bump(0.235, 0.01, 0.3) + bump(0.42, 0.05, 0.25);
}
