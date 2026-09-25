import { describe, expect, it } from 'vitest';
import { LINE_PX, stackPopup, type Stackable } from '../../../src/ui/popupStack';

describe('popup de-overlap (UIX-0047)', () => {
  it('five simultaneous shard ratings at one spot stack into five separate lines', () => {
    const live: Stackable[] = [];
    for (let i = 0; i < 5; i++) {
      const p: Stackable = { pos: { x: 600 + i * 6, y: 400 }, t: 0 };
      stackPopup(live, p);
      live.push(p);
    }
    const ys = live.map((p) => p.pos.y - (p.lift ?? 0)).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LINE_PX);
  });

  it('leaves popups alone when they are far apart or the earlier one is older than 0.3 s', () => {
    const old: Stackable = { pos: { x: 600, y: 400 }, t: 0.5 };
    const far: Stackable = { pos: { x: 700, y: 400 }, t: 0 };
    const p: Stackable = { pos: { x: 600, y: 400 }, t: 0 };
    expect(stackPopup([old, far], p)).toBe(0);
  });
});
