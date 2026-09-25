/** ENG-0232 debug overlays and ENG-0233 render-target viewer. */
import { describe, expect, it } from 'vitest';
import { hitOutline } from '../../../src/debug/visual';
import { pointSegment } from '../../../src/core/math';
import { Laceration } from '../../../src/surgery/entities';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('debug overlays (ENG-0232)', () => {
  it('outlines the true hit shape of an entity (a capsule round a laceration)', () => {
    const e = new Laceration({ x: 600, y: 400 }, 0.5, 100, 1);
    const pts = hitOutline(e, 140, 4);
    expect(pts.length).toBeGreaterThan(40);
    // Every outline point is inside, and within one grid step of the 24 px capsule edge.
    for (const p of pts) {
      const d = pointSegment(p, e.a, e.b).d;
      expect(d).toBeLessThan(24);
      expect(d).toBeGreaterThan(24 - 4 * 1.5);
    }
  });

  it('counts draw calls per frame section and lists every render target for the viewer (ENG-0233)', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    g.beginLayer('surface');
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.endLayer();
    g.beginWorld();
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'operation' });
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.endFrame();
    const st = g.resetStats();
    expect(st.sections.layers).toBe(1);
    expect(st.sections.world).toBe(1);
    expect(st.sections.post).toBeGreaterThanOrEqual(1);
    expect(st.sections.ui).toBe(1);
    expect(g.lastStats).toBe(st);
    const names = g.debugTextures().map((t) => t.name);
    for (const n of ['scene', 'bloom1', 'surface', 'fluid', 'glyph-atlas']) expect(names).toContain(n);
    expect(names.some((n) => n.startsWith('lut:'))).toBe(true);
  });
});
