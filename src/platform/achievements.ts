/**
 * Achievement framework (PLT-0049): data-driven definitions, `unlock` driven by game events, an
 * offline queue persisted in the profile and flushed when Steam connects, and a QA "reset all".
 * Steam API names in `steam/achievements.json` are generated from `ACHIEVEMENTS` (scripts/steam-config.mjs).
 */
import type { Edition } from './editions';
import type { Rank } from '../surgery/types';
import type { SteamPlatform } from './types';
import { log } from './log';

export type GameEvent =
  | { type: 'operation-end'; opId: string; won: boolean; rank: Rank | null; score: number; assisted: boolean; litanyUsed: boolean; maxCombo?: number }
  | { type: 'chapter-complete'; chapter: number }
  | { type: 'edition-complete' };

export interface AchievementDef {
  /** Steam API name. */
  id: string;
  /** Editions whose achievement set contains this one (PLT-0060). */
  sets: readonly Edition[];
  /** English display strings (localised copies live in the Steamworks admin). */
  name: string;
  description: string;
  hidden?: boolean;
  /** Unlock predicate over one game event. */
  when(e: GameEvent): boolean;
}

const opWon = (id: string) => (e: GameEvent) => e.type === 'operation-end' && e.won && e.opId === id;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'FIRST_PATIENT', sets: ['demo', 'full'], name: 'First, Do Little Harm', description: 'Save your first patient.', when: (e) => e.type === 'operation-end' && e.won },
  { id: 'HOUR_OF_MATINS', sets: ['demo', 'full'], name: 'Matins, Unsung', description: 'Purge the Malison of Matins.', when: opWon('op1-5') },
  { id: 'HOUR_OF_LAUDS', sets: ['demo', 'full'], name: 'Lauds, Unsung', description: 'Purge the Malison of Lauds.', when: opWon('op2-5') },
  { id: 'CHAPTER_ONE', sets: ['demo', 'full'], name: 'The Charity Hospice', description: 'Complete Chapter I.', when: (e) => e.type === 'chapter-complete' && e.chapter === 0 },
  { id: 'CHAPTER_TWO', sets: ['demo', 'full'], name: 'Camp Surgeon', description: 'Complete Chapter II.', when: (e) => e.type === 'chapter-complete' && e.chapter === 1 },
  { id: 'RANK_XS', sets: ['demo', 'full'], name: 'Hands of a Saint', description: 'Earn an XS rank on any operation.', when: (e) => e.type === 'operation-end' && e.won && e.rank === 'XS' },
  {
    id: 'NO_STILLNESS',
    sets: ['demo', 'full'],
    name: 'By Steel Alone',
    description: 'Purge a Malison without the Litany of Stillness or assists.',
    hidden: true,
    when: (e) => e.type === 'operation-end' && e.won && !e.litanyUsed && !e.assisted && (e.opId === 'op1-5' || e.opId === 'op2-5'),
  },
];

export const achievementsFor = (edition: Edition): AchievementDef[] => ACHIEVEMENTS.filter((a) => a.sets.includes(edition));

/** Persisted state (stored in the profile as `achievements` / `achievementQueue`). */
export interface AchievementState {
  achievements?: unknown;
  achievementQueue?: unknown;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export class Achievements {
  private defs: AchievementDef[];
  constructor(
    edition: Edition,
    private steam: SteamPlatform,
    private state: AchievementState,
    private persist: () => void,
  ) {
    this.defs = achievementsFor(edition);
    this.state.achievements = strings(state.achievements);
    this.state.achievementQueue = strings(state.achievementQueue);
    steam.onConnected((c) => {
      if (c) void this.flush();
    });
  }

  get unlocked(): string[] {
    return this.state.achievements as string[];
  }
  get queue(): string[] {
    return this.state.achievementQueue as string[];
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.includes(id) || this.steam.achievementState(id) === true;
  }

  /** Evaluate every definition against an event; unlock matches. Returns newly unlocked ids. */
  handle(e: GameEvent): string[] {
    const fresh = this.defs.filter((d) => !this.isUnlocked(d.id) && d.when(e)).map((d) => d.id);
    for (const id of fresh) this.unlock(id);
    return fresh;
  }

  unlock(id: string): void {
    if (!this.defs.some((d) => d.id === id)) {
      log.warn('achievements', `unknown achievement ${id}`);
      return;
    }
    if (!this.unlocked.includes(id)) this.unlocked.push(id);
    if (!this.queue.includes(id)) this.queue.push(id);
    log.info('achievements', `unlocked ${id}`);
    this.persist();
    void this.flush();
  }

  /** Push queued unlocks to Steam; failures stay queued for the next connection. */
  async flush(): Promise<void> {
    if (!this.steam.available || !this.queue.length) return;
    for (const id of [...this.queue]) {
      if (await this.steam.setAchievement(id, true)) this.state.achievementQueue = this.queue.filter((q) => q !== id);
    }
    this.persist();
  }

  /** QA/dev command: clear every achievement locally and on Steam. */
  async resetAll(): Promise<void> {
    for (const d of this.defs) await this.steam.setAchievement(d.id, false);
    this.state.achievements = [];
    this.state.achievementQueue = [];
    this.persist();
    log.info('achievements', 'reset all');
  }
}
