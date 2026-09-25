/** GAM-0026: the lancet's blade trail, its wet parting on flesh, and a 40 ms micro-shake on BAD. */
import { describe, expect, it } from 'vitest';
import { BladeFeedback, MICRO_SHAKE_SECONDS, TRAIL_SECONDS, WET_SECONDS } from '../../../src/render/bladeFeedback';
import type { Gfx } from '../../../src/render/gfx';

const lines = (b: BladeFeedback): number => {
  let n = 0;
  const g = new Proxy({}, { get: (_t, k) => () => void (k === 'line' && n++) }) as unknown as Gfx;
  b.draw(g);
  return n;
};

describe('GAM-0026 lancet feedback', () => {
  it('a trail follows the tip for 0.15 s; the flesh stays wet behind it for 0.8 s', () => {
    const b = new BladeFeedback();
    for (let i = 0; i < 20; i++) b.update(1 / 60, { x: 100 + i * 5, y: 200 }, true);
    expect(b.trail().length).toBeGreaterThan(5);
    expect(b.trail().length).toBeLessThanOrEqual(Math.ceil(TRAIL_SECONDS * 60) + 1);
    const cutting = lines(b);
    b.update(TRAIL_SECONDS + 0.05, null, true);
    expect(b.trail().length).toBe(0);
    expect(lines(b)).toBeGreaterThan(0); // still wet
    expect(lines(b)).toBeLessThan(cutting);
    b.update(WET_SECONDS, null, true);
    expect(lines(b)).toBe(0); // dry
  });

  it('in the air the blade leaves a trail but nothing wet', () => {
    const b = new BladeFeedback();
    for (let i = 0; i < 10; i++) b.update(1 / 60, { x: 10 + i * 5, y: 20 }, false);
    b.update(TRAIL_SECONDS + 0.05, null, false);
    expect(lines(b)).toBe(0);
  });

  it('a BAD stroke shakes the view for 40 ms, scaled by the shake slider, none with it off', () => {
    const b = new BladeFeedback();
    b.bad();
    b.update(0.01, null, false);
    const o = b.shakeOffset(1);
    expect(Math.hypot(o.x, o.y)).toBeGreaterThan(0);
    expect(b.shakeOffset(0)).toEqual({ x: 0, y: 0 });
    b.update(MICRO_SHAKE_SECONDS, null, false);
    expect(b.shakeOffset(1)).toEqual({ x: 0, y: 0 });
  });
});
