/** ENG-0226: in-place vector math and a per-frame scratch pool; Gfx shape calls allocate no vectors. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addTo, lerpTo, normTo, perpTo, rotateTo, scaleTo, subTo, VecPool } from '../../../src/core/vecPool';

describe('scratch vectors (ENG-0226)', () => {
  it('computes in place, returning the output vector', () => {
    const out = { x: 0, y: 0 };
    expect(addTo(out, { x: 1, y: 2 }, { x: 3, y: 4 })).toBe(out);
    expect(out).toEqual({ x: 4, y: 6 });
    expect(subTo(out, out, { x: 1, y: 1 })).toEqual({ x: 3, y: 5 });
    expect(scaleTo(out, { x: 2, y: -1 }, 3)).toEqual({ x: 6, y: -3 });
    expect(lerpTo(out, { x: 0, y: 0 }, { x: 10, y: 20 }, 0.25)).toEqual({ x: 2.5, y: 5 });
    expect(normTo(out, { x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(normTo(out, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const r = rotateTo(out, { x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
    expect(perpTo(out, { x: 1, y: 2 })).toEqual({ x: -2, y: 1 });
  });

  it('recycles pooled vectors every frame: steady state allocates nothing', () => {
    const pool = new VecPool();
    const frame = () => {
      pool.reset();
      const seen = [];
      for (let i = 0; i < 50; i++) seen.push(pool.get(i, -i));
      return seen;
    };
    const a = frame();
    expect(pool.capacity).toBe(50);
    const b = frame();
    expect(pool.capacity).toBe(50);
    expect(b[7]).toBe(a[7]);
    expect(b[7]).toEqual({ x: 7, y: -7 });
  });

  it('Gfx shape calls contain no vector/array allocations (source check of each method body)', () => {
    const src = readFileSync('src/render/gfx.ts', 'utf8');
    const methods = [
      'tri',
      'rect',
      'rectGrad',
      'rectLine',
      'circle',
      'ellipse',
      'circleGrad',
      'glow',
      'poly',
      'line',
      'polyline',
      'dashed',
      'arc',
      'quadCurve',
      'restore',
      'translate',
      'rotate',
      'scale',
    ];
    for (const m of methods) {
      const start = src.search(new RegExp(`\\n  ${m}\\(`));
      expect(start, m).toBeGreaterThan(0);
      // The body runs to the next method at the same indentation.
      const rest = src.slice(start + 1);
      const end = rest.search(/\n {2}(?:\/\*\*|[a-zA-Z_]+\(|private |get |\/\/ ---)/);
      const body = rest.slice(0, end);
      expect(body, m).not.toMatch(/\{\s*x:|new [A-Z]|=\s*\[|\.map\(|\.slice\(|\.concat\(|\.\.\./);
    }
  });
});
