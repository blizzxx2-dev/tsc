import { describe, expect, it } from 'vitest';
import '../../../src/render/surgery';
import { drawEntity } from '../../../src/render/surgery/registry';
import type { Gfx } from '../../../src/render/gfx';
import { AILMENT_MARKS, BloodPool, Embedded, Rot, Venom } from '../../../src/surgery/entities';
import { at, start } from '../../harness';

/** Machado et al. (2009) full-severity colour-vision-deficiency matrices, applied in linear RGB. */
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [0, 2, 4].map((i) => lin(parseInt(h.slice(1 + i, 3 + i), 16) / 255));
const simulate = (h: string, m: readonly (readonly number[])[]) => {
  const c = rgb(h);
  return m.map((row) => Math.max(0, Math.min(1, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
};
/** Chroma-only difference (hue as seen), ignoring lightness: what "hue alone" would have to carry. */
const hueGap = (a: number[], b: number[]) => {
  const n = (c: number[]) => {
    const s = c[0] + c[1] + c[2] || 1;
    return [c[0] / s, c[1] / s];
  };
  const [p, q] = [n(a), n(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
};

/** The ailments' signature inks (venom veins, hexstone glow, rot blotches, pus). */
const INKS = { venom: '#2a1030', hexstone: '#e8a838', rot: '#46582a', pus: '#c8b040' } as const;

function record(draw: (g: Gfx) => void): string[] {
  const calls: string[] = [];
  const g = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...a: unknown[]) =>
          void calls.push(
            `${String(k)}:${Array.isArray(a[0]) ? (a[0] as unknown[]).length : ''}:${typeof a[2] === 'number' ? Math.round(a[2] as number) : ''}`,
          ),
    },
  ) as unknown as Gfx;
  draw(g);
  return calls;
}

describe('GAM-0236: colour-blind safe ailments', () => {
  it('under deuteranopia, protanopia and tritanopia some ailment inks collapse together — so each carries its own shape mark', () => {
    const kinds = Object.keys(INKS) as (keyof typeof INKS)[];
    let close = 0;
    for (const m of Object.values(CVD))
      for (let i = 0; i < kinds.length; i++)
        for (let j = i + 1; j < kinds.length; j++) {
          if (hueGap(simulate(INKS[kinds[i]], m), simulate(INKS[kinds[j]], m)) < 0.12) close++;
          expect(AILMENT_MARKS[kinds[i]]).not.toBe(AILMENT_MARKS[kinds[j]]);
        }
    expect(close).toBeGreaterThan(0); // hue alone would not do
    expect(new Set(Object.values(AILMENT_MARKS)).size).toBe(4);
  });

  it('each ailment draws its mark: venom veins and punctures, a hexstone hexagon, rot speckle, pus bubbles', () => {
    const op = start(() => []);
    const venom = new Venom(at(0, 0), op);
    const hex = new Embedded(at(100, 0), 'hexstone', 0.4, false);
    const shard = new Embedded(at(-100, 0), 'shard', 0.4, false);
    const rot = new Rot(at(0, 100), 40, 0);
    const pus = new BloodPool(at(0, -100), 30, 'pus');
    const blood = new BloodPool(at(0, -100), 30, 'blood');
    for (const e of [venom, hex, shard, rot, pus, blood]) op.spawn(e);
    const v = record((g) => drawEntity(g, venom, op));
    expect(v.filter((c) => c.startsWith('polyline:7')).length).toBeGreaterThanOrEqual(3); // branching veins
    expect(v.filter((c) => c === 'circle::3').length).toBe(2); // twin punctures
    expect(record((g) => drawEntity(g, hex, op)).some((c) => c.startsWith('polyline:7'))).toBe(true);
    expect(record((g) => drawEntity(g, shard, op)).some((c) => c.startsWith('polyline:7'))).toBe(false);
    expect(record((g) => drawEntity(g, rot, op)).filter((c) => c === 'circle::3').length).toBeGreaterThan(0);
    expect(record((g) => drawEntity(g, pus, op)).filter((c) => c.startsWith('arc')).length).toBeGreaterThanOrEqual(3);
    expect(record((g) => drawEntity(g, blood, op)).length).toBe(0);
  });
});
