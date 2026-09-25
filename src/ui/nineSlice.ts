/**
 * 9-slice frames (ART-0048). A painted frame asset carries its margins in the manifest (`nine`,
 * from assets/_meta.json); `nineSlice` stretches the edges and centre and keeps the corners at
 * native size. `panel()` and `parchment()` use a painted frame when one is in the manifest and
 * fall back to the procedural kit otherwise.
 */
import { MANIFEST } from '../assets/manifest.gen';
import type { AssetEntry } from '../assets/types';
import type { Gfx, ImageOpts } from '../render/gfx';
import type { Rect } from './widgets';

export interface Slice {
  x: number;
  y: number;
  w: number;
  h: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** The nine destination rects and UV crops for a frame of `iw×ih` with margins `[l,t,r,b]` drawn into `r`. */
export function slices(r: Rect, iw: number, ih: number, [l, t, rr, b]: [number, number, number, number], scale = 1): Slice[] {
  // Shrink the corners proportionally if the target is smaller than the two margins.
  const k = Math.min(scale, l + rr > 0 ? r.w / (l + rr) : scale, t + b > 0 ? r.h / (t + b) : scale);
  const xs = [r.x, r.x + l * k, r.x + r.w - rr * k, r.x + r.w];
  const ys = [r.y, r.y + t * k, r.y + r.h - b * k, r.y + r.h];
  const us = [0, l / iw, 1 - rr / iw, 1];
  const vs = [0, t / ih, 1 - b / ih, 1];
  const out: Slice[] = [];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const w = xs[i + 1] - xs[i];
      const h = ys[j + 1] - ys[j];
      if (w > 0 && h > 0) out.push({ x: xs[i], y: ys[j], w, h, u0: us[i], v0: vs[j], u1: us[i + 1], v1: vs[j + 1] });
    }
  return out;
}

/** Draw a manifest frame as a 9-slice. Returns false (draws nothing) if the frame is absent or not yet loaded. */
export function nineSlice(g: Gfx, id: string, r: Rect, o: ImageOpts & { scale?: number } = {}, manifest: Record<string, AssetEntry> = MANIFEST): boolean {
  const e = manifest[id];
  if (!e?.nine || !e.w || !e.h) return false;
  const img = g.image(import.meta.env.BASE_URL + e.url);
  if (!img.ready) return false;
  for (const s of slices(r, e.w, e.h, e.nine, o.scale ?? 1)) g.drawImage(img, s.x, s.y, s.w, s.h, { ...o, crop: { u0: s.u0, v0: s.v0, u1: s.u1, v1: s.v1 } });
  return true;
}
