/** ART-0194, ART-0221, ART-0222: tallow clots, the petrify crust and plate flipbook, the name write-on. */
import { describe, expect, it } from 'vitest';
import { CRUST_STAGE_S, crustStage, PLATE_CRACK_FRAMES } from '../../../src/art/lateAilmentArt';
import { FPS } from '../../../src/art/timing';
import { NAME_WRITE_FRAMES } from '../../../src/surgery/bosses/prime';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('Chapter III–V ailment art', () => {
  it('the crust has four stages by age, and a cracked plate plays its flipbook then vanishes', async () => {
    expect([0, CRUST_STAGE_S, CRUST_STAGE_S * 2, CRUST_STAGE_S * 9].map(crustStage)).toEqual([0, 1, 2, 3]);
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const { petrifyPlateArt, tallowClotArt } = await import('../../../src/art/lateAilmentArt');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const verts = (fn: () => void) => {
      g.flush();
      const v0 = g.stats.vertices;
      fn();
      g.flush();
      return g.stats.vertices - v0;
    };
    const p = { x: 100, y: 100 };
    expect(verts(() => petrifyPlateArt(g, p, 14, { index: 0, next: true, crackAge: 0.1 }))).toBeGreaterThan(0);
    expect(verts(() => petrifyPlateArt(g, p, 14, { index: 0, next: true, crackAge: PLATE_CRACK_FRAMES / FPS.woodcut + 0.01 }))).toBe(0);
    // A molten clot runs drips a set one does not.
    expect(verts(() => tallowClotArt(g, p, 18, { soft: 1, drawn: 0, t: 0 }))).toBeGreaterThan(
      verts(() => tallowClotArt(g, p, 18, { soft: 0, drawn: 0, t: 0 })),
    );
    expect(NAME_WRITE_FRAMES).toBe(20);
  });
});
