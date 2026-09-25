/**
 * The Surgeon's Manual (GAM-0209): a page per instrument and per ailment, unlocked on first
 * encounter (`progress.codex` ids `manual.<page>`), each with a three-frame animated diagram.
 * Reached from the Operating Theatre beside the Hours codex.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { MANUAL_PAGES, manualId, type ManualPage } from '../content/manual';
import { loadProgress } from '../surgery/progress';
import { caps, glass, heading, INK } from '../ui/hudKit';
import { VIEW_W } from '../ui/layout';
import { drawDiagram, frameAt } from '../ui/manualDiagram';
import { wrapLines } from '../ui/text';
import { button, inRect, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

export const manualTitle = (p: ManualPage): string => (p.kind === 'tool' ? t(`tool.${p.id}.name`) : t(`manual.${p.id}.title`));
export const manualBody = (p: ManualPage): string => (p.kind === 'tool' ? t(`tool.${p.id}.hint`) : t(`manual.${p.id}.body`));

export class ManualScene implements Scene {
  private sel = 0;
  private readonly open: ReadonlySet<string>;
  private time = 0;

  /** `openAll`: every page readable (dev art review, `?ui=manual`). */
  constructor(
    private back: () => void,
    openAll = false,
  ) {
    this.open = new Set(openAll ? MANUAL_PAGES.map((p) => manualId(p.id)) : loadProgress().codex);
    this.sel = Math.max(0, MANUAL_PAGES.findIndex((p) => this.open.has(manualId(p.id))));
  }

  update(dt: number, game: Game): void {
    this.time += dt;
    const k = game.input;
    if (k.actPressed('ui.back')) return this.back();
    if (k.actPressed('ui.down')) this.sel = (this.sel + 1) % MANUAL_PAGES.length;
    if (k.actPressed('ui.up')) this.sel = (this.sel + MANUAL_PAGES.length - 1) % MANUAL_PAGES.length;
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 10 });
    const L = { x: 110, y: 40, w: 330, h: 600 };
    const R = { x: 470, y: 40, w: 700, h: 600 };
    glass(g, L, { strength: 1.1 });
    glass(g, R, { strength: 1.1 });
    heading(g, t('ui.manual.title'), L.x + L.w / 2, L.y + 46, L.w - 60);
    MANUAL_PAGES.forEach((p, i) => {
      const r = { x: L.x + 20, y: L.y + 72 + i * 29, w: L.w - 40, h: 27 };
      const known = this.open.has(manualId(p.id));
      if (inRect(game.input.pos, r) && game.input.pressed) this.sel = i;
      const on = i === this.sel;
      if (on) g.rect(r.x, r.y, r.w, r.h, hex(INK.gold, 0.12));
      if (i === 8) g.rect(r.x, r.y - 2, r.w, 1, hex(INK.gold, 0.3)); // instruments above, ailments below
      caps(g, known ? manualTitle(p) : t('ui.codex.sealed'), r.x + 12, r.y + 19, 13, hex(known ? (on ? INK.goldHi : INK.text) : INK.dim));
    });
    const p = MANUAL_PAGES[this.sel];
    if (this.open.has(manualId(p.id))) {
      heading(g, manualTitle(p), R.x + R.w / 2, R.y + 46, R.w - 80);
      drawDiagram(g, p, frameAt(this.time), { x: R.x + 150, y: R.y + 80, w: 400, h: 260 }, this.time);
      const lines = wrapLines((s) => g.measure(s, 20, 'body'), manualBody(p), R.w - 90);
      lines.forEach((l, i) => g.text(l, R.x + 45, R.y + 390 + i * 30, { size: 20, color: hex(INK.text), shadow: false }));
    } else g.text(t('ui.manual.locked'), R.x + R.w / 2, R.y + 280, { size: 20, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2, 676, 24)) this.back();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
