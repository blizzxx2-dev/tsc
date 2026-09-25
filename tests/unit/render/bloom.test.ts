/** ENG-0149: bloom presets per scene type as data; PostParams.bloom is a preset id plus intensity override. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOOM_PRESETS, resolveBloom } from '../../../src/render/bloom';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('bloom presets (ENG-0149)', () => {
  it('defines operation, story, menu and Malison presets as data', () => {
    for (const id of ['operation', 'story', 'menu', 'malison'] as const) {
      const p = BLOOM_PRESETS[id];
      expect(p.intensity).toBeGreaterThan(0);
      expect(p.threshold).toBeGreaterThan(0);
      expect(p.radius).toBeGreaterThan(0);
    }
    expect(BLOOM_PRESETS.malison.threshold).toBeLessThan(BLOOM_PRESETS.operation.threshold);
  });

  it('resolves a preset id with an optional intensity override', () => {
    expect(resolveBloom('story')).toEqual(BLOOM_PRESETS.story);
    expect(resolveBloom({ preset: 'malison', intensity: 2 })).toEqual({ ...BLOOM_PRESETS.malison, intensity: 2 });
    expect(resolveBloom(0.5).intensity).toBe(0.5);
  });

  it('drives the bright-pass threshold and upsample radius in endWorld', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const f = fakeGl();
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    g.beginWorld();
    const mark = f.calls.length;
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'malison' });
    const floats = f.calls
      .slice(mark)
      .filter((c) => c.fn === 'uniform1f')
      .map((c) => c.args[1]);
    expect(floats).toContain(BLOOM_PRESETS.malison.threshold);
    expect(floats).toContain(BLOOM_PRESETS.malison.radius);
  });

  it('every game scene names a preset instead of a bare bloom number', () => {
    const dirs = ['src/scenes', 'src/audio', 'src/input'];
    const offenders: string[] = [];
    for (const d of dirs)
      for (const f of readdirSync(d)) {
        if (!f.endsWith('.ts')) continue;
        const src = readFileSync(join(d, f), 'utf8');
        if (/endWorld\(\{[^}]*bloom: [0-9]/.test(src) || /^\s+bloom: [0-9]/m.test(src)) offenders.push(`${d}/${f}`);
      }
    expect(offenders).toEqual([]);
  });
});
