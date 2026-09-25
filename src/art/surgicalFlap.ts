/**
 * Surgical flaps (ART-0189): on a deep-organ operation an opened incision is held wide — the skin on
 * each side folded back as a flap, its raw underside showing, and pinned with brass clamps at the
 * ends and middle so the organ beneath lies open to the instruments.
 */
import type { Vec } from '../core/math';
import { hex, rgba } from '../render/color';
import type { Gfx } from '../render/gfx';

/** Pin positions along the incision: both ends and the middle. */
export function flapPins(points: readonly Vec[]): Vec[] {
  const a = points[0];
  const b = points[points.length - 1];
  return [a, points[Math.floor(points.length / 2)], b];
}

/** Flaps either side of `points`, folded back by `open` 0..1; `skin` is linear-ish RGB 0..1. */
export function surgicalFlapArt(g: Gfx, points: readonly Vec[], open: number, skin: readonly [number, number, number]): void {
  if (points.length < 2 || open <= 0) return;
  const reach = 26 * open;
  const sk = rgba(Math.round(skin[0] * 255), Math.round(skin[1] * 255), Math.round(skin[2] * 255), 1);
  for (const side of [-1, 1]) {
    const edge: Vec[] = [];
    const fold: Vec[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const q = points[Math.min(points.length - 1, i + 1)];
      const r = points[Math.max(0, i - 1)];
      const tx = q.x - r.x;
      const ty = q.y - r.y;
      const l = Math.hypot(tx, ty) || 1;
      const nx = (-ty / l) * side;
      const ny = (tx / l) * side;
      edge.push({ x: p.x + nx * 8, y: p.y + ny * 8 });
      fold.push({ x: p.x + nx * (8 + reach), y: p.y + ny * (8 + reach) });
    }
    // The flap's raw underside (dermis and fat) folded out, then the rolled skin lip along the fold.
    for (let i = 1; i < edge.length; i++) {
      g.tri(edge[i - 1].x, edge[i - 1].y, edge[i].x, edge[i].y, fold[i].x, fold[i].y, hex('#9a4a40', 0.9));
      g.tri(edge[i - 1].x, edge[i - 1].y, fold[i].x, fold[i].y, fold[i - 1].x, fold[i - 1].y, hex('#b8685a', 0.9));
    }
    // Fat beads along the cut underside, then the rolled skin lip with its shadow and sheen.
    for (let i = 0; i < edge.length; i++) g.circle((edge[i].x * 2 + fold[i].x) / 3, (edge[i].y * 2 + fold[i].y) / 3, 3, hex('#e8c880', 0.55));
    g.polyline(fold.map((p) => ({ x: p.x + 2, y: p.y + 3 })), 9, hex('#000000', 0.3));
    g.polyline(fold, 8, sk);
    g.polyline(fold, 2, hex('#fff4e8', 0.35));
    g.polyline(edge, 2, hex('#7a1a18', 0.6));
  }
  // Brass pin clamps holding each flap: a ring head and a shank into the table.
  for (const p of flapPins(points)) {
    for (const side of [-1, 1]) {
      const x = p.x;
      const y = p.y + side * (16 + reach);
      g.line({ x, y }, { x: x + 4, y: y + side * 10 }, 2, hex('#6a5020'));
      g.circle(x, y, 5.5, hex('#c9a13a'));
      g.circle(x, y, 2.2, hex('#3a2a10'));
    }
  }
}
