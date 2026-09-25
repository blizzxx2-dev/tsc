/**
 * Campaign state read by the front-end screens (title, chapter select, save slots, demo summary):
 * which chapters are reached or finished, what "next step" a save position names, the demo-complete
 * flag, play-time and date formatting, and the small run-statistics ledger (Litany uses, longest
 * chain) the demo summary shows. Kept free of drawing so it is unit-testable.
 */
import { CAMPAIGN } from '../content/campaign';
import type { SaveData } from '../core/save';
import { store } from '../core/save';
import type { CampaignPosition } from '../core/save/schema';
import { intlLocale, t } from '../i18n';
import { onGameEvent } from '../platform/events';
import { progress } from '../surgery/session';
import { RANKS } from '../core/save/schema';
import type { Rank } from '../surgery/types';
import { save } from './flow';

/** Run statistics kept on the profile (an extra field, so the save schema is untouched). */
export interface RunStats {
  litanyUses: number;
  longestChain: number;
  operations: number;
}

const FRESH_STATS: RunStats = { litanyUses: 0, longestChain: 0, operations: 0 };

export function statsOf(d: SaveData = save): RunStats {
  const raw = d.stats as Partial<RunStats> | undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return raw && typeof raw === 'object' ? { litanyUses: num(raw.litanyUses), longestChain: num(raw.longestChain), operations: num(raw.operations) } : { ...FRESH_STATS };
}

/** Fold one finished operation into the ledger. Returns the updated stats. */
export function recordStats(d: SaveData, r: { litanyUsed: boolean; maxCombo?: number }): RunStats {
  const s = statsOf(d);
  s.operations += 1;
  if (r.litanyUsed) s.litanyUses += 1;
  if (r.maxCombo !== undefined) s.longestChain = Math.max(s.longestChain, Math.floor(r.maxCombo));
  d.stats = s;
  return s;
}

onGameEvent((e) => {
  if (e.type !== 'operation-end') return;
  recordStats(save, { litanyUsed: e.litanyUsed, maxCombo: e.maxCombo });
  store(save);
});

/** The campaign has been played through to the end of the last chapter this edition ships. */
export function campaignComplete(d: SaveData = save, cleared = progress.chaptersCleared): boolean {
  const p = d.progress;
  const last = CAMPAIGN[CAMPAIGN.length - 1];
  if (!last) return false;
  return cleared >= CAMPAIGN.length || p.chapter >= CAMPAIGN.length || (p.chapter === CAMPAIGN.length - 1 && p.step >= last.steps.length);
}

/** A campaign is under way (something other than the very first step has been reached). */
export const campaignStarted = (d: SaveData = save): boolean => d.progress.chapter > 0 || d.progress.step > 0;

/** The player may open chapter `ci`: it is the current one or an earlier one. */
export const chapterReached = (ci: number, d: SaveData = save): boolean => ci <= d.progress.chapter && ci < CAMPAIGN.length;

/** Share of chapter `ci`'s steps completed, 0..1. */
export function chapterCompletion(ci: number, d: SaveData = save): number {
  const ch = CAMPAIGN[ci];
  if (!ch || !ch.steps.length) return 0;
  const p = d.progress;
  if (p.chapter > ci || campaignComplete(d)) return 1;
  if (p.chapter < ci) return 0;
  return Math.max(0, Math.min(1, p.step / ch.steps.length));
}

/** Operation ids of a chapter, in order. */
export const chapterOps = (ci: number) => (CAMPAIGN[ci]?.steps ?? []).flatMap((s) => (s.kind === 'op' ? [s.op] : []));

/** Best rank per operation of a chapter (null when unplayed). */
export const chapterRanks = (ci: number, d: SaveData = save): (Rank | null)[] => chapterOps(ci).map((op) => d.best[op.id]?.rank ?? null);

/** Operations of the chapters up to and including the given position that carry a best result. */
export function sealCount(pos: CampaignPosition, d: SaveData = save): number {
  let n = 0;
  CAMPAIGN.forEach((ch, ci) =>
    ch.steps.forEach((s, si) => {
      if (s.kind === 'op' && (ci < pos.chapter || (ci === pos.chapter && si <= pos.step)) && d.best[s.op.id]) n++;
    }),
  );
  return n;
}

/** Number of operations with a best of `rank` or better. */
export const countRank = (rank: Rank, d: SaveData = save): number => Object.values(d.best).filter((b) => RANKS.indexOf(b.rank) >= RANKS.indexOf(rank)).length;

/** Localised chapter title ("I. The Hour of Matins") or the end-of-campaign line. */
export function chapterLabel(pos: CampaignPosition): string {
  const ch = CAMPAIGN[pos.chapter];
  return ch ? t('ui.chapters.card_title', { numeral: ch.numeral, title: ch.title }) : t('ui.slots.campaign_done');
}

/** What the next step at `pos` is: an operation's title, or where the story scene takes place. */
export function stepLabel(pos: CampaignPosition): string {
  const step = CAMPAIGN[pos.chapter]?.steps[pos.step];
  if (!step) return t('ui.slots.campaign_done');
  return step.kind === 'op' ? step.op.title : t('ui.slots.story_step', { place: step.story.place });
}

/** "2h 14m" style play time. */
export function formatPlaytime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? t('ui.common.playtime_hm', { h, m }) : t('ui.common.playtime_m', { m });
}

/** Locale date for "last played". Unparseable input gives an empty string. */
export function formatDate(iso: string | undefined, locale: string = intlLocale()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
