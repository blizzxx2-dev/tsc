/**
 * Fixed-step simulation driver (ENG-0053).
 *
 * The render loop feeds it variable frame times; it answers how many fixed
 * 120 Hz ticks to run this frame (at most MAX_STEPS — anything beyond is
 * dropped so a slow frame can never trigger a spiral of death) and the
 * interpolation `alpha` for rendering between the last two ticks.
 */
export const FIXED_HZ = 120;
export const FIXED_DT = 1 / FIXED_HZ;
export const MAX_STEPS = 8;
/** Longest frame time accepted at all (tab switches, debugger pauses). */
export const MAX_FRAME = 0.25;

export class FixedStep {
  /** Unsimulated time carried to the next frame, in seconds. */
  private acc = 0;
  /** Time dropped because a frame needed more than MAX_STEPS ticks. */
  dropped = 0;

  constructor(
    readonly dt = FIXED_DT,
    readonly maxSteps = MAX_STEPS,
  ) {}

  /** Add one frame's elapsed time; returns the number of ticks to run now. */
  advance(frameDt: number): number {
    this.acc += Math.min(MAX_FRAME, Math.max(0, frameDt));
    // The epsilon absorbs float error so 1/30 s is exactly 4 ticks, not 3.
    let n = Math.floor(this.acc / this.dt + 1e-6);
    if (n > this.maxSteps) {
      this.dropped += this.acc - this.maxSteps * this.dt;
      n = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc = Math.max(0, this.acc - n * this.dt);
    }
    return n;
  }

  /** Fraction of a tick not yet simulated: render interpolates prev → current by this. */
  get alpha(): number {
    return Math.min(1, this.acc / this.dt);
  }

  /** Time still owed to the simulation (seconds). */
  get pending(): number {
    return this.acc;
  }

  reset(): void {
    this.acc = 0;
  }
}

/**
 * Wall-clock end time (ms) of each tick run this frame, so input samples can be
 * handed to the tick they happened in (ENG-0055). `nowMs` is the frame time,
 * `steps` the tick count and `remainder` the time (s) still owed after them.
 */
export function stepEndTimes(nowMs: number, steps: number, dt: number, remainder: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) out.push(nowMs - (remainder + (steps - 1 - i) * dt) * 1000);
  return out;
}

/**
 * Display refresh estimator (ENG-0061): median of recent rAF intervals,
 * snapped to common rates (59.94/60/75/90/120/144/165/240 Hz) when within 2%.
 */
export class RefreshEstimator {
  private samples: number[] = [];
  constructor(private size = 120) {}

  sample(dtSeconds: number): void {
    if (dtSeconds <= 0 || dtSeconds > 0.1) return;
    this.samples.push(dtSeconds);
    if (this.samples.length > this.size) this.samples.shift();
  }

  /** Estimated refresh rate in Hz (0 until enough samples). */
  get hz(): number {
    if (this.samples.length < 10) return 0;
    const s = [...this.samples].sort((a, b) => a - b);
    const hz = 1 / s[Math.floor(s.length / 2)];
    let best = 0;
    for (const r of [59.94, 60, 75, 90, 100, 120, 144, 165, 240]) if (Math.abs(hz - r) / r < 0.02 && (!best || Math.abs(hz - r) < Math.abs(hz - best))) best = r;
    return best || Math.round(hz * 10) / 10;
  }
}

/**
 * Frame limiter (ENG-0060): decides which rAF callbacks render. Frames are
 * scheduled on an ideal grid of 1/cap seconds so skipping stays even (a 60 cap
 * on a 144 Hz display renders 2-3-2-3… not jittery bursts). 0 = uncapped.
 */
export class FrameLimiter {
  private next = 0;
  cap = 0;

  /** Render the next rAF callback whatever the cap (input arrived while throttled, ENG-0229). */
  reset(): void {
    this.next = 0;
  }

  /** Returns true if the rAF callback at `nowMs` should render. */
  shouldRender(nowMs: number, refreshHz = 0): boolean {
    if (this.cap <= 0 || (refreshHz > 0 && this.cap >= refreshHz - 0.5)) {
      this.next = nowMs;
      return true;
    }
    const interval = 1000 / this.cap;
    // Half a refresh of tolerance so a frame due "between" vsyncs lands on the nearer one.
    const slack = refreshHz > 0 ? 500 / refreshHz : 2;
    if (nowMs + slack < this.next) return false;
    this.next = Math.max(this.next + interval, nowMs - interval);
    return true;
  }
}
