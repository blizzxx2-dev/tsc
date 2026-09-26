/**
 * Timing windows for the rhythmic gimmicks (INP-0111): a strike ±60 ms from its beat is COOL,
 * ±120 ms GOOD. The player's audio latency (Options → Audio → Calibrate) is taken off first, so a
 * player who hears the beat late is judged against the beat they heard.
 */
export const TIMING = { cool: 0.06, good: 0.12 };

/** Judge a strike `delta` seconds after its beat (negative: early), given the latency in ms. */
export function judgeTiming(delta: number, offsetMs = 0): 'cool' | 'good' | null {
  const d = Math.abs(delta - offsetMs / 1000);
  return d <= TIMING.cool ? 'cool' : d <= TIMING.good ? 'good' : null;
}

/** Calibration: the latency in ms from taps against known beats (the median delta, to the nearest 10). */
export function latencyFromTaps(taps: readonly number[], beats: readonly number[]): number {
  if (!taps.length || !beats.length) return 0;
  const deltas = taps.map((t) => beats.reduce((best, b) => (Math.abs(t - b) < Math.abs(best) ? t - b : best), Infinity)).sort((a, b) => a - b);
  const mid = deltas[Math.floor(deltas.length / 2)];
  return Math.max(-100, Math.min(250, Math.round((mid * 1000) / 10) * 10));
}
