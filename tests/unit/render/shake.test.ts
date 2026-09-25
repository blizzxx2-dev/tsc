/** ENG-0051: trauma-based camera shake is a pure function of trauma and time — no Math.random. */
import { describe, expect, it, vi } from 'vitest';
import { shakeOffset, shakeRoll, smoothNoise } from '../../../src/render/shake';

describe('trauma shake', () => {
  it('is deterministic and never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = shakeOffset(6, 1.234);
    const b = shakeOffset(6, 1.234);
    expect(a).toEqual(b);
    expect(shakeRoll(6, 1.234)).toBe(shakeRoll(6, 1.234));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is zero without trauma or with the shake setting off, and grows with trauma²', () => {
    expect(shakeOffset(0, 3)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(8, 3, { scale: 0 })).toEqual({ x: 0, y: 0 });
    expect(shakeRoll(0, 3)).toBe(0);
    const mag = (tr: number) => {
      let m = 0;
      for (let t = 0; t < 2; t += 0.01) m = Math.max(m, Math.hypot(shakeOffset(tr, t).x, shakeOffset(tr, t).y));
      return m;
    };
    const small = mag(3);
    const big = mag(12);
    expect(small).toBeGreaterThan(0);
    expect(big / small).toBeGreaterThan(8);
    expect(big).toBeLessThanOrEqual(14 * Math.SQRT2 + 1e-9);
    // Trauma above the sim's 12 cap does not grow further; the gentle setting halves it.
    expect(mag(24)).toBeCloseTo(big, 6);
    expect(shakeOffset(12, 0.5, { scale: 0.5 }).x).toBeCloseTo(shakeOffset(12, 0.5).x * 0.5, 9);
  });

  it('is smooth: consecutive frames move a bounded distance', () => {
    let prev = shakeOffset(12, 0);
    for (let t = 1 / 120; t < 3; t += 1 / 120) {
      const cur = shakeOffset(12, t);
      // Never jumps the peak-to-peak swing in one 120 Hz frame (a uniform random jitter reaches 28·√2).
      expect(Math.hypot(cur.x - prev.x, cur.y - prev.y)).toBeLessThan(28);
      prev = cur;
    }
    for (let t = 0; t < 10; t += 0.37) expect(Math.abs(smoothNoise(t, 1))).toBeLessThanOrEqual(1);
  });
});
