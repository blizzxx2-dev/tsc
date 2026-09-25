/**
 * Motion language (UIX-0026): one table of UI durations and easings, shared by
 * every widget and screen. Everything honours Reduced Motion: tweens jump to
 * their end state and oscillators (candle flicker, pulses) hold still.
 */
import { settings } from '../core/settings';

export const MOTION = {
  /** Hover / focus highlight fade. */
  hover: 0.08,
  /** Panel or modal opening (easeOutQuad). */
  panel: 0.22,
  /** Rank or rating stamp landing (easeOutBack). */
  stamp: 0.18,
  /** Page turn / tab change. */
  page: 0.35,
  /** Scene transition (fade through black), total. */
  transition: 0.3,
  /** Wax-seal button press squash. */
  press: 0.09,
  /** Tooltip hover delay before it appears (mouse; focus is instant). */
  tooltipDelay: 0.4,
} as const;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
} as const;
export type Ease = keyof typeof ease;

/** True when the player asked for reduced motion. */
export const reducedMotion = (): boolean => !!settings.reduceMotion;

/** Progress 0..1 of a tween `elapsed` seconds into `dur`, eased; always 1 with Reduced Motion. */
export function tween(elapsed: number, dur: number, e: Ease = 'outQuad'): number {
  if (reducedMotion() || dur <= 0) return 1;
  return ease[e](clamp01(elapsed / dur));
}

/** Move `cur` toward `target` so a full 0→1 change takes `dur` seconds (linear, frame-rate independent). */
export function approach(cur: number, target: number, dt: number, dur: number): number {
  if (reducedMotion() || dur <= 0) return target;
  const step = dt / dur;
  return cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
}

/** A 0..1 oscillation for glows and pulses; constant 0.5 with Reduced Motion. */
export function pulse(t: number, hz = 1): number {
  if (reducedMotion()) return 0.5;
  return 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2);
}

/**
 * Candle-flicker multiplier for UI panels (UIX-0027): a 2–3 % luminance wobble
 * built from incommensurate sines (the same rhythm as the theatre's candle
 * lights); exactly 1 with Reduced Motion or Reduced Flashing.
 */
export function candleFlicker(t: number): number {
  if (settings.reduceMotion || settings.reduceFlashing || !settings.flicker) return 1;
  return 1 + 0.014 * Math.sin(t * 9.3) * Math.sin(t * 4.1) + 0.01 * Math.sin(t * 2.3 + 1.7);
}
