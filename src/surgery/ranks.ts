import type { OperationDef } from './operation';

/**
 * Rank thresholds per operation, recalibrated after the slow-play farming fix
 * (`CALIBRATE=1 npx vitest run tests/balance.test.ts`: S = 96 % of the steady
 * bot's score, A = 80 % of S, B = 60 % of S). Content files keep
 * their original `ranks` as a fallback for operations not listed here.
 */
// Calibrated 2026-09-25 after the farming fix and the demo tool/ailment rules.
export const RANK_TABLE: Record<string, { S: number; A: number; B: number }> = {
  'op1-1': { S: 3960, A: 3170, B: 2380 },
  'op1-2': { S: 4390, A: 3510, B: 2630 },
  'op1-3': { S: 5260, A: 4210, B: 3160 },
  'op1-4': { S: 5180, A: 4140, B: 3110 },
  'op1-5': { S: 5310, A: 4250, B: 3190 },
  'op2-1': { S: 4830, A: 3860, B: 2900 },
  'op2-2': { S: 5640, A: 4510, B: 3380 },
  'op2-3': { S: 6840, A: 5470, B: 4100 },
  'op2-4': { S: 5990, A: 4790, B: 3590 },
  'op2-5': { S: 6380, A: 5100, B: 3830 },
  // Challenge X-ops (Master rules).
  'op1-5-x1': { S: 4710, A: 3770, B: 2830 },
  'op2-5-x2': { S: 5520, A: 4420, B: 3310 },
};

export function rankThresholds(def: OperationDef): { S: number; A: number; B: number } {
  return RANK_TABLE[def.id] ?? def.ranks;
}
