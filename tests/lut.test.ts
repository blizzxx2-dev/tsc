import { describe, expect, it } from 'vitest';
import { bakeLut, GRADES, LUT_SIZE } from '../src/render/lut';

describe('LUT baking', () => {
  it('neutral LUT is an identity', () => {
    const d = bakeLut(GRADES.neutral);
    const n = LUT_SIZE;
    for (const [r, g, b] of [[0, 0, 0], [31, 31, 31], [5, 17, 29], [31, 0, 16]]) {
      const i = (g * n * n + b * n + r) * 4;
      expect([d[i], d[i + 1], d[i + 2]]).toEqual([r, g, b].map((v) => Math.round((v / (n - 1)) * 255)));
    }
  });
  it('every grade stays in range and keeps black black-ish', () => {
    for (const [name, grade] of Object.entries(GRADES)) {
      const d = bakeLut(grade);
      expect(d.length, name).toBe(LUT_SIZE ** 3 * 4);
      expect(d[0] + d[1] + d[2], name).toBeLessThan(30);
    }
  });
});
