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
  'op2-1': { S: 4920, A: 3940, B: 2950 },
  'op2-2': { S: 6010, A: 4810, B: 3610 },
  'op2-3': { S: 8230, A: 6580, B: 4940 },
  'op2-4': { S: 6100, A: 4880, B: 3660 },
  'op2-5': { S: 5390, A: 4310, B: 3230 },
  // Chapters III–V (GAM-0156), calibrated 2026-09-26 with the late Hours as data.
  'op3-1': { S: 5240, A: 4190, B: 3140 },
  'op3-2': { S: 6200, A: 4960, B: 3720 },
  'op3-4': { S: 7670, A: 6140, B: 4600 },
  'op3-3': { S: 5350, A: 4280, B: 3210 },
  'op3-5': { S: 5070, A: 4060, B: 3040 },
  'op3-6': { S: 5220, A: 4180, B: 3130 },
  'op3-7': { S: 6590, A: 5270, B: 3950 },
  'op3-8': { S: 5950, A: 4760, B: 3570 },
  'op3-10': { S: 5890, A: 4710, B: 3530 },
  'op3-9': { S: 4540, A: 3630, B: 2720 },
  'op3-11': { S: 7260, A: 5810, B: 4360 },
  'op4-1': { S: 4840, A: 3870, B: 2900 },
  'op4-10': { S: 5200, A: 4160, B: 3120 },
  'op4-2': { S: 5400, A: 4320, B: 3240 },
  'op4-3': { S: 5820, A: 4660, B: 3490 },
  'op4-4': { S: 6490, A: 5190, B: 3890 },
  'op4-5': { S: 4430, A: 3540, B: 2660 },
  'op4-6': { S: 4380, A: 3500, B: 2630 },
  'op4-7': { S: 5720, A: 4580, B: 3430 },
  'op4-8': { S: 6410, A: 5130, B: 3850 },
  'op4-9': { S: 5790, A: 4630, B: 3470 },
  'op5-5': { S: 4900, A: 3920, B: 2940 },
  'op5-1': { S: 5010, A: 4010, B: 3010 },
  'op5-2': { S: 5110, A: 4090, B: 3070 },
  'op5-3': { S: 4840, A: 3870, B: 2900 },
  'op5-4': { S: 5630, A: 4500, B: 3380 },
  'op5-6': { S: 8400, A: 6720, B: 5040 },
  'op5-7': { S: 6020, A: 4820, B: 3610 },
  'op5-8': { S: 5610, A: 4490, B: 3370 },
  'op5-9': { S: 8950, A: 7160, B: 5370 },
  'op3-12': { S: 5310, A: 4250, B: 3190 }, // steady won 5534
  'op3-13': { S: 6420, A: 5140, B: 3850 }, // steady won 6688
  'op4-11': { S: 5390, A: 4310, B: 3230 }, // steady won 5618
  'op5-10': { S: 8830, A: 7060, B: 5300 }, // steady won 9202 (candle-lit)
  // The Trials of the Guild (CON-0203): calibrated by tests/sim/trials.test.ts.
  'trial-knives-t01': { S: 3310, A: 2650, B: 1990 },
  'trial-quiver-t02': { S: 5880, A: 4700, B: 3530 },
  'trial-goose-t03': { S: 3830, A: 3060, B: 2300 },
  'trial-gunsmiths-t04': { S: 6020, A: 4820, B: 3610 },
  'trial-tanners-t05': { S: 6750, A: 5400, B: 4050 },
  'trial-barrow-t06': { S: 5670, A: 4540, B: 3400 },
  'op1-5-t07': { S: 3670, A: 2940, B: 2200 },
  'op2-5-t08': { S: 4350, A: 3480, B: 2610 },
  'trial-seam-t09': { S: 5680, A: 4540, B: 3410 },
  'op3-6-t10': { S: 4380, A: 3500, B: 2630 },
  'op4-1-t11': { S: 4440, A: 3550, B: 2660 },
  'op1-5-t12': { S: 4040, A: 3230, B: 2420 },
  'op3-10-t13': { S: 5230, A: 4180, B: 3140 },
  'op3-11-t14': { S: 6660, A: 5330, B: 4000 },
  'op4-7-t15': { S: 5330, A: 4260, B: 3200 },
  'op4-8-t16': { S: 6340, A: 5070, B: 3800 },
  'op5-1-t17': { S: 4600, A: 3680, B: 2760 },
  'op5-6-t18': { S: 7890, A: 6310, B: 4730 },
  'op4-9-t19': { S: 5270, A: 4220, B: 3160 },
  'op5-8-t20': { S: 4910, A: 3930, B: 2950 },
  'op5-5-t21': { S: 4750, A: 3800, B: 2850 },
  'bossrush-t22': { S: 23450, A: 18760, B: 14070 },
  'op5-8-t23': { S: 5760, A: 4610, B: 3460 },
  'unsung-t24': { S: 6300, A: 5040, B: 3780 },
  'op3-12-d7': { S: 3870, A: 3100, B: 2320 },
  'op5-10-d8': { S: 8830, A: 7060, B: 5300 },
  // Challenge X-ops (Master rules).
  'op1-5-x1': { S: 3150, A: 2520, B: 1890 },
  'op2-5-x2': { S: 3940, A: 3150, B: 2360 },
};

export function rankThresholds(def: OperationDef): { S: number; A: number; B: number } {
  return RANK_TABLE[def.id] ?? def.ranks;
}
