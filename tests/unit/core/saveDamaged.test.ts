/**
 * UIX-0094: a journal that cannot be parsed (truncated JSON) is reported as unrecoverable, the bad
 * file is kept aside as `.damaged`, and the recovery dialog offers the newest manual slot.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encode, freshProfile } from '../../../src/core/save/codec';
import { PROFILE_FILE, slotFile, type SlotData } from '../../../src/core/save/schema';
import { MSG_RESTORED, MSG_UNRECOVERABLE, SaveStore } from '../../../src/core/save/store';
import { MemoryStorage } from '../../../src/platform/storage';
import { recoverableSlot } from '../../../src/scenes/title';

const BUILD = 'test+0.20260925';
const good = readFileSync('tests/fixtures/saves/v2-demo-0.9.0-mid-ch2.json', 'utf8');
/** The fixture cut mid-way through the `best` table: JSON.parse throws. */
const truncated = good.slice(0, Math.floor(good.length * 0.55));

const slot = (n: 1 | 2 | 3, savedAt: string, chapter = 1): SlotData => ({
  version: 2,
  slot: n,
  progress: { chapter, step: 2 },
  meta: { chapter, step: 2, chapterTitle: 'II', patient: 'x', playtime: 60, savedAt },
});

describe('corrupt save handling (UIX-0094)', () => {
  it('a truncated journal with no backup is unrecoverable and kept aside as .damaged', async () => {
    expect(() => JSON.parse(truncated)).toThrow();
    const fs = new MemoryStorage({ [PROFILE_FILE]: truncated });
    const store = new SaveStore(fs, 'demo', BUILD);
    const r = store.loadProfile();
    expect(r.outcome).toBe('unrecoverable');
    expect(r.message).toBe(MSG_UNRECOVERABLE);
    expect(r.profile.progress).toEqual({ chapter: 0, step: 0 });
    await Promise.resolve();
    expect(fs.read(`${PROFILE_FILE}.damaged`)).toBe(truncated);
    // Nothing has been written over the journal yet: the player chooses in the dialog.
    expect(fs.read(PROFILE_FILE)).toBe(truncated);
  });

  it('a truncated journal with a good backup is restored silently from it', () => {
    const fs = new MemoryStorage({ [PROFILE_FILE]: truncated, [`${PROFILE_FILE}.bak`]: good });
    const r = new SaveStore(fs, 'demo', BUILD).loadProfile();
    expect(r.outcome).toBe('restored-backup');
    expect(r.message).toBe(MSG_RESTORED);
    expect(r.profile.progress.chapter).toBe(1);
  });

  it('"Restore" offers the newest manual slot, never the autosave, and nothing when all are empty', () => {
    const fs = new MemoryStorage({
      [PROFILE_FILE]: truncated,
      [slotFile(1)]: encode('slot', slot(1, '2026-09-01T10:00:00.000Z')),
      [slotFile(3)]: encode('slot', slot(3, '2026-09-20T10:00:00.000Z')),
      [slotFile('auto')]: encode('slot', { ...slot(1, '2026-09-25T10:00:00.000Z'), slot: 'auto' }),
    });
    const store = new SaveStore(fs, 'demo', BUILD);
    const pick = recoverableSlot(store.listSlots());
    expect(pick?.slot).toBe(3);
    expect(recoverableSlot(new SaveStore(new MemoryStorage(), 'demo', BUILD).listSlots())).toBeNull();
  });

  it('starting fresh writes a valid journal over the damaged one', async () => {
    const fs = new MemoryStorage({ [PROFILE_FILE]: truncated });
    const store = new SaveStore(fs, 'demo', BUILD);
    const r = store.loadProfile();
    await store.saveProfile(r.profile);
    const again = new SaveStore(fs, 'demo', BUILD).loadProfile();
    expect(again.outcome).toBe('ok');
    expect(again.profile.edition).toBe(freshProfile('demo', BUILD).edition);
  });
});
