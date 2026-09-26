import { formatSplit, timeAttackBest } from '../surgery/timeAttack';
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
import { caseNote, renderCaseNote } from '../content/casenotes';

/** Row height and the clipped list area (UIX-0089). */
const ROW = 58;
const LIST = { x: 236, y: 150, w: 808, h: 440 };

/** Replay any operation already reached in the campaign, chasing better ranks. */
export class OperationsScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  private list: { chapter: string; def: OperationDef }[] = [];
  /** Time attack (GAM-0217): a cleared op is raced against the clock and its personal-best ghost. */
  private static timeAttack = false;

  enter(): void {
    const p = save.progress;
    CAMPAIGN.forEach((ch, ci) =>
      ch.steps.forEach((s, si) => {
        if (s.kind === 'op' && (ci < p.chapter || (ci === p.chapter && si <= p.step))) this.list.push({ chapter: ch.numeral, def: s.op });
      }),
    );
  }

  /** Scroll offset of the list, in px (UIX-0089): the full campaign runs to forty operations. */
  private scroll = 0;

  private maxScroll(): number {
    return Math.max(0, this.list.length * ROW - LIST.h);
  }

  update(_dt: number, game: Game): void {
    const i = game.input;
    if (i.actPressed('ui.back')) game.go(new TitleScene());
    if (i.wheel) this.scroll += i.wheel * ROW;
    if (i.actPressed('ui.down')) this.scroll += ROW;
    if (i.actPressed('ui.up')) this.scroll -= ROW;
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll));
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'theatre', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    panel(g, { x: 200, y: 40, w: 880, h: 640 });
    heading(g, t('ui.theatre.title'), VIEW_W / 2, 96, 420, 1, 30);
    let hovered: OperationDef | null = null;
    g.pushClip(LIST);
    this.list.forEach(({ chapter, def }, i) => {
      const y = LIST.y + 30 + i * ROW - this.scroll;
      if (y < LIST.y - ROW || y > LIST.y + LIST.h + ROW) return;
      const r = { x: 240, y: y - 34, w: 800, h: ROW - 6 };
      const hover = inRect(game.input.pos, r) && inRect(game.input.pos, LIST);
      if (hover) hovered = def;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.3));
      g.text(t('ui.theatre.entry', { chapter, index: i + 1 }), 260, y, { size: 24, color: hex(PALETTE.inkDim) });
      g.text(def.title, 340, y, { size: 28, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      const best = save.best[def.id];
      const ta = OperationsScene.timeAttack;
      const record = ta ? timeAttackBest(def.id) : null;
      // In time attack only cleared operations can be raced; the column shows the fastest clear.
      const open = !ta || !!best;
      const right = ta ? (record ? t('ui.theatre.fastest', { time: formatSplit(record.time) }) : best ? '—' : t('ui.theatre.not_cleared')) : best ? t('ui.theatre.best', { rank: best.rank, score: best.score }) : '—';
      g.text(right, 1020, y, { size: 26, color: hex(open && (record || (!ta && best)) ? PALETTE.gold : PALETTE.inkDim), align: 'right' });
      if (hover && open && game.input.pressed) {
        const back = () => game.go(new OperationsScene());
        playOperation(game, def, back, back, false, ta ? { timeAttack: true } : {});
      }
    });
    g.popClip();
    // Scroll bar, when the list is longer than the page.
    const max = this.maxScroll();
    if (max > 0) {
      const h = Math.max(40, (LIST.h * LIST.h) / (LIST.h + max));
      g.rect(LIST.x + LIST.w + 8, LIST.y, 4, LIST.h, hex(PALETTE.inkDim, 0.25));
      g.rect(LIST.x + LIST.w + 8, LIST.y + (LIST.h - h) * (this.scroll / max), 4, h, hex(PALETTE.gold, 0.8));
    }
    // The day-book page for a cleared operation (NAR-0170): its outcome at the best rank so far.
    const hov = hovered as OperationDef | null;
    const best = hov ? save.best[hov.id] : undefined;
    const note = hov && best ? caseNote(hov.id) : undefined;
    if (note && best) g.textBlock(t('ui.theatre.daybook', { note: renderCaseNote(note, best.rank).outcome }), 250, 606, 780, { size: 17, font: 'italic', color: hex(PALETTE.inkDim), shadow: false }, 1.2);
    const mode = t(OperationsScene.timeAttack ? 'ui.theatre.mode_timeattack' : 'ui.theatre.mode_standard');
    if (button(g, game.input, mode, VIEW_W / 2, 132, 20)) OperationsScene.timeAttack = !OperationsScene.timeAttack;
    if (button(g, game.input, t('ui.codex.open'), VIEW_W / 2 - 250, 650, 24)) game.go(new CodexScene(() => game.go(new OperationsScene())));
    if (button(g, game.input, t('ui.manual.open'), VIEW_W / 2, 650, 24)) game.go(new ManualScene(() => game.go(new OperationsScene())));
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2 + 250, 650, 26)) game.go(new TitleScene());
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
