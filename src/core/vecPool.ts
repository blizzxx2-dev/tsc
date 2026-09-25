/**
 * Scratch vectors for draw code (ENG-0226). The math helpers in ./math return fresh objects, which
 * is right for the simulation but churns the GC when views and HUD code call them every frame.
 * These in-place variants write into an `out` vector, and `VecPool` hands out reusable scratch
 * vectors that are recycled wholesale once per frame (`reset`).
 */
import type { Vec } from './math';

export const setTo = (out: Vec, x: number, y: number): Vec => {
  out.x = x;
  out.y = y;
  return out;
};
export const copyTo = (out: Vec, a: Vec): Vec => setTo(out, a.x, a.y);
export const addTo = (out: Vec, a: Vec, b: Vec): Vec => setTo(out, a.x + b.x, a.y + b.y);
export const subTo = (out: Vec, a: Vec, b: Vec): Vec => setTo(out, a.x - b.x, a.y - b.y);
export const scaleTo = (out: Vec, a: Vec, s: number): Vec => setTo(out, a.x * s, a.y * s);
export const lerpTo = (out: Vec, a: Vec, b: Vec, t: number): Vec => setTo(out, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export const normTo = (out: Vec, a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y);
  return l > 0 ? setTo(out, a.x / l, a.y / l) : setTo(out, 0, 0);
};
/** Rotate `a` by `ang` radians about the origin. */
export const rotateTo = (out: Vec, a: Vec, ang: number): Vec => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return setTo(out, a.x * c - a.y * s, a.x * s + a.y * c);
};
/** Perpendicular (left-hand normal) of `a`. */
export const perpTo = (out: Vec, a: Vec): Vec => setTo(out, -a.y, a.x);

/**
 * A grow-only pool of scratch vectors. `get` returns the next free vector (allocating only while
 * the pool is still growing toward its steady-state size); `reset` recycles them all at frame start.
 * Vectors from the pool must not be kept past the frame.
 */
export class VecPool {
  private items: Vec[] = [];
  private used = 0;

  get(x = 0, y = 0): Vec {
    let v = this.items[this.used];
    if (!v) this.items.push((v = { x: 0, y: 0 }));
    this.used++;
    v.x = x;
    v.y = y;
    return v;
  }

  /** Recycle every vector handed out since the last reset. */
  reset(): void {
    this.used = 0;
  }

  /** Vectors ever allocated (steady state after the first frames). */
  get capacity(): number {
    return this.items.length;
  }

  get inUse(): number {
    return this.used;
  }
}

/** The per-frame pool for view/HUD code; the main loop resets it at the start of each frame. */
export const frameVecs = new VecPool();
