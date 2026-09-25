/**
 * Story and operation content stays English at runtime, but every player-facing
 * line is addressable by a stable id so it can be exported for translation,
 * voiced and subtitled under one id (docs/loc/keys.md):
 *
 *   <storyId>.place            place caption of a story scene
 *   <storyId>.<NNN>            story line NNN (1-based, 3 digits), e.g. s1-2.014
 *   <storyId>.<NNN>.as         speaker-name override on that line
 *   <opId>.title|patient|diagnosis
 *   <opId>.p<phase>.<n>        assistant callout n of a phase (0-based phase), e.g. op1-2.p0.1
 *   chapter.<id>.title
 *   char.<id>.name|title
 *
 * Simulation barks (say/sayOnce literals in src/surgery) are added by the
 * export script, which scans the source with the TypeScript compiler API.
 */
import { CAMPAIGN } from '../content/campaign';
import { CAST, type CharacterId } from '../content/characters';
import { describeLine } from '../content/conditions';
import { choiceEntries, narrativeEntries } from '../content/export';

export type Scope = 'story' | 'callouts' | 'ops' | 'names' | 'barks';

export interface ContentEntry {
  id: string;
  text: string;
  scope: Scope;
  /** Chapter id (ch1, ch2…) or 'global'. */
  chapter: string;
  speaker?: string;
  /** Translator-facing context. */
  context: string;
}

const pad3 = (n: number) => String(n).padStart(3, '0');

export function contentEntries(): ContentEntry[] {
  const out: ContentEntry[] = [];
  for (const [id, c] of Object.entries(CAST) as [CharacterId, (typeof CAST)[CharacterId]][]) {
    if (c.name && c.name !== '???') out.push({ id: `char.${id}.name`, text: c.name, scope: 'names', chapter: 'global', context: 'Character name plate. Proper-name policy applies (docs/loc/style-guide.md).' });
    if (c.title) out.push({ id: `char.${id}.title`, text: c.title, scope: 'names', chapter: 'global', context: `Epithet of ${c.name}.` });
  }
  for (const ch of CAMPAIGN) {
    out.push({ id: `chapter.${ch.id}.title`, text: ch.title, scope: 'names', chapter: ch.id, context: `Title of Chapter ${ch.numeral}. Canonical-hour names follow the termbase.` });
    for (const step of ch.steps) {
      if (step.kind === 'story') {
        const s = step.story;
        out.push({ id: `${s.id}.place`, text: s.place, scope: 'story', chapter: ch.id, context: 'Place and time caption at the top-left of the scene.' });
        s.lines.forEach((line, i) => {
          const id = `${s.id}.${pad3(i + 1)}`;
          const who = CAST[line.who];
          const speaker = line.who === 'narrator' ? 'Narrator' : (line.as ?? who.name);
          const cond = describeLine(line);
          out.push({ id, text: line.text, scope: 'story', chapter: ch.id, speaker, context: `Story scene "${s.id}" (${s.place}), line ${i + 1} of ${s.lines.length}.${cond ? ` ${cond}` : ''}` });
          if (line.as) out.push({ id: `${id}.as`, text: line.as, scope: 'names', chapter: ch.id, context: `Speaker name shown for ${id}.` });
          out.push(...choiceEntries(s, i, ch.id));
        });
      } else {
        const op = step.op;
        out.push({ id: `${op.id}.title`, text: op.title, scope: 'ops', chapter: ch.id, context: 'Operation title (briefing, HUD banner, results, theatre list).' });
        out.push({ id: `${op.id}.patient`, text: op.patient, scope: 'ops', chapter: ch.id, context: 'Patient line on the chart and HUD.' });
        out.push({ id: `${op.id}.diagnosis`, text: op.diagnosis, scope: 'ops', chapter: ch.id, context: 'Findings paragraph on the patient chart.' });
        op.phases.forEach((ph, p) =>
          (ph.callout ?? []).forEach((text, n) =>
            out.push({ id: `${op.id}.p${p}.${n + 1}`, text, scope: 'callouts', chapter: ch.id, speaker: 'Sister Ilse', context: `Assistant callout when phase ${p + 1} of ${op.phases.length} of "${op.title}" begins.` }),
          ),
        );
      }
    }
  }
  // Aftermath/failure scenes, barks, codex, case notes (NAR): see src/content/export.ts.
  out.push(...narrativeEntries());
  return out;
}
