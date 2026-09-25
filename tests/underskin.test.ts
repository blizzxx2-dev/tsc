import { describe, expect, it } from 'vitest';
import { BURROW_WANDER, bulgesOf, underSkinBulges } from '../src/render/underSkin';
import { Grub } from '../src/surgery/entities';
import { Larvae } from '../src/surgery/ailments/parasites';
import { start } from './harness';

describe('under-skin movement (ENG-0265)', () => {
  it('a burrowed grub raises a travelling bulge near its sim position; a surfaced one raises none', () => {
    const op = start();
    const g = new Grub({ x: 40, y: 20 }, op);
    expect(bulgesOf(g, 1)).toEqual([]);
    g.hidden = true;
    g.burrowed = true;
    const a = bulgesOf(g, 1);
    const b = bulgesOf(g, 1.5);
    expect(a.length).toBeGreaterThan(1);
    expect(a[0].h).toBeGreaterThan(a[a.length - 1].h);
    expect(Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y)).toBeGreaterThan(1);
    for (const p of [...a, ...b]) expect(Math.hypot(p.x - 40, p.y - 20)).toBeLessThan(BURROW_WANDER * 1.5);
    expect(bulgesOf(g, 1)).toEqual(a);
    g.kill();
    expect(bulgesOf(g, 1)).toEqual([]);
  });

  it('unseen larvae writhe as a knot of small bulges', () => {
    const l = new Larvae({ x: 0, y: 0 });
    expect(underSkinBulges([l], 2)).toHaveLength(4);
  });
});
