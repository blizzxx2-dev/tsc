/** ENG-0156: candle flicker on the light rig stays within 3 % luminance and stops under Reduced Flashing. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/core/settings/schema';
import { candleFlicker, POST_FLICKER, RIG_FLICKER } from '../../../src/render/flicker';
import { POST_FS } from '../../../src/render/shaders';
import { displayPrefs } from '../../../src/ui/display';

describe('candle flicker (ENG-0156)', () => {
  it('moves a candle by at most 3 % and the field by at most 3 % overall', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 30; t += 0.01) {
      const k = candleFlicker(t, 0, 1);
      lo = Math.min(lo, k);
      hi = Math.max(hi, k);
    }
    expect(hi - 1).toBeLessThanOrEqual(RIG_FLICKER + 1e-9);
    expect(1 - lo).toBeLessThanOrEqual(RIG_FLICKER + 1e-9);
    expect(hi - lo).toBeGreaterThan(0.02);
    // The operating lamp (1.1) outweighs the two candles (0.45 + 0.4): their share caps the rig's effect.
    const candleShare = (0.45 + 0.4) / (1.1 + 0.45 + 0.4);
    expect(POST_FLICKER + RIG_FLICKER * candleShare).toBeLessThanOrEqual(0.03);
    expect(POST_FS).toContain(`u_flicker * ${POST_FLICKER} * P_FLICKER`);
  });

  it('is still under Reduced Flashing (and Reduced Motion)', () => {
    const on = displayPrefs({ ...DEFAULT_SETTINGS, flicker: true });
    expect(on.flicker).toBeGreaterThan(0);
    for (const s of [{ reduceFlashing: true }, { reduceMotion: true }]) {
      const p = displayPrefs({ ...DEFAULT_SETTINGS, flicker: true, ...s });
      expect(p.flicker).toBe(0);
      for (let t = 0; t < 5; t += 0.1) expect(candleFlicker(t, 1, p.flicker)).toBe(1);
    }
  });
});
