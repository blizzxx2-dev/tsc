import { settings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { fresh, store } from '../core/save';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { button, reticle } from '../ui/widgets';
import { divider, leatherPanel, UI } from '../ui/ornaments';
import { drawBackdrop } from './backdrop';
import { playStep, save } from './flow';
import { OperationsScene } from './operations';
import { OptionsScene } from './options';
import { platform } from '../platform';
import { buildLabel, IS_DEMO } from '../platform/build';
import { EDITIONS } from '../platform/editions';
import { flag } from '../platform/flags';

export class TitleScene implements Scene {
  private t = 0;
  private confirmNew = false;

  update(dt: number): void {
    this.t += dt;
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'title', g.time, { pointer: settings.reduceMotion ? undefined : game.input.pos });
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.1 });
    const a = Math.min(1, this.t);
    {
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.35));
    }
    g.glow(VIEW_W / 2, 180, 420, hex('#8a1016', 0.3 * a));
    g.text(t('ui.game.title'), VIEW_W / 2, 200, { size: 116, font: 'display', color: hex('#fff0c0', a), color2: hex('#d8a040', a), align: 'center', shadow: hex('#0a0402', 0.95 * a) });
    divider(g, VIEW_W / 2, 236, 520, hex(UI.brass, a));
    g.text(t('ui.game.subtitle'), VIEW_W / 2, 280, { size: 30, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    leatherPanel(g, { x: VIEW_W / 2 - 220, y: 330, w: 440, h: 270 }, { alpha: 0.9 * a });

    const p = save.progress;
    const started = p.chapter > 0 || p.step > 0;
    const done = p.chapter >= CAMPAIGN.length;
    let y = 390;
    if (this.confirmNew) {
      g.text(t('ui.title.confirm_new'), VIEW_W / 2, y, { size: 22, align: 'center' });
      if (button(g, game.input, t('ui.title.confirm_yes'), VIEW_W / 2 - 170, y + 70)) {
        Object.assign(save, { ...fresh(), best: save.best });
        store(save);
        playStep(game, 0, 0);
      }
      if (button(g, game.input, t('ui.title.confirm_no'), VIEW_W / 2 + 170, y + 70)) this.confirmNew = false;
    } else {
      if (started && !done && button(g, game.input, t('ui.title.continue'), VIEW_W / 2, y)) playStep(game, p.chapter, p.step);
      if (started && !done) y += 60;
      if (button(g, game.input, started ? t('ui.title.new_game_again') : t('ui.title.new_game'), VIEW_W / 2, y)) {
        if (started) this.confirmNew = true;
        else playStep(game, 0, 0);
      }
      y += 60;
      if (button(g, game.input, t('ui.title.theatre'), VIEW_W / 2, y, 30, started)) game.go(new OperationsScene());
      y += 60;
      if (button(g, game.input, t('ui.title.options'), VIEW_W / 2, y)) game.go(new OptionsScene(() => game.go(new TitleScene())));
      if (IS_DEMO && flag('wishlistPrompts')) {
        // Owned-full-game notice (PLT-0064) replaces the wishlist prompt (PLT-0063).
        if (platform.steam.ownsFullGame) g.text(t('ui.title.owns_full'), VIEW_W / 2, 630, { size: 20, font: 'italic', color: hex(UI.parch), align: 'center' });
        else if (button(g, game.input, t('ui.title.wishlist'), VIEW_W / 2, 630, 22)) platform.steam.openStore(EDITIONS.full.steamAppId);
      }
      if (done) g.text(t('ui.title.demo_complete'), VIEW_W / 2, 660, { size: 20, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    }
    g.text(t('ui.title.fullscreen_hint'), 20, VIEW_H - 14, { size: 16, color: hex(PALETTE.inkDim, 0.6), shadow: false });
    g.text(buildLabel(), VIEW_W - 20, VIEW_H - 14, { size: 16, color: hex(PALETTE.inkDim, 0.6), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
