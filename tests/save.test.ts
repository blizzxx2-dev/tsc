import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { checksum, decode, encode, freshProfile, migrate, readProfile, readSlot, sanitizeProfile } from '../src/core/save/codec';
import { PROFILE_FILE, SAVE_VERSION, slotFile, type Profile } from '../src/core/save/schema';
import { LEGACY_SAVE_KEYS, MSG_RESTORED, MSG_RESTORED_AUTOSAVE, MSG_UNRECOVERABLE, MSG_WRITE_FAILED, SaveStore, type LegacySource } from '../src/core/save/store';
import { MemoryStorage } from '../src/platform/storage';
import type { FileStorage } from '../src/platform/types';
import { Rng } from '../src/core/math';

const FIX = 'tests/fixtures/saves';
const fixture = (n: string) => readFileSync(`${FIX}/${n}`, 'utf8');
const BUILD = 'test+0.20260925';

function legacy(entries: Record<string, string>): LegacySource & { store: Map<string, string> } {
  const store = new Map(Object.entries(entries));
  return { store, read: (k) => store.get(k) ?? null, remove: (k) => void store.delete(k) };
}

function assertValid(p: Profile): void {
  expect(p.version).toBeGreaterThanOrEqual(SAVE_VERSION);
  expect(['demo', 'full']).toContain(p.edition);
  expect(Number.isInteger(p.progress.chapter) && p.progress.chapter >= 0).toBe(true);
  expect(Number.isInteger(p.progress.step) && p.progress.step >= 0).toBe(true);
  expect(Array.isArray(p.unlocks)).toBe(true);
  expect(Number.isFinite(p.playtime) && p.playtime >= 0).toBe(true);
  for (const r of Object.values(p.best)) {
    expect(['C', 'B', 'A', 'S', 'XS']).toContain(r.rank);
    expect(Number.isFinite(r.score)).toBe(true);
  }
}

describe('save codec', () => {
  it('checksums are stable FNV-1a', () => {
    expect(checksum('')).toBe('811c9dc5');
    expect(checksum('a')).toBe('e40c292c');
  });

  it('round-trips an envelope and rejects tampering', () => {
    const p = freshProfile('demo', BUILD);
    const text = encode('profile', p);
    const d = decode(text, 'profile');
    expect(d.ok && d.data).toEqual(p);
    expect(decode(text.replace('"playtime":0', '"playtime":9'), 'profile')).toEqual({ ok: false, error: 'checksum' });
    expect(decode(text, 'slot')).toEqual({ ok: false, error: 'format' });
    expect(decode('{"half":', 'profile')).toEqual({ ok: false, error: 'syntax' });
    expect(decode('', 'profile')).toEqual({ ok: false, error: 'empty' });
  });

  it('migrates v1 → v2: volume leaves the save, metadata is added', () => {
    const v1 = JSON.parse(fixture('v1-grim-apothecary.json'));
    const { data, from } = migrate(v1);
    expect(from).toBe(1);
    expect(data.version).toBe(2);
    expect('volume' in data).toBe(false);
    expect(data.contentIds).toBe(1);
  });

  it('loads every historic fixture save into a valid profile (save-compatibility suite)', () => {
    const files = readdirSync(FIX).filter((f) => /^v\d.*\.json$/.test(f) && !f.includes('slot'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const r = readProfile(fixture(f), 'demo', BUILD);
      expect(r, f).not.toBeNull();
      assertValid(r!.profile);
    }
    const slot = readSlot(fixture('v2-demo-0.9.0-slotauto.json'), 'auto');
    expect(slot?.progress).toEqual({ chapter: 1, step: 4 });
    expect(slot?.meta.chapterTitle).toBe('II. The Hour of Lauds');
  });

  it('keeps unknown future fields and never lowers the version (downgrade from a beta)', () => {
    const r = readProfile(fixture('v3-future-beta.json'), 'demo', BUILD)!;
    expect(r.profile.version).toBe(3);
    expect(r.profile.ghostField).toEqual({ keep: true });
    expect(r.profile.newGameCycle).toBe(2);
    const again = readProfile(encode('profile', r.profile), 'demo', BUILD)!;
    expect(again.profile.ghostField).toEqual({ keep: true });
    expect(again.profile.version).toBe(3);
  });

  it('clamps and repairs out-of-range fields', () => {
    const p = sanitizeProfile({ progress: { chapter: -3, step: 1e9 }, best: { a: { rank: 'Z', score: 1 }, b: { rank: 'S', score: 'x' } }, unlocks: [1, 'x', 'x'], playtime: -5 }, 'demo', BUILD);
    expect(p.progress).toEqual({ chapter: 0, step: 999 });
    expect(p.best).toEqual({ b: { rank: 'S', score: 0 } });
    expect(p.unlocks).toEqual(['x']);
    expect(p.playtime).toBe(0);
  });

  it('fuzz: 1,000 mutated or truncated saves never throw and always yield a valid profile', () => {
    const rng = new Rng(20260925);
    const seeds = readdirSync(FIX).map(fixture);
    const store = new SaveStore(new MemoryStorage(), 'demo', BUILD);
    for (let i = 0; i < 1000; i++) {
      let s = seeds[Math.floor(rng.next() * seeds.length)];
      const ops = 1 + Math.floor(rng.next() * 4);
      for (let k = 0; k < ops; k++) {
        const at = Math.floor(rng.next() * s.length);
        const op = rng.next();
        if (op < 0.3) s = s.slice(0, at); // truncate (power cut)
        else if (op < 0.6) s = s.slice(0, at) + String.fromCharCode(32 + Math.floor(rng.next() * 94)) + s.slice(at + 1); // flip a char
        else if (op < 0.8) s = s.slice(0, at) + s.slice(at + 1 + Math.floor(rng.next() * 20)); // delete a run
        else s = s.slice(0, at) + '{"version":' + Math.floor(rng.next() * 9) + s.slice(at); // inject garbage
      }
      const fs = new MemoryStorage({ [PROFILE_FILE]: s });
      const st = new SaveStore(fs, 'demo', BUILD);
      st.sleep = () => Promise.resolve();
      let loaded: Profile | undefined;
      expect(() => (loaded = st.loadProfile().profile)).not.toThrow();
      assertValid(loaded!);
    }
    expect(store.pending).toBe(0);
  });
});

describe('SaveStore', () => {
  it('imports the legacy grim-apothecary localStorage save on first run and forgets it once stored', async () => {
    const fs = new MemoryStorage();
    const src = legacy({ 'grim-apothecary.save': fixture('v1-grim-apothecary.json') });
    const st = new SaveStore(fs, 'demo', BUILD, src);
    const r = st.loadProfile();
    expect(r.outcome).toBe('migrated');
    expect(r.legacyVolume).toBe(0.35);
    expect(r.profile.progress).toEqual({ chapter: 0, step: 5 });
    expect(r.profile.best['op1-2']).toEqual({ rank: 'S', score: 6100 });
    await st.flush();
    await new Promise((res) => setTimeout(res, 0));
    expect(decode(fs.read(PROFILE_FILE), 'profile').ok).toBe(true);
    for (const k of LEGACY_SAVE_KEYS) expect(src.store.has(k)).toBe(false);
  });

  it('prefers the newer legacy key over the working-title key', () => {
    const st = new SaveStore(new MemoryStorage(), 'demo', BUILD, legacy({ 'grim-apothecary.save': fixture('v1-grim-apothecary.json'), 'suture-and-steel.save': fixture('v1-suture-and-steel.json') }));
    expect(st.loadProfile().profile.progress).toEqual({ chapter: 1, step: 3 });
  });

  it('keeps the previous good file as .bak and restores it with a message when the main file is damaged', async () => {
    const fs = new MemoryStorage();
    const st = new SaveStore(fs, 'demo', BUILD);
    const p = freshProfile('demo', BUILD);
    p.progress = { chapter: 1, step: 2 };
    await st.saveProfile(p);
    p.progress = { chapter: 1, step: 3 };
    await st.saveProfile(p);
    expect(readProfile(fs.read(`${PROFILE_FILE}.bak`), 'demo', BUILD)!.profile.progress).toEqual({ chapter: 1, step: 2 });
    fs.files.set(PROFILE_FILE, fs.read(PROFILE_FILE)!.slice(0, 40)); // power cut mid-write
    const r = new SaveStore(fs, 'demo', BUILD).loadProfile();
    expect(r.outcome).toBe('restored-backup');
    expect(r.message).toBe(MSG_RESTORED);
    expect(r.profile.progress).toEqual({ chapter: 1, step: 2 });
    expect(fs.read(`${PROFILE_FILE}.damaged`)).toContain('suture-and-steel');
  });

  it('falls back to the autosave slot, then to a fresh journal — never silently', () => {
    const fs = new MemoryStorage({ [PROFILE_FILE]: 'garbage', [slotFile('auto')]: fixture('v2-demo-0.9.0-slotauto.json') });
    const r = new SaveStore(fs, 'demo', BUILD).loadProfile();
    expect(r.outcome).toBe('restored-autosave');
    expect(r.message).toBe(MSG_RESTORED_AUTOSAVE);
    expect(r.profile.progress).toEqual({ chapter: 1, step: 4 });
    const r2 = new SaveStore(new MemoryStorage({ [PROFILE_FILE]: 'garbage' }), 'demo', BUILD).loadProfile();
    expect(r2.outcome).toBe('unrecoverable');
    expect(r2.message).toBe(MSG_UNRECOVERABLE);
    const r3 = new SaveStore(new MemoryStorage(), 'demo', BUILD).loadProfile();
    expect(r3.outcome).toBe('fresh');
    expect(r3.message).toBeNull();
  });

  it('coalesces queued writes to the same file', async () => {
    const writes: string[] = [];
    const mem = new MemoryStorage();
    const fs: FileStorage = { backend: 'desktop-fs', read: (n) => mem.read(n), list: () => mem.list(), remove: (n) => mem.remove(n), write: (n, d) => (writes.push(d), mem.write(n, d)) };
    const st = new SaveStore(fs, 'demo', BUILD);
    const all = [1, 2, 3, 4].map((i) => st.write('slot1.json', String(i)));
    await Promise.all(all);
    expect(writes).toEqual(['1', '4']);
  });

  it('read-only or full disk: warns once, retries with backoff and keeps the game running', async () => {
    let failures = 3;
    const mem = new MemoryStorage();
    const fs: FileStorage = { backend: 'desktop-fs', read: (n) => mem.read(n), list: () => mem.list(), remove: (n) => mem.remove(n), write: (n, d) => (failures-- > 0 ? Promise.resolve({ ok: false, error: 'ENOSPC' }) : mem.write(n, d)) };
    const st = new SaveStore(fs, 'demo', BUILD);
    const sleeps: number[] = [];
    st.sleep = (ms) => (sleeps.push(ms), Promise.resolve());
    const notices: string[] = [];
    st.listener = { notice: (m) => notices.push(m) };
    await st.saveProfile(freshProfile('demo', BUILD));
    expect(sleeps).toEqual([500, 1000, 2000]);
    expect(notices[0]).toBe(MSG_WRITE_FAILED);
    expect(notices).toHaveLength(2);
    expect(mem.read(PROFILE_FILE)).not.toBeNull();
  });

  it('serialising a full profile stays well under a 2 ms frame budget', () => {
    const p = freshProfile('full', BUILD);
    for (let c = 1; c <= 5; c++) for (let i = 1; i <= 10; i++) p.best[`op${c}-${i}`] = { rank: 'S', score: 99999 };
    p.unlocks = Array.from({ length: 100 }, (_, i) => `unlock.${i}`);
    encode('profile', p);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) encode('profile', p);
    expect((performance.now() - t0) / 100).toBeLessThan(2);
  });
});
