/**
 * Chapter select (UIX-0087): one card per chapter — numeral, title, completion and a rank seal for
 * each operation. Chapters the campaign has reached open at their first step (the current chapter
 * resumes where it stands); replays never move the save backwards because `advance` is monotonic.
 * The demo edition shows Chapters III–V as locked parchment "In the full game" cards.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { VIEW_W } from '../ui/layout';
import { Ui, type Rect, type UiNode } from '../ui/kit';
import { drawTooltip, focusRing, menuEntry } from '../ui/controls';
import { caps, glass, heading, INK, meter, numerals, rule, well } from '../ui/hudKit';
import { parchmentSheet, waxSeal } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { fitBlock, fitText } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { IS_DEMO } from '../platform/build';
import { drawBackdrop } from './backdrop';
import { playStep, save } from './flow';
import { rankSeal } from './rankArt';
import { campaignComplete, chapterCompletion, chapterRanks, chapterReached } from './campaignState';
import { TitleScene } from './title';

/** The chapters the full game adds after the demo's two: shown locked in the demo edition. */
export const LOCKED_CHAPTERS: readonly { numeral: string; titleKey: string }[] = IS_DEMO
  ? [
      { numeral: 'III', titleKey: 'ui.chapters.later_iii' },
      { numeral: 'IV', titleKey: 'ui.chapters.later_iv' },
      { numeral: 'V', titleKey: 'ui.chapters.later_v' },
    ]
  : [];

const CARD = { y: 132, w: 216, h: 448, gap: 16 };

/** Card rect for card index `i` of `n` cards, centred as a row. */
export function cardRect(i: number, n: number): Rect {
  const total = n * CARD.w + (n - 1) * CARD.gap;
  return { x: Math.round((VIEW_W - total) / 2) + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
}

export class ChapterSelectScene implements Scene {
  readonly ui = new Ui('chapters');
  private t = 0;

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const n = CAMPAIGN.length + LOCKED_CHAPTERS.length;
    CAMPAIGN.forEach((ch, ci) => {
      const reached = chapterReached(ci);
      ui.button(`ch${ci}`, cardRect(ci, n), t('ui.chapters.card_title', { numeral: ch.numeral, title: ch.title }), () => this.open(game, ci), {
        enabled: reached,
        tip: reached ? undefined : t('ui.chapters.not_reached'),
        data: ci,
      });
    });
    LOCKED_CHAPTERS.forEach((lc, i) => ui.button(`locked${i}`, cardRect(CAMPAIGN.length + i, n), t(lc.titleKey), () => undefined, { enabled: false, noNav: true, tip: t('ui.chapters.locked_note'), data: lc.numeral }));
    ui.button('back', { x: VIEW_W / 2 - 120, y: 616, w: 240, h: 46 }, t('ui.common.back'), () => game.go(new TitleScene()));
    if (!ui.focus) ui.focusFirst(`ch${Math.min(save.progress.chapter, CAMPAIGN.length - 1)}`);
  }

  /** The current chapter resumes at its saved step; earlier chapters replay from their first step. */
  private open(game: Game, ci: number): void {
    const p = save.progress;
    if (ci === p.chapter && !campaignComplete()) playStep(game, ci, p.step);
    else playStep(game, ci, 0);
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'chapters' });
      game.go(new TitleScene());
    }
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 8 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.45));
    const k = tween(this.t, MOTION.panel);
    heading(g, t('ui.chapters.title'), VIEW_W / 2, 72, 420, k, 30);
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      if (n.id.startsWith('ch')) this.chapterCard(g, n, s.glow, k);
      else if (n.id.startsWith('locked')) this.lockedCard(g, n, k);
      else menuEntry(g, n, s, g.time, 26);
    }
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private chapterCard(g: Gfx, n: UiNode, k: number, a: number): void {
    const ci = n.data as number;
    const ch = CAMPAIGN[ci];
    const r = n.rect;
    const lift = k * 4;
    g.save();
    g.translate(0, -lift);
    glass(g, r, { alpha: a, strength: n.enabled ? 1.1 : 0.8 });
    const ink = n.enabled ? 1 : 0.45;
    // Numeral in gold leaf over a rule, the title beneath.
    numerals(g, ch.numeral, r.x + r.w / 2, r.y + 92, 64, INK.goldHi, INK.gold, 'center', ink * a);
    rule(g, r.x + r.w / 2, r.y + 108, r.w - 50, hex(INK.gilt, 0.8 * ink * a));
    fitBlock(g, `chapters.${ci}.title`, ch.title, r.x + r.w / 2, r.y + 142, r.w - 36, 2, { size: 21, color: hex(INK.text, ink * a), align: 'center', shadow: hex('#000000', 0.8 * a) }, 1.2);
    // Completion.
    const frac = chapterCompletion(ci);
    caps(g, t('ui.chapters.completion'), r.x + 22, r.y + 222, 12, hex(INK.dim, ink * a));
    numerals(g, t('ui.chapters.percent', { value: frac }), r.x + r.w - 22, r.y + 224, 20, '#ffffff', '#d8ccb4', 'right', ink * a);
    meter(g, { x: r.x + 22, y: r.y + 236, w: r.w - 44, h: 8 }, frac, INK.goldHi, INK.goldLo, 0, ink * a);
    // A seal per operation: pressed wax where a best exists, an empty ring where none.
    const ranks = chapterRanks(ci);
    caps(g, t('ui.chapters.seals'), r.x + r.w / 2, r.y + 290, 12, hex(INK.dim, ink * a), 'center');
    const cols = Math.min(5, ranks.length);
    const rows = Math.ceil(ranks.length / cols);
    const sr = 17;
    const pitch = 39;
    ranks.forEach((rank, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, ranks.length - row * cols);
      const x = r.x + r.w / 2 + (i % cols - (inRow - 1) / 2) * pitch;
      const y = r.y + 330 + row * 44;
      if (rank) rankSeal(g, x, y, sr, rank, ink * a);
      else {
        well(g, { x: x - sr, y: y - sr, w: sr * 2, h: sr * 2 }, 0.7 * ink * a);
        g.arc(x, y, sr - 3, 1, hex(INK.gilt, 0.35 * ink * a));
      }
    });
    const earned = ranks.filter(Boolean).length;
    caps(g, t('ui.chapters.seal_tally', { earned, total: ranks.length }), r.x + r.w / 2, r.y + 330 + rows * 44 + 4, 12, hex(INK.gold, ink * a), 'center');
    const foot = !n.enabled ? t('ui.chapters.not_reached') : frac >= 1 ? t('ui.chapters.replay') : t('ui.chapters.continue');
    fitText(g, `chapters.${ci}.foot`, foot, r.x + r.w / 2, r.y + r.h - 22, r.w - 30, { size: 16, font: 'italic', color: hex(k > 0.5 ? INK.goldHi : INK.dim, ink * a), align: 'center', shadow: false });
    if (k > 0.01 && n.enabled) focusRing(g, r, k, g.time);
    g.restore();
  }

  /** A locked chapter: foxed parchment, the numeral and title in ink, a dark seal saying it waits in the full game. */
  private lockedCard(g: Gfx, n: UiNode, a: number): void {
    const r = n.rect;
    parchmentSheet(g, r, 7 + r.x, 'foxed');
    const inkCol = hex('#2a1a0c', 0.85 * a);
    g.text(String(n.data), r.x + r.w / 2, r.y + 92, { size: 56, font: 'display', color: hex('#6a0a10', 0.9 * a), align: 'center', tracking: 0.04, shadow: false });
    g.rect(r.x + 30, r.y + 106, r.w - 60, 1, hex('#6a0a10', 0.5 * a));
    fitBlock(g, `chapters.${n.id}.title`, n.label, r.x + r.w / 2, r.y + 142, r.w - 36, 2, { size: 21, color: inkCol, align: 'center', shadow: false }, 1.2);
    waxSeal(g, r.x + r.w / 2, r.y + 300, 40, '#3a2a28');
    g.text(t('ui.chapters.locked_short').toUpperCase(), r.x + r.w / 2, r.y + 372, { size: 13, font: 'display', color: hex('#6a0a10', 0.9 * a), align: 'center', tracking: 0.16, shadow: false });
    fitBlock(g, `chapters.${n.id}.note`, t('ui.chapters.locked'), r.x + r.w / 2, r.y + 400, r.w - 40, 2, { size: 17, font: 'italic', color: hex('#4a3a2c', 0.9 * a), align: 'center', shadow: false }, 1.25);
  }
}
