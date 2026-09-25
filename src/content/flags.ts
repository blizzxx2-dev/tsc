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
  // Terce, then Haller's burned hands: how much of the old man's craft survives (CON-0136).
  'op3-11': (rank) => ({ hallerFate: rank === 'XS' || rank === 'S' ? 'hands' : rank === 'C' ? 'lost' : 'scarred' }),
};

/** Flags written by the engine rather than by content, so the flag audit knows their source. */
export const ENGINE_FLAG_WRITES: readonly string[] = ['litanySeenCount'];

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
