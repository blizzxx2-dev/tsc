import { describe, expect, it } from 'vitest';
import { RUNE_FADE_S, RuneScars } from '../../../src/render/runeScars';
import type { Gfx } from '../../../src/render/gfx';
import { Sigil, SIGILS } from '../../../src/surgery/entities';
import { at } from '../../harness';

const gfx = (calls: string[]) => new Proxy({}, { get: (_t, k) => () => void calls.push(String(k)) }) as unknown as Gfx;

describe('hostile-spell residue (ENG-0266)', () => {
  it('scars glow under live sigils, pulse with world time, and fade after a dispel', () => {
    const sigil = new Sigil(at(0, 0), SIGILS.eye, 60, 5);
    const runes = new RuneScars();
    const calls: string[] = [];
    runes.draw(gfx(calls), [sigil], 0);
    expect(calls.filter((c) => c === 'line').length).toBe(sigil.segs.length * 2);
    expect(RuneScars.pulse(0.1)).not.toBeCloseTo(RuneScars.pulse(0.4), 2);
    expect(RuneScars.pulse(0.1, true)).toBe(RuneScars.pulse(0.4, true));
    sigil.kill();
    runes.dispelled(sigil, 5);
    calls.length = 0;
    runes.draw(gfx(calls), [sigil], 5 + RUNE_FADE_S / 2);
    expect(calls.filter((c) => c === 'line').length).toBe(sigil.segs.length * 2);
    calls.length = 0;
    runes.draw(gfx(calls), [], 5 + RUNE_FADE_S + 0.01);
    expect(calls.filter((c) => c === 'line')).toHaveLength(0);
  });
});
