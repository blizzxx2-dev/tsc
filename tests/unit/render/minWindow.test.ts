/** ENG-0187: below the 1024×576 minimum the whole UI scales down uniformly and stays usable (checked at 800×450). */
import { describe, expect, it } from 'vitest';
import { mapPointer } from '../../../src/core/input';
import { computeView } from '../../../src/render/viewport';

describe('minimum window (ENG-0187)', () => {
  it('fits the whole 1280×720 safe area at 800×450 with one uniform scale', () => {
    const v = computeView(800, 450);
    expect(v).toMatchObject({ w: 1280, h: 720, ox: 0, oy: 0 });
    expect(v.scale).toBeCloseTo(0.625);
    // The minimum supported window is exactly 0.8×.
    expect(computeView(1024, 576).scale).toBeCloseTo(0.8);
  });

  it('keeps every on-screen control reachable: pointer mapping inverts the uniform scale exactly', () => {
    const v = computeView(800, 450);
    const rect = { left: 0, top: 0, width: 1280 * v.scale, height: 720 * v.scale };
    // Corners and centre of the safe area, e.g. the pause button top-right and the tray on the left.
    for (const [x, y] of [
      [0, 0],
      [1280, 720],
      [640, 360],
      [1212, 36],
      [48, 400],
    ]) {
      const p = mapPointer(x * v.scale, y * v.scale, rect, v);
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(y, 6);
    }
  });

  it('never crops at small or odd sizes (16:10, 4:3, 21:9 below the minimum)', () => {
    for (const [w, h] of [
      [800, 500],
      [800, 600],
      [1000, 428],
      [640, 360],
    ]) {
      const v = computeView(w, h);
      expect(v.w).toBeGreaterThanOrEqual(1280 - 1e-6);
      expect(v.h).toBeGreaterThanOrEqual(720 - 1e-6);
      expect(v.w * v.scale).toBeLessThanOrEqual(w + 1e-6);
      expect(v.h * v.scale).toBeLessThanOrEqual(h + 1e-6);
    }
  });
});
