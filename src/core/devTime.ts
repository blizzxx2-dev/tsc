/**
 * Dev time controls (ENG-0236): pause, single-step one fixed tick, 0.25× slow-mo and 4×
 * fast-forward. The main loop feeds every frame's elapsed time through `frameTime`, and while
 * paused asks `takeSteps` how many ticks the developer requested. Release builds never enable it.
 */
export const DEV_SPEEDS = [0.25, 1, 4] as const;

export class DevTime {
  /** Frame-time multiplier (0.25 slow-mo, 1, 4 fast-forward, or any value from the console). */
  scale = 1;
  paused = false;
  private pendingSteps = 0;

  /** Scaled frame time for the fixed-step accumulator; 0 while paused. */
  frameTime(dt: number): number {
    return this.paused ? 0 : dt * this.scale;
  }

  /** Ticks to force this frame (single-steps requested while paused), consuming them. */
  takeSteps(): number {
    const n = this.paused ? this.pendingSteps : 0;
    this.pendingSteps = 0;
    return n;
  }

  togglePause(): boolean {
    this.paused = !this.paused;
    this.pendingSteps = 0;
    return this.paused;
  }

  /** Queue `n` fixed ticks; pauses first so the step is observable. */
  step(n = 1): void {
    this.paused = true;
    this.pendingSteps += Math.max(0, Math.floor(n));
  }

  setScale(x: number): number {
    if (!Number.isFinite(x) || x <= 0) throw new Error('timescale must be a positive number');
    this.scale = Math.min(16, Math.max(1 / 64, x));
    return this.scale;
  }

  /** Cycle 1× → 0.25× → 4× → 1×. */
  cycleSpeed(): number {
    const next = this.scale === 1 ? 0.25 : this.scale === 0.25 ? 4 : 1;
    return this.setScale(next);
  }

  /** Short HUD label, empty at normal speed and unpaused. */
  label(): string {
    if (this.paused) return `PAUSED${this.scale !== 1 ? ` ${this.scale}×` : ''} (F10 step)`;
    return this.scale === 1 ? '' : `${this.scale}×`;
  }

  /** Dev key bindings: F7 cycle speed, F9 pause, F10 single step. Returns true when handled. */
  onKey(code: string, mods: { ctrl?: boolean; shift?: boolean } = {}): boolean {
    if (mods.ctrl || mods.shift) return false;
    if (code === 'F7') this.cycleSpeed();
    else if (code === 'F9') this.togglePause();
    else if (code === 'F10') this.step(1);
    else return false;
    return true;
  }
}
