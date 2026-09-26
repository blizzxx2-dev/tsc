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
    // Along the drape (u, hem edge q0→q1) and across it (v, from the hem out to q3).
    const at = (u: number, v: number): Vec => {
      const s = { x: q[0].x + (q[1].x - q[0].x) * u, y: q[0].y + (q[1].y - q[0].y) * u };
      const e = { x: q[3].x + (q[2].x - q[3].x) * u, y: q[3].y + (q[2].y - q[3].y) * u };
      return { x: s.x + (e.x - s.x) * v, y: s.y + (e.y - s.y) * v };
    };
    const hx = q[0].x - q[3].x;
    const hy = q[0].y - q[3].y;
    const hl = Math.hypot(hx, hy) || 1;
    const out = { x: hx / hl, y: hy / hl };
    // The drape's soft shadow falls onto the open strip beside its hem, and under its outer edge.
    for (let k = 1; k <= 4; k++) {
      const d = k * 2.5;
      g.line({ x: q[0].x + out.x * d, y: q[0].y + out.y * d }, { x: q[1].x + out.x * d, y: q[1].y + out.y * d }, 3, hex('#000000', 0.16 * (1 - k / 5)));
    }
    g.poly(q.map((p) => ({ x: p.x + 3, y: p.y + 5 })), hex('#000000', 0.25));
    g.poly(q, hex(m.cloth), hex(m.centre));
    // Folds: soft wavering creases running along the drape, a lit crest beside a shaded trough,
    // fading out toward the ends where the cloth lies flat.
    const seg = 14;
    for (let k = 0; k < 4; k++) {
      const v0 = 0.18 + k * 0.21;
      const crest: Vec[] = [];
      const trough: Vec[] = [];
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const v = v0 + Math.sin(u * 5.1 + k * 1.7) * 0.035;
        crest.push(at(u, v));
        trough.push(at(u, v + 0.045));
      }
      const fade = [0.35, 0.55, 0.5, 0.3][k];
      g.polyline(trough, 3.2, hex(m.fold, 0.38 * fade + 0.1));
      g.polyline(crest, 2, hex(m.sheen > 0 ? '#ffffff' : m.centre, (m.sheen > 0 ? m.sheen : 0.5) * fade + 0.1));
    }
    // Coarse cloth shows its weave: fine cross-threads down the drape.
    if (m.weave > 0) {
      const n = Math.round(40 * m.weave);
      for (let k = 1; k < n; k++) g.line(at(k / n, 0.02), at(k / n, 0.98), 0.6, hex(m.fold, 0.12));
    }
    // A turned hem along the strip, and towel clamps at its two ends.
    g.line(q[0], q[1], 5, hex(m.hem, 0.85));
    g.line(at(0, 0.035), at(1, 0.035), 1, hex(m.centre, 0.5));
    for (const c of [q[0], q[1]]) {
      g.circle(c.x + 1.5, c.y + 2, 5.5, hex('#000000', 0.3));
      g.circle(c.x, c.y, 5, hex('#9aa0a6'));
      g.circle(c.x - 1.2, c.y - 1.2, 2.2, hex('#dfe4ea', 0.7));
      g.circle(c.x, c.y, 1.6, hex('#3a3c40'));
    }
  }
}
