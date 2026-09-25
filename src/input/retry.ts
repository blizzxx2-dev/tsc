import type { Input } from '../core/input';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { INK } from '../ui/hudKit';

/** Seconds the `op.retry` action must be held before the restart fires (INP-0113). */
export const RETRY_HOLD = 1;

/**
 * Hold-to-restart: `update` returns true once, the moment `op.retry` has been held for
 * `RETRY_HOLD` seconds; letting go re-arms it. `progress` (0..1) drives the ring on the reticle.
 */
export class HoldToRetry {
  progress = 0;
  private fired = false;

  update(input: Input, dt: number): boolean {
    if (!input.act('op.retry')) {
      this.progress = 0;
      this.fired = false;
      return false;
    }
    this.progress = Math.min(1, this.progress + dt / RETRY_HOLD);
    if (this.progress < 1 || this.fired) return false;
    this.fired = true;
    return true;
  }

  /** A ring filling round the reticle while the button is held. */
  draw(g: Gfx, p: Vec): void {
    if (this.progress <= 0) return;
    g.arc(p.x, p.y, 30, 4, hex('#000000', 0.5), this.progress);
    g.arc(p.x, p.y, 30, 2.2, hex(INK.goldHi, 0.95), this.progress);
  }
}
