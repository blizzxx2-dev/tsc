/**
 * Narrative content that is not a campaign step (aftermath and failure scenes, barks, codex,
 * case notes…), flattened for the localisation export (`src/i18n/extract.ts`). Used by scripts
 * and tests only — never imported by game code, so it may reach Chapters III–V content directly.
 */
import type { ContentEntry } from '../i18n/extract';
import { CAST } from './characters';
import { conditionOf, describeWhen } from './conditions';
import { AFTERMATH, FAILURE } from './aftermath';
import { LATER_AFTERMATH } from './aftermath-later';
import type { StoryDef } from './story';
import { TUTORIALS } from './tutorials';

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Chapter id from an op or scene id: op2-3 → ch2, a3-1 → ch3. */
export const chapterOf = (id: string): string => {
  const m = /(\d)-/.exec(id);
  return m ? `ch${m[1]}` : 'global';
};

/** Line context shared with campaign scenes: speaker, position, and any variant condition. */
export function lineContext(s: StoryDef, i: number, what: string): string {
  const cond = conditionOf(s.lines[i]);
  return `${what} "${s.id}" (${s.place}), line ${i + 1} of ${s.lines.length}.${cond ? ` ${describeWhen(cond)}` : ''}`;
}

export function storyEntries(s: StoryDef, chapter: string, what: string): ContentEntry[] {
  const out: ContentEntry[] = [{ id: `${s.id}.place`, text: s.place, scope: 'story', chapter, context: `Place caption of ${what.toLowerCase()} "${s.id}".` }];
  s.lines.forEach((line, i) => {
    const id = `${s.id}.${pad3(i + 1)}`;
    const speaker = line.who === 'narrator' ? 'Narrator' : (line.as ?? CAST[line.who].name);
    out.push({ id, text: line.text, scope: 'story', chapter, speaker, context: lineContext(s, i, what) });
    if (line.as) out.push({ id: `${id}.as`, text: line.as, scope: 'names', chapter, context: `Speaker name shown for ${id}.` });
  });
  return out;
}

export function narrativeEntries(): ContentEntry[] {
  const out: ContentEntry[] = [];
  for (const [op, s] of Object.entries({ ...AFTERMATH, ...LATER_AFTERMATH })) out.push(...storyEntries(s, chapterOf(op), `Aftermath scene after ${op}`));
  for (const [op, s] of Object.entries(FAILURE)) out.push(...storyEntries(s, chapterOf(op), `Failure scene when the patient of ${op} dies, before the retry prompt`));
  for (const t of TUTORIALS)
    out.push({ id: `tutorial.${t.id}`, text: t.prompt, scope: 'callouts', chapter: chapterOf(t.firstOp), context: `Tutorial prompt, first shown in ${t.firstOp}. Keep {TOKENS} verbatim: they become key/button glyphs. Imperative, one instruction.` });
  return out;
}
