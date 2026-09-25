import { describe, expect, it } from 'vitest';
import { drapePanels } from '../../../src/art/drape';

describe('amputation drape (GAM-0126)', () => {
  it('two panels flank the saw line and leave only the strip open', () => {
    const a = { x: 0, y: -100 };
    const b = { x: 0, y: 100 };
    const panels = drapePanels(a, b, { window: 40, reach: 80 });
    expect(panels).toHaveLength(2);
    // Each panel's inner edge sits exactly `window` from the line, on opposite sides.
    const inner = panels.map((q) => q[0].x);
    expect(Math.abs(inner[0])).toBeCloseTo(40);
    expect(Math.sign(inner[0])).toBe(-Math.sign(inner[1]));
    // Outer edges reach window + reach; the line itself is never covered.
    for (const q of panels) expect(Math.min(...q.map((p) => Math.abs(p.x)))).toBeGreaterThanOrEqual(40 - 1e-9);
    expect(Math.max(...panels[0].map((p) => Math.abs(p.x)))).toBeCloseTo(120);
  });
});

describe('drape material presets (ENG-0276)', () => {
  it('each preset draws its own cloth, and coarse cloth shows a weave', async () => {
    const { drawDrape, DRAPES } = await import('../../../src/art/drape');
    expect(Object.keys(DRAPES).sort()).toEqual(['canvas', 'linen', 'sackcloth', 'silk']);
    const record = (material: keyof typeof DRAPES) => {
      const calls: { k: string; args: unknown[] }[] = [];
      const g = new Proxy(
        {},
        {
          get:
            (_t, k) =>
            (...args: unknown[]) =>
              void calls.push({ k: String(k), args }),
        },
      ) as never;
      drawDrape(g, { x: 0, y: -100 }, { x: 0, y: 100 }, { material });
      return calls;
    };
    const cloth = (m: keyof typeof DRAPES) => JSON.stringify(record(m).filter((c) => c.k === 'poly')[1].args[1]);
    expect(cloth('silk')).not.toBe(cloth('linen'));
    expect(record('sackcloth').filter((c) => c.k === 'line').length).toBeGreaterThan(record('linen').filter((c) => c.k === 'line').length);
  });
});
