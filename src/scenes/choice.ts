import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui, type Rect } from '../ui/kit';
import { listItem } from '../ui/controls';
import { UI } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { ScrollList } from '../ui/scroll';
import { fitText } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { palette } from '../ui/theme';

/**
 * Dropdown popup (UIX-0006): a list of choices opened under an anchor row. Pushed
 * as a modal; Enter / click picks, Esc / B / clicking outside closes without change.
 */
export class ChoiceScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('choice');
  private t = 0;
  private list: ScrollList;
  private closed = false;

  constructor(
    anchor: Rect,
    private options: readonly string[],
    private selected: number,
    private onPick: (index: number) => void,
  ) {
    const rowH = 40;
    const h = Math.min(options.length, 8) * (rowH + 2);
    const y = anchor.y + anchor.h + h + 16 > 700 ? anchor.y - h - 8 : anchor.y + anchor.h + 4;
    this.list = new ScrollList({ x: anchor.x + anchor.w * 0.5, y, w: anchor.w * 0.5 - 12, h }, rowH, 2);
    this.list.reveal(selected);
  }

  private close(game: Game, pick: number | null): void {
    if (this.closed) return;
    this.closed = true;
    game.pop?.();
    if (pick !== null) this.onPick(pick);
  }

  update(dt: number, game: Game): void {
    const input = game.input;
    this.t += dt;
    if (this.list.update(input, this.options.length, dt)) this.ui.cancelPress();
    this.ui.begin();
    this.options.forEach((label, i) => {
      const r = this.list.rowRect(i);
      this.ui.add({ id: `opt${i}`, kind: 'item', rect: r, label, on: i === this.selected, clip: this.list.view, onActivate: () => this.close(game, i) });
    });
    if (!this.ui.focus) this.ui.focusFirst(`opt${this.selected}`);
    this.ui.update(input, dt);
    this.list.follow(this.ui, 'opt');
    const v = this.list.view;
    const outside = input.pressed && !(input.pos.x >= v.x && input.pos.x <= v.x + v.w && input.pos.y >= v.y && input.pos.y <= v.y + v.h);
    if (input.actPressed('ui.back') || outside) {
      uiEvents.emit('ui.back', { id: 'choice' });
      this.close(game, null);
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    const v = this.list.view;
    g.rect(v.x + 4, v.y + 6, v.w, v.h * k, hex('#000000', 0.5));
    g.rectGrad(v.x - 4, v.y - 4, v.w + 8, v.h * k + 8, hex('#2a120c', 0.98), hex('#140806', 0.98));
    g.rectLine(v.x - 4, v.y - 4, v.w + 8, v.h * k + 8, 1.5, hex(UI.brass));
    g.pushClip({ x: v.x, y: v.y, w: v.w, h: v.h * k });
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      listItem(g, n, s, g.time, !!n.on);
      fitText(g, n.id, n.label, n.rect.x + 16, n.rect.y + n.rect.h / 2 + 7, n.rect.w - 24, { size: 20, color: hex(n.on ? UI.gilt : palette().ink) });
    }
    g.popClip();
    this.list.drawBar(g, this.options.length);
    reticle(g, game.input.pos);
  }
}

/** Declare a dropdown row: Left/Right cycle in place, Enter/click opens the choice list. */
export function dropdown(ui: Ui, game: Game, id: string, rect: Rect, label: string, options: readonly string[], index: number, set: (i: number) => void, tip?: string): void {
  const n = options.length;
  ui.add({
    id,
    kind: 'dropdown',
    rect,
    label,
    value: options[index] ?? '',
    tip,
    onAdjust: (d) => set((index + d + n) % n),
    onActivate: () => (game.push ? game.push(new ChoiceScene(rect, options, index, set)) : set((index + 1) % n)),
  });
}
