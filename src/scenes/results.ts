import { assisted } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { VIEW_W } from '../ui/layout';
import { divider, parchmentSheet, UI, woodcutCorner, woodcutEdge } from '../ui/ornaments';
import { failSeal, rankSeal } from '../art/kit';
import { button, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

/** The case record: a parchment ledger page, stamped with the rank in wax. */
export class ResultsScene implements Scene {
  private t = 0;
  private stamped = false;
  constructor(
    private op: Operation,
    private won: boolean,
    private newBest: boolean,
    private actions: { next?: () => void; retry: () => void; quit: () => void },
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
    if (game.input.keyPressed('Enter') && this.t > 0.5) (this.actions.next ?? this.actions.retry)();
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    g.beginWorld();
    drawBackdrop(g, 'results', g.time);
    g.endWorld({ litany: 0, danger: this.won ? 0 : 0.4, shake: { x: 0, y: 0 }, bloom: 1 });

    const r = { x: 300, y: 40, w: 680, h: 560 };
    parchmentSheet(g, r, 7);
    for (let k = 0; k < 4; k++) woodcutCorner(g, k % 2 ? r.x + r.w - 14 : r.x + 14, k < 2 ? r.y + 14 : r.y + r.h - 14, k % 2 ? -1 : 1, k < 2 ? 1 : -1, k, hex('#3a2414', 0.85));
    for (const yy of [r.y + 14, r.y + r.h - 14]) woodcutEdge(g, r.x + 52, yy, r.x + r.w - 52, yy, hex('#3a2414', 0.7));
    for (const xx of [r.x + 14, r.x + r.w - 14]) woodcutEdge(g, xx, r.y + 52, xx, r.y + r.h - 52, hex('#3a2414', 0.7), 1);
    const ink = hex(UI.inkDark);
    const faded = hex('#6a5030');
    g.text('Case Record', VIEW_W / 2, r.y + 62, { size: 46, font: 'display', color: hex('#6a0a10'), align: 'center', shadow: false });
    g.text(`${op.def.title} — ${op.def.patient}`, VIEW_W / 2, r.y + 98, { size: 21, font: 'italic', color: faded, align: 'center', shadow: false });
    divider(g, VIEW_W / 2, r.y + 118, 440, hex('#6a4a22'));
    g.text(this.won ? 'The patient lives.' : 'The patient was lost.', VIEW_W / 2, r.y + 154, {
      size: 26,
      color: hex(this.won ? '#2a4a1a' : '#7a0a10'),
      align: 'center',
      shadow: false,
    });

    const rows: [string, string][] = [
      ['Cool', String(op.counts.cool)],
      ['Good', String(op.counts.good)],
      ['Bad', String(op.counts.bad)],
      ['Miss', String(op.counts.miss)],
      ['Longest chain', String(op.maxCombo)],
      ['Vitals remaining', String(op.bonus.vitals)],
      ['Time remaining', String(op.bonus.time)],
    ];
    const shown = Math.min(rows.length, Math.floor(this.t * 7));
    rows.slice(0, shown).forEach(([k, v], i) => {
      const y = r.y + 200 + i * 34;
      g.text(k, r.x + 60, y, { size: 22, color: faded, shadow: false });
      // Dotted leader.
      for (let dx = r.x + 60 + g.measure(k, 22) + 10; dx < r.x + 360 - g.measure(v, 22); dx += 8) g.circle(dx, y - 5, 1, hex('#6a5030', 0.6));
      g.text(v, r.x + 370, y, { size: 22, color: ink, align: 'right', shadow: false });
    });
    if (this.t > 1.2) {
      g.line({ x: r.x + 60, y: r.y + 452 }, { x: r.x + 370, y: r.y + 452 }, 1.5, hex('#6a4a22'));
      g.text('Score', r.x + 60, r.y + 490, { size: 30, color: ink, shadow: false });
      g.text(String(op.score), r.x + 370, r.y + 490, { size: 30, color: hex('#6a0a10'), align: 'right', shadow: false });
    }

    // The rank seal slams down.
    const sx = r.x + 530;
    const sy = r.y + 330;
    if (this.won && this.t > 1.6) {
      const rank = op.rank();
      const k = Math.min(1, (this.t - 1.6) / 0.3);
      rankSeal(g, sx, sy, 78, rank, this.t - 1.6);
      if (k >= 1) {
        g.text('Rank', sx, sy - 100, { size: 22, font: 'italic', color: faded, align: 'center', shadow: false });
        if (this.newBest) g.text('A new best!', sx, sy + 118, { size: 22, color: hex('#6a0a10'), align: 'center', shadow: false });
        if (assisted()) g.text('(assisted)', sx, sy + 144, { size: 16, font: 'italic', color: faded, align: 'center', shadow: false });
      }
    } else if (!this.won) {
      failSeal(g, sx, sy, 70, this.t - 0.4);
    }

    if (this.t > 1) {
      if (this.actions.next && button(g, game.input, 'Continue', VIEW_W / 2 + 200, 660)) this.actions.next();
      if (button(g, game.input, this.won ? 'Operate Again' : 'Try Again', VIEW_W / 2 - (this.actions.next ? 0 : 110), 660)) this.actions.retry();
      if (button(g, game.input, 'Leave', VIEW_W / 2 - 220, 660, 26)) this.actions.quit();
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
