/** ART-0234…0262: every Hour's Book-of-Hours card paints its own miniature; the Unsung card is blank. */
import { describe, expect, it } from 'vitest';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('Book-of-Hours cards', () => {
  it('each Hour’s miniature adds its own image over the sky, and the Unsung card draws', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const { hourCard, hourMiniature, unsungCard } = await import('../../../src/art/hourMiniatures');
    const { defaultMiniature } = await import('../../../src/art/hoursCard');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const r = { x: 0, y: 0, w: 176, h: 200 };
    const verts = (fn: () => void) => {
      g.flush();
      const v0 = g.stats.vertices;
      fn();
      g.flush();
      return g.stats.vertices - v0;
    };
    for (const h of ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline'] as const) {
      expect(
        verts(() => hourMiniature(h)(g, r)),
        h,
      ).toBeGreaterThan(verts(() => defaultMiniature(g, r, h, 1)));
      hourCard(g, { x: 0, y: 0, w: 240, h: 360 }, h, h);
    }
    expect(verts(() => unsungCard(g, { x: 0, y: 0, w: 240, h: 360 }))).toBeGreaterThan(0);
  });
});
