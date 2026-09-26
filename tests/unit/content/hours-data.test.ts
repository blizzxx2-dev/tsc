/** CON-0133/0137/0163/0170/0191/0200: the late Hours are data, with their tips, ranks and checkpoints. */
import { describe, expect, it } from 'vitest';
import { OP_3_10, OP_3_11, OP_4_7, OP_4_9, OP_5_6, OP_5_8 } from '../../../src/content/ops/hours';
import { opData, validateOp } from '../../../src/content/schema';
import { ComplineMalison } from '../../../src/surgery/bosses/compline';
import { Operation } from '../../../src/surgery/operation';
import { RANK_TABLE } from '../../../src/surgery/ranks';
import { DT, wait } from '../../harness';

const HOURS = [OP_3_10, OP_3_11, OP_4_7, OP_4_9, OP_5_6, OP_5_8];

const boot = (opts: ConstructorParameters<typeof Operation>[1] = {}) => {
  const op = new Operation(OP_5_8, opts);
  while (op.status === 'intro') op.update(DT);
  wait(op, 0.2);
  return op;
};
const compline = (op: Operation) => op.entities.find((e): e is ComplineMalison => e instanceof ComplineMalison)!;

describe('the late Hours as data', () => {
  it('each is written as data, validates cleanly, and has a calibrated rank row and a time tip', () => {
    for (const def of HOURS) {
      const data = opData(def);
      expect(data, def.id).not.toBeNull();
      expect(validateOp(data!), def.id).toEqual([]);
      expect(RANK_TABLE[def.id], def.id).toBeDefined();
      expect(def.tips?.time?.length ?? 0, def.id).toBeGreaterThan(40);
      expect(def.tips?.time?.length ?? 0, def.id).toBeLessThanOrEqual(140);
    }
  });
});

describe('Compline checkpoints (CON-0200)', () => {
  it('a loss after the Litany is stolen offers stage 2; after the Great Silence begins, stage 3', () => {
    const op = boot();
    const c = compline(op);
    expect(c.stage).toBe(1);
    op.lose('test', 'vitals');
    expect(op.checkpointBossStage()).toBeNull();
    const op2 = boot();
    compline(op2).stage = 2;
    op2.lose('test', 'vitals');
    expect(op2.checkpointBossStage()).toBe(2);
    const op3 = boot();
    compline(op3).stage = 3;
    op3.lose('test', 'vitals');
    expect(op3.checkpointBossStage()).toBe(3);
  });

  it('a retry at stage 2 starts with the Litany stolen; at stage 3 in the Great Silence with it restored', () => {
    const two = compline(boot({ checkpoint: 0, bossStage: 2 }));
    expect(two.stage).toBe(2);
    expect(two.litanyStolen).toBe(true);
    const op = boot({ checkpoint: 0, bossStage: 3 });
    const three = compline(op);
    expect(three.stage).toBe(3);
    expect(three.litanyStolen).toBe(false);
    expect(op.litanyLocked).toBe(false);
    expect(three.hp).toBeCloseTo(three.maxHp * 0.35);
  });

  it('a fresh run ignores a stray bossStage without a checkpoint', () => {
    expect(compline(boot({ bossStage: 3 })).stage).toBe(1);
  });
});
