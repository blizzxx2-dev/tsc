/** ENG-0081/0082: the baked tiling noise and the quality tiers that select flesh variants. */
import { describe, expect, it } from 'vitest';
import { bakedNoise, NOISE_PERIOD, NOISE_SIZE, periodicCells, periodicFbm } from '../../../src/render/noiseBake';
import { fleshVariantKey, QUALITIES, SHADER_TIERS } from '../../../src/render/quality';
import { shaderCatalog } from '../../../src/render/shaderCatalog';
import { FLESH_FS, fleshShaderSource } from '../../../src/render/shaders/flesh';

describe('baked noise', () => {
  it('tiles exactly with the declared period in both axes', () => {
    for (const [x, y] of [
      [0.37, 2.9],
      [7.13, 15.99],
      [-3.2, 4.4],
      [12.5, 0.01],
    ]) {
      const a = periodicFbm(x, y);
      for (const [dx, dy] of [
        [NOISE_PERIOD, 0],
        [0, NOISE_PERIOD],
        [-2 * NOISE_PERIOD, 3 * NOISE_PERIOD],
      ]) {
        const b = periodicFbm(x + dx, y + dy);
        expect(b[0]).toBeCloseTo(a[0], 6);
        expect(b[1]).toBeCloseTo(a[1], 5);
        expect(b[2]).toBeCloseTo(a[2], 5);
        const ca = periodicCells(x, y);
        const cb = periodicCells(x + dx, y + dy);
        expect(cb[0]).toBeCloseTo(ca[0], 6);
        expect(cb[1]).toBeCloseTo(ca[1], 6);
      }
    }
  });

  it('has the live fbm statistics (mean ≈ 0.48, spread ≈ 0.11) and sorted voronoi distances', () => {
    let sum = 0;
    let sq = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const v = periodicFbm((i * 0.7919) % NOISE_PERIOD, (i * 0.3571) % NOISE_PERIOD)[0];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      sum += v;
      sq += v * v;
      const [d1, d2, d3] = periodicCells((i * 0.41) % NOISE_PERIOD, (i * 0.83) % NOISE_PERIOD);
      expect(d1).toBeLessThanOrEqual(d2);
      expect(d2).toBeLessThanOrEqual(d3);
      expect(d1).toBeLessThan(1.6);
    }
    const mean = sum / n;
    const std = Math.sqrt(sq / n - mean * mean);
    expect(mean).toBeGreaterThan(0.42);
    expect(mean).toBeLessThan(0.55);
    expect(std).toBeGreaterThan(0.07);
    expect(std).toBeLessThan(0.16);
  });

  it('gradient matches finite differences of the value', () => {
    const e = 1e-4;
    for (const [x, y] of [
      [1.3, 2.2],
      [9.9, 4.1],
      [5.55, 13.3],
    ]) {
      const [, gx, gy] = periodicFbm(x, y);
      const fx = (periodicFbm(x + e, y)[0] - periodicFbm(x - e, y)[0]) / (2 * e);
      const fy = (periodicFbm(x, y + e)[0] - periodicFbm(x, y - e)[0]) / (2 * e);
      expect(gx).toBeCloseTo(fx, 2);
      expect(gy).toBeCloseTo(fy, 2);
    }
  });

  it('bakes 512² RGBA float texels once and caches the result', () => {
    const a = bakedNoise();
    expect(a.size).toBe(NOISE_SIZE);
    expect(a.fbm.length).toBe(NOISE_SIZE * NOISE_SIZE * 4);
    expect(a.cells.length).toBe(NOISE_SIZE * NOISE_SIZE * 4);
    expect(bakedNoise()).toBe(a);
    // First and last rows/columns continue into each other (the texture wraps).
    const px = (x: number, y: number) => a.fbm[(y * NOISE_SIZE + x) * 4];
    expect(Math.abs(px(0, 100) - px(NOISE_SIZE - 1, 100))).toBeLessThan(0.05);
    expect(Math.abs(px(100, 0) - px(100, NOISE_SIZE - 1))).toBeLessThan(0.05);
  });
});

describe('shader quality tiers', () => {
  it('every tier is a distinct flesh variant that samples the bake, with Low at 0.75× field resolution', () => {
    const keys = QUALITIES.map((q) => fleshVariantKey(SHADER_TIERS[q].flesh));
    expect(new Set(keys).size).toBe(QUALITIES.length);
    for (const q of QUALITIES) expect(SHADER_TIERS[q].flesh.noise).toBe('baked');
    expect(SHADER_TIERS.low.fieldScale).toBe(0.75);
    expect(SHADER_TIERS.high.fieldScale).toBe(1);
    expect(SHADER_TIERS.low.sceneScale).toBeLessThan(SHADER_TIERS.medium.sceneScale);
    expect(SHADER_TIERS.medium.sceneScale).toBeLessThan(SHADER_TIERS.high.sceneScale);
  });

  it('generates the requested variant macros and keeps the live reference shader', () => {
    const baked = fleshShaderSource(SHADER_TIERS.high.flesh);
    expect(baked).toContain('#define NOISE_BAKED 1');
    expect(baked).toContain('uniform sampler2D u_noise;');
    expect(baked).toContain('fbmGrad(hp)');
    expect(baked).not.toContain('const mat2 OCT');
    expect(FLESH_FS).toContain('#define NOISE_BAKED 0');
    expect(FLESH_FS).toContain('#define FBM_OCTAVES 4');
    expect(FLESH_FS).toContain('#define SSS 1');
    expect(fleshShaderSource(SHADER_TIERS.low.flesh)).toContain('#define SSS 0');
    expect(fleshShaderSource(SHADER_TIERS.low.flesh)).toContain('#define SPEC_AA 0');
  });

  it('the CI shader catalog compiles every tier, its mediump fallback and the live A/B variant', () => {
    const names = shaderCatalog().map((v) => v.name);
    for (const q of QUALITIES) {
      expect(names).toContain(`flesh (${q})`);
      expect(names).toContain(`flesh (${q}, mediump)`);
      expect(names).toContain(`flesh (${q}, live noise)`);
    }
  });
});
