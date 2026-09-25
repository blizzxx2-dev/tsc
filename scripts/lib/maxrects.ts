/**
 * MaxRects bin packing (Jukka Jylänki, "A Thousand Ways to Pack the Bin"),
 * best-short-side-fit heuristic, no rotation. Deterministic: identical input
 * (same order, same sizes) always yields identical placements.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackInput {
  id: string;
  w: number;
  h: number;
}

export interface Placement extends Rect {
  id: string;
  page: number;
}

class Bin {
  free: Rect[];
  constructor(w: number, h: number) {
    this.free = [{ x: 0, y: 0, w, h }];
  }

  /** Best-short-side-fit position for a w×h rect, or null. */
  find(w: number, h: number): { x: number; y: number; score: number; score2: number } | null {
    let best: { x: number; y: number; score: number; score2: number } | null = null;
    for (const f of this.free) {
      if (w > f.w || h > f.h) continue;
      const short = Math.min(f.w - w, f.h - h);
      const long = Math.max(f.w - w, f.h - h);
      if (!best || short < best.score || (short === best.score && long < best.score2) || (short === best.score && long === best.score2 && (f.y < best.y || (f.y === best.y && f.x < best.x)))) best = { x: f.x, y: f.y, score: short, score2: long };
    }
    return best;
  }

  place(r: Rect): void {
    const next: Rect[] = [];
    for (const f of this.free) {
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) {
        next.push(f);
        continue;
      }
      // Split the free rect around the placed one (up to four maximal pieces).
      if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
      if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
    }
    // Prune rects contained in another.
    this.free = next.filter((a, i) => !next.some((b, j) => j !== i && contains(b, a) && (!contains(a, b) || j < i)));
  }
}

const contains = (a: Rect, b: Rect): boolean => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

/**
 * Pack rects into as many `pageSize`² pages as needed. Inputs are sorted by
 * descending height, then width, then id, so input order does not matter.
 * `padding` is added around every rect (for extruded borders).
 */
export function packRects(items: PackInput[], pageSize = 2048, padding = 0): { placements: Placement[]; pages: number } {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const bins: Bin[] = [];
  const out: Placement[] = [];
  for (const it of sorted) {
    const w = it.w + padding * 2;
    const h = it.h + padding * 2;
    if (w > pageSize || h > pageSize) throw new Error(`packRects: ${it.id} (${it.w}×${it.h}) does not fit a ${pageSize}² page`);
    let page = -1;
    let pos: { x: number; y: number } | null = null;
    for (let i = 0; i < bins.length && !pos; i++) {
      pos = bins[i].find(w, h);
      if (pos) page = i;
    }
    if (!pos) {
      bins.push(new Bin(pageSize, pageSize));
      page = bins.length - 1;
      pos = bins[page].find(w, h)!;
    }
    bins[page].place({ x: pos.x, y: pos.y, w, h });
    out.push({ id: it.id, page, x: pos.x + padding, y: pos.y + padding, w: it.w, h: it.h });
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { placements: out, pages: bins.length };
}

/** Smallest power of two ≥ n. */
export const pow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/** True if no two placements on the same page overlap, counting `padding` around each. */
export function noOverlap(ps: Placement[], padding = 0): boolean {
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      if (a.page !== b.page) continue;
      const p = padding;
      if (a.x - p < b.x + b.w + p && b.x - p < a.x + a.w + p && a.y - p < b.y + b.h + p && b.y - p < a.y + a.h + p) return false;
    }
  return true;
}
