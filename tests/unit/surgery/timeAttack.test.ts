import { beforeEach, describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../../src/content/campaign';
import type { OperationDef } from '../../../src/surgery/operation';
import { formatSplit, ghostAt, GHOST_STEP, recordTimeAttack, resetTimeAttack, TimeAttackClock, timeAttackBest } from '../../../src/surgery/timeAttack';
import { DT, makeOp, start } from '../../helpers/sim';

const firstOp = (): OperationDef => {
  for (const ch of CAMPAIGN) for (const s of ch.steps) if (s.kind === 'op') return s.op;
  throw new Error('no op');
};

describe('time attack (GAM-0217)', () => {
  beforeEach(() => resetTimeAttack());

  it('clocks only the live operation and samples vitals every GHOST_STEP', () => {
    const op = makeOp(firstOp());
    const clock = new TimeAttackClock();
    clock.tick(op, 1); // intro: not counted
    expect(clock.time).toBe(0);
    start(op);
    for (let i = 0; i < 180; i++) {
      op.update(DT);
      clock.tick(op, DT);
    }
    expect(clock.time).toBeCloseTo(3, 5);
    expect(clock.vitals.length).toBeGreaterThanOrEqual(Math.floor(3 / GHOST_STEP));
    for (const v of clock.vitals) expect(v).toBeGreaterThan(0);
  });

  it('keeps only the fastest clear, and the ghost interpolates its trace', () => {
    expect(timeAttackBest('op1-1')).toBeNull();
    expect(recordTimeAttack('op1-1', { time: 90, vitals: [1, 0.5] })).toBe(true);
    expect(recordTimeAttack('op1-1', { time: 95, vitals: [1] })).toBe(false);
    expect(recordTimeAttack('op1-1', { time: 80, vitals: [1, 0.8, 0.6] })).toBe(true);
    const best = timeAttackBest('op1-1')!;
    expect(best.time).toBe(80);
    expect(ghostAt(best, GHOST_STEP / 2)).toBeCloseTo(0.9);
    expect(ghostAt(best, 999)).toBeCloseTo(0.6);
    expect(formatSplit(83.456)).toBe('1:23.46');
  });
});
