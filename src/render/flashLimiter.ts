/**
 * Photosensitivity guard. Full-screen effects (damage flashes, danger pulses, Litany onset,
 * Malison shake) are summarised each frame as one "flash luminance" value 0..1. A flash is a
 * rise-and-fall of more than THRESHOLD; if more than MAX_PER_SECOND occur within one second
 * the limiter attenuates further effect intensity until the rate drops (Harding-style check).
 */
export const MAX_PER_SECOND = 3;
export const THRESHOLD = 0.1;

export class FlashLimiter {
  private t = 0;
  private flashes: number[] = [];
  private rising = false;
  private lastPeak = 0;
  private last = 0;
  private gain = 1;

  /** Feed the requested intensity for this frame; returns the permitted intensity. */
  filter(requested: number, dt: number): number {
    this.t += dt;
    this.flashes = this.flashes.filter((f) => this.t - f < 1);
    const v = requested * this.gain;
    if (v > this.last + 1e-4) {
      this.rising = true;
      this.lastPeak = Math.max(this.lastPeak, v);
    } else if (this.rising && v < this.lastPeak - THRESHOLD) {
      // A completed flash (rise then fall).
      this.rising = false;
      if (this.lastPeak > THRESHOLD) this.flashes.push(this.t);
      this.lastPeak = v;
    }
    // Attenuate while the rate is at the limit; recover slowly otherwise.
    // At the limit, clamp immediately (the next rise would be one flash too many); recover slowly.
    if (this.flashes.length >= MAX_PER_SECOND - 1) this.gain = 0.08;
    else this.gain = Math.min(1, this.gain + dt * 0.5);
    this.last = v;
    return v;
  }

  /** Flashes counted in the last second (for tests and the debug overlay). */
  get rate(): number {
    return this.flashes.length;
  }
}
