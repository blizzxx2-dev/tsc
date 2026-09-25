/**
 * Animation timing sheet (ART-0297, docs/art/vfx/timing.md): the standard frame rates, ease curves
 * and hit-pause frames every flipbook and effect in the demo is timed against.
 */

/** Frame rates: woodcut flipbooks (seals, stamps, ribbons, page turns, leaf) and VFX. */
export const FPS = { woodcut: 12, vfx: 24 } as const;

/** Frame index of a `frames`-long flipbook at `fps`, held on the last frame. */
export const frameOf = (t: number, fps: number, frames: number): number => Math.max(0, Math.min(frames - 1, Math.floor(t * fps)));

/** Frame index of a looping flipbook. */
export const loopFrame = (t: number, fps: number, frames: number): number => ((Math.floor(t * fps) % frames) + frames) % frames;

/** The ease curves art may use (all map 0..1 → 0..1, overshoot allowed for `outBack`). */
export const EASE = {
  linear: (k: number): number => k,
  /** Arrivals: stamps landing, rings expanding. */
  outCubic: (k: number): number => 1 - (1 - k) ** 3,
  /** Departures: things falling away. */
  inCubic: (k: number): number => k * k * k,
  /** Breathing, sways, candle swells. */
  inOutSine: (k: number): number => 0.5 - 0.5 * Math.cos(Math.PI * k),
  /** Ribbons and banners unfurling with a small overshoot. */
  outBack: (k: number): number => {
    const c = 1.70158;
    return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
  },
} as const;

/**
 * Hit-pause at 60 fps: 3.6, 3 and 2.4 frames (60, 50 and 40 ms). The lengths live in
 * `HITSTOP_MS` (src/core/clock.ts), which `bindHitstop` applies; this is the frame view of them.
 * Reduce-motion disables hit-pause, and it is capped at 120 ms.
 */
export const HIT_PAUSE_FRAMES = {
  /** A blow on the Malison (rate-limited in `bindHitstop`). */
  malison: 3.6,
  /** A mistake costing 5+ vitals (barb tear, stray cut, burst): the `impact` event. */
  harm: 3,
  /** An object pulled free with the Tongs. */
  extract: 2.4,
} as const;

export const hitPauseMs = (frames: number): number => Math.round((frames * 1000) / 60);
