/** GAM-0051: cautery smoke scales with what is being seared, and heavy searing veils the field briefly. */
import { describe, expect, it } from 'vitest';
import { brandMaterial, BrandSmoke, SMOKE_PER_S, VEIL_MAX } from '../../../src/render/brandSmoke';
import { Grub, Laceration } from '../../../src/surgery/entities';
import { Malison } from '../../../src/surgery/malison';
import { at, start } from '../../harness';

describe('GAM-0051 brand smoke', () => {
  it('knows what the brand is on: flesh, grub, Malison', () => {
    let g!: Grub;
    let m!: Malison;
    const op = start((o) => [(g = new Grub(at(-200, 0), o, 0)), (m = new Malison(at(150, 0), o)), new Laceration(at(0, 150), 0, 40, 0.1)]);
    expect(brandMaterial(op, at(0, -100))).toBe(0);
    expect(brandMaterial(op, g.pos)).toBe(1);
    expect(brandMaterial(op, m.pos)).toBe(3);
  });

  it('smoke per second rises with the material, and the veil thickens then clears', () => {
    expect(SMOKE_PER_S[0]).toBeLessThan(SMOKE_PER_S[1]);
    expect(SMOKE_PER_S[1]).toBeLessThan(SMOKE_PER_S[2]);
    expect(SMOKE_PER_S[2]).toBeLessThan(SMOKE_PER_S[3]);
    const puffs = (m: 0 | 1 | 2 | 3) => {
      const s = new BrandSmoke();
      let n = 0;
      for (let i = 0; i < 60; i++) n += s.update(1 / 60, m);
      return { n, veil: s.veil, s };
    };
    const flesh = puffs(0);
    const malison = puffs(3);
    expect(Math.abs(flesh.n - SMOKE_PER_S[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(malison.n - SMOKE_PER_S[3])).toBeLessThanOrEqual(1);
    expect(malison.veil).toBeGreaterThan(flesh.veil);
    expect(malison.veil).toBeLessThanOrEqual(VEIL_MAX);
    for (let i = 0; i < 90; i++) malison.s.update(1 / 60, null);
    expect(malison.s.veil).toBe(0);
  });
});
