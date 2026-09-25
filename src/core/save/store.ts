/**
 * SaveStore (PLT-0079): durable, asynchronous saving over any FileStorage backend — the desktop file
 * system through the platform bridge, IndexedDB/localStorage in the browser, or memory in tests.
 *
 *  - Reads are synchronous (from the backend's boot snapshot), writes are queued and coalesced per file
 *    so saving never blocks a frame (PLT-0089).
 *  - The previous good file is kept as `<name>.bak` (the desktop main process does this atomically on
 *    disk; for web backends the store copies it before overwriting) — PLT-0082.
 *  - Loading falls back profile → .bak → autosave slot and reports what happened so the player sees
 *    "restored from a backup" instead of a silent reset (PLT-0083).
 *  - Failed writes (read-only or full disk) raise a non-blocking warning and retry with backoff while
 *    the game keeps running (PLT-0135).
 */
import type { Edition } from '../../platform/editions';
import type { FileStorage } from '../../platform/types';
import { decode, encode, freshProfile, readProfile, readSlot, sanitizePosition, type LoadOutcome } from './codec';
import { PROFILE_FILE, SAVE_VERSION, SLOT_IDS, slotFile, type Profile, type SlotData, type SlotId } from './schema';

/** Old localStorage keys: the working title's (PLT-0081) and the pre-v2 key. */
export const LEGACY_SAVE_KEYS = ['suture-and-steel.save', 'grim-apothecary.save'] as const;

export interface LegacySource {
  read(key: string): string | null;
  remove(key: string): void;
}

export interface SaveListener {
  writeStart?(): void;
  writeEnd?(ok: boolean): void;
  /** Non-blocking message for the player (damaged journal, disk trouble). */
  notice?(message: string, kind: 'info' | 'warning'): void;
}

export interface ProfileLoad {
  profile: Profile;
  outcome: LoadOutcome;
  /** Player-facing explanation when something was repaired. */
  message: string | null;
  /** v1 saves carried the volume; settings migrate it (PLT-0078). */
  legacyVolume: number | null;
}

export const MSG_RESTORED = 'Your journal was damaged and restored from a backup.';
export const MSG_RESTORED_AUTOSAVE = 'Your journal was damaged and restored from the last autosave. Some best ranks may be missing.';
export const MSG_UNRECOVERABLE = 'Your journal was damaged beyond repair and a fresh one was begun. The damaged copy was kept beside it.';
export const MSG_WRITE_FAILED = 'Your journal could not be written — the disk may be full or read-only. Retrying…';
export const MSG_WRITE_RECOVERED = 'Your journal is being written again.';

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 15000, 30000];

interface Pending {
  data: string;
  waiters: (() => void)[];
}

export class SaveStore {
  private queue = new Map<string, Pending>();
  private running: Promise<void> | null = null;
  private failing = false;
  listener: SaveListener = {};
  /** Injectable for tests. */
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Give up retrying after this many attempts per write (Infinity in the game; small in tests). */
  maxAttempts = Infinity;

  constructor(
    readonly fs: FileStorage,
    readonly edition: Edition,
    readonly build: string,
    private legacy: LegacySource | null = null,
  ) {}

  get pending(): number {
    return this.queue.size;
  }

  /* ───────────── loading ───────────── */

  loadProfile(): ProfileLoad {
    const primary = this.fs.read(PROFILE_FILE);
    const main = readProfile(primary, this.edition, this.build);
    if (main) return { profile: main.profile, outcome: main.migratedFrom ? 'migrated' : 'ok', message: null, legacyVolume: null };

    const hadPrimary = primary !== null && primary.trim() !== '';
    const bak = readProfile(this.fs.read(`${PROFILE_FILE}.bak`), this.edition, this.build);
    if (bak) {
      if (hadPrimary) void this.fs.write(`${PROFILE_FILE}.damaged`, primary);
      void this.writeNow(PROFILE_FILE, bak.profile);
      return { profile: bak.profile, outcome: 'restored-backup', message: hadPrimary ? MSG_RESTORED : null, legacyVolume: null };
    }

    if (!hadPrimary) {
      const legacy = this.loadLegacy();
      if (legacy) return legacy;
    }

    const auto = this.loadSlot('auto');
    if (hadPrimary) void this.fs.write(`${PROFILE_FILE}.damaged`, primary);
    if (auto) {
      const p = freshProfile(this.edition, this.build);
      p.progress = { ...auto.progress };
      p.playtime = auto.meta.playtime;
      void this.writeNow(PROFILE_FILE, p);
      return { profile: p, outcome: 'restored-autosave', message: hadPrimary ? MSG_RESTORED_AUTOSAVE : null, legacyVolume: null };
    }
    const p = freshProfile(this.edition, this.build);
    return hadPrimary ? { profile: p, outcome: 'unrecoverable', message: MSG_UNRECOVERABLE, legacyVolume: null } : { profile: p, outcome: 'fresh', message: null, legacyVolume: null };
  }

  /** First-run import of a v1 localStorage save (PLT-0081). */
  private loadLegacy(): ProfileLoad | null {
    if (!this.legacy) return null;
    for (const key of LEGACY_SAVE_KEYS) {
      const raw = this.legacy.read(key);
      if (!raw) continue;
      const parsed = decode(raw, 'profile');
      const r = readProfile(raw, this.edition, this.build);
      if (!r || !parsed.ok) continue;
      const v1 = parsed.data as { volume?: unknown };
      const legacyVolume = typeof v1.volume === 'number' && Number.isFinite(v1.volume) ? Math.min(1, Math.max(0, v1.volume)) : null;
      const legacy = this.legacy;
      void this.writeNow(PROFILE_FILE, r.profile).then(() => {
        // Only forget the old key once the v2 profile is safely stored.
        if (this.fs.read(PROFILE_FILE)) for (const k of LEGACY_SAVE_KEYS) legacy.remove(k);
      });
      return { profile: r.profile, outcome: 'migrated', message: null, legacyVolume };
    }
    return null;
  }

  loadSlot(slot: SlotId): SlotData | null {
    return readSlot(this.fs.read(slotFile(slot)), slot) ?? readSlot(this.fs.read(`${slotFile(slot)}.bak`), slot);
  }

  listSlots(): { slot: SlotId; data: SlotData | null }[] {
    return SLOT_IDS.map((slot) => ({ slot, data: this.loadSlot(slot) }));
  }

  /* ───────────── saving ───────────── */

  saveProfile(p: Profile): Promise<void> {
    p.updatedAt = new Date().toISOString();
    p.edition = this.edition;
    p.build = this.build;
    return this.write(PROFILE_FILE, encode('profile', p));
  }

  saveSlot(data: SlotData): Promise<void> {
    data.version = Math.max(SAVE_VERSION, data.version);
    data.progress = sanitizePosition(data.progress);
    return this.write(slotFile(data.slot), encode('slot', data));
  }

  deleteSlot(slot: SlotId): Promise<void> {
    this.queue.delete(slotFile(slot));
    return Promise.all([this.fs.remove(slotFile(slot)), this.fs.remove(`${slotFile(slot)}.bak`)]).then(() => undefined);
  }

  private writeNow(name: string, p: Profile): Promise<void> {
    return this.write(name, encode('profile', p));
  }

  /** Queue a write; a newer write to the same file replaces a queued one. Resolves once it is durable (or abandoned). */
  write(name: string, data: string): Promise<void> {
    return new Promise((resolve) => {
      const q = this.queue.get(name);
      if (q) {
        q.data = data;
        q.waiters.push(resolve);
      } else this.queue.set(name, { data, waiters: [resolve] });
      this.pump();
    });
  }

  /** Resolves when every queued write has been attempted to completion (quit flow, PLT-0017). */
  async flush(): Promise<void> {
    while (this.running) await this.running;
  }

  private pump(): void {
    if (this.running) return;
    this.running = (async () => {
      this.listener.writeStart?.();
      let allOk = true;
      while (this.queue.size) {
        const [name, job] = this.queue.entries().next().value as [string, Pending];
        this.queue.delete(name);
        const ok = await this.writeWithRetry(name, job);
        allOk &&= ok;
        job.waiters.forEach((w) => w());
      }
      this.running = null;
      this.listener.writeEnd?.(allOk);
    })();
  }

  private async writeWithRetry(name: string, job: Pending): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      // A newer version queued meanwhile supersedes this one.
      const newer = this.queue.get(name);
      if (newer) {
        this.queue.delete(name);
        job.data = newer.data;
        job.waiters.push(...newer.waiters);
      }
      if (await this.writeOnce(name, job.data)) {
        if (this.failing) {
          this.failing = false;
          this.listener.notice?.(MSG_WRITE_RECOVERED, 'info');
        }
        return true;
      }
      if (!this.failing) {
        this.failing = true;
        this.listener.notice?.(MSG_WRITE_FAILED, 'warning');
      }
      await this.sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    }
    return false;
  }

  private async writeOnce(name: string, data: string): Promise<boolean> {
    try {
      if (this.fs.backend !== 'desktop-fs') {
        // Keep the previous good copy; the desktop backend does this atomically on disk.
        const prev = this.fs.read(name);
        if (prev && prev !== data && decode(prev, name.startsWith('slot') ? 'slot' : name === 'settings.json' ? 'settings' : 'profile').ok) {
          const b = await this.fs.write(`${name}.bak`, prev);
          if (!b.ok) return false;
        }
      }
      return (await this.fs.write(name, data)).ok;
    } catch {
      return false;
    }
  }
}
