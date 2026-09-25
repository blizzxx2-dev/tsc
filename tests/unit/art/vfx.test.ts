/** ART-0294/0297/0373/0238: VFX specs documented, timing sheet applied, particle caps enforced, flare curve. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { starPath, VFX_SPECS, VfxLayer } from '../../../src/art/vfx';
import { FPS, HIT_PAUSE_FRAMES, hitPauseMs } from '../../../src/art/timing';
import { flareIntensity } from '../../../src/art/bossVfx';
import { FLIPBOOK_FPS } from '../../../src/art/kit';
import { HITSTOP_MS } from '../../../src/core/clock';
import { PARTICLE_CAPS, Particles } from '../../../src/render/particles';

const DOCS = join(__dirname, '../../../docs/art/vfx');

describe('VFX specs (ART-0294)', () => {
  it('every effect in code has a filled row in docs/art/vfx/README.md', () => {
    const md = readFileSync(join(DOCS, 'README.md'), 'utf8');
    for (const s of VFX_SPECS) {
      const row = md.split('\n').find((l) => l.startsWith(`| \`${s.id}\` |`));
      expect(row, s.id).toBeDefined();
      expect(row).toContain(`| ${s.fps} | ${s.blend} |`);
      expect(row!.trim().endsWith(`| ${s.maxConcurrent} |`)).toBe(true);
    }
  });

  it('specs are complete and use the timing-sheet frame rates', () => {
    for (const s of VFX_SPECS) {
      expect([FPS.vfx, FPS.woodcut]).toContain(s.fps);
      expect(s.maxConcurrent).toBeGreaterThan(0);
      expect(s.sprite.length).toBeGreaterThan(0);
    }
    expect(new Set(VFX_SPECS.map((s) => s.id)).size).toBe(VFX_SPECS.length);
  });

  it('the layer retires the oldest instance past maxConcurrent', () => {
    const v = new VfxLayer(new Particles());
    for (let i = 0; i < 10; i++) v.add('phase-shockwave', i, 0);
    expect(v.count('phase-shockwave')).toBe(1);
    for (let i = 0; i < 40; i++) v.add('blood-splatter', i, 0);
    expect(v.count('blood-splatter')).toBe(24);
  });

  it('the key-invoked Litany star is a closed five-pointed path', () => {
    const p = starPath({ x: 0, y: 0 }, 10);
    expect(p).toHaveLength(6);
    expect(p[0].x).toBeCloseTo(p[5].x);
    expect(p[0].y).toBeCloseTo(p[5].y);
  });
});

describe('animation timing sheet (ART-0297)', () => {
  it('kit flipbooks run at the woodcut rate', () => expect(FLIPBOOK_FPS).toBe(FPS.woodcut));
  it('hitstop lengths are the documented frame counts', () => {
    expect(HITSTOP_MS.harm).toBe(hitPauseMs(HIT_PAUSE_FRAMES.harm));
    expect(HITSTOP_MS.extract).toBe(hitPauseMs(HIT_PAUSE_FRAMES.extract));
    expect(HITSTOP_MS.malison).toBe(hitPauseMs(HIT_PAUSE_FRAMES.malison));
  });
});

describe('particle caps (ART-0373)', () => {
  it('matches the spec and is enforced per family', () => {
    expect(PARTICLE_CAPS).toMatchObject({ blood: 64, spark: 48, mote: 32, leaf: 40 });
    const p = new Particles();
    for (const kind of ['blood', 'spark', 'mote', 'leaf'] as const) {
      for (let i = 0; i < 10; i++) p.spawn({ kind, pos: { x: 0, y: 0 }, n: 30 });
      expect(p.countOf(kind)).toBe(PARTICLE_CAPS[kind]);
    }
    p.update(0.01, () => undefined);
    expect(p.countOf('blood')).toBeLessThanOrEqual(64);
  });
});

describe('dawn flare curve (ART-0238)', () => {
  it('attacks, holds and falls to zero at the end', () => {
    expect(flareIntensity(0, 2)).toBe(0);
    expect(flareIntensity(0.2, 2)).toBe(1);
    expect(flareIntensity(1, 2)).toBeGreaterThan(0);
    expect(flareIntensity(1, 2)).toBeLessThan(1);
    expect(flareIntensity(2, 2)).toBe(0);
  });
});
