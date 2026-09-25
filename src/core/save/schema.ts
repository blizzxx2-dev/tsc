/**
 * Save schema v2 (PLT-0078). Three kinds of file live in the user's save folder:
 *   profile.json   — progress, best ranks, unlocks, playtime (one per user and edition)
 *   settings.json  — player preferences (src/core/settings.ts; volume moved there from the v1 save)
 *   slot<N>.json   — campaign position for manual slots 1–3 and `slotauto.json` for the autosave
 * Every file is wrapped in an envelope with a checksum (PLT-0083). Unknown fields are preserved on
 * round-trip (PLT-0085).
 */
import type { Rank } from '../../surgery/types';
import type { Edition } from '../../platform/editions';

export const SAVE_VERSION = 2;

export const RANKS: readonly Rank[] = ['C', 'B', 'A', 'S', 'XS'];

export interface BestResult {
  rank: Rank;
  score: number;
}

export interface CampaignPosition {
  /** Next step to play: campaign chapter index and step index within it. */
  chapter: number;
  step: number;
}

export interface Profile {
  version: number;
  /** Edition that last wrote this profile — carry-over contract (PLT-0065). */
  edition: Edition;
  /** Build id (`version+sha.date`) that last wrote this profile. */
  build: string;
  /** Version of the content-id table the keys of `best` use (see src/platform/carryover.ts). */
  contentIds: number;
  /** Autosave position mirror: where "Continue" resumes. */
  progress: CampaignPosition;
  /** Best result per operation id. */
  best: Record<string, BestResult>;
  /** Unlock ids (extras, chapters, New Game+). */
  unlocks: string[];
  /** Seconds played, excluding pauses and idle periods over 5 minutes (PLT-0090). */
  playtime: number;
  createdAt: string;
  updatedAt: string;
  /** Set when this profile was seeded from a demo save (PLT-0066). */
  importedFrom?: { edition: Edition; build: string; at: string };
  /** Unknown future fields survive a load/save round trip. */
  [extra: string]: unknown;
}

export type SlotId = 'auto' | 1 | 2 | 3;
export const SLOT_IDS: readonly SlotId[] = ['auto', 1, 2, 3];

/** Load-menu metadata (PLT-0086). */
export interface SlotMeta {
  chapter: number;
  step: number;
  chapterTitle: string;
  /** Patient of the next operation, or the story scene's place. */
  patient: string;
  playtime: number;
  /** ISO timestamp of the save. */
  savedAt: string;
  /** Small JPEG data URL of the operating field, when one was captured. */
  thumbnail?: string;
}

export interface SlotData {
  version: number;
  slot: SlotId;
  progress: CampaignPosition;
  meta: SlotMeta;
  [extra: string]: unknown;
}

/** On-disk wrapper: `sum` is FNV-1a (32-bit, hex) of `JSON.stringify(data)`. */
export interface Envelope<T> {
  format: 'suture-and-steel';
  kind: 'profile' | 'slot' | 'settings';
  sum: string;
  data: T;
}

export const slotFile = (slot: SlotId): string => `slot${slot}.json`;
export const PROFILE_FILE = 'profile.json';
export const SETTINGS_FILE = 'settings.json';
