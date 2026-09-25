/** QAT-0050: save helpers — defaults, best-result ordering and monotonic progress. */
import { describe, expect, it } from 'vitest';
import { advance, fresh, recordBest } from '../../../src/core/save';
import { SAVE_VERSION } from '../../../src/core/save/schema';
import type { Rank } from '../../../src/surgery/types';

describe('fresh()', () => {
  it('returns current-version defaults with a fresh campaign', () => {
    const d = fresh();
    expect(d.version).toBe(SAVE_VERSION);
    expect(d.progress).toEqual({ chapter: 0, step: 0 });
    expect(d.best).toEqual({});
  });

  it('returns a new object each time', () => {
    const a = fresh();
    a.best.x = { rank: 'S', score: 1 };
    a.progress.step = 4;
    expect(fresh().best).toEqual({});
    expect(fresh().progress.step).toBe(0);
  });
});

describe('recordBest()', () => {
  const ORDER: Rank[] = ['C', 'B', 'A', 'S', 'XS'];

  it('stores the first result and reports it as a new best', () => {
    const d = fresh();
    expect(recordBest(d, 'op1-1', 'B', 2000)).toBe(true);
    expect(d.best['op1-1']).toEqual({ rank: 'B', score: 2000 });
  });

  it('ranks XS > S > A > B > C regardless of score', () => {
    for (let i = 0; i < ORDER.length; i++) {
      for (let j = 0; j < ORDER.length; j++) {
        const d = fresh();
        recordBest(d, 'op', ORDER[i], 5000);
        const better = j > i;
        expect(recordBest(d, 'op', ORDER[j], 100), `${ORDER[i]} then ${ORDER[j]}`).toBe(better);
        expect(d.best.op.rank).toBe(better ? ORDER[j] : ORDER[i]);
      }
    }
  });

  it('at equal rank keeps the higher score and only reports strictly higher scores', () => {
    const d = fresh();
    recordBest(d, 'op', 'A', 3000);
    expect(recordBest(d, 'op', 'A', 2999)).toBe(false);
    expect(recordBest(d, 'op', 'A', 3000)).toBe(false);
    expect(d.best.op).toEqual({ rank: 'A', score: 3000 });
    expect(recordBest(d, 'op', 'A', 3001)).toBe(true);
    expect(d.best.op).toEqual({ rank: 'A', score: 3001 });
  });

  it('keeps results per operation', () => {
    const d = fresh();
    recordBest(d, 'op1-1', 'S', 4000);
    recordBest(d, 'op1-2', 'C', 10);
    expect(Object.keys(d.best).sort()).toEqual(['op1-1', 'op1-2']);
  });
});

describe('advance()', () => {
  it('moves forward within and across chapters', () => {
    const d = fresh();
    advance(d, 0, 3);
    expect(d.progress).toEqual({ chapter: 0, step: 3 });
    advance(d, 1, 0);
    expect(d.progress).toEqual({ chapter: 1, step: 0 });
  });

  it('never regresses progress', () => {
    const d = fresh();
    advance(d, 1, 4);
    advance(d, 1, 2);
    advance(d, 0, 9);
    advance(d, 1, 4);
    expect(d.progress).toEqual({ chapter: 1, step: 4 });
  });
});
