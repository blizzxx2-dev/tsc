import { describe, expect, it } from 'vitest';
import { deltaE, nearestSwatch, SWATCHES } from '../../../src/render/palette';
import { PALETTE } from '../../../src/ui/layout';
import { UI } from '../../../src/ui/ornaments';

describe('ART-0011 master palette', () => {
  it('has 32 distinct swatches', () => {
    const list = Object.values(SWATCHES);
    expect(list).toHaveLength(32);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) expect(deltaE(list[i], list[j]), `${list[i]} ~ ${list[j]}`).toBeGreaterThan(3);
  });

  it('every UI and layout token maps to a swatch (ΔE ≤ 6)', () => {
    for (const [name, c] of Object.entries({ ...UI, ...PALETTE })) {
      if (typeof c !== 'string' || !c.startsWith('#')) continue;
      const n = nearestSwatch(c);
      expect(n.dE, `${name} ${c} → ${n.id}`).toBeLessThanOrEqual(6);
    }
  });
});
