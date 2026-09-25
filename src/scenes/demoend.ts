import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { formatNumber } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { VIEW_W } from '../ui/layout';
import { Ui } from '../ui/kit';
import { drawTooltip, menuEntry, sealButton } from '../ui/controls';
import { caps, glass, heading, INK, numerals, rule, well } from '../ui/hudKit';
import { chapterSeal } from '../art/kit';
import { settings } from '../core/settings';
import { kilnRowsPlate } from '../art/plates';
import { reticle } from '../ui/widgets';
import { MOTION, tween } from '../ui/motion';
import { fitText } from '../ui/text';
import { uiEvents } from '../ui/events';
import { drawBackdrop } from './backdrop';
import { save } from './flow';
import { rankSeal } from './rankArt';
import { campaignStarted, countRank, formatPlaytime, statsOf } from './campaignState';
import { ExtrasScene } from './extras';
import { OperationsScene } from './operations';
import { TitleScene } from './title';
import { platform } from '../platform';
import { EDITIONS, storeUrl } from '../platform/editions';

/** Store page for the wishlist call-to-action (the full game's app id lives in src/platform/editions.ts). */
export const STORE_URL = storeUrl(EDITIONS.full.steamAppId);

/** Every operation of the shipped chapters, in campaign order, with its chapter numeral. */
export const demoOperations = () => CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [{ chapter: c.numeral, op: s.op }] : [])));

/**
 * Shown after the last demo chapter (UIX-0168) and again from Extras (UIX-0173): thanks, a grid of
 * rank seals for every operation, the ledger totals (play time, XS seals, longest chain, Litany
 * uses), a wishlist seal, and a way back into the Operating Theatre for better seals.
 */
export class DemoEndScene implements Scene {
  readonly ui = new Ui('demoend');
  private t = 0;

  /** `replay`: opened from Extras — Back returns there instead of the title. */
  constructor(private replay = false) {}

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const ready = this.t > 0.8;
    ui.button('wishlist', { x: VIEW_W / 2 - 150, y: 592, w: 300, h: 52 }, t('ui.demoend.wishlist'), () => platform.steam.openStore(EDITIONS.full.steamAppId), { style: 'seal', enabled: ready });
    ui.button('replay', { x: 120, y: 596, w: 330, h: 44 }, t('ui.demoend.replay'), () => game.go(new OperationsScene()), { enabled: ready && campaignStarted(), tip: t('ui.demoend.replay_note') });
    ui.button('return', { x: VIEW_W - 450, y: 596, w: 330, h: 44 }, t(this.replay ? 'ui.common.back' : 'ui.demoend.return'), () => this.leave(game), { enabled: ready });
    if (!ui.focus) ui.focusFirst('wishlist');
  }

  private leave(game: Game): void {
    if (this.replay) game.go(new ExtrasScene());
    else game.go(new TitleScene());
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'demoend' });
      this.leave(game);
    }
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.1, defocus: 8 });
    const a = Math.min(1, this.t);
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.5));
    g.text(t('ui.game.title').toUpperCase(), VIEW_W / 2, 84, { size: 52, font: 'display', color: hex('#fff4d0', a), color2: hex('#c8923c', a), align: 'center', tracking: 0.09, shadow: hex('#000000', 0.9 * a), soft: true });
    rule(g, VIEW_W / 2, 100, 520, hex(INK.gilt, 0.8 * a));
    g.text(t('ui.demoend.thanks'), VIEW_W / 2, 136, { size: 24, font: 'italic', color: hex(INK.text, a), align: 'center', shadow: hex('#000000', 0.8 * a) });
    g.text(t('ui.demoend.teaser'), VIEW_W / 2, 164, { size: 19, color: hex(INK.dim, a), align: 'center', shadow: hex('#000000', 0.8 * a) });
    // A pressed seal for each chapter finished (ART-0067).
    CAMPAIGN.forEach((c, i) => chapterSeal(g, VIEW_W / 2 + (i === 0 ? -400 : 400), 120, 36, c.numeral, this.t - 0.6 - i * 0.25));

    const k = tween(Math.max(0, this.t - 0.3), MOTION.panel);
    // ---- the ledger: seal grid and totals (left)
    const pr = { x: 60, y: 190, w: 720, h: 386 };
    glass(g, pr, { alpha: k, strength: 1.1 });
    heading(g, t('ui.demoend.ledger'), pr.x + pr.w / 2, pr.y + 46, 300, k, 22);
    const ops = demoOperations();
    const cols = 5;
    const pitch = 128;
    const x0 = pr.x + pr.w / 2 - ((Math.min(cols, ops.length) - 1) * pitch) / 2;
    ops.forEach(({ chapter, op }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = x0 + col * pitch;
      const y = pr.y + 116 + row * 104;
      const best = save.best[op.id];
      const reveal = Math.min(1, Math.max(0, (this.t - 0.5 - i * 0.08) * 3)) * k;
      caps(g, t('ui.theatre.entry', { chapter, index: (i % cols) + 1 }), x, y - 36, 12, hex(INK.dim, reveal), 'center');
      if (best) rankSeal(g, x, y, 26, best.rank, reveal);
      else {
        well(g, { x: x - 26, y: y - 26, w: 52, h: 52 }, 0.7 * reveal);
        g.arc(x, y, 22, 1, hex(INK.gilt, 0.35 * reveal));
      }
      fitText(g, `demoend.${op.id}`, op.title, x, y + 48, pitch - 14, { size: 16, color: hex(INK.text, 0.9 * reveal), align: 'center', shadow: false });
    });
    // Totals as a ledger row along the bottom of the plate.
    const s = statsOf();
    const totals: [string, string][] = [
      [t('ui.demoend.playtime'), formatPlaytime(save.playtime)],
      [t('ui.demoend.xs_count'), t('ui.demoend.of_total', { n: countRank('XS'), total: ops.length })],
      [t('ui.demoend.longest_chain'), formatNumber(s.longestChain)],
      [t('ui.demoend.litany_uses'), formatNumber(s.litanyUses)],
    ];
    const tw = (pr.w - 60) / totals.length;
    rule(g, pr.x + pr.w / 2, pr.y + 302, pr.w - 80, hex(INK.gilt, 0.6 * k));
    totals.forEach(([label, value], i) => {
      const cx = pr.x + 30 + tw * (i + 0.5);
      caps(g, label, cx, pr.y + 330, 12, hex(INK.dim, k), 'center');
      numerals(g, value, cx, pr.y + 362, 22, '#ffffff', '#d8ccb4', 'center', k);
    });

    // ---- a woodcut plate of what comes next (ART-0060), right
    kilnRowsPlate(g, { x: 810, y: 190, w: 410, h: 386 }, settings.reduceMotion ? 0 : this.t, t('ui.demoend.plate'), a * k);

    for (const n of this.ui.nodes) {
      const st = this.ui.state(n.id);
      if (n.style === 'seal') sealButton(g, n, st, g.time, 26);
      else menuEntry(g, n, st, g.time, 22);
    }
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
