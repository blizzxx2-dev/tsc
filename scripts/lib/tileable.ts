/**
 * Tileability check (ART-0160). A texture that tiles has no step where its right edge meets its
 * left edge (and bottom meets top). Offsetting the image by half a tile moves that wrap seam to the
 * middle, where an artist would see it; numerically we compare the difference across the wrap with
 * the difference between ordinary neighbouring rows/columns. A ratio near 1 is seamless; a seam
 * shows as a spike.
 */

/** A multi-channel float or byte image, row-major, `channels` values per texel. */
export interface Plane {
  w: number;
  h: number;
  channels: number;
  data: ArrayLike<number>;
}

export interface SeamReport {
  /** Mean |Δ| across the horizontal wrap (last column → first) over typical column-to-column |Δ|. */
  x: number;
  /** Same for the vertical wrap (last row → first). */
  y: number;
  /** The worse of the two. */
  worst: number;
}

/** Default failure threshold: a wrap step more than 1.75× the texture's typical neighbour step. */
export const SEAM_THRESHOLD = 1.75;

/** Seam ratios for the given channels (default: every channel). */
export function seamRatio(img: Plane, channels: readonly number[] = Array.from({ length: img.channels }, (_, i) => i)): SeamReport {
  const { w, h, channels: n, data } = img;
  const at = (x: number, y: number, c: number): number => data[(y * w + x) * n + c];
  let wrapX = 0;
  let wrapY = 0;
  let inX = 0;
  let inY = 0;
  let cntX = 0;
  let cntY = 0;
  for (const c of channels) {
    for (let y = 0; y < h; y++) {
      wrapX += Math.abs(at(w - 1, y, c) - at(0, y, c));
      for (let x = 1; x < w; x++) inX += Math.abs(at(x, y, c) - at(x - 1, y, c));
    }
    for (let x = 0; x < w; x++) {
      wrapY += Math.abs(at(x, h - 1, c) - at(x, 0, c));
      for (let y = 1; y < h; y++) inY += Math.abs(at(x, y, c) - at(x, y - 1, c));
    }
    cntX += h;
    cntY += w;
  }
  const typX = inX / Math.max(1, cntX * (w - 1));
  const typY = inY / Math.max(1, cntY * (h - 1));
  const x = wrapX / Math.max(1, cntX) / Math.max(typX, 1e-6);
  const y = wrapY / Math.max(1, cntY) / Math.max(typY, 1e-6);
  return { x, y, worst: Math.max(x, y) };
}

/** The image offset by half a tile in both axes (the wrap seam lands in the middle), for review. */
export function halfOffset(img: Plane): Plane {
  const { w, h, channels: n, data } = img;
  const out = new Float32Array(w * h * n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = (x + (w >> 1)) % w;
      const sy = (y + (h >> 1)) % h;
      for (let c = 0; c < n; c++) out[(y * w + x) * n + c] = data[(sy * w + sx) * n + c];
    }
  return { w, h, channels: n, data: out };
}
