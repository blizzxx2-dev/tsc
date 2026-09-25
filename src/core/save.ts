import type { Rank } from '../surgery/types';

export interface SaveData {
  version: 1;
  /** Next step to play, per chapter index. */
  progress: { chapter: number; step: number };
  best: Record<string, { rank: Rank; score: number }>;
  volume: number;
}

const KEY = 'grim-apothecary.save';
const RANK_ORDER: Rank[] = ['C', 'B', 'A', 'S', 'XS'];

export const fresh = (): SaveData => ({ version: 1, progress: { chapter: 0, step: 0 }, best: {}, volume: 0.5 });

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.version !== 1) return fresh();
    return { ...fresh(), ...d } as SaveData;
  } catch {
    return fresh();
  }
}

export function store(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage unavailable (private mode): progress lasts only for this session.
  }
}

/** Record a result, keeping the better rank/score. Returns true if it's a new best. */
export function recordBest(d: SaveData, opId: string, rank: Rank, score: number): boolean {
  const prev = d.best[opId];
  if (prev && (RANK_ORDER.indexOf(prev.rank) > RANK_ORDER.indexOf(rank) || (prev.rank === rank && prev.score >= score))) return false;
  d.best[opId] = { rank, score };
  return true;
}

export function advance(d: SaveData, chapter: number, step: number): void {
  const p = d.progress;
  if (chapter > p.chapter || (chapter === p.chapter && step > p.step)) d.progress = { chapter, step };
}
