import { describe, expect, it } from 'vitest';
import { clawRake } from '../../../src/content/ops/ch2';
import { makeEntities } from '../../../src/content/schema';
import { Laceration } from '../../../src/surgery/entities';
import { at, Hand, running } from '../../harness-gameplay';

describe('CON-0056: claw rakes, three parallel cuts', () => {
  it('a zig-zag along the middle cut stitches it and leaves its neighbours alone', () => {
    const op = running((o) => clawRake(0, 0, 0, 90).flatMap((s) => makeEntities(s, o)));
    const [a, mid, c] = op.entities.filter((e): e is Laceration => e instanceof Laceration).sort((p, q) => p.pos.y - q.pos.y);
    const h = new Hand(op);
    const zig = [];
    for (let x = -50; x <= 50; x += 10) zig.push(at(x, mid.pos.y - 410 + ((x / 10) % 2 === 0 ? -8 : 8)));
    for (let pass = 0; pass < 3 && mid.alive; pass++) h.drag('thread', pass % 2 ? [...zig].reverse() : zig, 250);
    expect(mid.alive).toBe(false);
    expect(a.alive).toBe(true);
    expect(c.alive).toBe(true);
  });
});
