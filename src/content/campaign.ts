import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { CHAPTER_3 } from './chapter3';
import { CHAPTER_4 } from './chapter4';
import { CHAPTER_5 } from './chapter5';
import type { StoryDef } from './story';

export type Step = { kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef };

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
}

/** The demo ships Chapters I–II of the planned five. */
export const CAMPAIGN: readonly Chapter[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5];

export const allOperations = (): OperationDef[] =>
  CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
