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
  const rgb = (k: number, a = 1) => rgba(Math.round(Math.min(1, skin[0] * k) * 255), Math.round(Math.min(1, skin[1] * k) * 255), Math.round(Math.min(1, skin[2] * k) * 255), a);
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
      // The flap is widest mid-cut and tapers to the ends, where the skin is still whole.
      const t = points.length > 1 ? i / (points.length - 1) : 0.5;
      const w = 0.35 + 0.65 * Math.sin(Math.PI * t);
      edge.push({ x: p.x + nx * 8, y: p.y + ny * 8 });
      fold.push({ x: p.x + nx * (8 + reach * w), y: p.y + ny * (8 + reach * w) });
    }
    // The flap's raw underside: deep red at the cut shading to paler dermis at the fold, drawn as
    // one gradient strip (vertex colours), with a faint fat layer in the middle of it.
    for (let i = 1; i < edge.length; i++) {
      const deep = hex('#7a2a26', 0.95);
      const pale = hex('#c07a68', 0.95);
      g.tri(edge[i - 1].x, edge[i - 1].y, edge[i].x, edge[i].y, fold[i].x, fold[i].y, deep, deep, pale);
      g.tri(edge[i - 1].x, edge[i - 1].y, fold[i].x, fold[i].y, fold[i - 1].x, fold[i - 1].y, deep, pale, pale);
    }
    const mid = edge.map((e, i) => ({ x: (e.x + fold[i].x) / 2, y: (e.y + fold[i].y) / 2 }));
    g.strokePath(mid, 3, hex('#e8c880', 0.3));
    // The rolled skin lip along the fold: a contact shadow, the skin tube, a lit crest.
    g.strokePath(fold.map((p) => ({ x: p.x + 1.5, y: p.y + 2.5 })), 10, hex('#000000', 0.28));
    g.strokePath(fold, 8, rgb(0.8));
    g.strokePath(fold.map((p) => ({ x: p.x - 1, y: p.y - 1.4 })), 3.5, rgb(1.1, 0.8));
    g.strokePath(edge, 1.6, hex('#5a1414', 0.55));
  }
  // Brass pin clamps holding each flap: a ring head and a shank into the table.
  for (const p of flapPins(points)) {
    for (const side of [-1, 1]) {
      const x = p.x;
      const y = p.y + side * (16 + reach * 0.9);
      g.line({ x, y }, { x: x + 4, y: y + side * 10 }, 2, hex('#6a5020'));
      g.circle(x + 1, y + 1.5, 5.5, hex('#000000', 0.3));
      g.circle(x, y, 5.5, hex('#c9a13a'));
      g.circle(x - 1.3, y - 1.3, 2, hex('#f6e0a0', 0.8));
      g.circle(x, y, 1.8, hex('#3a2a10'));
    }
  }
}
