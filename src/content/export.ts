/**
 * Narrative content that is not a campaign step (aftermath and failure scenes, barks, codex,
 * case notes…), flattened for the localisation export (`src/i18n/extract.ts`). Used by scripts
 * and tests only — never imported by game code, so it may reach Chapters III–V content directly.
 */
import type { ContentEntry } from '../i18n/extract';
import { CAST } from './characters';
import { describeLine } from './conditions';
import { AFTERMATH, FAILURE } from './aftermath';
import { LATER_AFTERMATH } from './aftermath-later';
import type { StoryDef } from './story';
import { FOOTNOTES } from './footnotes';
import { RECAPS } from './recaps';
import { TUTORIALS } from './tutorials';

const pad3 = (n: number) => String(n).padStart(3, '0');

/** Chapter id from an op or scene id: op2-3 → ch2, a3-1 → ch3. */
export const chapterOf = (id: string): string => {
  const m = /(\d)-/.exec(id);
  return m ? `ch${m[1]}` : 'global';
};

/** Line context shared with campaign scenes: speaker, position, and any variant condition. */
export function lineContext(s: StoryDef, i: number, what: string): string {
  const cond = describeLine(s.lines[i]);
  return `${what} "${s.id}" (${s.place}), line ${i + 1} of ${s.lines.length}.${cond ? ` ${cond}` : ''}`;
}

/** Reply options of a choice line (CON-0010): `<storyId>.<NNN>.o<k>`, spoken by Kreuzer. */
export function choiceEntries(s: StoryDef, i: number, chapter: string): ContentEntry[] {
  const line = s.lines[i];
  const id = `${s.id}.${pad3(i + 1)}`;
  return (line.choice ?? []).map((o, k) => ({
    id: `${id}.o${k + 1}`,
    text: o.text,
    scope: 'story',
    chapter,
    speaker: CAST.kreuzer.name,
    context: `Reply ${k + 1} of ${line.choice!.length} to the choice at ${id}; shown as a menu option, then in the backlog as Kreuzer's line.${o.set ? ` Sets ${Object.entries(o.set).map(([f, v]) => `\`${f}\` = ${JSON.stringify(v)}`).join(', ')}.` : ''}`,
  }));
}

export function storyEntries(s: StoryDef, chapter: string, what: string): ContentEntry[] {
  const out: ContentEntry[] = [{ id: `${s.id}.place`, text: s.place, scope: 'story', chapter, context: `Place caption of ${what.toLowerCase()} "${s.id}".` }];
  s.lines.forEach((line, i) => {
    const id = `${s.id}.${pad3(i + 1)}`;
    const speaker = line.who === 'narrator' ? 'Narrator' : (line.as ?? CAST[line.who].name);
    out.push({ id, text: line.text, scope: 'story', chapter, speaker, context: lineContext(s, i, what) });
    if (line.as) out.push({ id: `${id}.as`, text: line.as, scope: 'names', chapter, context: `Speaker name shown for ${id}.` });
    out.push(...choiceEntries(s, i, chapter));
  });
  return out;
}

export function narrativeEntries(): ContentEntry[] {
  const out: ContentEntry[] = [];
  for (const [op, s] of Object.entries({ ...AFTERMATH, ...LATER_AFTERMATH })) out.push(...storyEntries(s, chapterOf(op), `Aftermath scene after ${op}`));
  for (const [op, s] of Object.entries(FAILURE)) out.push(...storyEntries(s, chapterOf(op), `Failure scene when the patient of ${op} dies, before the retry prompt`));
  for (const t of TUTORIALS)
    out.push({ id: `tutorial.${t.id}`, text: t.prompt, scope: 'callouts', chapter: chapterOf(t.firstOp), context: `Tutorial prompt, first shown in ${t.firstOp}. Keep {TOKENS} verbatim: they become key/button glyphs. Imperative, one instruction.` });
  for (const [op, text] of Object.entries(FOOTNOTES)) out.push({ id: `footnote.${op}`, text, scope: 'story', chapter: chapterOf(op), context: `"Where are they now" line for the patient of ${op}, read after the chapter ends. Narration; wry, not cruel.` });
  for (const [ch, lines] of Object.entries(RECAPS))
    lines.forEach((text, k) => out.push({ id: `recap.${ch}.${pad3(k + 1)}`, text, scope: 'story', chapter: ch, context: `Chapter-select recap before ${ch} ("previously"), sentence ${k + 1} of 3. Narration.` }));
  return out;
}
