/**
 * Suture closure (ENG-0112): when the last stitch goes in, the open cut does not vanish at once:
 * it erodes along the thread from the first end to the knot over CLOSE_S, the wet lips drawing
 * together behind the needle. What stays is the sutured scar (op.scars), which carries the stitch
 * marks for the rest of the operation and onto the results card.
 */
import type { Vec } from '../core/math';
import { Laceration } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { hex } from './color';
import type { Gfx } from './gfx';

export const CLOSE_S = 0.4;

export class Closures {
  private open: { a: Vec; b: Vec; w: number; at: number }[] = [];

  /** A cut left the field: if it was stitched shut, animate its closure. */
  closed(e: Entity, now: number): void {
    if (!(e instanceof Laceration) || e.stitch.count < e.stitch.needed) return;
    this.open.push({ a: { ...e.a }, b: { ...e.b }, w: 7, at: now });
  }

  get active(): number {
    return this.open.length;
  }

  clear(): void {
    this.open.length = 0;
  }

  /** The part of the cut still open at `now` (from, to), or null once closed. */
  static remaining(a: Vec, b: Vec, age: number): [Vec, Vec] | null {
    const k = age / CLOSE_S;
    if (k >= 1) return null;
    return [{ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, b];
  }

  draw(g: Gfx, now: number, blood = '#5a0a10'): void {
    this.open = this.open.filter((c) => now - c.at < CLOSE_S);
    for (const c of this.open) {
      const r = Closures.remaining(c.a, c.b, now - c.at);
      if (!r) continue;
      const k = (now - c.at) / CLOSE_S;
      g.line(r[0], r[1], c.w * (1 - 0.5 * k), hex(blood, 0.9));
      g.line(r[0], r[1], c.w * 0.35 * (1 - k), hex('#ff9a8a', 0.4));
    }
  }
}
