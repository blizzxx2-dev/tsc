/** ENG-0041 render layers, ENG-0042 entity draw order, ENG-0043 layer contract, ENG-0044 WorldUI. */
import { describe, expect, it } from 'vitest';
import { drawOrder, LAYER_CONTRACT, RenderLayer, RenderQueue, type LayerHost } from '../../../src/render/layers';
import type { PostParams } from '../../../src/render/gfx';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

const POST: PostParams = { litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 };

/** A fake host that logs calls, the camera in force, and whether the world target is bound. */
function host() {
  const log: string[] = [];
  let inWorld = false;
  let cam: string = 'none';
  const h: LayerHost = {
    beginWorld: () => {
      inWorld = true;
      log.push('beginWorld');
    },
    endWorld: () => {
      inWorld = false;
      log.push('endWorld');
    },
    setCamera: (m) => {
      cam = m ? 'cam' : 'none';
    },
  };
  const draw = (name: string) => () => log.push(`${name}@${inWorld ? 'world' : 'screen'}/${cam}`);
  return { h, log, draw };
}

describe('render layers (ENG-0041, ENG-0043, ENG-0044)', () => {
  it('submits per-layer command lists in layer order regardless of call order', () => {
    const { h, log, draw } = host();
    const q = new RenderQueue();
    q.add(RenderLayer.UI, draw('hud'));
    q.add(RenderLayer.Particles, draw('sparks'));
    q.add(RenderLayer.Debug, draw('debug'));
    q.add(RenderLayer.Backdrop, draw('drape'));
    q.add(RenderLayer.Entities, draw('wound-a'));
    q.add(RenderLayer.Overlay, draw('fade'));
    q.add(RenderLayer.WorldUI, draw('popup'));
    q.add(RenderLayer.Entities, draw('wound-b'));
    q.submit(h, POST, { camera: [2, 0, 0, 2, -640, -360] });
    expect(log).toEqual([
      'beginWorld',
      'drape@world/cam',
      'wound-a@world/cam',
      'wound-b@world/cam',
      'sparks@world/cam',
      'endWorld',
      'popup@screen/cam',
      'hud@screen/none',
      'fade@screen/none',
      'debug@screen/none',
    ]);
    expect(q.counts[RenderLayer.Entities]).toBe(2);
    // Lists are consumed.
    log.length = 0;
    q.submit(h, POST);
    expect(log).toEqual(['beginWorld', 'endWorld']);
  });

  it('documents the contract: UI and Overlay never receive post (grain, vignette, LUT, shake) or the camera', () => {
    for (const l of [RenderLayer.UI, RenderLayer.Overlay, RenderLayer.Debug])
      expect(LAYER_CONTRACT[l]).toEqual({ target: 'screen', post: false, camera: false });
    expect(LAYER_CONTRACT[RenderLayer.WorldUI]).toEqual({ target: 'screen', post: false, camera: true });
    for (const l of [RenderLayer.Backdrop, RenderLayer.Field, RenderLayer.Decals, RenderLayer.Entities, RenderLayer.Particles, RenderLayer.WorldFX])
      expect(LAYER_CONTRACT[l].post).toBe(true);
  });

  it('draws UI after the post composite, straight to the backbuffer (real Gfx on a fake GL)', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const f = fakeGl();
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    const q = new RenderQueue();
    q.add(RenderLayer.UI, (gg) => gg.rect(10, 10, 100, 20, 0xffffffff));
    q.add(RenderLayer.Entities, (gg) => gg.rect(300, 300, 50, 50, 0xff0000ff));
    const start = f.calls.length;
    q.submit(g, { ...POST, trauma: 12, bloom: 1 });
    g.endFrame();
    const calls = f.calls.slice(start);
    const drawIdx = calls.map((c, i) => (c.fn === 'drawArrays' ? i : -1)).filter((i) => i >= 0);
    const lastDraw = drawIdx[drawIdx.length - 1];
    // The last draw is the UI batch; the framebuffer bound before it is the backbuffer (null).
    const lastBind = [...calls.slice(0, lastDraw)].reverse().find((c) => c.fn === 'bindFramebuffer');
    expect(lastBind?.args[1]).toBeNull();
    // …and the post program's full-screen draw came before it.
    const postDraw = drawIdx.filter((i) => i < lastDraw).length;
    expect(postDraw).toBeGreaterThan(1);
  });
});

describe('entity draw order (ENG-0042)', () => {
  it('sorts by layer, then spawn order, stably and independent of array order', () => {
    const e = (id: number, layer: number) => ({ id, layer });
    const ents = [e(5, 1), e(2, 0), e(9, 0), e(1, 1), e(3, 2), e(4, 0)];
    expect(drawOrder(ents).map((x) => x.id)).toEqual([2, 4, 9, 1, 5, 3]);
    expect(drawOrder([...ents].reverse()).map((x) => x.id)).toEqual([2, 4, 9, 1, 5, 3]);
  });
});
