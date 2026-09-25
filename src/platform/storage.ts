import type { WriteResult } from './bridge';
import type { FileStorage } from './types';

/** In-memory backend — tests, kiosk/booth mode (no saves, PLT-0074), and the last-resort web fallback. */
export class MemoryStorage implements FileStorage {
  readonly backend = 'memory' as const;
  readonly files = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.files.set(k, v);
  }
  read(name: string): string | null {
    return this.files.get(name) ?? null;
  }
  list(): string[] {
    return [...this.files.keys()].sort();
  }
  write(name: string, data: string): Promise<WriteResult> {
    this.files.set(name, data);
    return Promise.resolve({ ok: true });
  }
  remove(name: string): Promise<WriteResult> {
    this.files.delete(name);
    return Promise.resolve({ ok: true });
  }
}

/** Synchronous localStorage backend: the web fallback when IndexedDB is unavailable. */
export class LocalStorageBackend implements FileStorage {
  readonly backend = 'localstorage' as const;
  constructor(
    private ls: Storage,
    private prefix: string,
  ) {}
  read(name: string): string | null {
    try {
      return this.ls.getItem(this.prefix + name);
    } catch {
      return null;
    }
  }
  list(): string[] {
    const out: string[] = [];
    try {
      for (let i = 0; i < this.ls.length; i++) {
        const k = this.ls.key(i);
        if (k?.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
      }
    } catch {
      // storage blocked
    }
    return out.sort();
  }
  write(name: string, data: string): Promise<WriteResult> {
    try {
      this.ls.setItem(this.prefix + name, data);
      return Promise.resolve({ ok: true });
    } catch (e) {
      return Promise.resolve({ ok: false, error: (e as Error).name || 'QuotaExceededError' });
    }
  }
  remove(name: string): Promise<WriteResult> {
    try {
      this.ls.removeItem(this.prefix + name);
    } catch {
      // ignore
    }
    return Promise.resolve({ ok: true });
  }
}

const DB_NAME = 'suture-and-steel';
const STORE = 'files';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * IndexedDB backend (PLT-0079): the whole namespace is read into a cache once at boot so that the
 * game can read synchronously; every write goes to the cache immediately and to IndexedDB in a
 * transaction whose completion resolves the promise.
 */
export class IndexedDbStorage implements FileStorage {
  readonly backend = 'indexeddb' as const;
  private cache = new Map<string, string>();
  private constructor(
    private db: IDBDatabase,
    private prefix: string,
  ) {}

  static async open(idb: IDBFactory, prefix: string, timeoutMs = 3000): Promise<IndexedDbStorage> {
    const open = idb.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
    };
    const db = await Promise.race([
      req(open),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB open timed out')), timeoutMs)),
    ]);
    const s = new IndexedDbStorage(db, prefix);
    const tx = db.transaction(STORE, 'readonly').objectStore(STORE);
    const range = IDBKeyRange.bound(prefix, prefix + '￿');
    const [keys, values] = await Promise.all([req(tx.getAllKeys(range)), req(tx.getAll(range))]);
    keys.forEach((k, i) => {
      if (typeof values[i] === 'string') s.cache.set(String(k).slice(prefix.length), values[i] as string);
    });
    return s;
  }

  read(name: string): string | null {
    return this.cache.get(name) ?? null;
  }
  list(): string[] {
    return [...this.cache.keys()].sort();
  }
  private tx(fn: (store: IDBObjectStore) => void): Promise<WriteResult> {
    return new Promise((resolve) => {
      try {
        const t = this.db.transaction(STORE, 'readwrite');
        fn(t.objectStore(STORE));
        t.oncomplete = () => resolve({ ok: true });
        t.onerror = () => resolve({ ok: false, error: t.error?.name ?? 'IndexedDB error' });
        t.onabort = () => resolve({ ok: false, error: t.error?.name ?? 'IndexedDB aborted' });
      } catch (e) {
        resolve({ ok: false, error: (e as Error).name });
      }
    });
  }
  write(name: string, data: string): Promise<WriteResult> {
    this.cache.set(name, data);
    return this.tx((s) => s.put(data, this.prefix + name));
  }
  remove(name: string): Promise<WriteResult> {
    this.cache.delete(name);
    return this.tx((s) => s.delete(this.prefix + name));
  }
}

/** Pick the best web backend: IndexedDB → localStorage → memory. */
export async function openWebStorage(prefix: string): Promise<FileStorage> {
  const g = globalThis as { indexedDB?: IDBFactory; localStorage?: Storage };
  if (g.indexedDB) {
    try {
      return await IndexedDbStorage.open(g.indexedDB, prefix);
    } catch {
      // private mode / blocked — fall through
    }
  }
  try {
    if (g.localStorage) {
      const probe = `${prefix}__probe`;
      g.localStorage.setItem(probe, '1');
      g.localStorage.removeItem(probe);
      return new LocalStorageBackend(g.localStorage, prefix);
    }
  } catch {
    // blocked
  }
  return new MemoryStorage();
}
