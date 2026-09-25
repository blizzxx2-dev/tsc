/** ENG-0224: the profiler counts hitches (>50 ms frames) and keeps the worst frame for the audit. */
import { describe, expect, it } from 'vitest';
import { HITCH_MS, Profiler } from '../../../src/render/profiler';

describe('profiler hitch audit', () => {
  it('counts frames over the threshold and remembers the worst one', () => {
    const p = new Profiler(() => 0);
    for (const ms of [8, 12, 51, 9, 130, 16, 50]) p.frame(ms);
    expect(HITCH_MS).toBe(50);
    expect(p.hitches).toBe(2);
    expect(p.worstMs).toBe(130);
    expect(p.worstFrame).toBe(4);
    expect(p.hitchReport()).toEqual({ hitches: 2, worstMs: 130, worstFrame: 4, frames: 7, hitchMs: 50 });
    p.resetHitches();
    expect(p.hitchReport()).toEqual({ hitches: 0, worstMs: 0, worstFrame: -1, frames: 0, hitchMs: 50 });
    p.frame(20);
    expect(p.hitchReport()).toMatchObject({ hitches: 0, worstMs: 20, worstFrame: 0, frames: 1 });
  });
});
