import type { TuningOverride } from './tuning';

/**
 * Per-operation tuning passes for the demo (GAM-0191…0198), kept beside the
 * sim so balance changes never touch story content. Merged over the defaults
 * and under any `OperationDef.tuning` the content itself declares.
 * Each entry is justified by the balance sweep (tests/balance.test.ts).
 */
export const OP_TUNING: Record<string, TuningOverride> = {
  // The Silenced Cantor: three sigils lashing every 4.5 s on a patient who starts at 80;
  // lashes bite a little less here so a steady hand keeps him above the red.
  // The Barbed Shaft (GAM-0192): this op teaches the barb nick, so ripping the barbs out unnicked
  // tears deep (35 vitals, not 8) — a sloppy surgeon still saves Pieter, but at B or C, never A.
  'op1-2': { tongs: { tornHurt: 35 } },
  'op2-4': { sigil: { lashHurt: 3 } },
  // The Hour of Terce (BOS-0067): the flame-fronts are salved over and over, so the salve pot is
  // deeper (46 → 70) and refills sooner (3 s → 2 s idle) — pressure comes from the leaps, not the pot.
  'op3-11': { salve: { capacity: 70, refillIdle: 2 } },
};
