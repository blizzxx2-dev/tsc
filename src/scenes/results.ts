import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

const RANK_COLOR: Record<string, string> = { XS: '#f5d76e', S: '#e8c060', A: '#9fd3a8', B: '#a0b8d8', C: '#a89c80' };

export class ResultsScene implements Scene {
  private t = 0;
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
    if (game.input.keyPressed('Enter') && this.t > 0.5) (this.actions.next ?? this.actions.retry)();
  }

  render(g: Gfx, game: Game): void {
    const op = this.op;
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: this.won ? 0 : 0.4, shake: { x: 0, y: 0 }, bloom: 1 });
    panel(g, { x: 290, y: 50, w: 700, h: 620 });
    g.text(this.won ? 'The Patient Lives' : 'The Patient Is Lost', VIEW_W / 2, 120, {
      size: 50,
      font: 'display',
      color: hex(this.won ? PALETTE.gold : '#d04040'),
      align: 'center',
    });
    g.text(op.def.title, VIEW_W / 2, 160, { size: 24, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });

    const rows: [string, string][] = [
      ['Cool', String(op.counts.cool)],
      ['Good', String(op.counts.good)],
      ['Bad', String(op.counts.bad)],
      ['Miss', String(op.counts.miss)],
      ['Longest chain', String(op.maxCombo)],
      ['Vitals bonus', String(op.bonus.vitals)],
      ['Time bonus', String(op.bonus.time)],
    ];
    const shown = Math.min(rows.length, Math.floor(this.t * 6));
    rows.slice(0, shown).forEach(([k, v], i) => {
      g.text(k, 360, 220 + i * 40, { size: 24, color: hex(PALETTE.inkDim) });
      g.text(v, 700, 220 + i * 40, { size: 24, color: hex(PALETTE.ink), align: 'right' });
    });
    if (this.t > 1.3) {
      g.line({ x: 360, y: 506 }, { x: 700, y: 506 }, 1, hex(PALETTE.panelEdge));
      g.text('Score', 360, 540, { size: 28, color: hex(PALETTE.ink) });
      g.text(String(op.score), 700, 540, { size: 28, color: hex(PALETTE.gold), align: 'right' });
    }
    if (this.won && this.t > 1.8) {
      const rank = op.rank();
      const s = 1 + Math.max(0, 2.2 - this.t) * 2;
      g.glow(850, 380, 150, hex(RANK_COLOR[rank], 0.3));
      g.text(rank, 850, 420, { size: 150 * s, font: 'display', color: hex(RANK_COLOR[rank]), align: 'center' });
      g.text('Rank', 850, 250, { size: 24, color: hex(PALETTE.inkDim), align: 'center' });
      if (this.newBest) g.text('A new best!', 850, 480, { size: 22, color: hex(PALETTE.gold), align: 'center' });
    }
    if (this.t > 1) {
      if (this.actions.next && button(g, game.input, 'Continue', VIEW_W / 2 + 180, 630)) this.actions.next();
      if (button(g, game.input, this.won ? 'Operate Again' : 'Try Again', VIEW_W / 2 - (this.actions.next ? 20 : 120), 630)) this.actions.retry();
      if (button(g, game.input, 'Leave', VIEW_W / 2 - 220, 630, 26)) this.actions.quit();
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
