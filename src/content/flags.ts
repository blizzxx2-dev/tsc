/**
 * Campaign flags (CON-0008): named boolean / number / string values the story writes (choices,
 * operation outcomes) and reads back later — `cantorMercy` from s2-4 shapes Chapter III, the
 * Litany-seen count feeds the Inquisitor's suspicion, and so on. The values live on the save
 * profile (`Profile.flags`, schema v3) so they persist, clear with New Game, and carry from the
 * demo into the full game (src/platform/carryover.ts). Documented in docs/narrative/flags.md.
 *
 * This module is DOM-free and content-side: the campaign flow binds the store to the active save
 * (`flags.bind(() => save.flags)`) and listens for writes to persist them.
 */
import { FLAG_LIMITS, type FlagRecord, type FlagValue } from '../core/save/schema';
import type { Rank } from '../surgery/types';
import type { Line } from './story';

export type { FlagRecord, FlagValue } from '../core/save/schema';

/** Read-only view of the store, as conditions see it. */
export interface FlagReader {
  get(key: string): FlagValue | undefined;
  has(key: string): boolean;
  /** True when the flag is set to something other than false, 0 or ''. */
  truthy(key: string): boolean;
}

const isValue = (v: unknown): v is FlagValue => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= FLAG_LIMITS.string);

export class FlagStore implements FlagReader {
  private source: () => FlagRecord;
  /** Called after every write (the flow persists the save here). */
  listener: ((key: string, value: FlagValue | undefined) => void) | null = null;

  constructor(source?: () => FlagRecord) {
    const own: FlagRecord = {};
    this.source = source ?? (() => own);
  }

  /** Point the store at a record — a getter, so New Game's replacement of the profile is followed. */
  bind(source: () => FlagRecord): void {
    this.source = source;
  }

  get(key: string): FlagValue | undefined {
    return this.source()[key];
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.source(), key);
  }

  truthy(key: string): boolean {
    const v = this.get(key);
    return v !== undefined && v !== false && v !== 0 && v !== '';
  }

  /** Set a flag. Invalid keys or values (docs/narrative/flags.md limits) are rejected, not stored. */
  set(key: string, value: FlagValue): boolean {
    if (key.length === 0 || key.length > FLAG_LIMITS.key || !isValue(value)) return false;
    const rec = this.source();
    if (!this.has(key) && Object.keys(rec).length >= FLAG_LIMITS.count) return false;
    rec[key] = value;
    this.listener?.(key, value);
    return true;
  }

  /** Set several flags at once (a choice option's `set`). */
  setAll(values: Readonly<FlagRecord>): void {
    for (const [k, v] of Object.entries(values)) this.set(k, v);
  }

  /** Add `delta` to a numeric flag (missing or non-numeric counts as 0) and return the new value. */
  count(key: string, delta = 1): number {
    const cur = this.get(key);
    const next = (typeof cur === 'number' ? cur : 0) + delta;
    this.set(key, next);
    return next;
  }

  delete(key: string): void {
    const rec = this.source();
    if (!this.has(key)) return;
    delete rec[key];
    this.listener?.(key, undefined);
  }

  /** Forget every flag (New Game). */
  clear(): void {
    const rec = this.source();
    for (const k of Object.keys(rec)) delete rec[k];
    this.listener?.('', undefined);
  }

  all(): Readonly<FlagRecord> {
    return { ...this.source() };
  }
}

/** The campaign's flag store. Unbound until the flow binds it to the save; tests use it as is. */
export const flags = new FlagStore();

// ---------------------------------------------------------------- conditions

/**
 * A condition over the flags, either a predicate or declarative data (which the loc export and
 * the docs can describe): `{ flag: 'cantorMercy' }` is truthy; `{ flag, is: value }` equality;
 * `{ flag, unset: true }` never written; `{ all }`, `{ any }`, `{ not }` combine.
 */
export type FlagCondition =
  | ((f: FlagReader) => boolean)
  | { flag: string; is?: FlagValue; unset?: boolean }
  | { all: readonly FlagCondition[] }
  | { any: readonly FlagCondition[] }
  | { not: FlagCondition };

export function evalCondition(c: FlagCondition, f: FlagReader): boolean {
  if (typeof c === 'function') return c(f);
  if ('flag' in c) {
    if (c.unset) return !f.has(c.flag);
    if (c.is !== undefined) return f.get(c.flag) === c.is;
    return f.truthy(c.flag);
  }
  if ('all' in c) return c.all.every((x) => evalCondition(x, f));
  if ('any' in c) return c.any.some((x) => evalCondition(x, f));
  return !evalCondition(c.not, f);
}

/** Human-readable condition, for translator context and docs/narrative/flags.md. */
export function describeCondition(c: FlagCondition): string {
  if (typeof c === 'function') return 'a scripted flag condition';
  if ('flag' in c) {
    if (c.unset) return `\`${c.flag}\` is unset`;
    if (c.is !== undefined) return `\`${c.flag}\` is ${JSON.stringify(c.is)}`;
    return `\`${c.flag}\` is set`;
  }
  if ('all' in c) return c.all.map(describeCondition).join(' and ');
  if ('any' in c) return c.any.map(describeCondition).join(' or ');
  return `not (${describeCondition(c.not)})`;
}

/** Flag names a declarative condition reads (predicates cannot be inspected). */
export function conditionReads(c: FlagCondition): string[] {
  if (typeof c === 'function') return [];
  if ('flag' in c) return [c.flag];
  if ('all' in c) return c.all.flatMap(conditionReads);
  if ('any' in c) return c.any.flatMap(conditionReads);
  return conditionReads(c.not);
}

// ---------------------------------------------------------------- operation outcomes → flags

/** Flags an operation writes when it is won in the campaign, from its rank (CON-0129, CON-0136). */
export const OP_FLAG_WRITES: Readonly<Record<string, (rank: Rank) => FlagRecord>> = {
  // Stroh's rotten molar: the Inquisitor owes the surgeon a tooth, and remembers it (CON-0129).
  'op3-9': (rank) => ({ strohTooth: true, strohToothFine: rank === 'XS' || rank === 'S' }),
  // Sext in Mauer: a captain hale enough to lead the Watch on Hollow Night, or maimed (NAR-0105).
  'op4-7': (rank) => ({ mauerFate: rank === 'C' ? 'maimed' : 'hale' }),
  // Terce, then Haller's burned hands (CON-0136, NAR-0100): at A or better he keeps them and advises by
  // letter; below, he lives maimed and bitter. He never dies of it — a lost operation stays its own
  // failure. ('lost' is still read, for saves made before this rule.)
  'op3-11': (rank) => ({ hallerFate: rank === 'XS' || rank === 'S' || rank === 'A' ? 'hands' : 'scarred' }),
};

/** Flags written by the engine rather than by content, so the flag audit knows their source. */
export const ENGINE_FLAG_WRITES: readonly string[] = ['litanySeenCount', 'unsungHeard', 'guildMarks', 'guildOps', 'rank.op1-1', 'rank.op1-2', 'rank.op1-3', 'rank.op1-5', 'rank.op2-1', ...[1, 2, 3, 4, 5].flatMap((n) => [`ch${n}Marks`, `ch${n}Ops`])];

/** Rank points toward the Guild's licence vote (NAR-0126): XS 4, S 3, A 2, B 1, C 0. */
const GUILD_POINTS: Readonly<Record<Rank, number>> = { XS: 4, S: 3, A: 2, B: 1, C: 0 };

/** Chapters I–III campaign wins feed the Guild's view of the Doctor: a running rank tally. */
export function noteGuildRank(opId: string, rank: Rank, store: FlagStore = flags): void {
  const ch = /^op([1-5])-/.exec(opId)?.[1];
  if (!ch) return;
  // The op's own rank, for patients who come back (NAR-0114).
  store.set(`rank.${opId}`, rank);
  // Each chapter's own tally (NAR-0097: Ilse's side scenes open on a good chapter).
  store.count(`ch${ch}Marks`, GUILD_POINTS[rank]);
  store.count(`ch${ch}Ops`);
  if (Number(ch) > 3) return;
  store.count('guildMarks', GUILD_POINTS[rank]);
  store.count('guildOps');
}

/** How an operation went for a returning patient (NAR-0114): XS/S high, C low, else — or unplayed — mid. */
export function opBand(opId: string, f: Pick<FlagReader, 'get'>): 'high' | 'mid' | 'low' {
  const r = f.get(`rank.${opId}`);
  return r === 'XS' || r === 'S' ? 'high' : r === 'C' ? 'low' : 'mid';
}

/** One line per rank band: the variant for how that patient's operation went. */
export const byBand = (opId: string, lines: Record<'high' | 'mid' | 'low', Line>): Line[] =>
  (['high', 'mid', 'low'] as const).map((b) => ({ ...lines[b], if: (f: FlagReader) => opBand(opId, f) === b }));

/** A chapter's campaign wins so far average A or better (XS 4, S 3, A 2…); false before any. */
export function chapterAverageA(chapter: number, f: Pick<FlagReader, 'get'>): boolean {
  const ops = Number(f.get(`ch${chapter}Ops`) ?? 0);
  return ops > 0 && Number(f.get(`ch${chapter}Marks`) ?? 0) / ops >= GUILD_POINTS.A;
}

/** The licence vote carries when the Chapters I–III average is A or better (NAR-0126). */
export function licenceKept(f: Pick<FlagReader, 'get'>): boolean {
  const ops = Number(f.get('guildOps') ?? 0);
  if (ops === 0) return true;
  return Number(f.get('guildMarks') ?? 0) / ops >= GUILD_POINTS.A;
}

/**
 * Story flags a boss fight reads (`BossOpDef.storyFlags`). `strohAlly`: the Inquisitor owes the
 * surgeon his tooth (op3-9) and stands with them at the Office (BOS-0139, BOS-0146).
 */
export function bossStoryFlags(f: FlagReader = flags): string[] {
  return f.truthy('strohTooth') ? ['strohAlly'] : [];
}

/** Apply an operation's outcome flags to the store. */
export function applyOpFlags(opId: string, rank: Rank, store: FlagStore = flags): void {
  const w = OP_FLAG_WRITES[opId];
  if (w) store.setAll(w(rank));
}
