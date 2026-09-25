/** ENG-0108 field-space UVs, ENG-0109 batched stamps, ENG-0114/0115 blood + erase, ENG-0120 rebuild, ENG-0121 lifecycle. */
import { describe, expect, it } from 'vitest';
import { DECAL_MAP_SIZE, DecalMaps, FIELD_MAP_RECT, fieldToMapUV, mapUVToField, type Stamp } from '../../../src/render/decals';
import { shaderCatalog } from '../../../src/render/shaderCatalog';
import { FIELD } from '../../../src/surgery/operation';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

async function setup() {
  installFakeDom();
  const { Gfx } = await import('../../../src/render/gfx');
  const f = fakeGl();
  const g = new Gfx(fakeCanvas(f), 1280, 720);
  return { f, g, d: new DecalMaps(g, 'high') };
}

const drop = (i: number, mode: Stamp['mode'] = 'add'): Stamp => ({
  map: 'blood',
  brush: 'splat',
  x: 300 + (i % 50) * 14,
  y: 250 + Math.floor(i / 50) * 30,
  r: 6,
  value: [0.7, 1, 0],
  mode,
  t: i * 0.01,
  seed: i / 500,
});

describe('field-space decal maps (ENG-0108)', () => {
  it('cover the field bounding rect at a fixed 16:9 size per tier, independent of view and zoom', () => {
    expect(DECAL_MAP_SIZE.high).toEqual([2048, 1152]);
    expect(DECAL_MAP_SIZE.low).toEqual([1024, 576]);
    expect(FIELD_MAP_RECT.w / FIELD_MAP_RECT.h).toBeCloseTo(16 / 9);
    // The whole operating field lies inside the map.
    const [u0, v0] = fieldToMapUV({ x: FIELD.cx - FIELD.rx, y: FIELD.cy + FIELD.ry });
    const [u1, v1] = fieldToMapUV({ x: FIELD.cx + FIELD.rx, y: FIELD.cy - FIELD.ry });
    for (const c of [u0, v0, u1, v1]) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(1);
    }
    const p = mapUVToField(0.3, 0.8);
    expect(fieldToMapUV(p)).toEqual([expect.closeTo(0.3), expect.closeTo(0.8)]);
  });

  it('sizes the map target by tier, not by the canvas', async () => {
    const { g, d } = await setup();
    expect([d.map('blood').w, d.map('blood').h]).toEqual([2048, 1152]);
    g.canvas.width = 3840;
    g.canvas.height = 2160;
    expect([d.map('blood').w, d.map('blood').h]).toEqual([2048, 1152]);
    d.setQuality('low');
    expect([d.map('blood').w, d.map('blood').h]).toEqual([1024, 576]);
  });
});

describe('batched stamps (ENG-0109)', () => {
  it('sends 500 stamps to one map in a single draw, in well under 0.5 ms of CPU', async () => {
    const { f, d } = await setup();
    const stamps = Array.from({ length: 500 }, (_, i) => drop(i));
    d.flush();
    let best = Infinity;
    for (let r = 0; r < 20; r++) {
      for (const s of stamps) d.stamp(s);
      const before = f.count('drawArraysInstanced');
      const t0 = performance.now();
      d.flush();
      best = Math.min(best, performance.now() - t0);
      expect(f.count('drawArraysInstanced') - before).toBe(1);
      expect(d.lastDraws).toBe(1);
    }
    expect(best).toBeLessThan(0.5);
    expect(
      shaderCatalog()
        .filter((v) => v.name.startsWith('decal-'))
        .map((v) => v.name),
    ).toEqual(['decal-stamp', 'decal-blood', 'decal-coverage']);
  });

  it('draws erases (the Leech-Pipe, ENG-0115) with a subtractive blend after that frame’s blood', async () => {
    const { f, d } = await setup();
    d.stamp(drop(1));
    d.stamp(drop(2, 'erase'));
    d.flush();
    const gl = f.gl;
    const blends = f.calls.filter((c) => c.fn === 'blendFuncSeparate').map((c) => JSON.stringify(c.args));
    const add = blends.lastIndexOf(JSON.stringify([gl.ONE, gl.ONE, gl.ONE, gl.ONE]));
    const erase = blends.lastIndexOf(JSON.stringify([gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE]));
    expect(add).toBeGreaterThanOrEqual(0);
    expect(erase).toBeGreaterThan(add);
    // Stamp time goes to alpha with MAX, so drying tracks the latest blood.
    expect(f.calls.some((c) => c.fn === 'blendEquationSeparate' && c.args[1] === gl.MAX)).toBe(true);
  });
});

describe('rebuild and lifecycle (ENG-0120, ENG-0121)', () => {
  const instances = (f: ReturnType<typeof fakeGl>) =>
    f.calls
      .filter((c) => c.fn === 'bufferSubData' && (c.args[2] as Float32Array).length >= 10 * 3)
      .map((c) => Array.from((c.args[2] as Float32Array).slice(0, (c.args[4] as number) ?? 0)));

  it('replays the stamp log with the same per-frame grouping after a context loss', async () => {
    const { f, g, d } = await setup();
    for (let frame = 0; frame < 4; frame++) {
      for (let i = 0; i < 5; i++) d.stamp(drop(frame * 5 + i, i === 4 ? 'erase' : 'add'));
      d.flush();
    }
    const first = instances(f);
    expect(first).toHaveLength(8);
    f.lose();
    g.contextLost();
    g.contextRestored();
    const mark = f.calls.length;
    d.flush();
    const again = instances({ ...f, calls: f.calls.slice(mark) } as ReturnType<typeof fakeGl>);
    expect(again).toEqual(first);
    expect(d.stampCount).toBe(20);
  });

  it('reset clears the log for a restart; release returns VRAM to the baseline', async () => {
    const { g, d } = await setup();
    const base = g.registry.bytes();
    for (let i = 0; i < 50; i++) d.stamp(drop(i));
    d.flush();
    d.drawBlood(1, { fresh: [0.5, 0.02, 0.03] });
    expect(g.registry.bytes() - base).toBeGreaterThanOrEqual(2048 * 1152 * 8);
    d.reset();
    expect(d.stampCount).toBe(0);
    d.release();
    expect(g.registry.bytes()).toBe(base);
  });
});
