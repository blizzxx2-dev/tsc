/**
 * Scene transitions (UIX-0009): `game.go()` fades through ink-black over
 * MOTION.transition (half out, swap, half in). While a transition runs, scenes
 * neither update nor see input, and further `go()` requests are ignored — a
 * double-clicked button can never start two scenes. Reduced Motion swaps
 * instantly.
 */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { MOTION, reducedMotion } from './motion';

export class Transition {
  phase: 'idle' | 'out' | 'in' = 'idle';
  t = 0;
  private swap: (() => void) | null = null;

  constructor(readonly duration = MOTION.transition) {}

  /** True while scenes must not update or take input. */
  get busy(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * Ask to change scene. Returns false (and does nothing) if a transition is
   * already running; otherwise `swap` runs at the midpoint (immediately with
   * Reduced Motion).
   */
  request(swap: () => void): boolean {
    if (this.phase === 'out') return false;
    if (reducedMotion() || this.duration <= 0) {
      this.phase = 'idle';
      swap();
      return true;
    }
    this.swap = swap;
    this.phase = 'out';
    this.t = 0;
    return true;
  }

  /** Start by fading in from black (first scene after boot). */
  fadeIn(): void {
    if (reducedMotion()) return;
    this.phase = 'in';
    this.t = 0;
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    const half = this.duration / 2;
    if (this.phase === 'out' && this.t >= half) {
      const s = this.swap;
      this.swap = null;
      this.phase = 'in';
      this.t = 0;
      s?.();
    } else if (this.phase === 'in' && this.t >= half) {
      this.phase = 'idle';
      this.t = 0;
    }
  }

  /** Veil opacity 0..1. */
  get alpha(): number {
    const half = this.duration / 2;
    if (this.phase === 'out') return Math.min(1, this.t / half);
    if (this.phase === 'in') return Math.max(0, 1 - this.t / half);
    return 0;
  }

  draw(g: Gfx): void {
    const a = this.alpha;
    if (a <= 0) return;
    const vr = g.viewRect();
    // Ink wash: the edges darken first, then the centre follows.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', Math.min(1, a * 1.1)));
    const edge = Math.min(1, a * 1.6);
    g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.3, hex('#000000', edge), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h * 0.7, vr.w, vr.h * 0.3, hex('#000000', 0), hex('#000000', edge));
  }
}
