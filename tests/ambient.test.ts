import { describe, expect, it } from 'vitest';
import { AMBIENCE, flameFlicker, motePos } from '../src/render/ambient';

describe('ambient backdrop particles (ENG-0143)', () => {
  it('candle flames, light-shaft dust and chapel incense are set per location', () => {
    expect(AMBIENCE.chapel.candles?.length).toBeGreaterThan(0);
    expect(AMBIENCE.chapel.shafts?.length).toBeGreaterThan(0);
    expect(AMBIENCE.chapel.incense?.length).toBeGreaterThan(0);
    expect(AMBIENCE.hospice.candles?.length).toBeGreaterThan(0);
  });

  it('flames gutter within bounds and motes stay inside their shaft, deterministically', () => {
    for (let t = 0; t < 20; t += 0.13) {
      const f = flameFlicker(t, 2);
      expect(f).toBeGreaterThan(0.7);
      expect(f).toBeLessThan(1.2);
    }
    const s = { x: 600, lean: 0.2, w: 100 };
    for (let k = 0; k < 26; k++) {
      const p = motePos(s, k, 7.5);
      expect(motePos(s, k, 7.5)).toEqual(p);
      const centre = s.x + Math.tan(s.lean) * p.y;
      expect(Math.abs(p.x - centre)).toBeLessThan(s.w / 2 + p.y * 0.125 + 12);
      expect(p.y).toBeGreaterThan(-5);
    }
  });
});
