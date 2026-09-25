/**
 * Operation HUD art helpers that read (never change) the simulation: cursor context tint,
 * the quill pulse-trace on vellum, and the tincture vial level.
 */
import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { onBody, type Operation } from '../surgery/operation';
import type { ToolId } from '../surgery/types';
import { vellumStripArt, type Rect } from './kit';

/** What the hand is over (UIX-0054): a target for the instrument in hand, one needing another instrument, or nothing. */
export type CursorTarget = { kind: 'valid' } | { kind: 'needs'; tool: ToolId } | { kind: 'none' };

export function cursorTarget(op: Operation, p: Vec): CursorTarget {
  let best: { layer: number; t: CursorTarget } | null = null;
  for (const e of op.entities) {
    if (!e.alive || e.hidden || !e.hitTest(p, op.hitPad)) continue;
    const wants = e.wants(op).filter((t) => op.def.tools.includes(t));
    if (!wants.length) continue;
    const t: CursorTarget = wants.includes(op.tool) ? { kind: 'valid' } : { kind: 'needs', tool: wants[0] };
    if (!best || e.layer > best.layer) best = { layer: e.layer, t };
  }
  return best?.t ?? { kind: 'none' };
}

/**
 * The tongs' jaws at the tip of the reticle (GAM-0031): spread open while hunting, snapped shut
 * the moment they close on something.
 */
export function drawTongsJaws(g: Gfx, p: Vec, closed: boolean, colour = '#d8d0c0'): void {
  const spread = closed ? 1.5 : 9;
  for (const s of [-1, 1]) g.line({ x: p.x + 16, y: p.y - 16 + s * 3 }, { x: p.x + 4, y: p.y - 4 + s * spread }, 2, hex(colour, 0.9));
  if (closed) g.circle(p.x + 4, p.y - 4, 2.5, hex(colour));
}

/** Crosshair tint: green over a live target, red where the Brand would sear healthy flesh, gilt otherwise. */
export function cursorTint(op: Operation, p: Vec): string {
  if (!onBody(p)) return '#c8a060';
  const target = op.entities.some((e) => e.alive && !e.hidden && dist(e.pos, p) < 36);
  if (target) return '#9fe0a8';
  return op.tool === 'brand' ? '#ff5a4a' : '#f5d76e';
}

/** The pulse drawn by a quill on a vellum strip; an ink blot spreads when the line goes flat. */
export function quillTrace(g: Gfx, r: Rect, samples: number[], vitals: number, t: number): void {
  vellumStripArt(g, r);
  const ink = vitals > 30 ? '#2a140a' : '#7a0a10';
  const pts = samples.map((v, i) => ({ x: r.x + 3 + (i / Math.max(1, samples.length - 1)) * (r.w - 6), y: r.y + r.h * 0.64 - v * r.h * 0.5 }));
  g.polyline(pts, 3.2, hex(ink, 0.18));
  g.polyline(pts, 1.6, hex(ink, 0.92));
  const head = pts[pts.length - 1];
  if (!head) return;
  // The nib at the pen head.
  g.poly([{ x: head.x, y: head.y }, { x: head.x + 3, y: head.y - 9 }, { x: head.x + 6, y: head.y - 7 }], hex('#c8a060'));
  const flat = samples.slice(-24).every((v) => Math.abs(v) < 0.02);
  if (flat || vitals < 12) {
    const k = 0.5 + 0.5 * Math.sin(t * 3);
    g.circleGrad(head.x - 2, head.y + 1, 6 + 3 * k, hex('#1a0404', 0.85), hex('#1a0404', 0));
    for (let i = 0; i < 5; i++) g.circle(head.x - 2 + Math.cos(i * 1.9) * (7 + i), head.y + 1 + Math.sin(i * 1.9) * 4, 1.2, hex('#1a0404', 0.7));
  }
}

/** Tincture vial level in thirds while the syringe refills (1 = full, 0 = spent and corked). */
export function vialLevel(cooldownFrac: number): number {
  return Math.floor((1 - Math.max(0, Math.min(1, cooldownFrac))) * 3) / 3;
}
