import type { Gfx } from '../render/gfx';
import type { SheetJson } from '../render/sprites';
import { checkerPixels, decodeImage, Texture } from '../render/texture';
import { AssetLoader, type LoaderBackend } from './loader';

/** Loader backend for the browser: fetch, off-thread image decode, GL textures, FontFace. */
export function browserBackend(gfx: Gfx): LoaderBackend {
  const aniso = gfx.plan.anisotropy;
  return {
    async fetchBytes(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r.arrayBuffer();
    },
    async image(id, bytes, entry) {
      const bmp = await decodeImage(new Blob([bytes]));
      const lut = entry.type === 'lut';
      const tex = new Texture(gfx.registry, bmp, lut ? { filter: 'linear', label: id } : { filter: 'trilinear', anisotropy: aniso, label: id });
      return { value: tex, dispose: () => tex.dispose() };
    },
    missingImage(id) {
      const tex = new Texture(gfx.registry, checkerPixels(), { filter: 'nearest', label: `missing:${id}` });
      return { value: tex, dispose: () => tex.dispose() };
    },
    async sheet(id, json, pages) {
      const sheet = json as SheetJson;
      const texs = await Promise.all(pages.map(async (b, i) => new Texture(gfx.registry, await decodeImage(new Blob([b])), { filter: 'trilinear', anisotropy: aniso, label: `${id}#${i}` })));
      const bind = () => texs.map((t) => ({ tex: t.tex, w: t.w, h: t.h }));
      gfx.sprites.add(sheet, bind());
      // Page textures are recreated on context restore; point the frames at the new handles.
      const off = gfx.registry.onRestore(() => gfx.sprites.retexture(sheet.name, texs.map((t) => t.tex), sheet), 20);
      return {
        value: sheet,
        dispose: () => {
          off();
          gfx.sprites.remove(sheet.name);
          for (const t of texs) t.dispose();
        },
      };
    },
    async font(_id, bytes, entry) {
      const f = entry.font!;
      const face = new FontFace(f.family, bytes, { style: f.style, weight: f.weight });
      await face.load();
      document.fonts.add(face);
      return { value: face, dispose: () => document.fonts.delete(face) };
    },
    warn(msg) {
      if (import.meta.env.DEV) console.error(msg);
      else console.warn(msg);
    },
  };
}

export function createAssets(gfx: Gfx): AssetLoader {
  return new AssetLoader(browserBackend(gfx), import.meta.env.BASE_URL);
}

/** Resolve `p`, or give up after `ms` (returns false) — font/bundle loads must never block boot forever. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | false> {
  return Promise.race([p, new Promise<false>((r) => setTimeout(() => r(false), ms))]);
}
