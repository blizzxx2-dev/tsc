/**
 * Test-state presets (QAT-0075): canned save states for testers and automation, loadable with
 * the console (`preset <name>`), the cheat menu, the debug API or `?preset=<name>` on the URL.
 * Built from the campaign structure so they follow content changes.
 */
import { CAMPAIGN } from '../content/campaign';
import { fresh, type SaveData } from '../core/save';
import type { Rank } from '../surgery/types';

export const PRESET_NAMES = ['fresh', 'mid-ch1', 'pre-matins', 'ch2-start', 'pre-lauds', 'demo-complete', 'all-xs'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

/** Index of the step in a chapter that plays operation `opId`. */
function stepOf(chapter: number, opId: string): number {
  const i = CAMPAIGN[chapter].steps.findIndex((s) => s.kind === 'op' && s.op.id === opId);
  if (i < 0) throw new Error(`preset: ${opId} is not in chapter ${chapter + 1}`);
  return i;
}

/** A plausible best result for every operation played before (chapter, step). */
function bestsBefore(chapter: number, step: number, rank: (ranks: { S: number; A: number; B: number }) => { rank: Rank; score: number }): SaveData['best'] {
  const best: SaveData['best'] = {};
  CAMPAIGN.forEach((ch, ci) =>
    ch.steps.forEach((s, si) => {
      if (s.kind === 'op' && (ci < chapter || (ci === chapter && si < step))) best[s.op.id] = rank(s.op.ranks);
    }),
  );
  return best;
}

type Ranks = { S: number; A: number; B: number };
const aRank = (r: Ranks) => ({ rank: 'A' as Rank, score: r.A });
const xsRank = (r: Ranks) => ({ rank: 'XS' as Rank, score: Math.ceil(r.S * 1.1) });

export function presetSave(name: PresetName): SaveData {
  const base = fresh();
  const at = (chapter: number, step: number, rank = aRank): SaveData => ({ ...base, progress: { chapter, step }, best: bestsBefore(chapter, step, rank) });
  switch (name) {
    case 'fresh':
      return base;
    case 'mid-ch1':
      return at(0, stepOf(0, 'op1-3'));
    case 'pre-matins':
      return at(0, stepOf(0, 'op1-5'));
    case 'ch2-start':
      return at(1, 0);
    case 'pre-lauds':
      return at(1, stepOf(1, 'op2-5'));
    case 'demo-complete':
      return at(CAMPAIGN.length, 0);
    case 'all-xs':
      return at(CAMPAIGN.length, 0, xsRank);
  }
}

export const isPresetName = (s: string): s is PresetName => (PRESET_NAMES as readonly string[]).includes(s);
