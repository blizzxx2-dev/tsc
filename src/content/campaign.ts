import type { OperationDef } from '../surgery/operation';
import type { TriageScenario } from '../surgery/triage';
import { CHAPTER_1 } from './chapter1';
import { CHAPTER_2 } from './chapter2';
import { LATER_CHAPTERS } from './later';
import type { Backdrop, StoryDef } from './story';
import type { InterviewDef, InterviewResult, InterviewSession } from '../surgery/interview';
import type { FlagRecord } from '../core/save/schema';
import { evalCondition, type FlagCondition, type FlagReader } from './flags';
import { gateChapters } from '../platform/gating';
import { EDITION } from '../platform/build';

/**
 * A campaign step (CON-0007): a story scene or an operation, optionally a branch node — a step
 * with an `if` is played only when the condition holds against the campaign flags and is skipped
 * otherwise. Steps keep their index in the chapter either way, so save positions and the
 * carry-over content-id table are unaffected; a linear chapter is simply one with no `if`s.
 */
export type Step = ({ kind: 'story'; story: StoryDef } | { kind: 'op'; op: OperationDef } | { kind: 'discipline'; discipline: DisciplineStepDef }) & { if?: FlagCondition };

/**
 * A step in one of the other disciplines (CON-0247): an interview (CON-0231), a forensic
 * examination (CON-0241) or a field triage (CON-0226). Bone-setting cases are operations. The
 * interview may be built from the flags when the step starts.
 */
export interface DisciplineStepDef {
  id: string;
  title: string;
  place: string;
  backdrop: Backdrop;
  mode: 'interview' | 'forensic' | 'triage';
  /** The interview or forensic examination (modes `interview`, `forensic`). */
  interview?: InterviewDef | ((f: FlagReader) => InterviewDef);
  /** The field (mode `triage`, CON-0226): its saved count is written to `savedFlag`. */
  triage?: TriageScenario;
  savedFlag?: string;
  /** Flags to write from the finished session, beyond the conclusion's own. */
  after?: (result: InterviewResult, session: InterviewSession) => FlagRecord;
  /** The flags `after` writes (for the flag audit). */
  writes?: readonly string[];
}

/** Every flag a discipline step can write: its conclusions' and its `after`'s. */
export function disciplineWrites(d: DisciplineStepDef, f: FlagReader): string[] {
  const keys = new Set<string>(d.writes ?? []);
  if (d.savedFlag) keys.add(d.savedFlag);
  if (d.mode === 'triage') return [...keys];
  for (const c of interviewOf(d, f).conclusions) for (const k of Object.keys(c.flags ?? {})) keys.add(k);
  return [...keys];
}

/** The interview a discipline step plays, resolved against the flags. */
export function interviewOf(d: DisciplineStepDef, f: FlagReader): InterviewDef {
  if (!d.interview) throw new Error(`discipline ${d.id} has no interview`);
  return typeof d.interview === 'function' ? d.interview(f) : d.interview;
}

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

export const stepId = (s: Step): string => (s.kind === 'op' ? s.op.id : s.kind === 'discipline' ? s.discipline.id : s.story.id);

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
