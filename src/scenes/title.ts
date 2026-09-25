import { settings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { fresh, store } from '../core/save';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { button, reticle } from '../ui/widgets';
import { diamond, INK, rule } from '../ui/hudKit';
import { drawBackdrop } from './backdrop';
import { playStep, save } from './flow';
import { OperationsScene } from './operations';
import { OptionsScene } from './options';
import { platform } from '../platform';
import { buildLabel, IS_DEMO } from '../platform/build';
import { EDITIONS } from '../platform/editions';
import { flag } from '../platform/flags';
import { pickEpigraph } from '../content/epigraphs';

/** One epigraph per boot (NAR-0069); cosmetic, so Math.random. */
const EPIGRAPH = pickEpigraph();

export class TitleScene implements Scene {
  private t = 0;
  private confirmNew = false;

  update(dt: number): void {
    this.t += dt;
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'title', g.time, { pointer: settings.reduceMotion ? undefined : game.input.pos });
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.3, defocus: 7 });
    const a = Math.min(1, this.t);
    const vr = g.viewRect();
    // Grade the backdrop down so the type carries the screen: a heavy vignette and a dark
    // column behind the menu.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.42));
    g.rectGrad(vr.x, vr.y, vr.w, 260, hex('#000000', 0.55), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h - 260, vr.w, 260, hex('#000000', 0), hex('#000000', 0.75));
    g.circleGrad(VIEW_W / 2, 470, 360, hex('#000000', 0.55 * a), hex('#000000', 0));
    // The title: engraved Roman capitals in gold leaf, a warm bloom behind.
    g.glow(VIEW_W / 2, 176, 460, hex('#7a3a10', 0.22 * a));
    const title = t('ui.game.title').toUpperCase();
    g.text(title, VIEW_W / 2, 196, { size: 84, font: 'display', color: hex('#fff4d0', a), color2: hex('#c8923c', a), align: 'center', tracking: 0.09, shadow: hex('#000000', 0.9 * a), soft: true });
    // Subtitle between two fading rules.
    const sub = t('ui.game.subtitle').toUpperCase();
    const sw = g.measure(sub, 15, 'display', 0.45);
    g.text(sub, VIEW_W / 2, 246, { size: 15, font: 'display', color: hex(INK.gold, 0.95 * a), align: 'center', tracking: 0.45, shadow: hex('#000000', 0.9 * a), soft: true });
    rule(g, VIEW_W / 2 - sw / 2 - 110, 240, 180, hex(INK.gilt, 0.8 * a));
    rule(g, VIEW_W / 2 + sw / 2 + 110, 240, 180, hex(INK.gilt, 0.8 * a));
    diamond(g, VIEW_W / 2 - sw / 2 - 18, 240.5, 3, hex(INK.gold, a));
    diamond(g, VIEW_W / 2 + sw / 2 + 18, 240.5, 3, hex(INK.gold, a));
    g.text(`“${EPIGRAPH.text}”`, VIEW_W / 2, 300, { size: 18, font: 'italic', color: hex(INK.dim, 0.9 * a), align: 'center', shadow: hex('#000000', 0.8 * a), soft: true });

    const p = save.progress;
    const started = p.chapter > 0 || p.step > 0;
    const done = p.chapter >= CAMPAIGN.length;
    let y = 390;
    if (this.confirmNew) {
      g.text(t('ui.title.confirm_new'), VIEW_W / 2, y, { size: 22, color: hex(INK.text), align: 'center', shadow: hex('#000000', 0.9), soft: true });
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
        if (platform.steam.ownsFullGame) g.text(t('ui.title.owns_full'), VIEW_W / 2, 630, { size: 19, font: 'italic', color: hex(INK.dim), align: 'center' });
        else if (button(g, game.input, t('ui.title.wishlist'), VIEW_W / 2, 630, 22)) platform.steam.openStore(EDITIONS.full.steamAppId);
      }
      if (done) g.text(t('ui.title.demo_complete'), VIEW_W / 2, 660, { size: 20, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    }
    g.text(t('ui.title.fullscreen_hint'), 24, VIEW_H - 18, { size: 16, color: hex(INK.faint), shadow: false });
    g.text(buildLabel(), VIEW_W - 24, VIEW_H - 18, { size: 16, color: hex(INK.faint), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
