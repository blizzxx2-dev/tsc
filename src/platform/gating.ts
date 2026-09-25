/**
 * Edition content gating (PLT-0058). The demo exposes Chapters I–II only: campaign, chapter select,
 * challenge mode and extras must route every list of content through these helpers.
 *
 * To keep Chapter III–V *code* out of demo bundles (PLT-0057), full-game chapters must be referenced
 * only behind the compile-time constant, e.g.
 *   const CH3_5 = EDITION === 'full' ? (await import('./chapter3to5')).CHAPTERS : [];
 * `scripts/check-demo-bundle.mjs` fails CI if a demo `dist/` contains any Chapter III+ module or id.
 */
import { EDITION_INFO } from './build';
import type { EditionInfo } from './editions';

export const chapterAllowed = (index: number, info: EditionInfo = EDITION_INFO): boolean => info.chapters.includes(index);

/** Keep only the chapters this edition may show. */
export function gateChapters<T>(chapters: readonly T[], info: EditionInfo = EDITION_INFO): T[] {
  return chapters.filter((_, i) => chapterAllowed(i, info));
}

/** Chapter index (0-based) encoded in an engine id (`op2-3`, `s1-end`) or stable id (`ch2.op3`), or null. */
export function chapterOfId(id: string): number | null {
  const m = /^(?:op|s)(\d+)-|^ch(\d+)\./.exec(id);
  if (!m) return null;
  return Number(m[1] ?? m[2]) - 1;
}

export function contentAllowed(id: string, info: EditionInfo = EDITION_INFO): boolean {
  const c = chapterOfId(id);
  return c === null ? id === 'prologue' : chapterAllowed(c, info);
}

/** Ids referenced by a profile that this edition must not expose (empty = clean). */
export function gatingViolations(profile: { best: Record<string, unknown>; progress: { chapter: number }; unlocks: string[] }, info: EditionInfo = EDITION_INFO): string[] {
  const bad = Object.keys(profile.best).filter((id) => !contentAllowed(id, info));
  const maxChapter = Math.max(...info.chapters);
  // `chapter === maxChapter + 1` is the legal "edition complete" position.
  if (profile.progress.chapter > maxChapter + 1) bad.push(`progress.chapter=${profile.progress.chapter}`);
  for (const u of profile.unlocks) if (/^ch\d+/.test(u) && !contentAllowed(u, info)) bad.push(`unlock:${u}`);
  return bad;
}
