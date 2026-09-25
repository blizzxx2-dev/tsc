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
  'op2-4': { sigil: { lashHurt: 3 } },
};
