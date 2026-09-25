/** ART-0357: colour-blind pass — every checked pair stays distinguishable with the matching colour filter. */
import { describe, expect, it } from 'vitest';
import { cvdPairs, MIN_DE, pairDe, simulate, type Cvd } from '../../../src/art/cvd';
import { PALETTES } from '../../../src/ui/theme';
import { RATING_INK } from '../../../src/art/kit';

const TYPES: Cvd[] = ['protanopia', 'deuteranopia', 'tritanopia'];

describe('colour-blind pass (ART-0357)', () => {
  it('the simulation leaves greys alone and collapses red/green for protanopes', () => {
    expect(simulate('#808080', 'protanopia')).toBe('#808080');
    const red = simulate('#ff0000', 'deuteranopia');
    const green = simulate('#00a000', 'deuteranopia');
    expect(Math.abs(parseInt(red.slice(1, 3), 16) - parseInt(green.slice(1, 3), 16))).toBeLessThan(80);
  });

  for (const t of TYPES)
    it(`${t}: ratings, vitals, sigils vs veins and curse vs blood are ≥ ΔE ${MIN_DE} with the ${t} filter`, () => {
      const low = cvdPairs(PALETTES[t])
        .map((p) => ({ label: p.label, de: pairDe(p, t) }))
        .filter((r) => r.de < MIN_DE);
      expect(low).toEqual([]);
    });

  it('the default rating stamps (no filter) stay apart for every type', () => {
    for (const t of TYPES)
      for (const p of cvdPairs(PALETTES.none, RATING_INK).filter((q) => q.group === 'ratings'))
        expect(pairDe(p, t), `${p.label} (${t})`).toBeGreaterThanOrEqual(MIN_DE);
  });

  it('sigils and curse motes stand apart from veins and blood even without a filter', () => {
    for (const t of TYPES)
      for (const p of cvdPairs(PALETTES.none).filter((q) => q.group === 'sigil vs vein' || q.group === 'curse vs blood'))
        expect(pairDe(p, t), `${p.label} (${t})`).toBeGreaterThanOrEqual(MIN_DE);
  });
});
