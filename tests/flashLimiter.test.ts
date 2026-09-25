import { describe, expect, it } from 'vitest';
import { FlashLimiter, MAX_PER_SECOND, THRESHOLD } from '../src/render/flashLimiter';

/** Count rise-and-fall flashes in an output timeline, over any 1 s window. */
function maxFlashesPerSecond(out: number[], dt: number): number {
  const events: number[] = [];
  let peak = 0;
  let rising = false;
  let last = 0;
  out.forEach((v, i) => {
    if (v > last + 1e-4) {
      rising = true;
      peak = Math.max(peak, v);
    } else if (rising && v < peak - THRESHOLD) {
      rising = false;
      if (peak > THRESHOLD * 1.5) events.push(i * dt);
      peak = v;
    }
    last = v;
  });
  let worst = 0;
  for (const t0 of events) worst = Math.max(worst, events.filter((t) => t >= t0 && t < t0 + 1).length);
  return worst;
}

describe('FlashLimiter', () => {
  const dt = 1 / 60;
  it('limits a worst-case 8 Hz strobe (e.g. rapid damage) to at most 3 flashes per second', () => {
    const lim = new FlashLimiter();
    const out: number[] = [];
    for (let i = 0; i < 600; i++) out.push(lim.filter(Math.sin((i * dt) * Math.PI * 2 * 8) > 0 ? 1 : 0, dt));
    expect(maxFlashesPerSecond(out, dt)).toBeLessThanOrEqual(MAX_PER_SECOND + 1);
    // Later flashes are strongly attenuated.
    expect(Math.max(...out.slice(300))).toBeLessThan(0.5);
  });
  it('leaves slow pulses (1 Hz danger pulse) untouched', () => {
    const lim = new FlashLimiter();
    const out: number[] = [];
    for (let i = 0; i < 600; i++) out.push(lim.filter(0.5 + 0.5 * Math.sin(i * dt * Math.PI * 2), dt));
    expect(Math.max(...out.slice(300))).toBeGreaterThan(0.95);
  });
});
