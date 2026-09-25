import { dist, segmentsIntersect, type Vec } from '../core/math';

/** Resample a stroke to n evenly spaced points. */
export function resample(pts: Vec[], n: number): Vec[] {
  if (pts.length < 2) return pts.slice();
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  const step = total / (n - 1);
  const out: Vec[] = [pts[0]];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length && out.length < n; ) {
    const d = dist(prev, pts[i]);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q = { x: prev.x + (pts[i].x - prev.x) * t, y: prev.y + (pts[i].y - prev.y) * t };
      out.push(q);
      prev = q;
      acc = 0;
    } else {
      acc += d;
      prev = pts[i];
      i++;
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

export type StarFailure = 'tooFewPoints' | 'tooSmall' | 'notClosed' | 'tooManyCrossings' | 'tooFewCrossings' | 'tooFewCorners';

export interface StarAnalysis {
  ok: boolean;
  /** Why the stroke was rejected (absent when ok). */
  reason?: StarFailure;
  crossings: number;
  corners: number;
  /** Bounding-box size (larger side, px). */
  size: number;
  /** Gap between the stroke's ends as a fraction of size. */
  gap: number;
}

export interface StarOptions {
  /** Minimum star size in px; scales with the UI scale (default 60 at 1×). */
  minSize?: number;
  /**
   * Threshold profile. Stick-drawn strokes (gamepad virtual cursor) have rounder
   * corners and wander more, so the gamepad profile widens the corner window and
   * accepts a larger closing gap.
   */
  profile?: 'pointer' | 'gamepad';
}

export const STAR_MIN_SIZE = 60;
const PROFILES = {
  pointer: { closeGap: 0.45, cornerWindow: 3, cornerCos: -0.2 },
  gamepad: { closeGap: 0.55, cornerWindow: 4, cornerCos: -0.05 },
} as const;

/** Sharp turns (direction change past the profile's threshold) along a resampled stroke. */
function countCorners(pts: Vec[], w: number, cosLimit: number): number {
  let corners = 0;
  let lastCorner = -10;
  for (let i = w; i < pts.length - w; i++) {
    const a = pts[i - w],
      b = pts[i],
      c = pts[i + w];
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    if (cos < cosLimit && i - lastCorner > w + 1) {
      corners++;
      lastCorner = i;
    }
  }
  return corners;
}

/**
 * Analyse a stroke as the five-pointed star that invokes the Litany of Stillness.
 * A pentagram has five self-crossings, five sharp points, and ends where it began.
 * The measures are rotation-, winding-, start-vertex- and aspect-invariant: they
 * only count crossings, turns and the closing gap relative to the stroke's size.
 */
export function analyzeStar(raw: Vec[], opts: StarOptions = {}): StarAnalysis {
  const prof = PROFILES[opts.profile ?? 'pointer'];
  const minSize = opts.minSize ?? STAR_MIN_SIZE;
  if (raw.length < 10) return { ok: false, reason: 'tooFewPoints', crossings: 0, corners: 0, size: 0, gap: 1 };
  const pts = resample(raw, 80);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  const gap = size > 0 ? dist(pts[0], pts[pts.length - 1]) / size : 1;
  const base = { crossings: 0, corners: 0, size, gap };
  if (size < minSize) return { ok: false, reason: 'tooSmall', ...base };
  if (gap > prof.closeGap) return { ok: false, reason: 'notClosed', ...base };
  // Count self-intersections between non-adjacent segments.
  let crossings = 0;
  for (let i = 1; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 1 && j === pts.length - 1) continue;
      if (segmentsIntersect(pts[i - 1], pts[i], pts[j - 1], pts[j])) crossings++;
    }
  const corners = countCorners(pts, prof.cornerWindow, prof.cornerCos);
  const res = { crossings, corners, size, gap };
  // Lenient, like the original: a closed stroke with star-like sharp turns. Clean stars cross
  // themselves five times; hurried ones may cross less, so sharp corners can stand in.
  if (crossings > 9) return { ok: false, reason: 'tooManyCrossings', ...res };
  if ((crossings >= 3 && corners >= 3) || (crossings >= 1 && corners >= 5)) return { ok: true, ...res };
  if (crossings < 1 || (crossings < 3 && corners >= 3)) return { ok: false, reason: 'tooFewCrossings', ...res };
  return { ok: false, reason: 'tooFewCorners', ...res };
}

/** True if the stroke is an acceptable five-pointed star. */
export function isStar(raw: Vec[], opts: StarOptions = {}): boolean {
  return analyzeStar(raw, opts).ok;
}

/** Player-facing hint for a failed star (shown in the failure popup). */
export const STAR_FAILURE_HINT: Record<StarFailure, string> = {
  tooFewPoints: 'The sign falters…',
  tooSmall: 'Five points — draw larger',
  notClosed: 'Close the sign, Doctor',
  tooManyCrossings: 'The sign tangles — five clean strokes',
  tooFewCrossings: 'Cross the lines — a five-pointed star',
  tooFewCorners: 'Sharper points, Doctor',
};

export interface LoopAnalysis {
  /** The stroke ends within `gap` px of where it began. */
  closed: boolean;
  /** The stroke winds around the centre. */
  encloses: boolean;
  /** Fraction of the stroke's length that strays into healthy tissue (beyond the margin band). */
  healthyFrac: number;
  /** Fraction of the stroke's length that cuts into the growth itself. */
  insideFrac: number;
  length: number;
}

export const LOOP_GAP = 18;
export const LOOP_MARGIN = 26;

const wrapAngle = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/**
 * Encircle-excise: judge a lancet stroke drawn around a growth of `radius` at `center`.
 * The ideal loop runs in the band between the growth's edge and `margin` px outside it.
 */
export function analyseLoop(path: Vec[], center: Vec, radius: number, margin = LOOP_MARGIN, gap = LOOP_GAP): LoopAnalysis {
  let length = 0;
  let healthy = 0;
  let inside = 0;
  let wind = 0;
  const turn = (a: Vec, b: Vec) => wrapAngle(Math.atan2(b.y - center.y, b.x - center.x) - Math.atan2(a.y - center.y, a.x - center.x));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const l = dist(a, b);
    length += l;
    const d = dist({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, center);
    if (d > radius + margin) healthy += l;
    else if (d < radius) inside += l;
    wind += turn(a, b);
  }
  const closed = path.length > 2 && dist(path[0], path[path.length - 1]) <= gap;
  // Closing the small gap counts toward the winding.
  if (closed) wind += turn(path[path.length - 1], path[0]);
  const L = length || 1;
  return { closed, encloses: Math.abs(wind) > Math.PI * 1.8, healthyFrac: healthy / L, insideFrac: inside / L, length };
}

/** Rating for an encircling cut: more than 25 % of it through healthy tissue is BAD. */
export function loopRating(l: LoopAnalysis): 'cool' | 'good' | 'bad' {
  if (l.healthyFrac > 0.25) return 'bad';
  return l.healthyFrac < 0.08 && l.insideFrac < 0.05 ? 'cool' : 'good';
}

/** A circle path (for bots and tests). */
export function circlePath(center: Vec, r: number, n = 48, start = 0): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  return pts;
}
