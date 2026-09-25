/** ENG-0236 dev time controls, ENG-0234 console commands and ENG-0240 build stamp. */
import { describe, expect, it } from 'vitest';
import { DevTime } from '../../../src/core/devTime';
import { FIXED_DT, FixedStep } from '../../../src/core/loop';
import type { DebugApi } from '../../../src/debug/api';
import { buildCommands } from '../../../src/debug/console-commands';
import { buildStamp, makeBuildInfo } from '../../../src/platform/build';

/** Ticks the main loop would run for `frames` frames of `dt` under `t`. */
const run = (t: DevTime, frames: number, dt = 1 / 60): number => {
  const fixed = new FixedStep();
  let n = 0;
  for (let i = 0; i < frames; i++) n += fixed.advance(t.frameTime(dt)) + t.takeSteps();
  return n;
};

describe('DevTime (ENG-0236)', () => {
  it('runs 120 ticks per second at 1x, a quarter at 0.25x and four times at 4x', () => {
    const t = new DevTime();
    expect(run(t, 60)).toBe(120);
    t.setScale(0.25);
    expect(run(t, 60)).toBe(30);
    t.setScale(4);
    expect(run(t, 60)).toBe(480);
  });

  it('pauses the simulation and single-steps exactly one fixed tick per request', () => {
    const t = new DevTime();
    t.togglePause();
    expect(run(t, 30)).toBe(0);
    t.step();
    const fixed = new FixedStep();
    expect(fixed.advance(t.frameTime(1 / 60)) + t.takeSteps()).toBe(1);
    expect(fixed.advance(t.frameTime(1 / 60)) + t.takeSteps()).toBe(0);
    t.togglePause();
    expect(run(t, 60)).toBe(120);
    expect(FIXED_DT).toBeCloseTo(1 / 120);
  });

  it('binds F7 (speed cycle), F9 (pause) and F10 (step), leaving Ctrl/Shift chords alone', () => {
    const t = new DevTime();
    expect(t.onKey('F7')).toBe(true);
    expect(t.scale).toBe(0.25);
    t.onKey('F7');
    expect(t.scale).toBe(4);
    t.onKey('F7');
    expect(t.scale).toBe(1);
    expect(t.onKey('F9', { ctrl: true, shift: true })).toBe(false);
    t.onKey('F9');
    expect(t.paused).toBe(true);
    expect(t.label()).toMatch(/PAUSED/);
    t.onKey('F10');
    expect(t.takeSteps()).toBe(1);
    expect(t.onKey('KeyA')).toBe(false);
    expect(() => t.setScale(0)).toThrow();
  });
});

describe('console commands (ENG-0234)', () => {
  it('exposes op, phase, vitals, litany, win, lose, timescale, seed, god, tier and lose-context', async () => {
    const calls: string[] = [];
    const api = {
      state: () => ({ scene: 'operation', op: null, save: { progress: { chapter: 0, step: 0 } } }),
      phase: (n: number) => calls.push(`phase ${n}`),
      setGod: (on?: boolean) => (calls.push(`god ${on}`), on ?? true),
      timescale: (x?: number) => (calls.push(`ts ${x}`), x ?? 1),
      reseed: (n: number) => calls.push(`seed ${n}`),
      shaderQuality: (q: string) => (calls.push(`q ${q}`), { quality: q, noise: 'baked' }),
      loseContext: (ms: number) => (calls.push(`lose ${ms}`), true),
    } as unknown as DebugApi;
    const reg = buildCommands(api);
    const names = reg.help();
    for (const c of ['op', 'phase', 'vitals', 'litany', 'win', 'lose', 'timescale', 'seed', 'god', 'tier', 'lose-context'])
      expect(names).toMatch(new RegExp(`^${c}\\b`, 'm'));
    await reg.run('phase 3');
    expect(await reg.run('god')).toBe('god on');
    expect(await reg.run('timescale 0.25')).toBe('timescale 0.25x');
    await reg.run('seed 42');
    expect(await reg.run('tier med')).toBe('tier medium');
    expect(await reg.run('lose-context 50')).toBe('context lost');
    expect(calls).toEqual(['phase 3', 'god undefined', 'ts 0.25', 'seed 42', 'q medium', 'lose 50']);
  });
});

describe('build stamp (ENG-0240)', () => {
  it('names version, sha, tier and renderer on one line', () => {
    const b = makeBuildInfo('demo', '1.0.3', 'abc1234', '20260925');
    expect(buildStamp('high', 'ANGLE (Intel, Intel(R) UHD Graphics 620)', b)).toBe('Demo 1.0.3 · abc1234 · high · ANGLE (Intel, Intel(R) UHD Graphics 620)');
    expect(buildStamp('low', '', b)).toMatch(/unknown GPU$/);
    expect(buildStamp('low', 'x'.repeat(90), b).length).toBeLessThan(90);
  });
});
