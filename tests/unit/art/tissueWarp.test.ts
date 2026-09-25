/** ART-0298: per-flesh-set warp maps driven by the heartbeat and the breath. */
import { describe, expect, it } from 'vitest';
import { TISSUE_WARP, tissueWarp } from '../../../src/art/tissueWarp';
import { FLESH_FS } from '../../../src/render/shaders';

describe('tissue warp (ART-0298)', () => {
  it('has a map for every organ kind the flesh shader draws', () => expect(TISSUE_WARP).toHaveLength(7));
  it('bone is rigid, the heart squeezes hardest and the lung breathes most', () => {
    expect(tissueWarp(6, 1, 1)).toEqual([1, 1]);
    const beat = (k: number) => tissueWarp(k, 1, -Math.PI / 2 / 1.6)[1] - 1;
    expect(beat(1)).toBeGreaterThan(beat(0));
    const breath = (k: number) => tissueWarp(k, 0, Math.PI / 2 / 1.6)[1] - 1;
    expect(breath(2)).toBeGreaterThan(breath(0));
  });
  it('is off under Reduced Motion and stays small enough for hit-testing', () => {
    expect(tissueWarp(1, 1, 0, true)).toEqual([1, 1]);
    for (let k = 0; k < 7; k++) for (const w of tissueWarp(k, 1, Math.PI / 2 / 1.6)) expect(w).toBeLessThan(1.045);
  });
  it('the flesh shader scales its texture space by u_warp', () => {
    expect(FLESH_FS).toContain('uniform vec2 u_warp;');
    expect(FLESH_FS).toMatch(/u_radii \* \(warped \? u_warp/);
  });
});
