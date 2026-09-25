/**
 * The boss phase sheet (BOS-0009): for every Hour and the Office, each phase's tells (ids in
 * BOSS_TELLS), the instruments that counter it, and Ilse's hint for it. The content lint
 * (tests/boss-lint.test.ts) holds every phase to ≥ 1 tell, ≥ 1 counter, a hint line and a codex
 * entry; the hint is what Ilse offers after a loss in that phase.
 */
import type { Entity } from '../entity';
import type { Operation } from '../operation';
import type { ToolId } from '../types';
import { BOSS_OPS, type CodexBoss } from './codex';

export interface PhaseSheet {
  name: string;
  tells: readonly string[];
  counters: readonly ToolId[];
  hint: string;
}

export const BOSS_SHEET: Record<CodexBoss, readonly PhaseSheet[]> = {
  matins: [
    { name: 'Vigil', tells: ['open', 'rend'], counters: ['brand', 'thread'], hint: 'Watch the shroud tremble — brand only once it opens, and stitch the rends while it is veiled.' },
    { name: 'Watchfire', tells: ['open', 'rend'], counters: ['brand', 'tongs'], hint: 'Its openings are shorter now. Pull the crawling shards off the wounds between them.' },
    { name: 'The Eye', tells: ['beat', 'gaze'], counters: ['brand'], hint: 'Count the Eye’s beats: brand on the third, and slide off its gaze line before it lashes.' },
  ],
  lauds: [
    { name: 'Call', tells: ['hymn'], counters: ['brand', 'thread'], hint: 'Trace each Voice’s sigil with the brand; stitch the Hymn’s tears as they open.' },
    { name: 'Response', tells: ['dim'], counters: ['brand', 'lancet'], hint: 'Strike one body, then the other within the answer — or cut the thread while it dims.' },
    { name: 'Dawn', tells: ['flare'], counters: ['lens', 'brand'], hint: 'Find its ripples with the lens between flares; when the horizon glows, look away.' },
  ],
  prime: [
    { name: 'Roll-Call', tells: ['stroke', 'name'], counters: ['lancet', 'brand'], hint: 'Strike the newest stroke out first with the lancet; brand the quill while it reels.' },
    { name: 'The Ledger', tells: ['stroke', 'name'], counters: ['lancet', 'brand'], hint: 'Red ink is nearest the heart and writes faster — erase those names first.' },
    { name: 'Kreuzer', tells: ['stroke', 'name'], counters: ['lancet', 'leech', 'brand'], hint: 'Draw off the ink before it writes, and keep your instruments out of it.' },
  ],
  terce: [
    { name: 'Kindling', tells: ['leap'], counters: ['salve', 'lancet'], hint: 'Salve the flame-front, then cut out the ember — and never the brand, it feeds the fire.' },
    { name: 'Pentecost', tells: ['leap'], counters: ['salve'], hint: 'Douse all three tongues together, within two seconds, or they merge again.' },
    { name: 'Ash', tells: ['leap'], counters: ['leech', 'lancet'], hint: 'Draw the smoke off with the leech-pipe to clear the haze, then cut round the core.' },
  ],
  sext: [
    { name: 'Languor', tells: ['torpor'], counters: ['tincture', 'lancet', 'brand'], hint: 'When your hands drag, a blue tincture quickens them. Chip the crust off, then brand it.' },
    { name: 'False Noon', tells: ['falseNoon', 'torpor'], counters: ['lens', 'tincture', 'brand'], hint: 'The monitor lies — hold the lens on the heart to read the true vitals.' },
    { name: 'Stillborn Hour', tells: ['stillborn'], counters: ['brand'], hint: 'Break the three sun-dials with the brand to end its stillness — or meet it with your Litany.' },
  ],
  none: [
    { name: 'Descent', tells: ['heart'], counters: ['lens', 'lancet', 'brand'], hint: 'Track the head with the lens and cut across its path ahead of it; brand it when it surfaces.' },
    { name: 'Division', tells: ['heart'], counters: ['lancet', 'brand'], hint: 'Each piece races alone now. Cut off the one nearest the heart first.' },
    { name: 'Ninth Hour', tells: ['surface'], counters: ['lancet', 'tongs'], hint: 'Cut the core down three times, then pull it with the tongs before it regrows.' },
  ],
  vespers: [
    { name: 'Lucernarium', tells: ['dim'], counters: ['brand', 'lancet', 'leech'], hint: 'Keep the lamps lit with the brand; sever the wicks you can see and draw off the tallow.' },
    { name: 'Magnificat', tells: ['snuff', 'dim'], counters: ['brand'], hint: 'When two lamps gutter, relight them — it can be struck only against a lit lamp.' },
    { name: 'Last Light', tells: ['dim'], counters: ['brand', 'lancet'], hint: 'Keep the last lamp alive and follow the wick back to its root.' },
  ],
  compline: [
    { name: 'Examen', tells: ['silence'], counters: ['brand', 'lancet'], hint: 'Beat each old Hour it wears the way you beat it before. Watch, not listen, in the silences.' },
    { name: 'Nunc Dimittis', tells: ['steal', 'silence'], counters: ['brand'], hint: 'Brand every silence-node to take your Litany back.' },
    { name: 'Great Silence', tells: ['silence'], counters: ['lancet', 'brand'], hint: 'Open it with the lancet and brand it at once — both in one breath.' },
  ],
  office: [
    { name: 'Dial', tells: ['dial'], counters: ['lancet', 'brand', 'salve', 'lens'], hint: 'The hand shows which Hour is next — meet each with its own counter.' },
    { name: 'Unison', tells: ['dial'], counters: ['lancet', 'brand', 'salve', 'lens'], hint: 'Two Hours at once: finish the one that bleeds him faster first.' },
    { name: 'The Choir’s Heart', tells: ['lash'], counters: ['brand'], hint: 'Burn out every stroke of the conductor’s sigil. I will hold him — and pray with you.' },
  ],
};

/** The phase (0-based) a boss entity is in, whatever its shape (MalisonBase `phaseIx`, or a 1-based `stage`/`phaseNo`). */
export function bossPhaseIndex(e: Entity): number | null {
  const b = e as unknown as { phaseIx?: number; stage?: number; phaseNo?: number };
  if (typeof b.phaseIx === 'number') return b.phaseIx;
  if (typeof b.stage === 'number') return b.stage - 1;
  if (typeof b.phaseNo === 'number') return b.phaseNo - 1;
  return null;
}

/**
 * Is this entity an Hour itself — a phased boss core that is not an elite? (The later Hours are
 * plain entities: an HP pool and a stage; the Office counts its lit hour-sigils instead of HP.)
 */
export function isHour(e: Entity): boolean {
  const b = e as unknown as { hp?: unknown; maxHp?: unknown; elite?: boolean; lit?: unknown };
  if (!e.alive || b.elite || bossPhaseIndex(e) === null) return false;
  return (typeof b.hp === 'number' && typeof b.maxHp === 'number') || b.lit instanceof Set;
}

/** Ilse's hint for the phase of the Hour an operation was lost in (null when not a boss operation). */
export function bossPhaseHint(op: Operation): string | null {
  const boss = BOSS_OPS[op.def.id.replace(/-x\d$/, '')];
  if (!boss) return null;
  const sheet = BOSS_SHEET[boss];
  for (const e of op.entities) {
    if (!isHour(e)) continue;
    const ix = bossPhaseIndex(e);
    if (ix !== null && sheet[ix]) return sheet[ix].hint;
  }
  return null;
}
