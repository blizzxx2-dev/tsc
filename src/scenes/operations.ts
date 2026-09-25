import type { Game, Scene } from '../core/scene';
import { heading } from '../ui/hudKit';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import type { OperationDef } from '../surgery/operation';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { playOperation, save } from './flow';
import { TitleScene } from './title';
import { CodexScene } from './codex';
import { ManualScene } from './manual';

/** Replay any operation already reached in the campaign, chasing better ranks. */
export class OperationsScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  private list: { chapter: string; def: OperationDef }[] = [];

  enter(): void {
    const p = save.progress;
    CAMPAIGN.forEach((ch, ci) =>
      ch.steps.forEach((s, si) => {
        if (s.kind === 'op' && (ci < p.chapter || (ci === p.chapter && si <= p.step))) this.list.push({ chapter: ch.numeral, def: s.op });
      }),
    );
  }

  update(_dt: number, game: Game): void {
    if (game.input.actPressed('ui.back')) game.go(new TitleScene());
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'theatre', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    panel(g, { x: 200, y: 40, w: 880, h: 640 });
    heading(g, t('ui.theatre.title'), VIEW_W / 2, 96, 420, 1, 30);
    this.list.forEach(({ chapter, def }, i) => {
      const y = 180 + i * 64;
      const r = { x: 240, y: y - 34, w: 800, h: 54 };
      const hover = inRect(game.input.pos, r);
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.3));
      g.text(t('ui.theatre.entry', { chapter, index: i + 1 }), 260, y, { size: 24, color: hex(PALETTE.inkDim) });
      g.text(def.title, 340, y, { size: 28, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      const best = save.best[def.id];
      g.text(best ? t('ui.theatre.best', { rank: best.rank, score: best.score }) : '—', 1020, y, { size: 26, color: hex(best ? PALETTE.gold : PALETTE.inkDim), align: 'right' });
      if (hover && game.input.pressed) {
        const back = () => game.go(new OperationsScene());
        playOperation(game, def, back, back);
      }
    });
    if (button(g, game.input, t('ui.codex.open'), VIEW_W / 2 - 250, 650, 24)) game.go(new CodexScene(() => game.go(new OperationsScene())));
    if (button(g, game.input, t('ui.manual.open'), VIEW_W / 2, 650, 24)) game.go(new ManualScene(() => game.go(new OperationsScene())));
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2 + 250, 650, 26)) game.go(new TitleScene());
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
