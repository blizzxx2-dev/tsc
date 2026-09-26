/** CON-0058: grave-dirt on the Gravehound's rakes — leech it out; salve over it is BAD and festers. */
import { describe, expect, it } from 'vitest';
import { OP_2_1 } from '../../../src/content/ops/ch2';
import { GRAVE_DIRT, GraveDirt } from '../../../src/surgery/ailments/graveDirt';
import { Laceration, Rot } from '../../../src/surgery/entities';
import { at, Hand, running } from '../../harness-gameplay';

describe('grave-dirt (CON-0058)', () => {
  it('op2-1 carries two spots of it in with the claw rakes', () => {
    const op = running(() => []);
    const spawned = OP_2_1.phases[2].spawn?.(op) ?? [];
    expect(spawned.filter((e) => e instanceof GraveDirt)).toHaveLength(2);
  });

  it('the leech draws it out — GOOD', () => {
    const op = running((o) => [new GraveDirt(at(0, 0), o)]);
    const dirt = op.entities[0] as GraveDirt;
    new Hand(op).hold('leech', dirt.pos, GRAVE_DIRT.leech + 0.2);
    expect(dirt.alive).toBe(false);
    expect(op.counts.good).toBe(1);
  });

  it('salve over it seals it in — BAD and harm at once, and rot where it was a few seconds later', () => {
    // A rake far off keeps the phase open.
    const op = running((o) => [new GraveDirt(at(0, 0), o), new Laceration(at(200, 60), 0, 60, 0.4)]);
    const dirt = op.entities[0] as GraveDirt;
    const before = op.vitals;
    const h = new Hand(op);
    h.hold('salve', dirt.pos, 0.5);
    h.release();
    expect(op.counts.bad).toBe(1);
    expect(op.vitals).toBeLessThan(before);
    expect(op.entities.some((e) => e instanceof Rot && e.alive)).toBe(false);
    h.idle(GRAVE_DIRT.festerAfter + 0.1);
    expect(dirt.alive).toBe(false);
    expect(op.entities.some((e) => e instanceof Rot && e.alive)).toBe(true);
  });
});
