/**
 * Campaign save facade used by the scenes. The storage engine lives in `src/core/save/` (schema v2,
 * checksummed envelopes, migrations, atomic/backed-up writes, slots); this module keeps the small
 * API the scenes already use — `load`, `store`, `fresh`, `recordBest`, `advance` — on top of it.
 *
 * Autosave behaviour (PLT-0087): the flow calls `store` when a story scene or operation *begins*
 * (recording it as the resume point) and after each operation result — never during an operation.
 * Quitting mid-operation therefore resumes at that operation's briefing.
 */
import type { Rank } from '../surgery/types';
import { BUILD, EDITION } from '../platform/build';
import { platform } from '../platform';
import { notify, setBusy } from '../platform/notify';
import { MemoryStorage } from '../platform/storage';
import { freshProfile } from './save/codec';
import { RANKS, type CampaignPosition, type Profile, type SlotData, type SlotId } from './save/schema';
import { SaveStore, type LegacySource, type ProfileLoad } from './save/store';

export type SaveData = Profile;
export type { SlotData, SlotId } from './save/schema';

function legacySource(): LegacySource | null {
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (!ls) return null;
  return {
    read: (k) => {
      try {
        return ls.getItem(k);
      } catch {
        return null;
      }
    },
    remove: (k) => {
      try {
        ls.removeItem(k);
      } catch {
        // ignore
      }
    },
  };
}

/** Kiosk/booth builds keep nothing between visitors (PLT-0074). */
export const saveStore = new SaveStore(platform.args.kiosk ? new MemoryStorage() : platform.storage, EDITION, BUILD.id, legacySource());

let busyCount = 0;
saveStore.listener = {
  writeStart: () => setBusy(++busyCount > 0),
  writeEnd: () => setBusy((busyCount = Math.max(0, busyCount - 1)) > 0),
  notice: (m, k) => notify(m, k),
};

export const fresh = (): SaveData => freshProfile(EDITION, BUILD.id);

/** Result of the most recent `load()` — outcome and any migrated v1 volume (read by settings). */
export let lastLoad: ProfileLoad | null = null;
let active: SaveData | null = null;

export function load(): SaveData {
  lastLoad = saveStore.loadProfile();
  if (lastLoad.message) notify(lastLoad.message, lastLoad.outcome === 'unrecoverable' ? 'warning' : 'info');
  active = lastLoad.profile;
  return active;
}

/* ───────────── autosave slot metadata ───────────── */

type Describer = (pos: CampaignPosition) => { chapterTitle: string; patient: string };
let describe: Describer = () => ({ chapterTitle: '', patient: '' });
let thumbnail: () => string | undefined = () => undefined;

/** Registered by the session glue with campaign knowledge (keeps core free of content imports). */
export function setSlotDescriber(d: Describer): void {
  describe = d;
}
/** Source of the small field-snapshot thumbnail stored with slots. */
export function setThumbnailSource(t: () => string | undefined): void {
  thumbnail = t;
}

function slotFrom(d: SaveData, slot: SlotId): SlotData {
  const pos = { ...d.progress };
  const thumb = thumbnail();
  return {
    version: d.version,
    slot,
    progress: pos,
    meta: { chapter: pos.chapter, step: pos.step, ...describe(pos), playtime: d.playtime, savedAt: new Date().toISOString(), ...(thumb ? { thumbnail: thumb } : {}) },
  };
}

let lastAuto = '';

/** Persist the profile, and the autosave slot whenever the resume point moved. Asynchronous; never blocks. */
export function store(d: SaveData): void {
  active = d;
  void saveStore.saveProfile(d);
  const pos = `${d.progress.chapter}:${d.progress.step}`;
  if (pos !== lastAuto) {
    lastAuto = pos;
    void saveStore.saveSlot(slotFrom(d, 'auto'));
  }
}

/** Manual save into slot 1–3 (load menu). */
export function saveToSlot(d: SaveData, slot: 1 | 2 | 3): Promise<void> {
  return saveStore.saveSlot(slotFrom(d, slot));
}

/** Resume from a slot: moves the profile's resume point and returns it, or null for an empty slot. */
export function loadFromSlot(d: SaveData, slot: SlotId): CampaignPosition | null {
  const s = saveStore.loadSlot(slot);
  if (!s) return null;
  d.progress = { ...s.progress };
  store(d);
  return d.progress;
}

export const listSlots = () => saveStore.listSlots();

/** Wait for every queued write (quit flow). Stores the active profile first so playtime is kept. */
export async function flushSaves(): Promise<void> {
  if (active) void saveStore.saveProfile(active);
  await saveStore.flush();
}

/** Accumulate playtime on the active profile (persisted with the next store/flush). */
export function addPlaytime(seconds: number): void {
  if (active && Number.isFinite(seconds) && seconds > 0) active.playtime += seconds;
}

export const activeSave = (): SaveData | null => active;

/** Record a result, keeping the better rank/score. Returns true if it's a new best. */
export function recordBest(d: SaveData, opId: string, rank: Rank, score: number): boolean {
  const prev = d.best[opId];
  if (prev && (RANKS.indexOf(prev.rank) > RANKS.indexOf(rank) || (prev.rank === rank && prev.score >= score))) return false;
  d.best[opId] = { rank, score };
  return true;
}

export function advance(d: SaveData, chapter: number, step: number): void {
  const p = d.progress;
  if (chapter > p.chapter || (chapter === p.chapter && step > p.step)) d.progress = { chapter, step };
}
