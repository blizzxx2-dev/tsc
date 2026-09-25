/**
 * Render interpolation (ENG-0054). The simulation ticks at a fixed rate; frames fall between
 * ticks. Views draw each entity `alpha` of the way from where the last tick started to where it
 * ended, so motion is smooth on high-refresh displays. The simulation's own positions are put
 * back after drawing, so interpolation can never leak into the rules.
 */
import type { Vec } from '../core/math';

/** Interpolate a scalar (tool heat, an orbit angle…) between two ticks. */
export const lerp = (prev: number, cur: number, alpha: number): number => prev + (cur - prev) * alpha;

/** Interpolate a point between two ticks (a jump of more than `snap` px is drawn where it landed). */
export function lerpVec(prev: Vec, cur: Vec, alpha: number, snap = 80): Vec {
  if (Math.abs(cur.x - prev.x) > snap || Math.abs(cur.y - prev.y) > snap) return { x: cur.x, y: cur.y };
  return { x: lerp(prev.x, cur.x, alpha), y: lerp(prev.y, cur.y, alpha) };
}

/** Draw `things` at their interpolated positions, restoring the real ones afterwards. */
export function drawInterpolated<T extends { pos: Vec; prevPos: Vec }>(things: readonly T[], alpha: number, draw: (t: T) => void): void {
  if (alpha >= 1) {
    for (const t of things) draw(t);
    return;
  }
  for (const t of things) {
    const real = t.pos;
    t.pos = lerpVec(t.prevPos, real, alpha);
    try {
      draw(t);
    } finally {
      t.pos = real;
    }
  }
}
