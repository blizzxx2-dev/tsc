import type { Vec } from '../core/math';

/**
 * Tracks how much of a circular area a brush tool (salve) has covered.
 * Cells are laid on a grid clipped to the circle.
 */
export class Coverage {
  cells: { x: number; y: number; done: boolean }[] = [];

  constructor(
    public center: Vec,
    public radius: number,
    readonly step = 12,
  ) {
    for (let y = -radius; y <= radius; y += step)
      for (let x = -radius; x <= radius; x += step)
        if (x * x + y * y <= radius * radius) this.cells.push({ x, y, done: false });
    if (this.cells.length === 0) this.cells.push({ x: 0, y: 0, done: false });
  }

  /** Mark cells within brush radius of p. Returns the number newly covered. */
  brush(p: Vec, brush = 24): number {
    let n = 0;
    for (const c of this.cells) {
      if (c.done) continue;
      const dx = this.center.x + c.x - p.x;
      const dy = this.center.y + c.y - p.y;
      if (dx * dx + dy * dy <= brush * brush) {
        c.done = true;
        n++;
      }
    }
    return n;
  }

  get fraction(): number {
    return this.cells.filter((c) => c.done).length / this.cells.length;
  }

  contains(p: Vec, pad = 0): boolean {
    const dx = p.x - this.center.x;
    const dy = p.y - this.center.y;
    const r = this.radius + pad;
    return dx * dx + dy * dy <= r * r;
  }
}
