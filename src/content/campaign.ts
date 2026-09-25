import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import type { StoryDef } from './story';

export type Step = { kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef };

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
}

export const CAMPAIGN: readonly Chapter[] = [CHAPTER_1];

export const allOperations = (): OperationDef[] =>
  CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
