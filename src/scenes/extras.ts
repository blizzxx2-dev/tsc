/**
 * Extras (UIX-0173): the demo summary again once the demo is finished, the credits and the
 * third-party notices, reached from the title.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { Ui } from '../ui/kit';
import { drawTooltip, menuEntry } from '../ui/controls';
import { glass, heading } from '../ui/hudKit';
import { MOTION, tween } from '../ui/motion';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { IS_DEMO } from '../platform/build';
import { drawBackdrop } from './backdrop';
import { campaignComplete } from './campaignState';
import { CreditsScene, NoticesScene } from './credits';
import { DemoEndScene } from './demoend';
import { TitleScene } from './title';

export class ExtrasScene implements Scene {
  readonly ui = new Ui('extras');
  private t = 0;

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 380;
    const x = VIEW_W / 2 - w / 2;
    let y = 232;
    const h = 46;
    const add = (id: string, label: string, fn: () => void, enabled = true, tip?: string) => {
      ui.button(id, { x, y, w, h }, label, fn, { enabled, tip });
      y += h + 6;
    };
    const done = campaignComplete();
    add('summary', t(IS_DEMO ? 'ui.extras.demo_summary' : 'ui.extras.summary'), () => game.go(new DemoEndScene(true)), done, done ? undefined : t('ui.extras.summary_locked'));
    add('credits', t('ui.title.credits'), () => game.go(new CreditsScene((g) => g.go(new ExtrasScene()))));
    add('notices', t('ui.credits.notices'), () => game.push?.(new NoticesScene()));
    add('back', t('ui.common.back'), () => game.go(new TitleScene()));
    if (!ui.focus) ui.focusFirst(done ? 'summary' : 'credits');
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'extras' });
      game.go(new TitleScene());
    }
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.5));
    const k = tween(this.t, MOTION.panel);
    const r = { x: VIEW_W / 2 - 230, y: 120, w: 460, h: 400 };
    g.save();
    g.translate(0, (1 - k) * 24);
    glass(g, r, { alpha: k, strength: 1.1 });
    heading(g, t('ui.title.extras'), r.x + r.w / 2, r.y + 62, r.w - 120, k);
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 26);
    g.restore();
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
