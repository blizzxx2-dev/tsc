import type { OperationDef } from './operation';

/**
 * Rank thresholds per operation, recalibrated after the slow-play farming fix
 * (`CALIBRATE=1 npx vitest run tests/balance.test.ts`: S = 96 % of the steady
 * bot's score, A = 80 % of S, B = 60 % of S). Content files keep
 * their original `ranks` as a fallback for operations not listed here.
 */
// Calibrated 2026-09-25 after the farming fix, the demo tool/ailment rules and the phased Malisons with their elites.
export const RANK_TABLE: Record<string, { S: number; A: number; B: number }> = {
  'op1-1': { S: 3960, A: 3170, B: 2380 },
  'op1-2': { S: 4390, A: 3510, B: 2630 },
  'op1-3': { S: 5260, A: 4210, B: 3160 },
  'op1-4': { S: 5810, A: 4650, B: 3490 },
  'op1-5': { S: 4100, A: 3280, B: 2460 },
  'op2-1': { S: 4840, A: 3870, B: 2900 },
  'op2-2': { S: 5660, A: 4530, B: 3400 },
  'op2-3': { S: 8510, A: 6810, B: 5110 },
  'op2-4': { S: 6100, A: 4880, B: 3660 },
  'op2-5': { S: 5390, A: 4310, B: 3230 },
  // Challenge X-ops (Master rules).
  'op1-5-x1': { S: 3150, A: 2520, B: 1890 },
  'op2-5-x2': { S: 3940, A: 3150, B: 2360 },
};

export function rankThresholds(def: OperationDef): { S: number; A: number; B: number } {
  return RANK_TABLE[def.id] ?? def.ranks;
}
