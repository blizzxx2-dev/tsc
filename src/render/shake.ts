/**
 * Trauma-driven camera shake (ENG-0051). The simulation only keeps a scalar trauma (`op.shake`,
 * decaying); the offset is a pure function of trauma and presentation time, built from smooth
 * noise, so it is deterministic, contains no `Math.random`, and never touches the sim. Amplitude
 * grows with trauma² (small blows barely register, heavy ones lurch) and the two axes use
 * incommensurate frequencies so the motion never settles into a visible loop.
 */
import type { Vec } from '../core/math';

/** Smooth 1-D noise in -1..1: a sum of incommensurate sines, C∞ and cheap. */
export function smoothNoise(t: number, seed = 0): number {
  const s = seed * 1.7;
  return (Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.3 + s * 3.1 + 1.3) * 0.3 + Math.sin(t * 4.1 + s * 0.7 + 2.9) * 0.2) / 1.0;
}

export interface ShakeOpts {
  /** Shakes per second at the base frequency. */
  frequency?: number;
  /** Peak offset (virtual px) at trauma 1 before the multiplier. */
  amplitude?: number;
  /** Player screen-shake multiplier 0..1 (0 disables). */
  scale?: number;
}

/**
 * Screen offset for a trauma value at presentation time `t` (seconds). `trauma` is the sim's
 * decaying shake intensity (0–12 in `Operation.shake`); it is normalised to 0..1 against 12.
 */
export function shakeOffset(trauma: number, t: number, opts: ShakeOpts = {}): Vec {
  const scale = opts.scale ?? 1;
  const tr = Math.min(1, Math.max(0, trauma / 12));
  if (tr <= 0 || scale <= 0) return { x: 0, y: 0 };
  const f = (opts.frequency ?? 11) * Math.PI * 2;
  const amp = (opts.amplitude ?? 14) * tr * tr * scale;
  return { x: smoothNoise(t * f, 1) * amp, y: smoothNoise(t * f * 1.13, 2) * amp };
}

/** Small camera roll (radians) for the same trauma, for renderers that rotate rather than offset. */
export function shakeRoll(trauma: number, t: number, opts: ShakeOpts = {}): number {
  const scale = opts.scale ?? 1;
  const tr = Math.min(1, Math.max(0, trauma / 12));
  if (tr <= 0 || scale <= 0) return 0;
  return smoothNoise(t * (opts.frequency ?? 11) * Math.PI * 2 * 0.87, 3) * 0.012 * tr * tr * scale;
}
