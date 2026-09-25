import { describe, expect, it } from 'vitest';
import { withMutators } from '../src/content/challenge';
import { OP_4_1, OP_4_10 } from '../src/content/chapter4';
import { rainStreak, venueLights, VENUE_ID } from '../src/render/venues';
import { FIELD } from '../src/surgery/operation';

const F = { cx: FIELD.cx, cy: FIELD.cy, rx: FIELD.rx, ry: FIELD.ry };

describe('venues (ENG-0272, ENG-0274)', () => {
  it('field triage is torch-lit with a cold fill; the slab has no warm light at all', () => {
    const field = venueLights('field', { x: 0, y: 0 }, F, 1, 1);
    expect(field[0].col[0]).toBeGreaterThan(field[0].col[2] * 3);
    expect(field.some((l) => l.col[2] > l.col[0])).toBe(true);
    for (const l of venueLights('forensic', { x: 0, y: 0 }, F, 1, 1)) expect(l.col[2]).toBeGreaterThanOrEqual(l.col[0]);
    expect(venueLights('hospice', { x: 10, y: 20 }, F, 1, 1)[0]).toMatchObject({ x: 10, y: 20 });
    expect(VENUE_ID).toEqual({ hospice: 0, field: 1, forensic: 2 });
  });

  it('rain streaks fall and wrap, the same for the same time', () => {
    const a = rainStreak(5, 0, 1280, 720);
    const b = rainStreak(5, 0.05, 1280, 720);
    expect(rainStreak(5, 0, 1280, 720)).toEqual(a);
    expect(b.y0).not.toBe(a.y0);
    for (let t = 0; t < 10; t += 0.37) {
      const s = rainStreak(11, t, 1280, 720);
      expect(s.y0).toBeGreaterThanOrEqual(-100);
      expect(s.y0).toBeLessThanOrEqual(820);
      expect(s.y1).toBeLessThan(s.y0);
    }
  });

  it('the Gorget tent ops and the Rain mutator are field triage', () => {
    expect(OP_4_1.venue).toBe('field');
    expect(OP_4_10.venue).toBe('field');
    expect(withMutators({ ...OP_4_1, venue: undefined }, {}, ['rain']).def.venue).toBe('field');
    expect(withMutators({ ...OP_4_1, venue: undefined }, {}, ['cart']).def.venue).toBeUndefined();
  });
});
