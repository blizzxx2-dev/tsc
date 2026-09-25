/**
 * Chapter content notes (NAR-0034): with "Show content notes" on, Chapters IV and V open on a short
 * card naming what they depict, with a way into the comfort options. Continue carries on.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { menuEntry } from '../ui/controls';
import { caps, heading, INK, rule } from '../ui/hudKit';
import { Ui } from '../ui/kit';
import { VIEW_W } from '../ui/layout';
import { MOTION, tween } from '../ui/motion';
import { wrapLines } from '../ui/text';
import { reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { OptionsScene } from './options';

/** Chapters (by id) that carry a content note. */
export const CHAPTER_NOTES: readonly string[] = ['ch4', 'ch5'];

export class ChapterNoteScene implements Scene {
  readonly ui = new Ui('chapter-note');
  private t = 0;
  private done = false;

  constructor(
    private chapterId: string,
    private numeral: string,
    private next: () => void,
  ) {}

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 320;
    const ready = this.t > 1;
    ui.button('continue', { x: VIEW_W / 2 - w - 10, y: 600, w, h: 46 }, t('ui.notice.continue'), () => {
      if (!ready || this.done) return;
      this.done = true;
      this.next();
    });
    ui.button('comfort', { x: VIEW_W / 2 + 10, y: 600, w, h: 46 }, t('ui.notice.comfort'), () => ready && game.push?.(new OptionsScene(() => game.pop?.(), 'overlay', 'access')));
    if (!ui.focus) ui.focusFirst('continue');
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 10 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.78));
    heading(g, t('ui.content_notes.heading', { numeral: this.numeral }), VIEW_W / 2, 120, 520, k);
    const cw = 760;
    const x = VIEW_W / 2 - cw / 2;
    caps(g, t('ui.content_notes.depicts'), x, 210, 14, hex(INK.goldHi, k));
    rule(g, VIEW_W / 2, 224, cw, hex(INK.gilt, 0.45 * k));
    const lines = wrapLines((s) => g.measure(s, 22, 'body'), t(`ui.content_notes.${this.chapterId}`), cw);
    lines.forEach((l, i) => g.text(l, x, 266 + i * 34, { size: 22, color: hex(INK.text, 0.92 * k), shadow: false }));
    g.text(t('ui.content_notes.footer'), VIEW_W / 2, 560, { size: 17, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 24);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
