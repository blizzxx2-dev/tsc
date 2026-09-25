import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { VIEW_W } from '../ui/layout';
import { divider, leatherPanel, UI, waxSeal } from '../ui/ornaments';
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
    if (game.input.keyPressed('Escape')) game.go(new TitleScene());
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.1 });
    const a = Math.min(1, this.t);
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.45));
    g.text('Suture & Steel', VIEW_W / 2, 100, { size: 72, font: 'display', color: hex('#fff0c0', a), color2: hex(UI.giltLo, a), align: 'center' });
    divider(g, VIEW_W / 2, 124, 420, hex(UI.brass, a));
    g.text('Thank you for playing the demo.', VIEW_W / 2, 166, { size: 28, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    g.text('Six more Hours remain. Prime is already being sung.', VIEW_W / 2, 200, { size: 22, color: hex('#c8b890', a), align: 'center' });

    const panelR = { x: 250, y: 232, w: 780, h: 330 };
    leatherPanel(g, panelR, { alpha: 0.94 * a });
    g.text('Your case ledger', VIEW_W / 2, panelR.y + 42, { size: 24, color: hex(UI.gilt), align: 'center' });
    const ops = CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [{ ch: c.numeral, op: s.op }] : [])));
    ops.forEach(({ ch, op }, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const x = panelR.x + 50 + col * 370;
      const y = panelR.y + 90 + row * 48;
      const best = save.best[op.id];
      g.text(`${ch}-${row + 1}  ${op.title}`, x, y, { size: 20, color: hex(UI.parch) });
      if (best) waxSeal(g, x + 320, y - 7, 17, '#8a1016', best.rank, best.rank === 'XS' ? 14 : 20);
      else g.text('—', x + 320, y, { size: 20, color: hex('#6a5a40'), align: 'center' });
    });

    if (this.t > 0.8) {
      if (button(g, game.input, 'Wishlist on Steam', VIEW_W / 2, 620, 32)) platform.steam.openStore(EDITIONS.full.steamAppId);
      if (button(g, game.input, 'Return to the Title', VIEW_W / 2, 675, 24)) game.go(new TitleScene());
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
