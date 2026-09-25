import type { Rank } from '../surgery/types';
import type { Line, StoryDef } from './story';

/**
 * Narrative conditions (NAR-0039, NAR-0047, NAR-0065): a few story lines depend on how the
 * operation just before them went — the rank earned, or whether the Litany was spoken.
 *
 * Conditions are attached to `Line` objects out of band (a WeakMap), so the story format and
 * the line ids used for localisation and VO (`<storyId>.<NNN>`, docs/loc/keys.md) are unchanged:
 * every variant line keeps its own id, and the scene simply skips the lines whose condition
 * fails. Only the outcome of the most recent operation is known here; it is not persisted, so a
 * scene resumed from a save shows its canonical variant (Litany spoken, middling rank).
 * Persistent campaign flags (cantorMercy…) belong to the flag store (CON-0008).
 */
export type RankBand = 'high' | 'mid' | 'low';

/** XS/S are "high", A/B "mid", C "low". */
export const rankBand = (r: Rank): RankBand => (r === 'XS' || r === 'S' ? 'high' : r === 'C' ? 'low' : 'mid');

export interface When {
  /** Shown only if the Litany was (true) or was not (false) spoken in the preceding operation. */
  litany?: boolean;
  /** Shown only for these rank bands of the preceding operation. */
  rank?: RankBand | readonly RankBand[];
}

export interface StoryContext {
  opId?: string;
  rank?: Rank | null;
  litanyUsed?: boolean;
}

/** Canonical assumptions when the preceding operation is unknown (e.g. resumed from a save). */
export const CANON: Required<Pick<StoryContext, 'litanyUsed'>> & { band: RankBand } = { litanyUsed: true, band: 'mid' };

const CONDS = new WeakMap<Line, When>();

/** Mark lines as conditional. Returns them for spreading into a `lines` array. */
export function when(c: When, ...lines: Line[]): Line[] {
  for (const l of lines) CONDS.set(l, c);
  return lines;
}

export const conditionOf = (l: Line): When | undefined => CONDS.get(l);

/** Human-readable condition, for translator context and the script docs. */
export function describeWhen(c: When): string {
  const parts: string[] = [];
  if (c.litany !== undefined) parts.push(c.litany ? 'the Litany was spoken in the preceding operation' : 'the Litany was NOT spoken in the preceding operation');
  if (c.rank) parts.push(`the preceding operation's rank was ${([] as RankBand[]).concat(c.rank).join(' or ')} (high = XS/S, mid = A/B, low = C)`);
  return `Variant line: shown only if ${parts.join(' and ')}.`;
}

export function lineShown(l: Line, ctx: StoryContext = {}): boolean {
  const c = CONDS.get(l);
  if (!c) return true;
  if (c.litany !== undefined && (ctx.litanyUsed ?? CANON.litanyUsed) !== c.litany) return false;
  if (c.rank) {
    const band = ctx.rank ? rankBand(ctx.rank) : CANON.band;
    if (!([] as RankBand[]).concat(c.rank).includes(band)) return false;
  }
  return true;
}

/** The scene as this player will see it. */
export function resolveStory(s: StoryDef, ctx: StoryContext = {}): StoryDef {
  const lines = s.lines.filter((l) => lineShown(l, ctx));
  return lines.length === s.lines.length ? s : { ...s, lines };
}

// ---------------------------------------------------------------- last operation outcome

let last: StoryContext = {};

/** Called by the campaign flow when an operation ends. */
export function noteOutcome(opId: string, rank: Rank | null, litanyUsed: boolean): void {
  last = { opId, rank, litanyUsed };
}

export const lastOutcome = (): StoryContext => last;

/** Forget the outcome (new game, title screen). */
export function clearOutcome(): void {
  last = {};
}
