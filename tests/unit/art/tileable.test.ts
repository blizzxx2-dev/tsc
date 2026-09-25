/** ART-0160: the half-tile seam check passes periodic textures and fails ones whose edges don't meet. */
import { describe, expect, it } from 'vitest';
import { bakedNoise } from '../../../src/render/noiseBake';
import { halfOffset, SEAM_THRESHOLD, seamRatio, type Plane } from '../../../scripts/lib/tileable.ts';

const make = (w: number, h: number, f: (x: number, y: number) => number): Plane => {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y);
  return { w, h, channels: 1, data };
};

describe('ART-0160 tileability check', () => {
  it('passes a periodic texture', () => {
    const img = make(64, 64, (x, y) => Math.sin((x / 64) * Math.PI * 6) + Math.cos((y / 64) * Math.PI * 4));
    expect(seamRatio(img).worst).toBeLessThan(SEAM_THRESHOLD);
  });

  it('fails a texture whose edges do not meet', () => {
    const img = make(64, 64, (x, y) => x / 64 + 0.2 * Math.sin(y));
    expect(seamRatio(img).x).toBeGreaterThan(SEAM_THRESHOLD);
  });

  it('the half offset moves the wrap to the middle and keeps every texel', () => {
    const img = make(8, 8, (x, y) => y * 8 + x);
    const off = halfOffset(img);
    expect(off.data[0]).toBe(img.data[4 * 8 + 4]);
    expect(Array.from(off.data).sort((a, b) => a - b)).toEqual(Array.from(img.data).sort((a, b) => a - b));
  });

  it('the baked flesh noise (albedo and normal fields) tiles', () => {
    const b = bakedNoise(64);
    const plane: Plane = { w: b.size, h: b.size, channels: 4, data: b.fbm };
    expect(seamRatio(plane, [0]).worst).toBeLessThan(SEAM_THRESHOLD);
    expect(seamRatio(plane, [1, 2]).worst).toBeLessThan(SEAM_THRESHOLD);
  });
});
