/**
 * Steam overlay gate (PLT-0042). While the overlay is up the operation is paused and the game's
 * input is suspended: held keys and buttons are released as cancels (`notifyOverlay`), and the
 * input facade is fed empty frames instead of device events, so nothing that Steam lets through
 * (or that was queued as the overlay opened) reaches the scenes. Closing the overlay restores the
 * device frames; the pause stays until the player resumes.
 */
import type { FrameSource } from '../core/input';
import type { Device, InputFrame } from '../input/types';
import { ZERO_STICKS } from '../input/types';

/** The slice of `Input` the gate needs (tests pass a fake). */
export interface GateInput {
  replay: FrameSource | null;
  readonly pos: { x: number; y: number };
  device: Device;
  notifyOverlay(active: boolean, t?: number): void;
}

/** A frame with no events: the cursor stays put, sticks are centred. */
class Silence implements FrameSource {
  private last = 0;
  constructor(
    private input: GateInput,
    private now: () => number,
  ) {}
  next(): InputFrame {
    const t = this.now();
    const t0 = this.last || t - 1000 / 60;
    this.last = t;
    return { t, t0, dt: Math.min(0.05, Math.max(0, t - t0) / 1000), start: { ...this.input.pos }, events: [], sticks: { ...ZERO_STICKS }, device: this.input.device };
  }
}

export class OverlayGate {
  private silence: Silence | null = null;
  private active = false;

  constructor(
    private input: GateInput,
    private pause: () => void,
    private now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  ) {}

  get up(): boolean {
    return this.active;
  }

  set(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.input.notifyOverlay(active, this.now());
    if (active) {
      this.pause();
      // A `?replay=` in progress keeps its frames; the overlay only silences live devices.
      if (!this.input.replay) this.input.replay = this.silence = new Silence(this.input, this.now);
    } else if (this.silence && this.input.replay === this.silence) {
      this.input.replay = null;
      this.silence = null;
    }
  }
}
