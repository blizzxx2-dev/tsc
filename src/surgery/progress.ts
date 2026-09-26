import type { Rank } from './types';
import { DIFFICULTY_ORDER, NO_ASSISTS, type Assists, type Difficulty } from './difficulty';
import type { LitanyVariant } from './litany';
import type { TuningOverride } from './tuning';

/**
 * Meta progression: difficulty choice, bests per difficulty, the fee economy,
 * instrument upgrades, kit loadout, failure counts (for hints), first-time
 * hints seen and codex pages. Stored beside the campaign save under its own key.
 */

export type UpgradeId = 'fine-lancet' | 'silver-tongs' | 'deep-leech' | 'waxed-thread';
export type TinctureColor = 'red' | 'green' | 'blue' | 'amber';

export interface UpgradeInfo {
  id: UpgradeId;
  name: string;
  cost: number;
  effect: string;
}

export const UPGRADES: Record<UpgradeId, UpgradeInfo> = {
  'fine-lancet': { id: 'fine-lancet', name: 'Fine Lancet', cost: 500, effect: 'Incision tolerance +2 px.' },
  'silver-tongs': { id: 'silver-tongs', name: 'Silver Tongs', cost: 700, effect: 'Hexstone whispers half as loud through silver.' },
  'deep-leech': { id: 'deep-leech', name: 'Deep Leech', cost: 600, effect: 'Leech-pipe draws 20 % faster.' },
  'waxed-thread': { id: 'waxed-thread', name: 'Waxed Thread', cost: 600, effect: 'Stitch spacing tolerance +20 %.' },
};

/** Tuning changes the owned upgrades make (the others are read directly by the sim). */
export function upgradeTuning(owned: Iterable<string>): TuningOverride {
  const has = new Set(owned);
  const o: TuningOverride = {};
  if (has.has('fine-lancet')) o.incision = { coolDev: 8, goodDev: 16, startTol: 24 };
  if (has.has('waxed-thread')) o.stitch = { coolMin: 8, coolMax: 33.6, goodMin: 4.8, goodMax: 48 };
  return o;
}

/** Fees paid by rank on a first clear; improving a rank pays the difference. */
export const RANK_FEE: Record<Rank, number> = { XS: 300, S: 200, A: 120, B: 70, C: 30 };
/** Paid once for completing a chapter. */
export const CHAPTER_FEE = 250;
export const UPGRADE_TOTAL = Object.values(UPGRADES).reduce((a, u) => a + u.cost, 0);

const RANK_ORDER: Rank[] = ['C', 'B', 'A', 'S', 'XS'];

export interface BestEntry {
  rank: Rank;
  score: number;
  /** Assist / upgrade / checkpoint flags on the best run. */
  flags: string[];
}

export interface Progress {
  version: 2;
  /** Which build wrote this save (demo saves carry into the full game). */
  edition: 'demo' | 'full';
  difficulty: Difficulty;
  masterUnlocked: boolean;
  assists: Assists;
  litany: LitanyVariant;
  tincture: TinctureColor;
  chaptersCleared: number;
  best: Record<string, Partial<Record<Difficulty, BestEntry>>>;
  /** Challenge (X-op) bests: rank, score and clear time. */
  xBest: Record<string, { rank: Rank; score: number; time: number }>;
  fees: number;
  /** Fees already paid per op (so improvements pay the difference). */
  feePaid: Record<string, number>;
  upgrades: UpgradeId[];
  fails: Record<string, number>;
  /** Story clears per op (CON-0086: each moves the op's replays on to its next seed). */
  clears?: Record<string, number>;
  /** Every operation ever lost on this save, in order (Prime writes those patients' names, BOS-0055). */
  lost?: string[];
  hintsSeen: string[];
  codex: string[];
  tutorialSkip: boolean;
  achievements: string[];
}

export const freshProgress = (edition: 'demo' | 'full' = 'demo'): Progress => ({
  version: 2,
  edition,
  difficulty: 'surgeon',
  masterUnlocked: false,
  assists: { ...NO_ASSISTS },
  litany: 'stillness',
  tincture: 'red',
  chaptersCleared: 0,
  best: {},
  xBest: {},
  fees: 0,
  feePaid: {},
  upgrades: [],
  fails: {},
  hintsSeen: [],
  codex: [],
  tutorialSkip: false,
  achievements: [],
});

/**
 * Bring any older save up to date. Version 1 was the demo's first layout
 * (`best: {opId: {rank, score}}` with no difficulty); its bests count as Surgeon.
 */
export function migrateProgress(raw: unknown, edition: 'demo' | 'full' = 'full'): Progress {
  const p = freshProgress(edition);
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  if (r.version === 1 && r.best && typeof r.best === 'object') {
    for (const [id, b] of Object.entries(r.best as Record<string, { rank: Rank; score: number }>)) {
      if (b && RANK_ORDER.includes(b.rank)) p.best[id] = { surgeon: { rank: b.rank, score: b.score, flags: [] } };
    }
    return p;
  }
  if (r.version === 2) {
    const q = { ...p, ...(r as Partial<Progress>), edition };
    q.assists = { ...NO_ASSISTS, ...((r as Partial<Progress>).assists ?? {}) };
    return q;
  }
  return p;
}

export interface RunResult {
  opId: string;
  won: boolean;
  rank: Rank;
  score: number;
  difficulty: Difficulty;
  flags: string[];
  /** Challenge op id when this was an X-op. */
  challenge?: string;
  time?: number;
}

/** Record a finished operation. Returns what changed (for NEW BEST and fee popups). */
export function recordRun(p: Progress, r: RunResult): { newBest: boolean; fee: number } {
  if (!r.won) {
    p.fails[r.opId] = (p.fails[r.opId] ?? 0) + 1;
    if (!r.challenge) {
      p.lost ??= [];
      if (!p.lost.includes(r.opId)) p.lost.push(r.opId);
    }
    return { newBest: false, fee: 0 };
  }
  p.fails[r.opId] = 0;
  if (!r.challenge) {
    p.clears ??= {};
    p.clears[r.opId] = (p.clears[r.opId] ?? 0) + 1;
  }
  if (r.challenge) {
    const prev = p.xBest[r.challenge];
    const better = !prev || RANK_ORDER.indexOf(r.rank) > RANK_ORDER.indexOf(prev.rank) || (prev.rank === r.rank && r.score > prev.score);
    if (better) p.xBest[r.challenge] = { rank: r.rank, score: r.score, time: r.time ?? 0 };
    return { newBest: better, fee: 0 };
  }
  const slot = (p.best[r.opId] ??= {});
  const prev = slot[r.difficulty];
  const newBest = !prev || RANK_ORDER.indexOf(r.rank) > RANK_ORDER.indexOf(prev.rank) || (prev.rank === r.rank && r.score > prev.score);
  if (newBest) slot[r.difficulty] = { rank: r.rank, score: r.score, flags: r.flags };
  // Fees: the best rank ever reached on this op, paid once (improvements pay the difference).
  const owed = RANK_FEE[r.rank];
  const paid = p.feePaid[r.opId] ?? 0;
  const fee = Math.max(0, owed - paid);
  if (fee > 0) {
    p.feePaid[r.opId] = owed;
    p.fees += fee;
  }
  return { newBest, fee };
}

/** A chapter was completed for the first time. */
export function recordChapter(p: Progress, chapter: number): number {
  if (chapter <= p.chaptersCleared) return 0;
  p.chaptersCleared = chapter;
  if (chapter >= 2) p.masterUnlocked = true;
  p.fees += CHAPTER_FEE;
  return CHAPTER_FEE;
}

export function buyUpgrade(p: Progress, id: UpgradeId): boolean {
  const u = UPGRADES[id];
  if (p.upgrades.includes(id) || p.fees < u.cost) return false;
  p.fees -= u.cost;
  p.upgrades.push(id);
  return true;
}

/** Best entry across difficulties, for lists that show one line per op. */
export function bestOf(p: Progress, opId: string): (BestEntry & { difficulty: Difficulty }) | null {
  const slot = p.best[opId];
  if (!slot) return null;
  let out: (BestEntry & { difficulty: Difficulty }) | null = null;
  for (const d of DIFFICULTY_ORDER) {
    const b = slot[d];
    if (b && (!out || RANK_ORDER.indexOf(b.rank) > RANK_ORDER.indexOf(out.rank))) out = { ...b, difficulty: d };
  }
  return out;
}

/**
 * Has this player been on the table before (GAM-0208)? True once any operation was
 * finished — won (a best entry) or lost (a failure count) — so a new game can offer to
 * skip the tutorials with an "operated before?" prompt.
 */
export function hasOperated(p: Progress): boolean {
  if (p.chaptersCleared > 0 || p.tutorialSkip) return true;
  if (Object.values(p.best).some((slot) => Object.keys(slot).length > 0)) return true;
  if (Object.keys(p.xBest).length > 0) return true;
  return Object.values(p.fails).some((n) => n > 0);
}

export function setDifficulty(p: Progress, d: Difficulty): boolean {
  if (d === 'master' && !p.masterUnlocked) return false;
  p.difficulty = d;
  return true;
}

// ------------------------------------------------------------------ storage

const KEY = 'suture-and-steel.progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateProgress(JSON.parse(raw), 'demo');
    // Carry bests over from the original campaign save if present.
    const old = localStorage.getItem('suture-and-steel.save');
    return old ? migrateProgress(JSON.parse(old), 'demo') : freshProgress('demo');
  } catch {
    return freshProgress('demo');
  }
}

export function storeProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress lasts this session only.
  }
}
