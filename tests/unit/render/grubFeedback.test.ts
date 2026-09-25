/** GAM-0039 / GAM-0085: stitch and grub feedback — the thread's tension and knot, the grub's squeal and death-curl. */
import { describe, expect, it } from 'vitest';
import { squealVariant } from '../../../src/audio/director';
import { EVENTS } from '../../../src/audio/events';
import { RECIPES } from '../../../src/audio/sfx';
import type { FxEvent } from '../../../src/render/particles';
import { CURL_SECONDS, KNOT_SECONDS, Particles } from '../../../src/render/particles';
import type { Gfx } from '../../../src/render/gfx';
import { Grub, Laceration } from '../../../src/surgery/entities';
import { at, Hand, start } from '../../harness';

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
