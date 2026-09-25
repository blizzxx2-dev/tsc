import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { LATER_CHAPTERS } from './later';
import type { StoryDef } from './story';
import { gateChapters } from '../platform/gating';
import { EDITION } from '../platform/build';

export type Step = { kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef };

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
}

/**
 * Chapters I–II are the demo; III–V (LATER_CHAPTERS) complete the campaign. The later chapters
 * sit behind the compile-time edition so demo bundles tree-shake them out (PLT-0057), and the
 * edition gate filters what the player may reach (PLT-0058).
 */
export const CAMPAIGN: readonly Chapter[] = gateChapters<Chapter>([CHAPTER_1, CHAPTER_2, ...(EDITION === 'full' ? LATER_CHAPTERS : [])]);

export const allOperations = (): OperationDef[] =>
  CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

/** Every chapter regardless of edition — for tests and tools (tree-shaken out of shipped bundles). */
export const FULL_CAMPAIGN: readonly Chapter[] = [CHAPTER_1, CHAPTER_2, ...LATER_CHAPTERS];

export const allCampaignOperations = (): OperationDef[] =>
  FULL_CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
