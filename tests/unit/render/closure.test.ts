import { describe, expect, it } from 'vitest';
import { CLOSE_S, Closures } from '../../../src/render/closure';
import type { Gfx } from '../../../src/render/gfx';
import { Laceration } from '../../../src/surgery/entities';
import { at, Hand, start, wait } from '../../harness';

describe('suture closure (ENG-0112)', () => {
  it('a stitched cut erodes along the thread over 0.4 s and leaves its scar', () => {
    let lac!: Laceration;
    const op = start(() => [(lac = new Laceration(at(0, 0), 0, 100, 0.2)), new Laceration(at(0, 150), 0, 30, 0.1)]);
    const closures = new Closures();
    op.events.on('death', ({ entity }) => closures.closed(entity, op.elapsed));
    const zig = Array.from({ length: 9 }, (_, i) => at(-45 + i * 11, i % 2 ? 22 : -22));
    const hand = new Hand(op);
    for (let i = 0; i < 6 && lac.alive; i++) hand.drag('thread', zig, 300);
    wait(op, 0.02);
    expect(lac.alive).toBe(false);
    expect(closures.active).toBe(1);
    expect(op.scars.length).toBeGreaterThan(0);
    const half = Closures.remaining(lac.a, lac.b, CLOSE_S / 2)!;
    expect(half[0].x).toBeCloseTo((lac.a.x + lac.b.x) / 2);
    expect(Closures.remaining(lac.a, lac.b, CLOSE_S)).toBeNull();
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => () => void calls.push(String(k)) }) as unknown as Gfx;
    closures.draw(g, op.elapsed + CLOSE_S + 0.01);
    expect(closures.active).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('a cut that simply left the field (salved) gets no closure', () => {
    const op = start(() => [new Laceration(at(0, 0), 0, 30, 0.2)]);
    const closures = new Closures();
    closures.closed(op.entities[0], 0);
    expect(closures.active).toBe(0);
  });
});
