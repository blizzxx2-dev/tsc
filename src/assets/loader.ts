import { BUNDLES, MANIFEST, type AssetId, type BundleId } from './manifest.gen';
import type { AssetEntry } from './types';

/** What a loaded asset becomes, by manifest type. */
export interface LoadedAsset {
  id: AssetId;
  entry: AssetEntry;
  /** Decoded payload: GPU texture handle, parsed JSON, text, audio bytes, FontFace… */
  value: unknown;
  /** True when loading failed and a fallback (magenta checker, silence) stands in (ENG-0210). */
  fallback: boolean;
  /** Frees GPU/DOM resources when the last reference is released. */
  dispose?: () => void;
}

/**
 * Platform hooks, injectable so the loader runs headless in tests. The game
 * wires them to fetch/createImageBitmap/Gfx textures/document.fonts.
 */
export interface LoaderBackend {
  fetchBytes(url: string): Promise<ArrayBuffer>;
  /** Decode + upload an image (off-thread via createImageBitmap); returns value + dispose. */
  image(id: AssetId, bytes: ArrayBuffer, entry: AssetEntry): Promise<{ value: unknown; dispose?: () => void }>;
  /** Missing/failed image stand-in: the magenta checker. */
  missingImage(id: AssetId): { value: unknown; dispose?: () => void };
  /** Load a sprite sheet: JSON frame table + its page images. */
  sheet(id: AssetId, json: unknown, pages: ArrayBuffer[], entry: AssetEntry): Promise<{ value: unknown; dispose?: () => void }>;
  font(id: AssetId, bytes: ArrayBuffer, entry: AssetEntry): Promise<{ value: unknown; dispose?: () => void }>;
  /** Parse + upload a glTF binary (3D sets, props, busts). Optional: headless backends skip models. */
  model?(id: AssetId, bytes: ArrayBuffer, entry: AssetEntry): Promise<{ value: unknown; dispose?: () => void }>;
  warn(msg: string): void;
}

export type Progress = (loaded: number, total: number) => void;

const decoder = new TextDecoder();

/**
 * Typed asset loader (ENG-0211/0212): `load(id)` de-duplicates concurrent
 * requests and reference-counts results; `release(id)` frees on the last
 * reference. Bundles load/unload groups of assets with progress. Failures
 * never throw — they log and resolve to a fallback (ENG-0210).
 */
export class AssetLoader {
  private loaded = new Map<AssetId, LoadedAsset>();
  private inflight = new Map<AssetId, Promise<LoadedAsset>>();
  private refs = new Map<AssetId, number>();
  private bundlesHeld = new Set<BundleId>();
  private base: string;

  constructor(
    private backend: LoaderBackend,
    base = '/',
    private manifest: Record<string, AssetEntry> = MANIFEST,
    private bundles: Record<string, readonly string[]> = BUNDLES,
  ) {
    this.base = base.endsWith('/') ? base : base + '/';
  }

  url(id: AssetId): string {
    return this.base + this.manifest[id].url;
  }

  /** Load (or re-reference) an asset. Resolves once decoded/uploaded; never rejects. */
  load(id: AssetId): Promise<LoadedAsset> {
    this.refs.set(id, (this.refs.get(id) ?? 0) + 1);
    const done = this.loaded.get(id);
    if (done) return Promise.resolve(done);
    let p = this.inflight.get(id);
    if (!p) {
      p = this.fetchAsset(id).then((a) => {
        this.inflight.delete(id);
        // Released to zero while loading: free immediately.
        if (!this.refs.get(id)) a.dispose?.();
        else this.loaded.set(id, a);
        return a;
      });
      this.inflight.set(id, p);
    }
    return p;
  }

  /** The loaded asset, if resident. */
  get(id: AssetId): LoadedAsset | undefined {
    return this.loaded.get(id);
  }

  refCount(id: AssetId): number {
    return this.refs.get(id) ?? 0;
  }

  get residentCount(): number {
    return this.loaded.size;
  }

  /** Drop one reference; the last one disposes the asset. */
  release(id: AssetId): void {
    const n = (this.refs.get(id) ?? 0) - 1;
    if (n > 0) {
      this.refs.set(id, n);
      return;
    }
    this.refs.delete(id);
    const a = this.loaded.get(id);
    if (a) {
      this.loaded.delete(id);
      a.dispose?.();
    }
  }

  /** Load every asset of a bundle, reporting progress by count. Holding a bundle twice is a no-op. */
  async loadBundle(b: BundleId, onProgress?: Progress): Promise<void> {
    const ids = (this.bundles[b] ?? []) as AssetId[];
    if (this.bundlesHeld.has(b)) {
      onProgress?.(ids.length, ids.length);
      await Promise.all(ids.map((id) => this.inflight.get(id) ?? Promise.resolve()));
      return;
    }
    this.bundlesHeld.add(b);
    let done = 0;
    onProgress?.(0, ids.length);
    await Promise.all(
      ids.map((id) =>
        this.load(id).then(() => {
          done++;
          onProgress?.(done, ids.length);
        }),
      ),
    );
  }

  /** Start loading a bundle in the background (next chapter during story scenes). */
  prefetch(b: BundleId): void {
    void this.loadBundle(b);
  }

  unloadBundle(b: BundleId): void {
    if (!this.bundlesHeld.delete(b)) return;
    for (const id of (this.bundles[b] ?? []) as AssetId[]) this.release(id);
  }

  isResident(b: BundleId): boolean {
    return this.bundlesHeld.has(b) && ((this.bundles[b] ?? []) as AssetId[]).every((id) => this.loaded.has(id));
  }

  /** Merge generated entries (the local 3D models manifest) into the manifest and their bundles. */
  addEntries(entries: Record<string, AssetEntry>): void {
    this.manifest = { ...this.manifest, ...entries };
    const bundles: Record<string, string[]> = Object.fromEntries(Object.entries(this.bundles).map(([k, v]) => [k, [...v]]));
    for (const [id, e] of Object.entries(entries)) (bundles[e.bundle] ??= []).includes(id) || bundles[e.bundle].push(id);
    this.bundles = bundles;
  }

  has(id: string): boolean {
    return id in this.manifest;
  }

  /** How many assets a bundle holds (0 for an empty or unknown bundle). */
  bundleSize(b: BundleId): number {
    return (this.bundles[b] ?? []).length;
  }

  heldBundles(): BundleId[] {
    return [...this.bundlesHeld];
  }

  /**
   * Dev hot reload (ART-0039): adopt a rebuilt manifest and re-fetch every resident asset whose
   * content hash changed, swapping it in place so `get(id)` returns the new version. Reference
   * counts and held bundles carry over. Resolves to the ids that were swapped.
   */
  async hotSwap(manifest: Record<string, AssetEntry>, bundles: Record<string, readonly string[]>): Promise<AssetId[]> {
    const old = this.manifest;
    this.manifest = manifest;
    this.bundles = bundles;
    const changed = [...this.loaded.keys()].filter((id) => manifest[id] && manifest[id].hash !== old[id]?.hash);
    await Promise.all(
      changed.map(async (id) => {
        const fresh = await this.fetchAsset(id);
        const prev = this.loaded.get(id);
        if (!this.refs.get(id)) return fresh.dispose?.();
        this.loaded.set(id, fresh);
        prev?.dispose?.();
      }),
    );
    // Bundles held before the swap pick up assets that were added to them.
    for (const b of this.bundlesHeld) for (const id of (bundles[b] ?? []) as AssetId[]) if (!this.refs.has(id)) void this.load(id);
    return changed;
  }

  private async fetchAsset(id: AssetId): Promise<LoadedAsset> {
    const entry = this.manifest[id];
    const be = this.backend;
    if (!entry) {
      be.warn(`asset '${id}' is not in the manifest`);
      return { id, entry: { type: 'text', url: '', bytes: 0, bundle: 'boot', hash: '' }, value: null, fallback: true };
    }
    try {
      switch (entry.type) {
        case 'image':
        case 'lut': {
          const r = await be.image(id, await be.fetchBytes(this.url(id)), entry);
          return { id, entry, fallback: false, ...r };
        }
        case 'sheet': {
          const json = JSON.parse(decoder.decode(await be.fetchBytes(this.url(id))));
          const pages = await Promise.all((entry.pages ?? []).map((u) => be.fetchBytes(this.base + u)));
          const r = await be.sheet(id, json, pages, entry);
          return { id, entry, fallback: false, ...r };
        }
        case 'font': {
          const r = await be.font(id, await be.fetchBytes(this.url(id)), entry);
          return { id, entry, fallback: false, ...r };
        }
        case 'model': {
          if (!be.model) return { id, entry, fallback: true, value: null };
          const r = await be.model(id, await be.fetchBytes(this.url(id)), entry);
          return { id, entry, fallback: false, ...r };
        }
        case 'json':
          return { id, entry, fallback: false, value: JSON.parse(decoder.decode(await be.fetchBytes(this.url(id)))) };
        case 'audio':
          return { id, entry, fallback: false, value: await be.fetchBytes(this.url(id)) };
        default:
          return { id, entry, fallback: false, value: decoder.decode(await be.fetchBytes(this.url(id))) };
      }
    } catch (err) {
      be.warn(`asset '${id}' failed to load (${(err as Error).message}); using fallback`);
      return { id, entry, fallback: true, ...this.fallbackFor(id, entry) };
    }
  }

  private fallbackFor(id: AssetId, e: AssetEntry): { value: unknown; dispose?: () => void } {
    switch (e.type) {
      case 'image':
      case 'lut':
        return this.backend.missingImage(id);
      case 'audio':
        return { value: new ArrayBuffer(0) }; // silence
      case 'json':
        return { value: {} };
      case 'sheet':
        return { value: null }; // Gfx.sprite() draws the checker for unknown frames
      default:
        return { value: null }; // fonts fall back to the CSS serif stack
    }
  }
}
