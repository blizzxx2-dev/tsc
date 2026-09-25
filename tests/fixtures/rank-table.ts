/**
 * Rank boundary table (QAT-0019). One table drives the rule test; the results screen shows
 * `op.rank()`, which this table pins down. Thresholds are relative to an op's `ranks` so the
 * table survives GAM retuning of individual operations.
 *
 * Current rule (src/surgery/operation.ts `rank()`): S/A/B inclusive at their thresholds;
 * XS needs score ≥ 1.05 × S and no BAD or MISS at all.
 */
import type { Rank } from '../../src/surgery/types';

export interface RankCase {
  label: string;
  /** Score as a function of the op's thresholds. */
  score: (r: { S: number; A: number; B: number }) => number;
  bad: number;
  miss: number;
  expected: Rank;
}

export const XS_FACTOR = 1.05;

export const RANK_TABLE: readonly RankCase[] = [
  { label: 'zero', score: () => 0, bad: 0, miss: 0, expected: 'C' },
  { label: 'one below B', score: (r) => r.B - 1, bad: 0, miss: 0, expected: 'C' },
  { label: 'exactly B', score: (r) => r.B, bad: 0, miss: 0, expected: 'B' },
  { label: 'one below A', score: (r) => r.A - 1, bad: 0, miss: 0, expected: 'B' },
  { label: 'exactly A', score: (r) => r.A, bad: 0, miss: 0, expected: 'A' },
  { label: 'one below S', score: (r) => r.S - 1, bad: 0, miss: 0, expected: 'A' },
  { label: 'exactly S, clean', score: (r) => r.S, bad: 0, miss: 0, expected: 'S' },
  { label: 'just under the XS line, clean', score: (r) => Math.ceil(r.S * XS_FACTOR) - 1, bad: 0, miss: 0, expected: 'S' },
  { label: 'on the XS line, clean', score: (r) => Math.ceil(r.S * XS_FACTOR), bad: 0, miss: 0, expected: 'XS' },
  { label: 'on the XS line, one BAD', score: (r) => Math.ceil(r.S * XS_FACTOR), bad: 1, miss: 0, expected: 'S' },
  { label: 'on the XS line, one MISS', score: (r) => Math.ceil(r.S * XS_FACTOR), bad: 0, miss: 1, expected: 'S' },
  { label: 'far above S, one BAD', score: (r) => r.S * 3, bad: 1, miss: 0, expected: 'S' },
  { label: 'exactly A with BADs', score: (r) => r.A, bad: 5, miss: 5, expected: 'A' },
];
