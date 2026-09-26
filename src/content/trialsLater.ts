/**
 * The Chapter III–V story operations the Trials of the Guild remix (CON-0201). Kept apart from
 * trials.ts so demo bundles, where `EDITION` is `demo`, drop these chapters entirely.
 */
import type { OperationDef } from '../surgery/operation';
import { BOSS_RUSH } from './bossRush';
import { OP_3_6 } from './chapter3';
import { OP_4_1, OP_4_8 } from './chapter4';
import { OP_5_1, OP_5_5 } from './chapter5';
import { OP_3_10, OP_3_11, OP_4_7, OP_4_9, OP_5_6, OP_5_8 } from './ops/hours';

export const LATER_TRIAL_BASES = {
  pieman: OP_3_6,
  gorget: OP_4_1,
  stoneBride: OP_4_8,
  choirThroat: OP_5_1,
  hexstoneShot: OP_5_5,
  prime: OP_3_10,
  terce: OP_3_11,
  sext: OP_4_7,
  none: OP_4_9,
  vespers: OP_5_6,
  compline: OP_5_8,
  rush: BOSS_RUSH,
} satisfies Record<string, OperationDef>;

export type LaterTrialBase = keyof typeof LATER_TRIAL_BASES;
