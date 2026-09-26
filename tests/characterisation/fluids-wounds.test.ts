/** QAT-0034 BloodPool and QAT-0035 Laceration characterisation. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { OP_2_1 } from '../../src/content/chapter2';
import { BloodPool, Laceration, SALVE_MAX } from '../../src/surgery/entities';
import type { Operation } from '../../src/surgery/operation';
import { DEFAULT_TUNING } from '../../src/surgery/tuning';
import { holdAt, live, raster, step, strokePath, zigzag } from '../helpers/sim';
import { scenario } from '../helpers/trace';

describe('BloodPool', () => {
  it.each(['blood', 'pus', 'blackbile'] as const)('the leech drains %s and rates COOL "Drained" (within 1.5 s) for a pool that started at r ≥ 20', (ichor) => {
    const { op, ents, trace } = scenario(() => [new BloodPool(at(0, 0), 30, ichor)]);
    holdAt(op, 'leech', at(0, 0), 1.4);
    trace.note('after leech', { stains: op.stains.length });
    expect(ents[0].alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(op.stains.length).toBe(ichor === 'blood' ? 1 : 0);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a pool that started below r 20 drains without a rating', () => {
    const { op, ents, trace } = scenario(() => [new BloodPool(at(0, 0), 15)]);
    holdAt(op, 'leech', at(0, 0), 1);
    trace.note('after leech');
    expect(ents[0].alive).toBe(false);
    expect(op.counts).toEqual({ cool: 0, good: 0, bad: 0, miss: 0 });
    expect(trace.text()).toMatchSnapshot();
  });

  it('a pool that grew past 20 counts as big', () => {
    const { op, ents, trace } = scenario(() => [new BloodPool(at(0, 0), 10)]);
    ents[0].grow(15);
    holdAt(op, 'leech', at(0, 0), 1.4);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('Laceration', () => {
  const stitch = (op: Operation, lac: Laceration, crossings = lac.stitch.needed) =>
    strokePath(op, 'thread', zigzag(lac.a, lac.b, 26, crossings), { speed: 380 });

  it('stitching while flooded says "flooded" and makes no progress', () => {
    const { op, ents, trace } = scenario(() => [new Laceration(at(0, 0), 0.3, 100, 0), new BloodPool(at(0, 0), 45)]);
    stitch(op, ents[0] as Laceration);
    trace.note('after stitching into the pool', { count: (ents[0] as Laceration).stitch.count });
    expect((ents[0] as Laceration).stitch.count).toBe(0);
    expect(op.flags.has('flooded')).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a one-stroke stitch rates COOL "Stitched" and leaves a scar', () => {
    const { op, ents, trace } = scenario(() => [new Laceration(at(0, 0), 0.3, 120, 0)]);
    const lac = ents[0];
    expect(lac.stitch.needed).toBe(Math.max(2, Math.ceil(120 / DEFAULT_TUNING.stitch.pxPerStitch)));
    stitch(op, lac);
    trace.note('after stitching');
    expect(lac.alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(op.scars).toHaveLength(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a two-stroke stitch rates GOOD "Stitched"', () => {
    const { op, ents, trace } = scenario(() => [new Laceration(at(0, 0), 0.3, 120, 0)]);
    const lac = ents[0];
    const zz = zigzag(lac.a, lac.b, 26, lac.stitch.needed * 2);
    strokePath(op, 'thread', zz.slice(0, 4));
    strokePath(op, 'thread', zz.slice(3));
    trace.note('after two strokes');
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it(`nicks up to SALVE_MAX (${SALVE_MAX}) are sealed by salve: GOOD "Sealed"`, () => {
    const { op, ents, trace } = scenario(() => [new Laceration(at(0, 0), 0.9, SALVE_MAX, 0), new Laceration(at(-200, 0), 0.9, SALVE_MAX + 1, 0)]);
    const [nick, long] = ents;
    expect(nick.small).toBe(true);
    expect(long.small).toBe(false);
    strokePath(op, 'salve', raster(nick.pos, nick.length / 2 + 6), { speed: 900 });
    strokePath(op, 'salve', raster(long.pos, long.length / 2 + 6), { speed: 900 });
    trace.note('after salving both');
    expect(nick.alive).toBe(false);
    expect(long.alive).toBe(true);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('bleeding feeds a pool at the wound over time', () => {
    const { op, trace } = scenario(() => [new Laceration(at(0, 0), 0.3, 100, 1)]);
    step(op, 10);
    const pools = live(op, BloodPool);
    trace.note('after 10 s', { pools: pools.length, r: pools.map((p) => Math.round(p.r)) });
    expect(pools.length).toBeGreaterThan(0);
    expect(trace.text()).toMatchSnapshot();
  });

  it('op2-1 claw rakes: three parallel lacerations, each stitched in one stroke', () => {
    // The grave-dirt riding in with them (CON-0058) is tests/unit/content/graveDirt.test.ts's.
    const { op, ents, trace } = scenario((o) => OP_2_1.phases[2].spawn(o).filter((e): e is Laceration => e instanceof Laceration));
    expect(ents).toHaveLength(3);
    expect(ents.map((l) => l.length)).toEqual([86, 100, 86]);
    for (const lac of ents) {
      for (const pool of live(op, BloodPool)) holdAt(op, 'leech', pool.pos, 1);
      stitch(op, lac);
    }
    trace.note('after the rakes');
    expect(ents.every((l) => !l.alive)).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});
