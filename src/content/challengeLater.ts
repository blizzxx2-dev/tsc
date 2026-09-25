/**
 * The story operations the Chapter III–V X-ops remix (GAM-0215). Kept apart from
 * challenge.ts so demo bundles, where `EDITION` is `demo`, drop these chapters entirely.
 */
import type { OperationDef } from '../surgery/operation';
import { OP_3_10, OP_3_11 } from './chapter3';
import { OP_4_7, OP_4_9 } from './chapter4';
import { OP_5_6, OP_5_8 } from './chapter5';

export const LATER_X_BASES: Readonly<Record<'x3' | 'x4' | 'x5' | 'x6' | 'x7' | 'x8', OperationDef>> = {
  x3: OP_3_10,
  x4: OP_3_11,
  x5: OP_4_7,
  x6: OP_4_9,
  x7: OP_5_6,
  x8: OP_5_8,
};
