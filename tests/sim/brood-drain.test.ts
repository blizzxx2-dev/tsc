/** GAM-0197: Brood-Mother's Kiss never runs away from a steady surgeon — sustained drain peaks ≤ 1.2/s. */
import { describe, expect, it } from 'vitest';
import { OP_2_3 } from '../../src/content/ops/ch2';
import { playWithBot } from '../bot';

/** The worst vitals loss per second over any 5 s window. */
function peakDrain(seed: number): { won: boolean; peak: number } {
  const hist: { t: number; v: number }[] = [];
  let peak = 0;
  const { op } = playWithBot(OP_2_3, {
    profile: 'steady',
    seed: 23000 + seed,
    botSeed: seed,
    onFrame: (o) => {
      hist.push({ t: o.elapsed, v: o.vitals });
      while (hist.length && o.elapsed - hist[0].t > 5) hist.shift();
      // A healing frame (the Litany) would only lower the window; measure losses from 5 s in.
      if (o.elapsed > 5) peak = Math.max(peak, (hist[0].v - o.vitals) / (o.elapsed - hist[0].t));
    },
  });
  return { won: op.status === 'won', peak };
}

describe('op2-3 drain (GAM-0197)', () => {
  it.each([1, 2, 3, 4, 5])('steady seed %i peaks at or under 1.2/s', (seed) => {
    const r = peakDrain(seed);
    expect(r.won).toBe(true);
    expect(r.peak).toBeLessThanOrEqual(1.2);
  });
}, 600_000);
