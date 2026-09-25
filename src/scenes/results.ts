import { assisted } from '../core/settings';
import { t, tSource } from '../i18n';
import { formatNumber } from '../i18n/format';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { VIEW_W } from '../ui/layout';
import { caps, glass, heading, INK, numerals } from '../ui/hudKit';
import { failSeal, rankSeal } from '../art/kit';
import { button, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import type { RunSummary } from '../surgery/session';
import { ACHIEVEMENTS } from '../surgery/achievements';
import { HoldToRetry } from '../input/retry';

/** The case record: a parchment ledger page, stamped with the rank in wax. */
export class ResultsScene implements Scene {
  private t = 0;
  private stamped = false;
  /** Hold R (or the pad's View button) for a second to go straight back in (INP-0113). */
  private retry = new HoldToRetry();
  constructor(
    private op: Operation,
    private won: boolean,
    private newBest: boolean,
    private actions: { next?: () => void; retry: () => void; quit: () => void; retryNovice?: () => void; retryCheckpoint?: () => void },
    private summary?: RunSummary,
  ) {}

  enter(game: Game): void {
    if (this.won) game.audio.play('bell');
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    if (this.won && !this.stamped && this.t > 1.9) {
      this.stamped = true;
      game.audio.play('squelch');
    }
    if (game.input.actPressed('ui.confirm') && this.t > 0.5) (this.actions.next ?? this.actions.retry)();
    if (this.retry.update(game.input, dt)) this.actions.retry();
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    g.beginWorld();
    drawBackdrop(g, 'results', g.time);
    g.endWorld({ litany: 0, danger: this.won ? 0 : 0.4, shake: { x: 0, y: 0 }, bloom: 1, defocus: 8 });

    const r = { x: 300, y: 36, w: 680, h: 580 };
    const a = Math.min(1, this.t * 3);
    glass(g, r, { alpha: a, strength: 1.12 });
    heading(g, t('ui.results.title'), VIEW_W / 2, r.y + 60, 420, a, 30);
    g.text(t('ui.results.subtitle', { title: op.def.title, patient: op.def.patient }), VIEW_W / 2, r.y + 108, { size: 19, font: 'italic', color: hex(INK.dim, a), align: 'center', shadow: false });
    caps(g, this.won ? t('ui.results.won') : t('ui.results.lost'), VIEW_W / 2, r.y + 146, 15, hex(this.won ? '#9fd8a8' : '#ff8a80', a), 'center');
    // The cause of death, for vitals and time-out losses alike (UIX-0116).
    if (!this.won && op.lostReason) g.text(tSource(op.lostReason), VIEW_W / 2, r.y + 170, { size: 17, font: 'italic', color: hex('#e8b0a8', a), align: 'center', shadow: false });

    const rows: [string, string][] = [
      [t('rating.cool'), formatNumber(op.counts.cool)],
      [t('rating.good'), formatNumber(op.counts.good)],
      [t('rating.bad'), formatNumber(op.counts.bad)],
      [t('rating.miss'), formatNumber(op.counts.miss)],
      [t('ui.results.longest_chain'), formatNumber(op.maxCombo)],
      [t('ui.results.vitals_remaining'), formatNumber(op.bonus.vitals)],
      [t('ui.results.time_remaining'), formatNumber(op.bonus.time)],
    ];
    const bd = op.breakdown();
    if (bd.closureBonus) rows.push(['Clean closure', String(bd.closureBonus)]);
    if (bd.penalties) rows.push(['Penalties', `-${bd.penalties}`]);
    const lx = r.x + 56;
    const lw = 320;
    // Rows ease in one after another, like entries being written up.
    rows.forEach(([k, v], i) => {
      const ra = Math.max(0, Math.min(1, (this.t - 0.25 - i * 0.12) * 5));
      if (ra <= 0) return;
      const y = r.y + 196 + i * 32 + (1 - ra) * 6;
      caps(g, k, lx, y, 12, hex(INK.dim, ra));
      numerals(g, v, lx + lw, y + 2, 20, '#ffffff', '#d8ccb4', 'right', ra);
      g.rect(lx, y + 12, lw, 1, hex(INK.gilt, 0.14 * ra));
    });
    if (this.t > 1.2) {
      const sa = Math.min(1, (this.t - 1.2) * 4);
      g.rect(lx, r.y + 470, lw, 1.5, hex(INK.gilt, 0.7 * sa));
      caps(g, t('ui.results.score'), lx, r.y + 506, 15, hex(INK.gold, sa));
      numerals(g, formatNumber(op.score), lx + lw, r.y + 510, 36, INK.goldHi, INK.gold, 'right', sa);
    }

    // The rank seal presses down.
    const sx = r.x + 530;
    const sy = r.y + 320;
    if (this.won && this.t > 1.6) {
      const rank = op.rank();
      const k = Math.min(1, (this.t - 1.6) / 0.3);
      g.glow(sx, sy, 150, hex(INK.gold, 0.12 * k));
      rankSeal(g, sx, sy, 74, rank, this.t - 1.6);
      if (k >= 1) {
        caps(g, t('ui.results.rank'), sx, sy - 104, 13, hex(INK.dim), 'center');
        if (this.newBest) caps(g, t('ui.results.new_best'), sx, sy + 116, 14, hex(INK.goldHi), 'center');
        if (assisted() || op.resultFlags().length) g.text(t('ui.results.assisted'), sx, sy + 142, { size: 16, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
      }
    } else if (!this.won) {
      failSeal(g, sx, sy, 70, this.t - 0.4);
    }

    // Margin notes: what the next rank needs, why not XS, flags, fees, tips.
    if (this.t > 2) {
      const notes: string[] = [];
      if (this.won && bd.next) notes.push(`${bd.next.delta} to ${bd.next.rank}`);
      if (this.won && bd.rank === 'S') {
        const why = op.xsBlockers();
        if (why.length) notes.push(`XS needs: no ${why.join(', no ')}`.replace('no a Bad', 'not a Bad'));
      }
      if (bd.flags.length) notes.push(`(${bd.flags.join(', ')})`);
      if (this.summary?.fee) notes.push(`Fee paid: ${this.summary.fee} crowns`);
      for (const a2 of this.summary?.achievements ?? []) notes.push(`✦ ${ACHIEVEMENTS[a2]}`);
      g.textBlock(notes.join('  ·  '), r.x + 420, r.y + 480, 230, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false }, 1.2);
      if (this.summary?.tip) g.textBlock(t('ui.results.ilse_tip', { tip: this.summary.tip }), r.x + 420, r.y + 420, 230, { size: 16, font: 'italic', color: hex(INK.gold), shadow: false }, 1.2);
    }

    if (this.t > 1) {
      if (!this.won && this.actions.retryCheckpoint && button(g, game.input, t('ui.results.from_malison'), VIEW_W / 2 + 150, 624, 22)) this.actions.retryCheckpoint();
      if (!this.won && this.actions.retryNovice && button(g, game.input, t('ui.results.retry_novice'), VIEW_W / 2 - 150, 624, 22)) this.actions.retryNovice();
      if (this.actions.next && button(g, game.input, t('ui.results.continue'), VIEW_W / 2 + 220, 664, 25)) this.actions.next();
      if (button(g, game.input, this.won ? t('ui.results.operate_again') : t('ui.results.try_again'), VIEW_W / 2 - (this.actions.next ? 40 : 110), 664, 25)) this.actions.retry();
      if (button(g, game.input, t('ui.results.leave'), VIEW_W / 2 - 250, 664, 25)) this.actions.quit();
    }
    reticle(g, game.input.pos);
    this.retry.draw(g, game.input.pos);
    g.endFrame();
  }
}
