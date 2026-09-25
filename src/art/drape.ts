/**
 * Surgical drape framing (GAM-0126): an amputation is shown through a slit in two linen drapes
 * laid either side of the saw line, clipped with towel clamps, so the player works a narrow strip
 * and the limb itself stays under cloth. Nothing past the strip is drawn uncovered.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export interface DrapeLook {
  /** Half-width of the open strip around the saw line, px. */
  window?: number;
  /** How far each drape reaches out from the strip, px. */
  reach?: number;
  /** How far the drapes run past each end of the saw line, px. */
  overhang?: number;
}

/** The two drape panels as quads (strip-side edge first), for drawing and tests. */
export function drapePanels(a: Vec, b: Vec, o: DrapeLook = {}): Vec[][] {
  const w = o.window ?? 46;
  const r = o.reach ?? 80;
  const over = o.overhang ?? 60;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const p = (u: number, v: number): Vec => ({ x: a.x + ux * u + nx * v, y: a.y + uy * u + ny * v });
  return [1, -1].map((s) => [p(-over, s * w), p(len + over, s * w), p(len + over, s * (w + r)), p(-over, s * (w + r))]);
}

export function drawDrape(g: Gfx, a: Vec, b: Vec, o: DrapeLook = {}): void {
  for (const q of drapePanels(a, b, o)) {
    // Cloth: a shadow under the edge, the linen, then folds running along the drape.
    g.poly(q.map((p) => ({ x: p.x + 3, y: p.y + 5 })), hex('#000000', 0.25));
    g.poly(q, hex('#9a8f78'), hex('#b3a78d'));
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const s = { x: q[0].x + (q[3].x - q[0].x) * t, y: q[0].y + (q[3].y - q[0].y) * t };
      const e = { x: q[1].x + (q[2].x - q[1].x) * t, y: q[1].y + (q[2].y - q[1].y) * t };
      g.line(s, e, 1.4, hex('#6e654f', 0.5));
    }
    // A darkened hem along the strip, and towel clamps at its two ends.
    g.line(q[0], q[1], 5, hex('#5e5542', 0.85));
    for (const c of [q[0], q[1]]) {
      g.circle(c.x, c.y, 5, hex('#9aa0a6'));
      g.circle(c.x, c.y, 2, hex('#3a3c40'));
    }
  }
}
