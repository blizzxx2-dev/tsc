import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OperationDef } from '../surgery/operation';
import { TOOL_INFO } from '../surgery/types';
import { toolKeyLabel } from '../input/glyphs';
import { VIEW_W } from '../ui/layout';
import { button, parchment, reticle, toolIcon } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

/** The patient chart shown before an operation. */
export class BriefingScene implements Scene {
  constructor(
    private def: OperationDef,
    private best: { rank: string; score: number } | undefined,
    private onBegin: () => void,
    private onBack: () => void,
  ) {}

  update(_dt: number, game: Game): void {
    if (game.input.actPressed('ui.confirm')) this.onBegin();
    if (game.input.actPressed('ui.back')) this.onBack();
  }

  render(g: Gfx, game: Game): void {
    const d = this.def;
    g.beginWorld();
    drawBackdrop(g, 'theatre', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });

    const r = { x: 240, y: 60, w: 800, h: 600 };
    parchment(g, r);
    const ink = hex('#2a1a10');
    const faded = hex('#5a4228');
    g.text('Patient Chart', VIEW_W / 2, r.y + 70, { size: 46, font: 'display', color: hex('#5a0a10'), align: 'center', shadow: false });
    g.text(d.title, VIEW_W / 2, r.y + 120, { size: 32, color: ink, align: 'center', shadow: false });
    g.line({ x: r.x + 60, y: r.y + 140 }, { x: r.x + r.w - 60, y: r.y + 140 }, 1.5, faded);
    g.text('Patient:', r.x + 60, r.y + 185, { size: 22, color: faded, shadow: false });
    g.text(d.patient, r.x + 200, r.y + 185, { size: 22, color: ink, shadow: false });
    g.text('Findings:', r.x + 60, r.y + 225, { size: 22, color: faded, shadow: false });
    g.textBlock(d.diagnosis, r.x + 200, r.y + 225, r.w - 260, { size: 22, color: ink, shadow: false });
    const mm = Math.floor(d.timeLimit / 60);
    const ss = String(d.timeLimit % 60).padStart(2, '0');
    g.text('Time allowed:', r.x + 60, r.y + 340, { size: 22, color: faded, shadow: false });
    g.text(`${mm}:${ss}`, r.x + 220, r.y + 340, { size: 22, color: ink, shadow: false });
    if (this.best) {
      g.text('Best:', r.x + 420, r.y + 340, { size: 22, color: faded, shadow: false });
      g.text(`${this.best.rank}  (${this.best.score})`, r.x + 490, r.y + 340, { size: 22, color: ink, shadow: false });
    }
    g.text('Instruments:', r.x + 60, r.y + 395, { size: 22, color: faded, shadow: false });
    d.tools.forEach((t, i) => {
      const x = r.x + 110 + i * 88;
      g.circle(x, r.y + 445, 30, hex('#1a120c', 0.85));
      toolIcon(g, t, x, r.y + 445, 0.9, g.time);
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === t) + 1), x, r.y + 492, { size: 16, color: faded, align: 'center', shadow: false });
    });
    if (button(g, game.input, 'Scrub In', VIEW_W / 2 + 120, r.y + 560, 34, true, true)) this.onBegin();
    if (button(g, game.input, 'Back', VIEW_W / 2 - 160, r.y + 560, 26, true, true)) this.onBack();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
