/**
 * Painting helpers for entity drawers (GAM-0012): soft marks into the surface layer, the salve
 * paste over covered cells, and gut-thread stitches.
 */
import { dist, type Vec } from '../../core/math';
import type { Coverage } from '../../surgery/coverage';
import { pointAlong, projectAlong, type StitchLine } from '../../surgery/entities';
import type { Operation } from '../../surgery/operation';
import { stitchArt } from '../../art/ailmentArt';
import { hex, rgba } from '../color';
import type { Gfx } from '../gfx';

/** Soft-edged channel stroke into the surface layer: stacked widths approximate a falloff. */
export function surfLine(g: Gfx, pts: Vec[], w: number, r: number, gc = 0, b = 0, a = 0): void {
  for (const [k, f] of [
    [1.8, 0.25],
    [1.2, 0.35],
    [0.7, 0.4],
  ] as const)
    g.polyline(pts, w * k, rgba(Math.round(r * f * 255), Math.round(gc * f * 255), Math.round(b * f * 255), a * f));
}

/** Soft channel disc into the surface layer. */
export function surfDisc(g: Gfx, p: Vec, rad: number, r: number, gc = 0, b = 0, a = 0): void {
  g.circleGrad(p.x, p.y, rad, rgba(Math.round(r * 255), Math.round(gc * 255), Math.round(b * 255), a), rgba(0, 0, 0, 0));
}

/** When each salved cell was first painted (renderer seconds): the paste soaks in from there. */
const SALVED_AT = new WeakMap<object, number>();
/** Seconds Saint's Salve takes to soak in (ART-0193). */
export const SALVE_ABSORB_S = 1.5;

/**
 * Saint's Salve on the covered cells (ART-0193): a pale-gold paste with a glisten where it was just
 * laid, soaking in over 1.5 s to a faint sheen.
 */
export function drawCoverage(g: Gfx, cov: Coverage, within = Infinity): void {
  for (const c of cov.cells) {
    if (!c.done || c.x * c.x + c.y * c.y > within * within) continue;
    let t0 = SALVED_AT.get(c);
    if (t0 === undefined || t0 > g.time) SALVED_AT.set(c, (t0 = g.time));
    const wet = 1 - Math.min(1, (g.time - t0) / SALVE_ABSORB_S);
    const x = cov.center.x + c.x;
    const y = cov.center.y + c.y;
    g.circleGrad(x, y, 10 + 2 * wet, hex('#f0dc98', 0.14 + 0.46 * wet), hex('#f0dc98', 0));
    if (wet > 0.05) g.ellipse(x - 3, y - 3, 3.2, 1.5, -0.5, hex('#fffbe8', 0.7 * wet), hex('#fffbe8', 0));
  }
}

/** Gut-thread stitches along a stitch line, and the thread's tension to the needle while stitching. */
export function drawStitch(g: Gfx, s: StitchLine, op?: Operation): void {
    // Gut-thread stitches: one knotted crossing per mark, drawn taut 0.25 s after it is placed.
    s.marks.forEach((m, i) => {
      const at = projectAlong(s.points, m).at;
      const p0 = pointAlong(s.points, Math.max(0, at - 2));
      const p1 = pointAlong(s.points, Math.min(s.length, at + 2));
      const tight = op ? Math.min(1, (op.elapsed - (s.markTimes[i] ?? -1)) / 0.25) : 1;
      stitchArt(g, m, Math.atan2(p1.y - p0.y, p1.x - p0.x), 9, tight, i);
    });
    // Thread tension: a taut line from the last stitch to the needle while stitching.
    if (op && op.tool === 'thread' && s.marks.length && s.count < s.needed) {
      const last = s.marks[s.marks.length - 1];
      if (dist(last, op.cursor) < 120) g.line(last, op.cursor, 1.2, hex('#efe6c4', 0.6));
    }
  }
