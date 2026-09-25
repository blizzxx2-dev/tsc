/**
 * Encoding, integrity checks, validation and the ordered migration chain for save files
 * (PLT-0080, PLT-0083, PLT-0084, PLT-0085). Pure functions: no storage, no DOM.
 */
import type { Edition } from '../../platform/editions';
import { FLAG_LIMITS, RANKS, SAVE_VERSION, type BestResult, type CampaignPosition, type Envelope, type FlagRecord, type FlagValue, type Profile, type SlotData, type SlotId, SLOT_IDS } from './schema';

/** FNV-1a 32-bit over UTF-16 code units, as 8 hex digits. */
export function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function encode<T>(kind: Envelope<T>['kind'], data: T): string {
  const body = JSON.stringify(data);
  return `{"format":"suture-and-steel","kind":"${kind}","sum":"${checksum(body)}","data":${body}}`;
}

export type DecodeError = 'empty' | 'syntax' | 'format' | 'checksum';

/**
 * Parse an envelope and verify its checksum. Bare JSON objects without an envelope (v1 saves, which
 * predate checksums) are accepted as `legacy`.
 */
export function decode(raw: string | null | undefined, kind: Envelope<unknown>['kind']): { ok: true; data: unknown; legacy: boolean } | { ok: false; error: DecodeError } {
  if (raw == null || raw.trim() === '') return { ok: false, error: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'syntax' };
  }
  if (!isObj(parsed)) return { ok: false, error: 'format' };
  if (parsed.format !== 'suture-and-steel') {
    // Pre-envelope v1 save: {version: 1, progress, best, volume}
    return 'version' in parsed ? { ok: true, data: parsed, legacy: true } : { ok: false, error: 'format' };
  }
  if (parsed.kind !== kind || !('data' in parsed)) return { ok: false, error: 'format' };
  if (typeof parsed.sum !== 'string' || checksum(JSON.stringify(parsed.data)) !== parsed.sum) return { ok: false, error: 'checksum' };
  return { ok: true, data: parsed.data, legacy: false };
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : dflt);
const num = (v: unknown, lo: number, hi: number, dflt: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
const str = (v: unknown, dflt: string, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : dflt);

/* ───────────── migrations ───────────── */

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;

/**
 * `MIGRATIONS[n]` upgrades a version-n profile to n+1. Append only; never edit a shipped step.
 * Each step must be idempotent on already-migrated fields.
 */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 (M0 prototype, localStorage) → v2: volume moves to settings.json, envelope + metadata added.
  1: (d) => {
    const { volume: _volume, ...rest } = d;
    void _volume;
    return { ...rest, version: 2, edition: 'demo', build: 'v1-legacy', contentIds: 1, unlocks: [], playtime: 0 };
  },
  // v2 → v3: campaign flag store (CON-0008). Older saves have made no choices yet.
  2: (d) => ({ ...d, version: 3, flags: isObj(d.flags) ? d.flags : {} }),
};

export function migrate(d: Record<string, unknown>): { data: Record<string, unknown>; from: number } {
  const from = int(d.version, 0, Number.MAX_SAFE_INTEGER, 1) || 1;
  let cur: Record<string, unknown> = { ...d, version: from };
  for (let v = from; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No save migration from v${v}`);
    cur = step(cur);
    cur.version = v + 1;
  }
  return { data: cur, from };
}

/* ───────────── validation ───────────── */

const nowIso = (): string => new Date().toISOString();

export function freshProfile(edition: Edition, build: string, now = nowIso()): Profile {
  return {
    version: SAVE_VERSION,
    edition,
    build,
    contentIds: 1,
    progress: { chapter: 0, step: 0 },
    best: {},
    unlocks: [],
    flags: {},
    playtime: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizePosition(v: unknown): CampaignPosition {
  const o = isObj(v) ? v : {};
  return { chapter: int(o.chapter, 0, 99, 0), step: int(o.step, 0, 999, 0) };
}

function sanitizeBest(v: unknown): Record<string, BestResult> {
  const out: Record<string, BestResult> = {};
  if (!isObj(v)) return out;
  for (const [id, r] of Object.entries(v)) {
    if (!isObj(r) || !RANKS.includes(r.rank as BestResult['rank']) || id.length > 64) continue;
    out[id] = { rank: r.rank as BestResult['rank'], score: int(r.score, 0, 1e9, 0) };
  }
  return out;
}

/** A flag value that may be stored: boolean, finite number or bounded string. */
export const isFlagValue = (v: unknown): v is FlagValue => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= FLAG_LIMITS.string);

/** Keep only well-formed flags: valid keys and values, at most FLAG_LIMITS.count of them. */
export function sanitizeFlags(v: unknown): FlagRecord {
  const out: FlagRecord = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v)) {
    if (n >= FLAG_LIMITS.count) break;
    if (k.length === 0 || k.length > FLAG_LIMITS.key || !isFlagValue(val)) continue;
    out[k] = val;
    n++;
  }
  return out;
}

/**
 * Coerce anything into a valid Profile: known fields are type-checked and clamped, unknown fields
 * are kept verbatim (forward compatibility), and the version never goes down.
 */
export function sanitizeProfile(v: unknown, edition: Edition, build: string): Profile {
  const o = isObj(v) ? v : {};
  const base = freshProfile(edition, build);
  const unlocks = Array.isArray(o.unlocks) ? [...new Set(o.unlocks.filter((u): u is string => typeof u === 'string' && u.length <= 64))] : [];
  const out: Profile = {
    ...o,
    version: Math.max(SAVE_VERSION, int(o.version, 0, Number.MAX_SAFE_INTEGER, SAVE_VERSION)),
    edition: o.edition === 'full' || o.edition === 'demo' ? o.edition : edition,
    build: str(o.build, build, 80),
    contentIds: int(o.contentIds, 1, 1000, 1),
    progress: sanitizePosition(o.progress),
    best: sanitizeBest(o.best),
    unlocks,
    flags: sanitizeFlags(o.flags),
    playtime: num(o.playtime, 0, 1e9, 0),
    createdAt: str(o.createdAt, base.createdAt, 40),
    updatedAt: str(o.updatedAt, base.updatedAt, 40),
  };
  if (isObj(o.importedFrom)) {
    const f = o.importedFrom;
    out.importedFrom = { edition: f.edition === 'full' ? 'full' : 'demo', build: str(f.build, '', 80), at: str(f.at, '', 40) };
  } else delete out.importedFrom;
  return out;
}

export function sanitizeSlot(v: unknown, slot: SlotId): SlotData | null {
  if (!isObj(v)) return null;
  const m = isObj(v.meta) ? v.meta : {};
  const progress = sanitizePosition(v.progress);
  const thumb = typeof m.thumbnail === 'string' && m.thumbnail.startsWith('data:image/') && m.thumbnail.length < 200_000 ? m.thumbnail : undefined;
  return {
    ...v,
    version: Math.max(SAVE_VERSION, int(v.version, 0, Number.MAX_SAFE_INTEGER, SAVE_VERSION)),
    slot: SLOT_IDS.includes(v.slot as SlotId) ? (v.slot as SlotId) : slot,
    progress,
    meta: {
      chapter: progress.chapter,
      step: progress.step,
      chapterTitle: str(m.chapterTitle, ''),
      patient: str(m.patient, ''),
      playtime: num(m.playtime, 0, 1e9, 0),
      savedAt: str(m.savedAt, '', 40),
      ...(thumb ? { thumbnail: thumb } : {}),
    },
  };
}

export type LoadOutcome = 'ok' | 'fresh' | 'migrated' | 'restored-backup' | 'restored-autosave' | 'unrecoverable';

/**
 * Decode + migrate + validate one profile text. Returns null when the text is unusable
 * (missing, unparseable, wrong checksum, or a migration failed). Never throws.
 */
export function readProfile(raw: string | null, edition: Edition, build: string): { profile: Profile; migratedFrom: number | null } | null {
  try {
    const d = decode(raw, 'profile');
    if (!d.ok || !isObj(d.data)) return null;
    const { data, from } = migrate(d.data);
    return { profile: sanitizeProfile(data, edition, build), migratedFrom: from < SAVE_VERSION ? from : null };
  } catch {
    return null;
  }
}

export function readSlot(raw: string | null, slot: SlotId): SlotData | null {
  try {
    const d = decode(raw, 'slot');
    if (!d.ok || d.legacy) return null;
    return sanitizeSlot(d.data, slot);
  } catch {
    return null;
  }
}
