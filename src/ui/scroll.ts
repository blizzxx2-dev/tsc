/**
 * Scroll list (UIX-0006): a clipped vertical list driven by the mouse wheel,
 * pointer drag, keyboard/D-pad focus (the list scrolls to keep the focused row
 * visible) and the gamepad's left stick through the same `ui.up/down` actions.
 */
import type { Gfx } from '../render/gfx';
import { hex } from '../render/color';
import { UI } from './ornaments';
import type { Rect, Ui, UiInput } from './kit';
import { inside } from './kit';
import { reducedMotion } from './motion';

export class ScrollList {
  /** Current scroll offset in px (eased toward `target`). */
  offset = 0;
  target = 0;
  private dragY: number | null = null;
  private dragFrom = 0;
  private moved = 0;

  constructor(
    public view: Rect,
    public rowH: number,
    public gap = 6,
  ) {}

  contentHeight(count: number): number {
    return count * (this.rowH + this.gap) - this.gap;
  }

  get maxOffset(): number {
    return this.maxFor;
  }
  private maxFor = 0;

  /** Rect of row `i` at the current offset. */
  rowRect(i: number): Rect {
    return { x: this.view.x, y: this.view.y + i * (this.rowH + this.gap) - this.offset, w: this.view.w, h: this.rowH };
  }

  /** True when row `i` is at least partly inside the view. */
  visible(i: number): boolean {
    const r = this.rowRect(i);
    return r.y + r.h > this.view.y && r.y < this.view.y + this.view.h;
  }

  /**
   * Handle wheel/drag. Call before declaring the rows (so rects use the new
   * offset); call `follow` after `ui.update` so keyboard focus stays visible.
   * Returns true while a drag is scrolling.
   */
  update(input: UiInput, count: number, dt: number): boolean {
    this.maxFor = Math.max(0, this.contentHeight(count) - this.view.h);
    const over = inside(input.pos, this.view);
    if (over && input.wheel) this.target += input.wheel * (this.rowH + this.gap);
    if (input.pressed && over) {
      this.dragY = input.pos.y;
      this.dragFrom = this.target;
      this.moved = 0;
    }
    if (this.dragY !== null) {
      if (input.down) {
        this.moved = Math.max(this.moved, Math.abs(input.pos.y - this.dragY));
        if (this.moved > 8) this.target = this.dragFrom - (input.pos.y - this.dragY);
      } else this.dragY = null;
    }
    this.target = Math.max(0, Math.min(this.maxFor, this.target));
    const k = reducedMotion() || this.dragY !== null ? 1 : Math.min(1, dt * 14);
    this.offset += (this.target - this.offset) * k;
    if (Math.abs(this.target - this.offset) < 0.5) this.offset = this.target;
    return this.moved > 8;
  }

  /** Scroll so row `i` is fully visible. */
  reveal(i: number): void {
    const top = i * (this.rowH + this.gap);
    if (top < this.target) this.target = top;
    else if (top + this.rowH > this.target + this.view.h) this.target = top + this.rowH - this.view.h;
    this.target = Math.max(0, Math.min(this.maxFor, this.target));
  }

  /** After `ui.update`: keep the keyboard/gamepad-focused row (ids `${prefix}${i}`) in view. */
  follow(ui: Ui, prefix: string): void {
    const i = ScrollList.focusIndex(ui, prefix);
    if (i >= 0 && ui.navMode) this.reveal(i);
  }

  /** Index of the row node focused in `ui` (ids `${prefix}${i}`), or -1. */
  static focusIndex(ui: Ui, prefix: string): number {
    const f = ui.focus;
    return f && f.startsWith(prefix) ? Number(f.slice(prefix.length)) : -1;
  }

  /** Brass scroll bar at the right edge of the view. */
  drawBar(g: Gfx, count: number): void {
    const total = this.contentHeight(count);
    if (total <= this.view.h) return;
    const x = this.view.x + this.view.w + 8;
    g.rect(x, this.view.y, 4, this.view.h, hex('#000000', 0.45));
    const h = Math.max(30, (this.view.h * this.view.h) / total);
    const y = this.view.y + (this.view.h - h) * (this.offset / Math.max(1, this.maxFor));
    g.rectGrad(x - 1, y, 6, h, hex(UI.brassHi), hex(UI.brassLo));
  }
}
