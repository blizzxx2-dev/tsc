import { describe, expect, it } from 'vitest';
import { validateSpec } from '../src/content/schema';
import { Burn, DRAGON_COOL_S } from '../src/surgery/entities';
import { ALL, start } from './harness';

describe('dragon-breath burns (ENG-0263)', () => {
  it('always char deep (grade 3, lancet first) and cool over world time', () => {
    const op = start();
    const b = new Burn({ x: 600, y: 400 }, 30, op, 'dragon');
    expect(b.grade).toBe(3);
    expect(b.wants()).toEqual(['lancet']);
    const t0 = op.elapsed;
    expect(b.heat(t0)).toBeCloseTo(1, 5);
    expect(b.heat(t0 + DRAGON_COOL_S)).toBeCloseTo(Math.exp(-1), 5);
    expect(new Burn({ x: 600, y: 400 }, 30, op, 'fire').heat(t0)).toBe(0);
  });

  it('is a valid burn source in operation data', () => {
    expect(validateSpec({ e: 'burn', at: [0, 0], r: 30, source: 'dragon' }, ALL, 'x')).toEqual([]);
  });
});
