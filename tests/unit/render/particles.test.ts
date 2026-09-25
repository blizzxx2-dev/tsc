/** ENG-0124 instanced particles, ENG-0126 emitter data, ENG-0127 curves, ENG-0128 budget, ENG-0131 deterministic spawn, ENG-0145 tier scaling. */
import { describe, expect, it } from 'vitest';
import { bakeCurve, bakeGradient, CURVE_SAMPLES, CurveAtlas, evalCurve, sampleBaked, sampleGradient } from '../../../src/render/curves';
import { EMITTERS, emitterRng, spawnOffset, validateEmitters } from '../../../src/render/fx/emitters';
import { PARTICLE_BUDGET, Particles } from '../../../src/render/particles';
import { shaderCatalog } from '../../../src/render/shaderCatalog';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('curves and gradients (ENG-0127)', () => {
  it('evaluates piecewise-linear keyframes, clamped at the ends', () => {
    const c = [
      [0, 0],
      [0.5, 1],
      [1, 0.2],
    ] as const;
    expect(evalCurve(c, -1)).toBe(0);
    expect(evalCurve(c, 0.25)).toBeCloseTo(0.5);
    expect(evalCurve(c, 0.75)).toBeCloseTo(0.6);
    expect(evalCurve(c, 2)).toBeCloseTo(0.2);
    expect(evalCurve(3, 0.4)).toBe(3);
  });

  it('bakes 64 samples and interpolates between them', () => {
    const lut = bakeCurve([
      [0, 0],
      [1, 63],
    ]);
    expect(lut).toHaveLength(CURVE_SAMPLES);
    expect(lut[0]).toBe(0);
    expect(lut[63]).toBeCloseTo(63);
    expect(sampleBaked(lut, 0.5)).toBeCloseTo(31.5);
    expect(sampleBaked(lut, 10 / 63 + 0.5 / 63)).toBeCloseTo(10.5);
    expect(sampleBaked(lut, 1.5)).toBeCloseTo(63);
  });

  it('bakes gradients to RGBA8 with alpha keys', () => {
    const g = bakeGradient([
      [0, '#ff0000', 1],
      [1, '#0000ff', 0],
    ]);
    expect(g).toHaveLength(CURVE_SAMPLES * 4);
    expect([...g.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...g.slice(-4)]).toEqual([0, 0, 255, 0]);
    const mid = sampleGradient(g, 0.5);
    expect(mid[0]).toBeCloseTo(127.5, -1);
    expect(mid[3]).toBeCloseTo(127.5, -1);
  });

  it('packs rows into one texture image with row-centre v coordinates', () => {
    const a = new CurveAtlas();
    a.addGradient('blood', '#6a0208');
    a.addCurve('size', [
      [0, 1],
      [1, 2],
    ]);
    a.addCurve('alpha', 0.5, [0, 1]);
    expect(a.height).toBe(3);
    expect(a.row('size')).toBeCloseTo(1.5 / 3);
    const px = a.pixels();
    expect(px).toHaveLength(CURVE_SAMPLES * 4 * 3);
    expect(px[CURVE_SAMPLES * 4]).toBe(0);
    expect(px[CURVE_SAMPLES * 8 - 4]).toBe(255);
    expect(px[CURVE_SAMPLES * 8]).toBe(128);
    expect(a.ranges.get('size')).toEqual([1, 2]);
  });
});

describe('emitter definitions (ENG-0126)', () => {
  it('ships a valid table covering every effect the simulation emits', () => {
    expect(validateEmitters(EMITTERS as Record<string, unknown>)).toEqual([]);
    for (const k of ['blood', 'pus', 'spark', 'smoke', 'mote', 'gold', 'dust']) expect(EMITTERS[k]).toBeDefined();
  });

  it('reports malformed entries by path', () => {
    const errs = validateEmitters({
      bad: { ...EMITTERS.blood, priority: 'urgent', shape: { kind: 'arc', r: 3 }, life: [2, 1], color: 'red', particle: 'cube', sizeOverLife: [[2, 1]] },
    });
    expect(errs.map((e) => e.split(':')[0])).toEqual(['bad.priority', 'bad.shape', 'bad.life', 'bad.particle', 'bad.color', 'bad.sizeOverLife']);
  });

  it('spawns inside each shape', () => {
    const r = emitterRng(1, 'x');
    for (let i = 0; i < 200; i++) {
      const [lx, ly] = spawnOffset({ kind: 'line', dx: 10, dy: 0 }, r);
      expect(lx).toBeGreaterThanOrEqual(0);
      expect(lx).toBeLessThanOrEqual(10);
      expect(ly).toBe(0);
      const [ax, ay] = spawnOffset({ kind: 'arc', r: 5, a0: 0, a1: Math.PI / 2 }, r);
      expect(Math.hypot(ax, ay)).toBeCloseTo(5);
      expect(ax).toBeGreaterThanOrEqual(-1e-9);
      const [ex, ey] = spawnOffset({ kind: 'ellipse', rx: 4, ry: 2 }, r);
      expect((ex / 4) ** 2 + (ey / 2) ** 2).toBeLessThanOrEqual(1 + 1e-9);
      const [px, py] = spawnOffset(
        {
          kind: 'path',
          points: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        },
        r,
      );
      expect(px === 10 || py === 0).toBe(true);
    }
  });
});

const events = (p: Particles) => {
  p.spawn({ kind: 'blood', pos: { x: 100, y: 100 }, n: 12, dir: 0.3 });
  p.spawn({ kind: 'spark', pos: { x: 200, y: 100 }, n: 8 });
  p.spawn({ kind: 'smoke', pos: { x: 300, y: 100 }, n: 5 });
  p.update(0.05, () => {});
};

describe('deterministic spawn (ENG-0131)', () => {
  it('replays identically for the same operation seed and differs for another', () => {
    const a = new Particles(undefined, 42);
    const b = new Particles(undefined, 42);
    const c = new Particles(undefined, 43);
    for (const p of [a, b, c]) events(p);
    const inst = (p: Particles) => Array.from(p.instances('alpha').data.slice(0, p.instances('alpha').count * 12));
    expect(inst(a)).toEqual(inst(b));
    expect(inst(a)).not.toEqual(inst(c));
  });

  it('gives each emitter its own stream, so adding one effect does not shift another', () => {
    const a = new Particles(undefined, 7);
    const b = new Particles(undefined, 7);
    a.spawn({ kind: 'blood', pos: { x: 0, y: 0 }, n: 5 });
    b.spawn({ kind: 'spark', pos: { x: 0, y: 0 }, n: 5 });
    b.spawn({ kind: 'blood', pos: { x: 0, y: 0 }, n: 5 });
    // Compare the simulated fields (position, velocity, size, rotation, age, shape), not the curve-row coordinates.
    const blood = (p: Particles) => Array.from(p.instances('alpha').data.slice(0, 5 * 12)).filter((_, i) => i % 12 < 8);
    expect(blood(a)).toEqual(blood(b));
  });
});

describe('budget and priority classes (ENG-0128, ENG-0145)', () => {
  it('caps the pool per tier and culls ambient before gameplay-readable effects', () => {
    const p = new Particles(undefined, 1);
    p.quality = 'low';
    expect(p.max).toBe(PARTICLE_BUDGET.low);
    p.quality = 'high';
    for (let i = 0; i < 20; i++) p.spawn({ kind: 'smoke', pos: { x: 0, y: 0 }, n: 200 });
    p.quality = 'low';
    while (p.count < p.max) p.spawn({ kind: 'dust', pos: { x: 0, y: 0 }, n: 500 });
    expect(p.count).toBe(4000);
    p.spawn({ kind: 'blood', pos: { x: 0, y: 0 }, n: 300 });
    expect(p.counts().gameplay).toBe(300);
    expect(p.count).toBe(4000);
    expect(p.culled.ambient).toBeGreaterThanOrEqual(300);
    // Full of gameplay particles: new ambient ones are refused, gameplay ones are never evicted.
    while (p.counts().gameplay < p.max) p.spawn({ kind: 'blood', pos: { x: 0, y: 0 }, n: 500 });
    p.spawn({ kind: 'smoke', pos: { x: 0, y: 0 }, n: 50 });
    expect(p.counts().ambient).toBe(0);
    expect(p.counts().gameplay).toBe(p.max);
  });

  it('scales non-gameplay emission with the tier but keeps gameplay bursts whole', () => {
    const count = (q: 'high' | 'low', kind: 'spark' | 'blood') => {
      const p = new Particles(undefined, 3);
      p.caps = {}; // tier scaling alone, without the per-family caps (ART-0373)
      p.quality = q;
      for (let i = 0; i < 50; i++) p.spawn({ kind, pos: { x: 0, y: 0 }, n: 10 });
      return p.count;
    };
    expect(count('high', 'spark')).toBe(500);
    expect(count('low', 'spark')).toBeLessThan(260);
    expect(count('low', 'blood')).toBe(500);
  });
});

describe('UI particles (ENG-0144)', () => {
  it('draws COOL sparkle, milestone flare and rank ink splash on the UI layer only', () => {
    const p = new Particles(undefined, 2);
    for (const id of ['uiSparkle', 'uiFlare', 'inkSplash']) {
      expect(EMITTERS[id].layer).toBe('UI');
      p.burst(id, { x: 640, y: 360 });
    }
    expect(p.instances('alpha', 'Particles').count + p.instances('add', 'Particles').count).toBe(0);
    expect(p.instances('alpha', 'UI').count + p.instances('add', 'UI').count).toBe(p.count);
  });
});

describe('instanced renderer (ENG-0124)', () => {
  it('draws every particle in one instanced call per blend and registers its shader variant', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const f = fakeGl();
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    const p = new Particles(undefined, 9);
    events(p);
    p.spawn({ kind: 'gold', pos: { x: 10, y: 10 }, n: 30 });
    const before = f.count('drawArraysInstanced');
    p.draw(g);
    const calls = f.calls.filter((c) => c.fn === 'drawArraysInstanced').slice(before);
    expect(calls).toHaveLength(2);
    const total = calls.reduce((s, c) => s + (c.args[3] as number), 0);
    expect(total).toBe(p.count);
    expect(shaderCatalog().some((v) => v.name === 'particle')).toBe(true);
  });
});
