import type { Rank } from '../types';
import type { Operation } from '../operation';

/**
 * Codex entries and Ilse's rank-keyed debrief lines for every Hour (BOS-0026,
 * 0046, 0061, 0075, 0089, 0104, 0118, 0133, 0146) and the elites (BOS-0163).
 * Text lives in the i18n tables: `codex.<id>.title|body`, `debrief.<id>.high|mid|low`
 * (`debrief.office.<band>.stroh` for the Stroh-ally ending variants).
 */

export const CODEX_BOSSES = ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline', 'office'] as const;
export type CodexBoss = (typeof CODEX_BOSSES)[number];

/** Elites with a codex entry of their own (ids match `MalisonBase.bossId`). */
export const CODEX_ELITES = ['broodmother', 'cantor', 'gravehound', 'herald'] as const;

export type DebriefBand = 'high' | 'mid' | 'low';

/** XS/S → high, A/B → mid, C → low. */
export function debriefBand(rank: Rank): DebriefBand {
  return rank === 'XS' || rank === 'S' ? 'high' : rank === 'C' ? 'low' : 'mid';
}

/** The i18n key of Ilse's debrief line after a boss operation. */
export function debriefKey(boss: string, rank: Rank, storyFlags: readonly string[] = []): string {
  const band = debriefBand(rank);
  if (boss === 'office' && storyFlags.includes('strohAlly')) return `debrief.office.${band}.stroh`;
  return `debrief.${boss}.${band}`;
}

export const codexTitleKey = (id: string): string => `codex.${id}.title`;
export const codexBodyKey = (id: string): string => `codex.${id}.body`;

/**
 * Codex unlocks: every boss or elite met in an operation (the `encounter`
 * event). The caller persists the returned list (e.g. into the save's codex).
 */
export function watchEncounters(op: Operation, onUnlock: (id: string) => void): () => void {
  const seen = new Set<string>();
  return op.events.on('boss', (e) => {
    if (e.kind !== 'encounter' || seen.has(e.boss)) return;
    seen.add(e.boss);
    onUnlock(e.boss);
  });
}

/** Operation id → the boss whose debrief it plays. */
export const BOSS_OPS: Record<string, CodexBoss> = {
  'op1-5': 'matins',
  'op2-5': 'lauds',
  'op3-10': 'prime',
  'op3-11': 'terce',
  'op4-7': 'sext',
  'op4-9': 'none',
  'op5-6': 'vespers',
  'op5-8': 'compline',
  'op5-9': 'office',
};
