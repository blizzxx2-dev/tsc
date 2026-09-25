/**
 * Surgical drape framing (GAM-0126): an amputation is shown through a slit in two linen drapes
 * laid either side of the saw line, clipped with towel clamps, so the player works a narrow strip
 * and the limb itself stays under cloth. Nothing past the strip is drawn uncovered.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

/** Drape materials (ENG-0276), chosen per operation (`OperationDef.drape`). */
export type DrapeMaterial = 'linen' | 'silk' | 'sackcloth' | 'canvas';

export const DRAPES: Record<DrapeMaterial, { cloth: string; centre: string; fold: string; hem: string; weave: number; sheen: number }> = {
  /** Hospice linen: undyed, soft folds. */
  linen: { cloth: '#9a8f78', centre: '#b3a78d', fold: '#6e654f', hem: '#5e5542', weave: 0, sheen: 0 },
  /** A noble's silk: deep red, a sheen along the folds. */
  silk: { cloth: '#6a1c22', centre: '#8a2a30', fold: '#3a0c10', hem: '#c9a55c', weave: 0, sheen: 0.35 },
  /** Prison sackcloth: coarse and dun, a visible weave. */
  sackcloth: { cloth: '#7a6a4c', centre: '#8c7b5a', fold: '#4c4028', hem: '#3a3020', weave: 1, sheen: 0 },
  /** Army canvas: waxed olive, stitched hem. */
  canvas: { cloth: '#5a5a3a', centre: '#6a6a46', fold: '#3a3a24', hem: '#2a2a18', weave: 0.5, sheen: 0.12 },
};

export interface DrapeLook {
  /** Cloth (default hospice linen). */
  material?: DrapeMaterial;
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
  const m = DRAPES[o.material ?? 'linen'];
  for (const q of drapePanels(a, b, o)) {
    // Cloth: a shadow under the edge, the material, then folds running along the drape.
    g.poly(q.map((p) => ({ x: p.x + 3, y: p.y + 5 })), hex('#000000', 0.25));
    g.poly(q, hex(m.cloth), hex(m.centre));
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const s = { x: q[0].x + (q[3].x - q[0].x) * t, y: q[0].y + (q[3].y - q[0].y) * t };
      const e = { x: q[1].x + (q[2].x - q[1].x) * t, y: q[1].y + (q[2].y - q[1].y) * t };
      g.line(s, e, 1.4, hex(m.fold, 0.5));
      if (m.sheen > 0) g.line({ x: s.x + 2, y: s.y + 2 }, { x: e.x + 2, y: e.y + 2 }, 1, hex('#ffffff', m.sheen * 0.5));
    }
    // Coarse cloth shows its weave: short cross-threads down the drape.
    if (m.weave > 0) {
      const n = Math.round(24 * m.weave);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const s = { x: q[0].x + (q[1].x - q[0].x) * t, y: q[0].y + (q[1].y - q[0].y) * t };
        const e = { x: q[3].x + (q[2].x - q[3].x) * t, y: q[3].y + (q[2].y - q[3].y) * t };
        g.line(s, e, 0.8, hex(m.fold, 0.22));
      }
    }
    // A darkened hem along the strip, and towel clamps at its two ends.
    g.line(q[0], q[1], 5, hex(m.hem, 0.85));
    for (const c of [q[0], q[1]]) {
      g.circle(c.x, c.y, 5, hex('#9aa0a6'));
      g.circle(c.x, c.y, 2, hex('#3a3c40'));
    }
  }
}
