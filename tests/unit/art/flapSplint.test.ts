/** ART-0189 surgical flaps, ART-0223 fracture sprites and splint, ART-0267 the live leech. */
import { describe, expect, it } from 'vitest';
import { flapPins } from '../../../src/art/surgicalFlap';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('flaps, splints and the live leech', () => {
  it('pins a flap at both ends and the middle, and every sprite draws', async () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 5 },
      { x: 100, y: 0 },
    ];
    expect(flapPins(pts)).toEqual([pts[0], pts[1], pts[2]]);
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const { surgicalFlapArt } = await import('../../../src/art/surgicalFlap');
    const { boneFragmentArt, boneChipsArt, splintArt } = await import('../../../src/art/boneView');
    const { leechSquirm, LEECH_SQUIRM_FRAMES } = await import('../../../src/art/toolSprites');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const v = (fn: () => void) => {
      g.flush();
      const v0 = g.stats.vertices;
      fn();
      g.flush();
      return g.stats.vertices - v0;
    };
    expect(v(() => surgicalFlapArt(g, pts, 1, [0.8, 0.6, 0.5]))).toBeGreaterThan(0);
    expect(v(() => surgicalFlapArt(g, pts, 0, [0.8, 0.6, 0.5]))).toBe(0);
    expect(v(() => boneFragmentArt(g, { x: 0, y: 0 }, 0, 52, { brokenA: true, brokenB: false, set: false, protrude: true }))).toBeGreaterThan(0);
    expect(v(() => boneChipsArt(g, { x: 0, y: 0 }, 3))).toBeGreaterThan(0);
    expect(v(() => splintArt(g, { x: 0, y: 0 }, { x: 150, y: 0 }))).toBeGreaterThan(0);
    expect(LEECH_SQUIRM_FRAMES).toBe(4);
    expect(v(() => leechSquirm(g, 0, 0, 64, 0))).toBeGreaterThan(0);
  });
});
