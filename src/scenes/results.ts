import { assisted } from '../core/settings';
import { t, tSource } from '../i18n';
import { formatClock, formatNumber } from '../i18n/format';
import { BOSS_OPS, debriefBand } from '../surgery/bosses/codex';
import { bossStoryFlags } from '../content/flags';
import { MEDAL_OF, nextMedal, trial } from '../content/trials';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { VIEW_W } from '../ui/layout';
import { Particles } from '../render/particles';
import { fitText } from '../ui/text';
import { caps, glass, heading, INK, numerals, tallyMarks } from '../ui/hudKit';
import { failSeal, rankSeal } from '../art/kit';
import { sutureVignette } from '../art/sutures';
import { button, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import type { RunSummary } from '../surgery/session';
import { ACHIEVEMENTS } from '../surgery/achievements';
import { rankQuip } from '../content/barks';
import { HoldToRetry } from '../input/retry';

/** The case record: a parchment ledger page, stamped with the rank in wax. */
export class ResultsScene implements Scene {
  private t = 0;
  private stamped = false;
  /** The observer's one-line verdict under the rank (NAR-0078); chosen once per card. */
  private quip = '';
  /** Hold R (or the pad's View button) for a second to go straight back in (INP-0113). */
  private retry = new HoldToRetry();
  constructor(
    private op: Operation,
    private won: boolean,
    private newBest: boolean,
    private actions: { next?: () => void; retry: () => void; quit: () => void; retryNovice?: () => void; retryCheckpoint?: () => void },
    private summary?: RunSummary,
  ) {}

  /** When the tally has finished writing itself up (rows, score, seal). */
  private static readonly TALLY_DONE = 2.0;

  enter(game: Game): void {
    if (this.won) game.audio.play('bell');
    // XS (UIX-0118): a second peal for a flawless case.
    if (this.won && this.op.rank() === 'XS') setTimeout(() => game.audio.play('bell'), 350);
  }

  /** Rank-reveal ink splash (ENG-0144). */
  private fx = new Particles();
  private splashAt: { x: number; y: number } | null = null;

  update(dt: number, game: Game): void {
    this.t += dt;
    this.fx.update(dt, () => {});
    if (this.won && !this.stamped && this.t > 1.9) {
      this.stamped = true;
      if (this.splashAt) this.fx.burst('inkSplash', this.splashAt);
      game.audio.play('squelch');
    }
    // Results skip (UIX-0117): the first press completes the tally, the second continues.
    if (game.input.actPressed('ui.confirm') || (game.input.pressed && this.t < ResultsScene.TALLY_DONE)) {
      if (this.t < ResultsScene.TALLY_DONE) this.t = ResultsScene.TALLY_DONE;
      else if (game.input.actPressed('ui.confirm')) (this.actions.next ?? this.actions.retry)();
    }
    if (this.retry.update(game.input, dt)) this.actions.retry();
  }

  /** Per-action breakdown (UIX-0114): how many of each labelled action, and the costliest category (UIX-0115). */
  private breakdownRows(): { actions: [string, number][]; costly: string | null } {
    const by = new Map<string, number>();
    const bad = new Map<string, number>();
    for (const e of this.op.journal) {
      if (e.kind !== 'rated' || !e.label) continue;
      const k = tSource(e.label);
      by.set(k, (by.get(k) ?? 0) + 1);
      if (e.rating === 'bad' || e.rating === 'miss') bad.set(k, (bad.get(k) ?? 0) + 1);
    }
    const actions = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const worst = [...bad.entries()].sort((a, b) => b[1] - a[1])[0];
    return { actions, costly: worst ? t('ui.results.costly', { n: worst[1], label: worst[0] }) : null };
  }

  /** The field as it was left (ENG-0122), pinned beside the ledger like a sketch in the case book. */
  private drawSnapshot(g: Gfx, a: number): void {
    const snap = g.fieldSnapshot;
    if (!snap || a <= 0) return;
    const w = 248;
    const h = Math.round((w * snap.h) / snap.w);
    const x = 30;
    const y = 250;
    g.plate(x - 8, y - 8, w + 16, h + 44, { radius: 3, alpha: a, border: hex(INK.gilt, 0.7) });
    g.texQuad(snap.tex, x, y, w, h, hex('#ffffff', a), true);
    fitText(g, 'results.field', t('ui.results.field'), x + w / 2, y + h + 26, w, { size: 16, font: 'italic', color: hex(INK.dim, a), align: 'center', shadow: false });
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    g.beginWorld();
    drawBackdrop(g, 'results', g.time);
    g.endWorld({ litany: 0, danger: this.won ? 0 : 0.4, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });

    const r = { x: 300, y: 36, w: 680, h: 580 };
    const a = Math.min(1, this.t * 3);
    this.drawSnapshot(g, a);
    // The patient's sutures (ART-0188): every closed wound's scar, carried over from the table.
    if (op.scars.length) sutureVignette(g, op, 150, 330, a);
    glass(g, r, { alpha: a, strength: 1.12 });
    heading(g, t('ui.results.title'), VIEW_W / 2, r.y + 60, 420, a, 30);
    g.text(t('ui.results.subtitle', { title: op.def.title, patient: op.def.patient }), VIEW_W / 2, r.y + 108, { size: 19, font: 'italic', color: hex(INK.dim, a), align: 'center', shadow: false });
    caps(g, this.won ? t('ui.results.won') : t('ui.results.lost'), VIEW_W / 2, r.y + 146, 15, hex(this.won ? '#9fd8a8' : '#ff8a80', a), 'center');
    // The cause of death, for vitals and time-out losses alike (UIX-0116).
    if (!this.won && op.lostReason) g.text(tSource(op.lostReason), VIEW_W / 2, r.y + 170, { size: 17, font: 'italic', color: hex('#e8b0a8', a), align: 'center', shadow: false });
    if (this.won && this.stamped) g.text((this.quip ||= rankQuip(op.def.id, op.rank())), VIEW_W / 2, r.y + 170, { size: 17, font: 'italic', color: hex(INK.gold, a), align: 'center', shadow: false });

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
    rows.push([t('ui.results.time_taken'), formatClock(op.timeLimit - op.timeLeft)]);
    rows.push([t('ui.results.litany_used'), t(op.litanyUsed ? 'ui.common.yes' : 'ui.common.no')]);
    const lx = r.x + 56;
    const lw = 320;
    // Rows ease in one after another, like entries being written up. Ratings carry tally marks (UIX-0114).
    const counts = [op.counts.cool, op.counts.good, op.counts.bad, op.counts.miss];
    rows.forEach(([k, v], i) => {
      const ra = Math.max(0, Math.min(1, (this.t - 0.25 - i * 0.1) * 5));
      if (ra <= 0) return;
      // Clear of the verdict line above (it sat on the COOL row).
      const y = r.y + 204 + i * 26 + (1 - ra) * 6;
      caps(g, k, lx, y, 12, hex(INK.dim, ra));
      if (i < 4) tallyMarks(g, lx + 120, y - 9, Math.min(25, counts[i]), hex(i < 2 ? INK.gold : '#c05040', 0.85 * ra));
      numerals(g, v, lx + lw, y + 2, 20, '#ffffff', '#d8ccb4', 'right', ra);
      g.rect(lx, y + 12, lw, 1, hex(INK.gilt, 0.14 * ra));
    });
    // The per-action breakdown, in a small column beside the seal.
    const br = this.breakdownRows();
    if (this.t > 1.4 && br.actions.length) {
      const ba = Math.min(1, (this.t - 1.4) * 4);
      caps(g, t('ui.results.actions'), r.x + 420, r.y + 186, 11, hex(INK.dim, ba));
      br.actions.forEach(([k, n], i) => {
        g.text(k, r.x + 420, r.y + 210 + i * 20, { size: 16, color: hex(INK.text, 0.85 * ba), shadow: false });
        numerals(g, String(n), r.x + 640, r.y + 211 + i * 20, 16, '#ffffff', '#d8ccb4', 'right', ba);
      });
    }
    if (this.t > 1.2) {
      const sa = Math.min(1, (this.t - 1.2) * 4);
      g.rect(lx, r.y + 476, lw, 1.5, hex(INK.gilt, 0.7 * sa));
      caps(g, t('ui.results.score'), lx, r.y + 512, 15, hex(INK.gold, sa));
      numerals(g, formatNumber(op.score), lx + lw, r.y + 516, 36, INK.goldHi, INK.gold, 'right', sa);
    }

    // The rank seal presses down.
    const sx = r.x + 530;
    const sy = r.y + 320;
    this.splashAt = { x: sx, y: sy };
    if (this.won && this.t > 1.6) {
      const rank = op.rank();
      const k = Math.min(1, (this.t - 1.6) / 0.3);
      // XS: gold leaf — a brighter halo and a slow glint round the seal (UIX-0118).
      g.glow(sx, sy, 150, hex(INK.gold, (rank === 'XS' ? 0.3 : 0.12) * k));
      if (rank === 'XS') g.arc(sx, sy, 92, 1.5, hex('#fff4d0', 0.5 + 0.3 * Math.sin(g.time * 2)));
      rankSeal(g, sx, sy, 74, rank, this.t - 1.6);
      if (k >= 1) {
        caps(g, t('ui.results.rank'), sx, sy - 104, 13, hex(INK.dim), 'center');
        // Every Hour and the Office end on the same stamp (BOS-0173).
        if (BOSS_OPS[op.def.id]) caps(g, t('ui.results.malison_unmade'), sx, sy - 132, 16, hex('#d86a50'), 'center');
        if (rank === 'XS') g.text(t('ui.results.xs_subtitle'), sx, sy + 100, { size: 17, font: 'italic', color: hex('#fff4d0'), align: 'center', shadow: hex('#000000', 0.8), soft: true });
        if (this.newBest) caps(g, t('ui.results.new_best'), sx, sy + (rank === 'XS' ? 128 : 116), 14, hex(INK.goldHi), 'center');
        if (assisted() || op.resultFlags().length) g.text(t('ui.results.assisted'), sx, sy + 142, { size: 16, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
      }
    } else if (!this.won) {
      failSeal(g, sx, sy, 70, this.t - 0.4);
    }
    this.fx.draw(g, 'UI');

    // Margin notes: what the next rank needs, why not XS, flags, fees, tips.
    if (this.t > 2) {
      const notes: string[] = [];
      if (this.won && bd.next) notes.push(`${bd.next.delta} to ${bd.next.rank}`);
      if (this.won && bd.rank === 'S') {
        const why = op.xsBlockers();
        if (why.length) notes.push(`XS needs: no ${why.join(', no ')}`.replace('no a Bad', 'not a Bad'));
      }
      if (br.costly) notes.push(br.costly);
      if (bd.flags.length) notes.push(`(${bd.flags.join(', ')})`);
      // A trial pays in medals (UIX-0189): the one won, and what the next needs.
      if (op.opts.challenge && trial(op.opts.challenge)) {
        const medal = this.won ? MEDAL_OF[op.rank()] : null;
        if (medal) notes.push(t('ui.trials.medal_won', { medal: t(`ui.trials.medal.${medal}`) }));
        const nx = nextMedal(this.won ? op.rank() : 'C', op.ranks);
        if (nx) notes.push(t('ui.trials.next_medal', { medal: t(`ui.trials.medal.${nx.medal}`), need: nx.need }));
      }
      if (this.summary?.fee) notes.push(`Fee paid: ${this.summary.fee} crowns`);
      for (const a2 of this.summary?.achievements ?? []) notes.push(`✦ ${ACHIEVEMENTS[a2]}`);
      g.textBlock(notes.join('  ·  '), r.x + 420, r.y + 480, 230, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false }, 1.2);
      // After a Malison: Sister Ilse's debrief, by how cleanly it was unmade.
      const boss = BOSS_OPS[op.def.id];
      if (this.won && boss) {
        // The Office's ending debrief varies by rank and by the story flags (BOS-0146).
        const band = debriefBand(op.rank());
        const stroh = boss === 'office' && bossStoryFlags().includes('strohAlly');
        const line = stroh ? t(`debrief.office.${band}.stroh`) : t(`debrief.${boss}.${band}`);
        g.textBlock(t('ui.results.ilse_tip', { tip: line }), r.x + 420, r.y + 400, 230, { size: 16, font: 'italic', color: hex(INK.gold), shadow: false }, 1.2);
      }
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
