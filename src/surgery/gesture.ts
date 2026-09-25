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

/**
 * Recognise a five-pointed star drawn in one stroke (the sign that invokes the
 * Litany of Stillness). A pentagram has five self-crossings and ends where it began.
 */
export function isStar(raw: Vec[]): boolean {
  if (raw.length < 10) return false;
  const pts = resample(raw, 80);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 60) return false;
  // Closed shape.
  if (dist(pts[0], pts[pts.length - 1]) > size * 0.45) return false;
  // Count self-intersections between non-adjacent segments.
  let crossings = 0;
  for (let i = 1; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 1 && j === pts.length - 1) continue;
      if (segmentsIntersect(pts[i - 1], pts[i], pts[j - 1], pts[j])) crossings++;
    }
  // Count sharp corners (direction change > ~100 degrees over a short window).
  let corners = 0;
  let lastCorner = -10;
  for (let i = 3; i < pts.length - 3; i++) {
    const a = pts[i - 3], b = pts[i], c = pts[i + 3];
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    if (cos < -0.2 && i - lastCorner > 4) {
      corners++;
      lastCorner = i;
    }
  }
  // Lenient, like the original: a closed stroke with star-like sharp turns. Clean stars cross
  // themselves five times; hurried ones may cross less, so sharp corners can stand in.
  return (crossings >= 3 && crossings <= 9 && corners >= 3) || (crossings >= 1 && corners >= 5);
}
