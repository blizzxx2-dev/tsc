import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { VIEW_W } from '../ui/layout';
import { divider, leatherPanel, UI, waxSeal, woodcutCorner } from '../ui/ornaments';
import { chapterSeal } from '../art/kit';
import { settings } from '../core/settings';
import { kilnRowsPlate } from '../art/plates';
import { button, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { save } from './flow';
import { TitleScene } from './title';
import { platform } from '../platform';
import { EDITIONS, storeUrl } from '../platform/editions';

/** Store page for the wishlist call-to-action (the full game's app id lives in src/platform/editions.ts). */
export const STORE_URL = storeUrl(EDITIONS.full.steamAppId);

/** Shown after the last demo chapter: thanks, the player's case ledger, and a wishlist call-to-action. */
export class DemoEndScene implements Scene {
  private t = 0;
  update(dt: number, game: Game): void {
    this.t += dt;
    if (game.input.actPressed('ui.back')) game.go(new TitleScene());
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.1, defocus: 8 });
    const a = Math.min(1, this.t);
    {
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.45));
    }
    g.text(t('ui.game.title'), VIEW_W / 2, 100, { size: 72, font: 'display', color: hex('#fff0c0', a), color2: hex(UI.giltLo, a), align: 'center' });
    divider(g, VIEW_W / 2, 124, 420, hex(UI.brass, a));
    g.text(t('ui.demoend.thanks'), VIEW_W / 2, 166, { size: 28, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    g.text(t('ui.demoend.teaser'), VIEW_W / 2, 200, { size: 22, color: hex('#c8b890', a), align: 'center' });

    // A pressed seal for each chapter finished (ART-0067).
    CAMPAIGN.forEach((c, i) => chapterSeal(g, VIEW_W / 2 + (i === 0 ? -330 : 330), 150, 38, c.numeral, this.t - 0.6 - i * 0.25));
    const panelR = { x: 70, y: 232, w: 680, h: 330 };
    leatherPanel(g, panelR, { alpha: 0.94 * a });
    for (const [x, y, dx, dy] of [[panelR.x, panelR.y, 1, 1], [panelR.x + panelR.w, panelR.y, -1, 1], [panelR.x, panelR.y + panelR.h, 1, -1], [panelR.x + panelR.w, panelR.y + panelR.h, -1, -1]] as const) woodcutCorner(g, x, y, dx, dy, 0, hex(UI.brass, a), 1, '#2a1812');
    g.text(t('ui.demoend.ledger'), panelR.x + panelR.w / 2, panelR.y + 42, { size: 24, color: hex(UI.gilt), align: 'center' });
    const ops = CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [{ ch: c.numeral, op: s.op }] : [])));
    ops.forEach(({ ch, op }, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const x = panelR.x + 36 + col * 322;
      const y = panelR.y + 90 + row * 48;
      const best = save.best[op.id];
      g.text(t('ui.demoend.ledger_entry', { chapter: ch, index: row + 1, title: op.title }), x, y, { size: 20, color: hex(UI.parch) });
      if (best) waxSeal(g, x + 284, y - 7, 17, '#8a1016', best.rank, best.rank === 'XS' ? 14 : 20);
      else g.text('—', x + 284, y, { size: 20, color: hex('#6a5a40'), align: 'center' });
    });

    // A woodcut plate of what comes next (ART-0060).
    kilnRowsPlate(g, { x: 780, y: 232, w: 430, h: 330 }, settings.reduceMotion ? 0 : this.t, t('ui.demoend.plate'), a);

    if (this.t > 0.8) {
      if (button(g, game.input, t('ui.demoend.wishlist'), VIEW_W / 2, 620, 32)) platform.steam.openStore(EDITIONS.full.steamAppId);
      if (button(g, game.input, t('ui.demoend.return'), VIEW_W / 2, 675, 24)) game.go(new TitleScene());
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
