import type { Operation } from './operation';
import { bestOf, type Progress } from './progress';
import type { Rank } from './types';

/**
 * Gameplay achievements. The ids are the shared event list the platform layer
 * maps to Steam achievements; `awardAchievements` is called once per finished
 * operation and returns the ids newly earned (also stored on the save).
 */
export const ACHIEVEMENTS = {
  'first-xs': 'Unerring Hand — earn an XS rank',
  'combo-50': 'Fifty Stitches Deep — a chain of 50',
  'no-litany-boss': 'Without Prayer — unmake a Malison without the Litany',
  'all-x-ops': 'The Whole Office — clear every X-Operation',
  'never-bad': 'Clean Ledger — finish an operation without a Bad or Miss',
  'first-malison': 'Matins Unmade — unmake your first Malison',
  'thrall-freed': 'The Thread Cut — sear a vampire’s thrall-channel',
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;

export function awardAchievements(p: Progress, op: Operation, opts: { allXOps?: readonly string[] } = {}): AchievementId[] {
  const earned: AchievementId[] = [];
  const give = (id: AchievementId, cond: boolean) => {
    if (cond && !p.achievements.includes(id)) {
      p.achievements.push(id);
      earned.push(id);
    }
  };
  const won = op.status === 'won';
  give('first-xs', won && op.rank() === 'XS');
  give('combo-50', op.maxCombo >= 50);
  give('never-bad', won && op.counts.bad + op.counts.miss === 0);
  give('first-malison', won && op.bossOp);
  give('no-litany-boss', won && op.bossOp && !op.litanyUsed);
  give('thrall-freed', op.journal.some((e) => e.kind === 'rated' && e.label === 'Channel seared'));
  if (opts.allXOps?.length) give('all-x-ops', opts.allXOps.every((id) => p.xBest[id]));
  return earned;
}

// ------------------------------------------------------------------ hospice reputation

const REP: Record<Rank, number> = { XS: 5, S: 4, A: 3, B: 2, C: 1 };

/** Reputation: the sum of the best rank on every operation. */
export function reputation(p: Progress): number {
  return Object.keys(p.best).reduce((a, id) => {
    const b = bestOf(p, id);
    return a + (b ? REP[b.rank] : 0);
  }, 0);
}

/** Cosmetic hospice improvements and codex pages unlocked by reputation. */
export const REPUTATION_UNLOCKS: readonly { at: number; id: string; kind: 'hospice' | 'codex'; name: string }[] = [
  { at: 5, id: 'candles', kind: 'hospice', name: 'Beeswax candles for the ward' },
  { at: 12, id: 'codex-humours', kind: 'codex', name: 'Codex: On the Four Humours' },
  { at: 20, id: 'glass', kind: 'hospice', name: 'Glazed windows in the theatre' },
  { at: 30, id: 'codex-choir', kind: 'codex', name: 'Codex: Hymnal of the Hollow Choir' },
  { at: 40, id: 'garden', kind: 'hospice', name: 'Sister Ilse’s herb garden' },
  { at: 60, id: 'codex-malison', kind: 'codex', name: 'Codex: The Office of the Malison' },
];

export const unlockedByReputation = (p: Progress) => REPUTATION_UNLOCKS.filter((u) => reputation(p) >= u.at);
