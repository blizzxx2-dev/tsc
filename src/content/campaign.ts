import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { LATER_CHAPTERS } from './later';
import type { StoryDef } from './story';

export type Step = { kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef };

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
}

/** Chapters I–II are the demo; III–V (LATER_CHAPTERS) complete the campaign. */
export const CAMPAIGN: readonly Chapter[] = [CHAPTER_1, CHAPTER_2, ...LATER_CHAPTERS];

export const allOperations = (): OperationDef[] =>
  CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
