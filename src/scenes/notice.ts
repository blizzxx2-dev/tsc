/**
 * First-launch notices (UIX-0074): a photosensitivity notice and a content warning (gore, plague,
 * body horror, religious violence), shown once before the title, with a way into the comfort
 * options. Any key, click or button continues after a short read-lock.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui } from '../ui/kit';
import { menuEntry } from '../ui/controls';
import { caps, heading, INK, rule } from '../ui/hudKit';
import { MOTION, tween } from '../ui/motion';
import { wrapLines } from '../ui/text';
import { reticle } from '../ui/widgets';
import { VIEW_W } from '../ui/layout';
import { OptionsScene } from './options';
import { drawBackdrop } from './backdrop';

const SEEN_KEY = 'suture-and-steel.notices.v1';

/** True until the notices have been acknowledged once on this machine. */
export function noticesDue(): boolean {
  // Automated browsers (e2e, screenshots) boot straight to the title.
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // no storage: shown again next launch, which is harmless
  }
}

export class NoticeScene implements Scene {
  readonly ui = new Ui('notices');
  private t = 0;
  private done = false;

  constructor(private next: () => void) {}

  private finish(): void {
    if (this.done) return;
    this.done = true;
    markSeen();
    this.next();
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 320;
    // A moment to read before a stray key can dismiss it.
    const ready = this.t > 1.2;
    ui.button('continue', { x: VIEW_W / 2 - w - 10, y: 600, w, h: 46 }, t('ui.notice.continue'), () => ready && this.finish());
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
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 10 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.78));
    heading(g, t('ui.notice.heading'), VIEW_W / 2, 92, 520, k);

    const cols = [
      { title: t('ui.notice.photo.title'), body: t('ui.notice.photo.body'), x: 150 },
      { title: t('ui.notice.content.title'), body: t('ui.notice.content.body'), x: VIEW_W / 2 + 30 },
    ];
    const cw = VIEW_W / 2 - 180;
    for (const c of cols) {
      caps(g, c.title, c.x, 170, 14, hex(INK.goldHi, k));
      rule(g, c.x + cw / 2, 184, cw, hex(INK.gilt, 0.45 * k));
      const lines = wrapLines((s) => g.measure(s, 20, 'body'), c.body, cw);
      lines.forEach((l, i) => g.text(l, c.x, 222 + i * 30, { size: 20, color: hex(INK.text, 0.92 * k), shadow: false }));
    }
    g.rect(VIEW_W / 2 - 0.5, 186, 1, 330, hex(INK.gilt, 0.2 * k));
    g.text(t('ui.notice.footer'), VIEW_W / 2, 560, { size: 17, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 24);
    if (this.t <= 1.2) g.rect(VIEW_W / 2 - 330, 600, 660, 46, hex('#050303', 0.6 * (1 - this.t / 1.2)));
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
