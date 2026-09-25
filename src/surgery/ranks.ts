import type { OperationDef } from './operation';

/**
 * Rank thresholds per operation, recalibrated after the slow-play farming fix
 * (`CALIBRATE=1 npx vitest run tests/balance.test.ts`, fast bot at think 0.9,
 * S = 97 % of its score, A = 80 % of S, B = 60 % of S). Content files keep
 * their original `ranks` as a fallback for operations not listed here.
 */
export const RANK_TABLE: Record<string, { S: number; A: number; B: number }> = {};

export function rankThresholds(def: OperationDef): { S: number; A: number; B: number } {
  return RANK_TABLE[def.id] ?? def.ranks;
}
