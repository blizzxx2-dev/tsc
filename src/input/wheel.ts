/**
 * Wheel normalisation: one mouse notch or one trackpad flick = one tool step.
 * Raw deltas are accumulated until they reach a threshold (50 px or 1 line); a
 * step then starts a cooldown during which the rest of the flick is swallowed.
 */
export const WHEEL_THRESHOLD_PX = 50;
export const WHEEL_LINE_PX = 50;
export const WHEEL_COOLDOWN_MS = 120;
/** A single event this large is a discrete notch from a real wheel; notches may follow each other faster than a flick. */
export const WHEEL_NOTCH_PX = 100;
export const WHEEL_NOTCH_COOLDOWN_MS = 40;
/** A pause this long ends a gesture and forgets any partial accumulation. */
export const WHEEL_IDLE_MS = 250;

export class WheelNormaliser {
  private acc = 0;
  private lastEvent = -Infinity;
  private lastStep = -Infinity;

  /**
   * Feed one WheelEvent. `mode` is `WheelEvent.deltaMode` (0 pixels, 1 lines, 2 pages).
   * Returns +1 (down/next), -1 (up/previous) or 0.
   */
  feed(deltaY: number, mode: number, t: number): number {
    const px = mode === 1 ? deltaY * WHEEL_LINE_PX : mode === 2 ? Math.sign(deltaY) * WHEEL_NOTCH_PX : deltaY;
    if (px === 0) return 0;
    if (t - this.lastEvent > WHEEL_IDLE_MS || Math.sign(px) !== Math.sign(this.acc)) this.acc = 0;
    this.lastEvent = t;
    const notch = Math.abs(px) >= WHEEL_NOTCH_PX;
    const cooldown = notch ? WHEEL_NOTCH_COOLDOWN_MS : WHEEL_COOLDOWN_MS;
    if (t - this.lastStep < cooldown) {
      // Swallow the tail of the flick that already produced a step.
      this.acc = 0;
      return 0;
    }
    this.acc += px;
    if (Math.abs(this.acc) < WHEEL_THRESHOLD_PX) return 0;
    const step = Math.sign(this.acc);
    this.acc = 0;
    this.lastStep = t;
    return step;
  }
}
