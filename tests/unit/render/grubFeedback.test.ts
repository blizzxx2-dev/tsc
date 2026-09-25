/** GAM-0031 / GAM-0039 / GAM-0085: tongs, stitch and grub feedback — the thread's tension and knot, the grub's squeal and death-curl. */
import { describe, expect, it } from 'vitest';
import { clackPitch, EMBED_WEIGHT, squealVariant } from '../../../src/audio/director';
import { drawTongsJaws } from '../../../src/art/hud';
import { EVENTS } from '../../../src/audio/events';
import { RECIPES } from '../../../src/audio/sfx';
import type { FxEvent } from '../../../src/render/particles';
import { CURL_SECONDS, KNOT_SECONDS, Particles } from '../../../src/render/particles';
import type { Gfx } from '../../../src/render/gfx';
import { BloodPool, Grub, Laceration, LEECH_DROPS } from '../../../src/surgery/entities';
import { at, Hand, start } from '../../harness';

describe('GAM-0031 the tongs’ clack and grip', () => {
  it('the clack drops in pitch with the weight of the object; the jaws snap shut on a grab', () => {
    expect(clackPitch('shot')).toBeLessThan(clackPitch('bolt'));
    expect(clackPitch('bolt')).toBeLessThan(clackPitch('arrow'));
    expect(clackPitch('arrow')).toBeLessThan(clackPitch('glass'));
    for (const k of Object.keys(EMBED_WEIGHT) as (keyof typeof EMBED_WEIGHT)[]) expect(clackPitch(k)).toBeGreaterThan(0.5);
    const tips = (closed: boolean) => {
      const ends: number[] = [];
      const g = new Proxy({}, { get: (_t, k) => (_a: { y: number }, b: { y: number }) => k === 'line' && ends.push(b.y) }) as unknown as Gfx;
      drawTongsJaws(g, { x: 100, y: 100 }, closed);
      return Math.abs(ends[0] - ends[1]);
    };
    expect(tips(false)).toBeGreaterThan(12);
    expect(tips(true)).toBeLessThan(4);
  });
});

describe('GAM-0035 Leech-Pipe feedback', () => {
  it('suction droplets and the gurgle scale linearly with the current draw', () => {
    const drops = (offset: number) => {
      let pool!: BloodPool;
      const op = start(() => [(pool = new BloodPool(at(0, 0), 60)), new Laceration(at(300, 100), 0, 30, 0.1)]);
      let n = 0;
      let flow = 0;
      op.events.on('fx', (e) => {
        if (e.kind !== 'suck') return;
        n += e.n;
        flow = pool.flow;
      });
      new Hand(op).hold('leech', at(offset, 0), 0.5);
      return { n: n * 2, flow };
    };
    const centre = drops(0);
    const rim = drops(60);
    expect(centre.flow).toBeGreaterThan(rim.flow);
    expect(centre.n).toBeGreaterThan(rim.n);
    // Linear: droplets per second track LEECH_DROPS × flow.
    expect(centre.n).toBeGreaterThanOrEqual(Math.floor(LEECH_DROPS * centre.flow) - 2);
    expect(centre.n).toBeLessThanOrEqual(Math.ceil(LEECH_DROPS * centre.flow) + 1);
  });
});

describe('GAM-0039 thread tension and the knot', () => {
  it('a taut line runs from the last stitch to the needle, and a finished line ties off with a knot flourish', () => {
    const fx: FxEvent[] = [];
    let lac!: Laceration;
    const op = start(() => [(lac = new Laceration(at(0, 0), 0, 100, 0.2)), new Laceration(at(0, 150), 0, 30, 0.1)]);
    op.events.on('fx', (e) => fx.push(e));
    op.setTool('thread');
    const h = new Hand(op);
    const zig = Array.from({ length: 9 }, (_, i) => at(-45 + i * 11, i % 2 ? 22 : -22));
    h.drag('thread', zig.slice(0, 4), 300);
    // Mid-line: the thread from the last stitch to the cursor is drawn.
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => () => void calls.push(String(k)) }) as unknown as Gfx;
    op.cursor = at(0, 30);
    lac.stitch.draw(g, op);
    expect(lac.stitch.count).toBeGreaterThan(0);
    expect(calls.filter((c) => c === 'line').length).toBeGreaterThanOrEqual(lac.stitch.count);
    for (let i = 0; i < 4 && lac.alive; i++) h.drag('thread', zig, 300);
    expect(lac.alive).toBe(false);
    const knot = fx.find((e) => e.kind === 'knot');
    expect(knot).toBeDefined();
    const ps = new Particles();
    ps.spawn(knot!);
    ps.update(KNOT_SECONDS - 0.05, () => undefined);
    expect(ps.count).toBe(1);
    ps.update(0.1, () => undefined);
    expect(ps.count).toBe(0);
  });
});

describe('GAM-0085 grub feedback', () => {
  it('three squeal variants, picked by the op seed and the grub — the same on every replay', () => {
    expect(EVENTS['sfx.grub.squeal'].vars).toBe(3);
    expect(RECIPES['sfx.grub.squeal']).toBeDefined();
    const picks = new Set<number>();
    for (let id = 1; id <= 60; id++) picks.add(squealVariant(41, id));
    expect([...picks].sort()).toEqual([0, 1, 2]);
    expect(squealVariant(41, 7)).toBe(squealVariant(41, 7));
  });

  it('searing a grub curls it up for exactly 0.4 s', () => {
    const fx: FxEvent[] = [];
    let g!: Grub;
    const op = start((o) => [(g = new Grub(at(0, 0), o, 0))]);
    op.events.on('fx', (e) => fx.push(e));
    new Hand(op).hold('brand', g.pos, 1.2);
    expect(g.alive).toBe(false);
    const curl = fx.find((e) => e.kind === 'curl');
    expect(curl).toBeDefined();
    const ps = new Particles();
    ps.spawn(curl!);
    expect(ps.count).toBe(1);
    ps.update(CURL_SECONDS - 0.05, () => undefined);
    expect(ps.count).toBe(1);
    ps.update(0.1, () => undefined);
    expect(ps.count).toBe(0);
    expect(CURL_SECONDS).toBe(0.4);
  });
});
