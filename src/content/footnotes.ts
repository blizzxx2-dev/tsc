/**
 * "Where are they now" (NAR-0089): a one-line follow-up per patient, read after their chapter
 * ends — the woodcut-caption habit of the old casebooks. Wry, never cruel; nothing here decides
 * a later scene, so the lines hold whatever rank the operation earned.
 */
import { n, type StoryDef } from './story';

export const FOOTNOTES: Record<string, string> = {
  'op1-1': 'Jost the drover swore off dice for good. He broke the promise by Friday, and the stitches held anyway.',
  'op1-2': 'Pieter kept the arrowhead on a cord round his neck and told the militia it was from a duel.',
  'op1-3': 'Anno went back to the gunsmith’s bench and now stands to the side of every barrel he proves.',
  'op1-4': 'Matthis Kolb returned to the Tanners’ Rows, and would speak of the buboes to no one but the hospice cat.',
  'op1-5': 'Emmerich no longer hears the singing. He sleeps with a candle lit, and nobody at the hospice has the heart to stop him.',
  'op2-1': 'Tomas kept the arm, and learned to throw left-handed anyway, in case.',
  'op2-2': 'Orsa Flintvein walked back to her diggings with the shards in a lead box and a promise to return the favour.',
  'op2-3': 'Ilvaren went home to the Grauwald and planted the spider’s thicket with nettles.',
  'op2-4': 'The lay-cantor’s hymn is written in the Inquisitor’s ledger, in a hand that pressed hard enough to tear the page.',
  'op2-5': 'Jorg carried the standard again at the next muster. He hums, now, without noticing, and stops when anyone looks.',
};

/** The follow-ups for a chapter's operations, as a narration scene; null when none are written. */
export function footnoteStory(chapterId: string, numeral: string, opIds: readonly string[]): StoryDef | null {
  const lines = opIds.filter((id) => FOOTNOTES[id]).map((id) => n(FOOTNOTES[id]));
  if (!lines.length) return null;
  return { id: `footnotes-${chapterId}`, place: `Where are they now — after Chapter ${numeral}`, backdrop: 'hospice', lines };
}
