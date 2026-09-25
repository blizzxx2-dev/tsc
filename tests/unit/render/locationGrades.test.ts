import { describe, expect, it } from 'vitest';
import { GRADES, gradeFor, LOCATION_GRADE } from '../../../src/render/lut';

describe('per-location grades (ENG-0153)', () => {
  it('every story place maps to a real grade; hospice, theatre, street, chapel and night differ', () => {
    for (const g of Object.values(LOCATION_GRADE)) expect(GRADES[g], g).toBeDefined();
    expect(gradeFor('nowhere')).toBe('candle');
    const probe = (name: string) =>
      GRADES[name](0.5, 0.4, 0.3)
        .map((v) => v.toFixed(3))
        .join();
    const looks = ['candle', 'theatre', 'street', 'chapel', 'night'].map(probe);
    expect(new Set(looks).size).toBe(5);
    // Night is the coolest, theatre the warmest.
    const warmth = (name: string) => GRADES[name](0.5, 0.5, 0.5)[0] - GRADES[name](0.5, 0.5, 0.5)[2];
    expect(warmth('night')).toBeLessThan(warmth('candle'));
    expect(warmth('theatre')).toBeGreaterThan(warmth('street'));
  });
});
