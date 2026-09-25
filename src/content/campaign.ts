import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import type { StoryDef } from './story';
import { gateChapters } from '../platform/gating';

export type Step = { kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef };

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
}

/** The demo ships Chapters I–II of the planned five. */
export const CAMPAIGN: readonly Chapter[] = gateChapters<Chapter>([CHAPTER_1, CHAPTER_2]);

export const allOperations = (): OperationDef[] =>
  CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
