import { describe, expect, it } from 'vitest';
import { slices } from '../../../src/ui/nineSlice';

describe('ART-0048 9-slice', () => {
  it('keeps corners at native size and stretches the edges and centre', () => {
    const s = slices({ x: 0, y: 0, w: 300, h: 200 }, 100, 100, [20, 10, 30, 40]);
    expect(s).toHaveLength(9);
    expect(s[0]).toMatchObject({ x: 0, y: 0, w: 20, h: 10, u0: 0, v0: 0, u1: 0.2, v1: 0.1 });
    expect(s[4]).toMatchObject({ x: 20, y: 10, w: 250, h: 150, u0: 0.2, v0: 0.1, u1: 0.7, v1: 0.6 });
    expect(s[8]).toMatchObject({ x: 270, y: 160, w: 30, h: 40, u0: 0.7, v0: 0.6, u1: 1, v1: 1 });
  });

  it('shrinks corners proportionally when the target is smaller than the margins', () => {
    const s = slices({ x: 0, y: 0, w: 25, h: 100 }, 100, 100, [20, 10, 30, 40]);
    expect(s.reduce((n, p) => n + (p.y === 0 ? p.w : 0), 0)).toBeCloseTo(25);
    expect(s.every((p) => p.w > 0 && p.h > 0)).toBe(true);
  });
});
