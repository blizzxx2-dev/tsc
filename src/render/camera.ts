import type { Vec } from '../core/math';

/** Easing curves for camera tweens (ENG-0047); each maps 0..1 → 0..1 with f(0)=0, f(1)=1. */
export const EASE = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} as const;
export type Ease = keyof typeof EASE;

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Tween {
  from: { x: number; y: number; zoom: number };
  to: { x: number; y: number; zoom: number };
  t: number;
  dur: number;
  ease: (t: number) => number;
}

/**
 * 2D camera (ENG-0045). `x`,`y` is the world point shown at the centre of the
 * `viewW`×`viewH` safe area; `zoom` > 1 magnifies. The view matrix is uploaded
 * as a uniform to the primitive shader, so zooming never re-tessellates.
 *
 * Maps world → safe-area view coordinates:  v = R(−rot)·S(zoom)·(w − c) + viewCentre.
 */
export class Camera2D {
  x: number;
  y: number;
  zoom = 1;
  rotation = 0;
  /** Optional clamp region in world units (ENG-0049): the view never shows beyond it. */
  bounds: Bounds | null = null;
  /** Trauma-style offset (shake) in view units, applied after the matrix. */
  offset: Vec = { x: 0, y: 0 };
  private tween: Tween | null = null;

  constructor(
    readonly viewW = 1280,
    readonly viewH = 720,
  ) {
    this.x = viewW / 2;
    this.y = viewH / 2;
  }

  get isIdentity(): boolean {
    return this.zoom === 1 && this.rotation === 0 && this.x === this.viewW / 2 && this.y === this.viewH / 2 && this.offset.x === 0 && this.offset.y === 0;
  }

  reset(): void {
    this.x = this.viewW / 2;
    this.y = this.viewH / 2;
    this.zoom = 1;
    this.rotation = 0;
    this.tween = null;
  }

  /** Affine world→view matrix as [a, b, c, d, e, f] (x' = a·x + c·y + e, y' = b·x + d·y + f). */
  matrix(out: Float32Array | number[] = new Float32Array(6)): Float32Array | number[] {
    const z = this.zoom;
    const cs = Math.cos(-this.rotation) * z;
    const sn = Math.sin(-this.rotation) * z;
    out[0] = cs;
    out[1] = sn;
    out[2] = -sn;
    out[3] = cs;
    out[4] = -(cs * this.x - sn * this.y) + this.viewW / 2 + this.offset.x;
    out[5] = -(sn * this.x + cs * this.y) + this.viewH / 2 + this.offset.y;
    return out;
  }

  /** Safe-area view point (e.g. `input.pos`) → world point (ENG-0046). */
  toWorld(p: Vec, out: Vec = { x: 0, y: 0 }): Vec {
    const vx = p.x - this.viewW / 2 - this.offset.x;
    const vy = p.y - this.viewH / 2 - this.offset.y;
    const c = Math.cos(this.rotation) / this.zoom;
    const s = Math.sin(this.rotation) / this.zoom;
    out.x = c * vx - s * vy + this.x;
    out.y = s * vx + c * vy + this.y;
    return out;
  }

  /** World point → safe-area view point. */
  toView(p: Vec, out: Vec = { x: 0, y: 0 }): Vec {
    const m = this.matrix([0, 0, 0, 0, 0, 0]);
    const x = p.x;
    const y = p.y;
    out.x = m[0] * x + m[2] * y + m[4];
    out.y = m[1] * x + m[3] * y + m[5];
    return out;
  }

  /** Tween to look at `target` with `zoom` over `seconds` (ENG-0047). */
  focus(target: Vec, zoom: number, seconds: number, ease: Ease = 'inOutCubic'): void {
    if (seconds <= 0) {
      this.x = target.x;
      this.y = target.y;
      this.zoom = zoom;
      this.tween = null;
      this.clamp();
      return;
    }
    this.tween = { from: { x: this.x, y: this.y, zoom: this.zoom }, to: { x: target.x, y: target.y, zoom }, t: 0, dur: seconds, ease: EASE[ease] };
  }

  get tweening(): boolean {
    return this.tween !== null;
  }

  update(dt: number): void {
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(tw.dur, tw.t + dt);
      const k = tw.ease(tw.t / tw.dur);
      this.x = tw.from.x + (tw.to.x - tw.from.x) * k;
      this.y = tw.from.y + (tw.to.y - tw.from.y) * k;
      this.zoom = tw.from.zoom + (tw.to.zoom - tw.from.zoom) * k;
      if (tw.t >= tw.dur) this.tween = null;
    }
    this.clamp();
  }

  /** Keep the visible world rect inside `bounds` (ENG-0049). Rotation is ignored for the clamp. */
  clamp(): void {
    const b = this.bounds;
    if (!b) return;
    const minZoom = Math.max(this.viewW / b.w, this.viewH / b.h);
    if (this.zoom < minZoom) this.zoom = minZoom;
    const hw = this.viewW / 2 / this.zoom;
    const hh = this.viewH / 2 / this.zoom;
    this.x = Math.min(b.x + b.w - hw, Math.max(b.x + hw, this.x));
    this.y = Math.min(b.y + b.h - hh, Math.max(b.y + hh, this.y));
  }
}

/**
 * Trauma-based camera shake (ENG-0051): `add(amount)` raises trauma 0..1, which
 * decays linearly; the offset is trauma² × max offset, driven by smooth value
 * noise from a seeded phase, so it is reproducible and never uses Math.random.
 */
export class Shake {
  trauma = 0;
  private t = 0;

  constructor(
    public maxOffset = 14,
    public maxAngle = 0.02,
    public decay = 1.6,
    private seed = 1,
  ) {}

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
  }

  /** Current offset (view units) and angle, scaled by the user's shake setting. */
  sample(scale = 1, out: { x: number; y: number; angle: number } = { x: 0, y: 0, angle: 0 }): { x: number; y: number; angle: number } {
    const k = this.trauma * this.trauma * scale;
    const f = this.t * 22;
    out.x = this.maxOffset * k * noise1(this.seed * 17.1 + f);
    out.y = this.maxOffset * k * noise1(this.seed * 31.7 + f + 100);
    out.angle = this.maxAngle * k * noise1(this.seed * 7.3 + f + 200);
    return out;
  }
}

function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth 1D value noise in −1..1. */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1;
}
