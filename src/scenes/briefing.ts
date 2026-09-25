import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { formatClock } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OperationDef } from '../surgery/operation';
import { TOOL_INFO } from '../surgery/types';
import { toolKeyLabel } from '../input/glyphs';
import { VIEW_W } from '../ui/layout';
import { button, parchment, reticle, toolIcon } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { briefingNotes } from '../surgery/session';
import { drawWoundMan, prognosis, woundSites, type Pin } from '../art/woundMan';

/** The patient chart shown before an operation. */
export class BriefingScene implements Scene {
  private notes: string[] | null = null;
  private pins: Pin[] | null = null;
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
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 8 });

    const r = { x: 240, y: 60, w: 800, h: 600 };
    parchment(g, r);
    const ink = hex('#2a1a10');
    const faded = hex('#5a4228');
    g.text(t('ui.briefing.title'), VIEW_W / 2, r.y + 70, { size: 46, font: 'display', color: hex('#5a0a10'), align: 'center', shadow: false });
    g.text(d.title, VIEW_W / 2, r.y + 120, { size: 32, color: ink, align: 'center', shadow: false });
    g.line({ x: r.x + 60, y: r.y + 140 }, { x: r.x + r.w - 60, y: r.y + 140 }, 1.5, faded);
    g.text(t('ui.briefing.patient'), r.x + 60, r.y + 180, { size: 22, color: faded, shadow: false });
    g.text(d.patient, r.x + 200, r.y + 180, { size: 22, color: ink, shadow: false });
    g.text(t('ui.briefing.findings'), r.x + 60, r.y + 214, { size: 22, color: faded, shadow: false });
    g.textBlock(d.diagnosis, r.x + 200, r.y + 214, r.w - 440, { size: 20, color: ink, shadow: false }, 1.3);
    g.text(t('ui.briefing.time_allowed'), r.x + 60, r.y + 326, { size: 22, color: faded, shadow: false });
    g.text(formatClock(d.timeLimit), r.x + 220, r.y + 326, { size: 22, color: ink, shadow: false });
    if (this.best) {
      g.text(t('ui.briefing.best'), r.x + 420, r.y + 326, { size: 22, color: faded, shadow: false });
      g.text(t('ui.briefing.best_value', { rank: this.best.rank, score: this.best.score }), r.x + 490, r.y + 326, { size: 22, color: ink, shadow: false });
    }
    // The Wound Man with pins at the injuries, and a stamped prognosis (ART-0056).
    this.pins ??= woundSites(d);
    drawWoundMan(g, r.x + r.w - 120, r.y + 156, 226, this.pins, g.time);
    const prog = prognosis(d);
    const px = r.x + 60;
    const py = r.y + 362;
    g.text(t('ui.briefing.prognosis'), px, py, { size: 20, color: faded, shadow: false });
    (['fair', 'guarded', 'grave'] as const).forEach((k, i) => {
      const bx = px + 140 + i * 120;
      g.rectLine(bx, py - 16, 18, 18, 1.5, faded);
      g.text(t(`ui.briefing.prognosis.${k}`), bx + 26, py, { size: 18, color: ink, shadow: false });
      if (k === prog) {
        // A red ink stamp: a ring pressed slightly askew over the box.
        g.arc(bx + 9, py - 7, 15, 2.5, hex('#8a1016', 0.75));
        g.line({ x: bx + 3, y: py - 12 }, { x: bx + 15, y: py - 1 }, 2.5, hex('#8a1016', 0.85));
        g.line({ x: bx + 15, y: py - 12 }, { x: bx + 3, y: py - 1 }, 2.5, hex('#8a1016', 0.85));
      }
    });
    g.text(t('ui.briefing.instruments'), r.x + 60, r.y + 398, { size: 22, color: faded, shadow: false });
    d.tools.forEach((t, i) => {
      const x = r.x + 110 + i * 88;
      g.circle(x, r.y + 440, 30, hex('#1a120c', 0.85));
      toolIcon(g, t, x, r.y + 440, 0.9, g.time);
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === t) + 1), x, r.y + 486, { size: 16, color: faded, align: 'center', shadow: false });
    });
    this.notes ??= briefingNotes(d);
    this.notes.forEach((n, i) => g.text(n, r.x + 60, r.y + 508 + i * 18, { size: 16, font: 'italic', color: faded, shadow: false }));
    if (button(g, game.input, t('ui.briefing.begin'), VIEW_W / 2 + 120, r.y + 560, 34, true, true)) this.onBegin();
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2 - 160, r.y + 560, 26, true, true)) this.onBack();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
