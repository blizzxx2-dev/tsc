import { PNG } from 'pngjs';
import { packRects, pow2 } from './maxrects.ts';

/** RGBA8 image. */
export interface Img {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface SheetMeta {
  /** Pivots per frame name (0..1), default centre. */
  pivots?: Record<string, { x: number; y: number }>;
  anims?: Record<string, { frames: string[]; ms: number[] | number; mode?: 'loop' | 'once' | 'pingpong' }>;
}

export interface SheetJson {
  name: string;
  pages: { file: string; w: number; h: number }[];
  frames: Record<string, { page: number; x: number; y: number; w: number; h: number; px?: number; py?: number }>;
  anims?: SheetMeta['anims'];
}

export function decodePng(buf: Buffer | Uint8Array): Img {
  const png = PNG.sync.read(Buffer.from(buf));
  return { w: png.width, h: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
}

/** Deterministic PNG encode (fixed filter + deflate settings). */
export function encodePng(img: Img): Buffer {
  const png = new PNG({ width: img.w, height: img.h });
  Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength).copy(png.data);
  return PNG.sync.write(png, { colorType: 6, inputColorType: 6, bitDepth: 8, deflateLevel: 9, filterType: 4 });
}

export function blank(w: number, h: number): Img {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

/** Copy `src` into `dst` at (x, y), then extrude its border `e` pixels outward (stops bilinear bleeding). */
export function blitExtruded(dst: Img, src: Img, x: number, y: number, e: number): void {
  for (let sy = -e; sy < src.h + e; sy++) {
    const cy = Math.min(src.h - 1, Math.max(0, sy));
    const dy = y + sy;
    if (dy < 0 || dy >= dst.h) continue;
    for (let sx = -e; sx < src.w + e; sx++) {
      const cx = Math.min(src.w - 1, Math.max(0, sx));
      const dx = x + sx;
      if (dx < 0 || dx >= dst.w) continue;
      const si = (cy * src.w + cx) * 4;
      const di = (dy * dst.w + dx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

/**
 * Pack named frames into ≤`pageSize`² power-of-two pages with `extrude`-pixel
 * borders (ENG-0033). Page files are named `<name>-<n>.png`. Output depends
 * only on the frame names and pixels, never on input order.
 */
export function buildAtlas(name: string, frames: { id: string; img: Img }[], meta: SheetMeta = {}, pageSize = 2048, extrude = 2): { pages: Img[]; json: SheetJson } {
  const byId = new Map(frames.map((f) => [f.id, f.img]));
  const { placements, pages } = packRects(
    frames.map((f) => ({ id: f.id, w: f.img.w, h: f.img.h })),
    pageSize,
    extrude,
  );
  // Shrink each page to the smallest power of two that holds its contents.
  const size = Array.from({ length: pages }, () => ({ w: 1, h: 1 }));
  for (const p of placements) {
    size[p.page].w = Math.max(size[p.page].w, p.x + p.w + extrude);
    size[p.page].h = Math.max(size[p.page].h, p.y + p.h + extrude);
  }
  const imgs = size.map((s) => blank(pow2(s.w), pow2(s.h)));
  const json: SheetJson = { name, pages: imgs.map((im, i) => ({ file: `${name}-${i}.png`, w: im.w, h: im.h })), frames: {} };
  for (const p of placements) {
    blitExtruded(imgs[p.page], byId.get(p.id)!, p.x, p.y, extrude);
    const pv = meta.pivots?.[p.id];
    json.frames[`${name}/${p.id}`] = { page: p.page, x: p.x, y: p.y, w: p.w, h: p.h, ...(pv ? { px: pv.x, py: pv.y } : {}) };
  }
  if (meta.anims) {
    json.anims = {};
    for (const [id, a] of Object.entries(meta.anims)) json.anims[`${name}/${id}`] = { ...a, frames: a.frames.map((f) => `${name}/${f}`) };
  }
  return { pages: imgs, json };
}
