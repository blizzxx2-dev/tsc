/**
 * Recorded-asset runtime: the manifest written by `scripts/audio-build.mjs`,
 * bank loading with progress, decoded-memory accounting and release. Events
 * that list asset keys play the decoded buffers once their bank is loaded; all
 * others (and everything in a build without assets) use the synthesised recipe.
 */

export type AssetCategory = 'sfx' | 'music' | 'vo' | 'amb';

export interface ManifestEntry {
  path: string;
  bank: string;
  category: AssetCategory;
  duration: number;
  channels: number;
  /** Integrated loudness (LUFS) and true peak (dBTP) measured at build time. */
  lufs: number;
  truePeak: number;
  bytes: number;
  /** Loop points in seconds (music stems, ambience beds). */
  loop?: [number, number];
  licence?: string;
  source?: string;
}

export interface Manifest {
  version: 1;
  files: Record<string, ManifestEntry>;
  banks: Record<string, string[]>;
}

export const EMPTY_MANIFEST: Manifest = { version: 1, files: {}, banks: {} };

/** Decoded-memory budget for the demo. */
export const DEMO_MEMORY_BUDGET = 150 * 1024 * 1024;

/** Which banks a scene needs, by scene kind (see scenes.ts). */
export function banksFor(kind: string, extra?: string): string[] {
  const base = ['boot'];
  switch (kind) {
    case 'title':
    case 'options':
    case 'demoend':
      return [...base, 'title'];
    case 'story':
      return [...base, 'story'];
    case 'briefing':
    case 'operation':
    case 'results':
      return [...base, 'operation', ...(extra ? [extra] : [])];
    default:
      return base;
  }
}

export class AssetStore {
  manifest: Manifest = EMPTY_MANIFEST;
  private buffers = new Map<string, AudioBuffer>();
  private banks = new Map<string, Promise<void>>();
  private loadedBanks = new Set<string>();
  /** 0..1 progress of the bank currently loading. */
  progress = 1;

  constructor(private base = 'audio/') {}

  async init(fetcher: typeof fetch = fetch): Promise<void> {
    try {
      const r = await fetcher(`${this.base}manifest.json`);
      if (r.ok) this.manifest = (await r.json()) as Manifest;
    } catch {
      // No recorded assets in this build: every event uses its synthesised recipe.
    }
  }

  has(key: string): boolean {
    return this.buffers.has(key);
  }

  get(key: string): AudioBuffer | undefined {
    return this.buffers.get(key);
  }

  entry(key: string): ManifestEntry | undefined {
    return this.manifest.files[key];
  }

  /** Load every file of a bank, decoding as it goes; resolves when all are ready. */
  loadBank(ctx: BaseAudioContext, name: string, onProgress?: (p: number) => void, fetcher: typeof fetch = fetch): Promise<void> {
    const cur = this.banks.get(name);
    if (cur) return cur;
    const keys = this.manifest.banks[name] ?? [];
    let done = 0;
    this.progress = keys.length ? 0 : 1;
    const job = Promise.all(
      keys.map(async (key) => {
        const e = this.manifest.files[key];
        if (!e || this.buffers.has(key)) return;
        try {
          const r = await fetcher(`${this.base}${e.path}`);
          const data = await r.arrayBuffer();
          this.buffers.set(key, await ctx.decodeAudioData(data));
        } catch {
          // Missing or corrupt file: that event keeps its synthesised fallback.
        } finally {
          done++;
          this.progress = done / keys.length;
          onProgress?.(this.progress);
        }
      }),
    ).then(() => {
      this.loadedBanks.add(name);
    });
    this.banks.set(name, job);
    return job;
  }

  /** Drop a bank's decoded buffers (files shared with a still-loaded bank are kept). */
  release(name: string): void {
    const keep = new Set<string>();
    for (const b of this.loadedBanks) if (b !== name) for (const k of this.manifest.banks[b] ?? []) keep.add(k);
    for (const k of this.manifest.banks[name] ?? []) if (!keep.has(k)) this.buffers.delete(k);
    this.loadedBanks.delete(name);
    this.banks.delete(name);
  }

  /** Keep exactly these banks loaded: release the rest, load the missing. */
  async require(ctx: BaseAudioContext, names: string[], onProgress?: (p: number) => void): Promise<void> {
    for (const b of [...this.loadedBanks]) if (!names.includes(b)) this.release(b);
    await Promise.all(names.map((n) => this.loadBank(ctx, n, onProgress)));
  }

  loaded(): string[] {
    return [...this.loadedBanks];
  }

  /** Decoded PCM memory in bytes (float32 per sample per channel). */
  memoryBytes(): number {
    let n = 0;
    for (const b of this.buffers.values()) n += b.length * b.numberOfChannels * 4;
    return n;
  }
}
