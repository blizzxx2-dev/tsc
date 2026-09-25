import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { formatClock } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OperationDef } from '../surgery/operation';
import { TOOL_INFO } from '../surgery/types';
import { toolKeyLabel } from '../input/glyphs';
import { VIEW_W } from '../ui/layout';
import { button, reticle, toolIcon } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { briefingNotes } from '../surgery/session';
import { drawWoundMan, ENGRAVED_INKS, prognosis, woundSites, type Pin } from '../art/woundMan';
import { caps, glass, heading, INK, numerals } from '../ui/hudKit';

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
    glass(g, r, { strength: 1.12 });
    heading(g, t('ui.briefing.title'), VIEW_W / 2, r.y + 58, 380, 1, 28);
    g.text(d.title, VIEW_W / 2, r.y + 112, { size: 30, color: hex(INK.text), align: 'center', shadow: hex('#000000', 0.8), soft: true });
    const lx = r.x + 56;
    const vx = r.x + 200;
    caps(g, t('ui.briefing.patient'), lx, r.y + 172, 12);
    g.text(d.patient, vx, r.y + 174, { size: 20, color: hex(INK.text), shadow: false });
    caps(g, t('ui.briefing.findings'), lx, r.y + 208, 12);
    g.textBlock(d.diagnosis, vx, r.y + 210, r.w - 440, { size: 19, font: 'italic', color: hex('#d8ccb4'), shadow: false }, 1.35);
    caps(g, t('ui.briefing.time_allowed'), lx, r.y + 326, 12);
    numerals(g, formatClock(d.timeLimit), vx, r.y + 330, 22, '#ffffff', '#d8ccb4');
    // The Litany is sealed for this patient (GAM-0170): a red tag beside the clock, so the player knows before the star fails.
    if (d.litany === false) caps(g, t('ui.briefing.litany_sealed'), vx + (this.best ? 300 : 110), r.y + 326, 12, hex('#e06050'));
    if (this.best) {
      caps(g, t('ui.briefing.best'), vx + 110, r.y + 326, 12);
      g.text(t('ui.briefing.best_value', { rank: this.best.rank, score: this.best.score }), vx + 170, r.y + 330, { size: 20, color: hex(INK.gold), shadow: false });
    }
    // The Wound Man, engraved in gold, with pins at the injuries, and a stamped prognosis (ART-0056).
    this.pins ??= woundSites(d);
    g.plate(r.x + r.w - 236, r.y + 146, 200, 250, { radius: 2, top: hex('#0a0807', 0.6), bottom: hex('#0e0b09', 0.6), border: hex(INK.gilt, 0.25), borderW: 1, bevel: -0.4, shadow: [0, 0, 0], grain: 0.4 });
    drawWoundMan(g, r.x + r.w - 136, r.y + 160, 222, this.pins, g.time, 1, ENGRAVED_INKS);
    const prog = prognosis(d);
    caps(g, t('ui.briefing.prognosis'), lx, r.y + 370, 12);
    (['fair', 'guarded', 'grave'] as const).forEach((k, i) => {
      const bx = vx + i * 110;
      const on = k === prog;
      g.plate(bx, r.y + 356, 16, 16, { radius: 2, top: hex(on ? '#5a1418' : '#0a0807'), bottom: hex(on ? '#2a0608' : '#140f0c'), border: hex(on ? '#e04040' : INK.gilt, on ? 0.95 : 0.5), borderW: 1.2, bevel: 0.4, shadow: [0.4, 3, 1], glow: on ? hex('#e04040', 0.25) : undefined, glowR: 10 });
      if (on) {
        g.line({ x: bx + 4, y: r.y + 360 }, { x: bx + 12, y: r.y + 368 }, 1.8, hex('#ffd0c8'));
        g.line({ x: bx + 12, y: r.y + 360 }, { x: bx + 4, y: r.y + 368 }, 1.8, hex('#ffd0c8'));
      }
      g.text(t(`ui.briefing.prognosis.${k}`), bx + 24, r.y + 370, { size: 18, color: hex(on ? '#ffb0a8' : INK.dim), shadow: false });
    });
    caps(g, t('ui.briefing.instruments'), lx, r.y + 420, 12);
    d.tools.forEach((tool, i) => {
      const x = lx + 34 + i * 84;
      g.plate(x - 32, r.y + 436, 64, 64, { radius: 3, top: hex('#16110d', 0.95), bottom: hex('#0a0806', 0.95), border: hex('#5a4a34', 0.8), borderW: 1, bevel: 0.5, shadow: [0.5, 6, 2] });
      toolIcon(g, tool, x, r.y + 470, 0.8, g.time);
      g.text(toolKeyLabel(TOOL_INFO.findIndex((ti) => ti.id === tool) + 1), x, r.y + 520, { size: 13, font: 'display', color: hex(INK.dim), align: 'center', tracking: 0.1, shadow: false });
    });
    this.notes ??= briefingNotes(d);
    this.notes.forEach((n, i) => g.text(n, lx, r.y + 548 + i * 18, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false }));
    if (button(g, game.input, t('ui.briefing.begin'), r.x + r.w - 140, r.y + 568, 30, true, false)) this.onBegin();
    if (button(g, game.input, t('ui.common.back'), r.x + r.w - 330, r.y + 568, 24, true, false)) this.onBack();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
