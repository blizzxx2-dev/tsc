import { describe, expect, it } from 'vitest';
import { anaemia, coldTint, frostArea, paleFlesh, paleRough } from '../../../src/render/fleshMood';
import { FrostPatch } from '../../../src/surgery/ailments/frost';
import type { Operation } from '../../../src/surgery/operation';

const withVolume = (v: number, tracked = true) => ({ bloodVolume: v, def: { secondary: tracked ? { bloodVolume: true } : undefined } }) as unknown as Operation;

describe('anaemic flesh (GAM-0119)', () => {
  it('pales and dulls as blood volume falls, only on ops that track it', () => {
    expect(anaemia(withVolume(100))).toBe(0);
    expect(anaemia(withVolume(40, false))).toBe(0);
    expect(anaemia(withVolume(55))).toBeCloseTo(0.5);
    expect(anaemia(withVolume(0))).toBe(1);
    const flesh: [number, number, number] = [0.77, 0.42, 0.36];
    const pale = paleFlesh(flesh, 1);
    // Less saturated (channels closer together) and not darker.
    expect(Math.max(...pale) - Math.min(...pale)).toBeLessThan(Math.max(...flesh) - Math.min(...flesh));
    expect(pale[1] + pale[2]).toBeGreaterThan(flesh[1] + flesh[2]);
    expect(paleFlesh(flesh, 0)).toEqual(flesh);
    expect(paleRough(0.45, 1)).toBeGreaterThan(paleRough(0.45, 0));
  });
});

describe('frost presentation (GAM-0103)', () => {
  it('the cold grade follows the frozen area still standing', () => {
    const a = new FrostPatch({ x: 0, y: 0 }, 40);
    const b = new FrostPatch({ x: 100, y: 0 }, 40);
    const op = { entities: [a, b] } as unknown as Operation;
    const full = frostArea(op);
    a.thaw = 1;
    expect(frostArea(op) / full).toBeCloseTo(0.5);
    const base: [number, number, number] = [1, 1, 1];
    expect(coldTint(base, 0)).toEqual(base);
    const cold = coldTint(base, 1);
    expect(cold[2]).toBeGreaterThan(1);
    expect(cold[0]).toBeLessThan(1);
    expect(coldTint(base, 0.5)[2]).toBeLessThan(cold[2]);
  });
});

describe('muscle and skin organ kinds (ENG-0093)', () => {
  it('map to their own shader kinds and palettes', async () => {
    const { organPalette } = await import('../../../src/render/organs');
    const m = organPalette({ organ: 'muscle' });
    const s = organPalette({ organ: 'skin' });
    expect([m.kind, s.kind]).toEqual([7, 8]);
    expect(m.base[0]).toBeGreaterThan(m.base[2]);
    expect(s.rough).toBeGreaterThan(m.rough);
  });
});

describe('fever (ART-0212)', () => {
  it('rises with infective ailments alive and is zero on a clean field', async () => {
    const { fever } = await import('../../../src/render/fleshMood');
    const { Bubo, Rot } = await import('../../../src/surgery/entities');
    const mk = (n: number) =>
      ({ entities: Array.from({ length: n }, (_, i) => (i % 2 ? new Rot({ x: 0, y: 0 }, 20) : new Bubo({ x: 0, y: 0 }, 20))) }) as never;
    expect(fever({ entities: [] } as never)).toBe(0);
    expect(fever(mk(2))).toBeGreaterThan(0);
    expect(fever(mk(3))).toBeGreaterThan(fever(mk(2)));
    expect(fever(mk(20))).toBe(1);
  });
});

describe('tallow blood (ART-0174)', () => {
  it('mixes the blood toward tallow by k, and leaves it alone at 0', async () => {
    const { tallowBlood, TALLOW } = await import('../../../src/render/organs');
    expect(tallowBlood('#6a0208', 0)).toBe('#6a0208');
    expect(tallowBlood('#6a0208', 1)).toBe(TALLOW);
    const mid = tallowBlood('#6a0208', 0.5);
    expect(parseInt(mid.slice(1, 3), 16)).toBeGreaterThan(0x6a);
  });
});
