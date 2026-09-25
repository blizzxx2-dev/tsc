import type { OperationDef } from '../surgery/operation';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { LATER_CHAPTERS } from './later';
import type { StoryDef } from './story';
import { evalCondition, type FlagCondition, type FlagReader } from './flags';
import { gateChapters } from '../platform/gating';
import { EDITION } from '../platform/build';

/**
 * A campaign step (CON-0007): a story scene or an operation, optionally a branch node — a step
 * with an `if` is played only when the condition holds against the campaign flags and is skipped
 * otherwise. Steps keep their index in the chapter either way, so save positions and the
 * carry-over content-id table are unaffected; a linear chapter is simply one with no `if`s.
 */
export type Step = ({ kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef }) & { if?: FlagCondition };

/** A chapter's flag contract (NAR-0116, NAR-0131, NAR-0145): audited by tests/unit/content/flags.test.ts. */
export interface ChapterFlags {
  /** Flags the chapter's lines, steps or aftermaths read. */
  reads: readonly string[];
  /** Flags the chapter's choices or operations write. */
  writes: readonly string[];
}

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  steps: readonly Step[];
  flags?: ChapterFlags;
}

export const stepId = (s: Step): string => (s.kind === 'op' ? s.op.id : s.story.id);

/** Whether a step is on this player's path. */
export const stepOpen = (s: Step, f: FlagReader): boolean => !s.if || evalCondition(s.if, f);

/** Index of the first step at or after `from` that is open, or `steps.length` when none is. */
export function nextOpenStep(ch: Chapter, from: number, f: FlagReader): number {
  let i = Math.max(0, from);
  while (i < ch.steps.length && !stepOpen(ch.steps[i], f)) i++;
  return i;
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
