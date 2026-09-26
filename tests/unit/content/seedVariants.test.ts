/** CON-0086: each demo op has three seeds; replays rotate through them, one step per clear. */
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../../../src/content/chapter1';
import { CHAPTER_2 } from '../../../src/content/chapter2';
import { OP_2_2 } from '../../../src/content/ops/ch2';
import { opData, validateOp } from '../../../src/content/schema';
import { freshProgress, recordRun } from '../../../src/surgery/progress';
import { seedFor } from '../../../src/surgery/session';

const demo = [CHAPTER_1, CHAPTER_2].flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

describe('seed variants (CON-0086)', () => {
  it('every demo op defines three distinct seeds, the first its own', () => {
    expect(demo).toHaveLength(10);
    for (const d of demo) {
      expect(d.seeds, d.id).toHaveLength(3);
      expect(d.seeds![0], d.id).toBe(d.seed);
      expect(new Set(d.seeds).size, d.id).toBe(3);
    }
  });

  it('the first play is on the op’s own seed; each clear steps on; a loss does not', () => {
    const p = freshProgress();
    const run = (won: boolean) => recordRun(p, { opId: OP_2_2.id, won, rank: 'B', score: 1, difficulty: 'surgeon', flags: [] });
    expect(seedFor(OP_2_2, p)).toBe(OP_2_2.seeds![0]);
    run(false);
    expect(seedFor(OP_2_2, p)).toBe(OP_2_2.seeds![0]);
    run(true);
    expect(seedFor(OP_2_2, p)).toBe(OP_2_2.seeds![1]);
    run(true);
    expect(seedFor(OP_2_2, p)).toBe(OP_2_2.seeds![2]);
    run(true);
    expect(seedFor(OP_2_2, p)).toBe(OP_2_2.seeds![0]);
  });

  it('the schema rejects a malformed seed list', () => {
    const bad = { ...opData(OP_2_2)!, seeds: [99, 1, 2] };
    expect(validateOp(bad).some((e) => e.includes('seeds'))).toBe(true);
  });
});
