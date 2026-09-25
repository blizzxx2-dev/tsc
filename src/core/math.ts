export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** Distance from point p to segment ab, plus the parametric position t along it. */
export function pointSegment(p: Vec, a: Vec, b: Vec): { d: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  return { d: Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)), t };
}

/** Signed side of point p relative to the directed line ab (>0 left, <0 right). */
export const side = (p: Vec, a: Vec, b: Vec): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** True if segments p1p2 and q1q2 properly intersect. */
export function segmentsIntersect(p1: Vec, p2: Vec, q1: Vec, q2: Vec): boolean {
  const d1 = side(q1, p1, p2);
  const d2 = side(q2, p1, p2);
  const d3 = side(p1, q1, q2);
  const d4 = side(p2, q1, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Small deterministic PRNG (mulberry32) so operations are reproducible and testable. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** The generator's internal state (snapshots, ENG-0249). */
  get state(): number {
    return this.s >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
