/**
 * The examination chart (ENG-0275): a patient drawn as an anatomist's plate — head, trunk and limbs
 * in sepia wash with an ink outline — for the interview and forensic sheets. `map` places a point
 * given in sheet fractions (0..1 across, 0..1 down) through the magnifier; `z` is its zoom.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

type Map = (fx: number, fy: number) => Vec;

const WASH = '#6a5040';
const INK = '#3a2a1a';

export function drawBodyChart(g: Gfx, map: Map, z: number, alpha = 1): void {
  const limb = (a: [number, number], b: [number, number], w: number) => {
    const p = map(a[0], a[1]);
    const q = map(b[0], b[1]);
    g.line(p, q, (w + 3) * z, hex(INK, 0.35 * alpha));
    g.line(p, q, w * z, hex(WASH, 0.28 * alpha));
  };
  // Legs, arms (upper and fore), then the trunk over their roots, the neck and the head.
  limb([0.44, 0.62], [0.42, 0.97], 30);
  limb([0.56, 0.62], [0.58, 0.97], 30);
  limb([0.34, 0.3], [0.27, 0.44], 20);
  limb([0.27, 0.44], [0.24, 0.57], 16);
  limb([0.66, 0.3], [0.73, 0.44], 20);
  limb([0.73, 0.44], [0.76, 0.57], 16);
  const trunk = map(0.5, 0.44);
  g.ellipse(trunk.x, trunk.y, 70 * z, 118 * z, 0, hex(INK, 0.3 * alpha));
  g.ellipse(trunk.x, trunk.y, 66 * z, 114 * z, 0, hex(WASH, 0.24 * alpha));
  limb([0.5, 0.17], [0.5, 0.24], 20);
  const head = map(0.5, 0.11);
  g.ellipse(head.x, head.y, 36 * z, 44 * z, 0, hex(INK, 0.32 * alpha));
  g.ellipse(head.x, head.y, 33 * z, 41 * z, 0, hex(WASH, 0.26 * alpha));
  // Plate marks: the midline and the ribs, faint.
  const n0 = map(0.5, 0.26);
  const n1 = map(0.5, 0.62);
  g.line(n0, n1, 1, hex(INK, 0.25 * alpha));
  for (let i = 0; i < 4; i++) {
    const y = 0.3 + i * 0.035;
    g.line(map(0.4, y + 0.01), map(0.5, y), 1, hex(INK, 0.18 * alpha));
    g.line(map(0.6, y + 0.01), map(0.5, y), 1, hex(INK, 0.18 * alpha));
  }
}

/** A finding marked on the chart (the symptom overlay): an ink ring and a short tick. */
export function markFinding(g: Gfx, at: Vec, z: number): void {
  g.arc(at.x, at.y, 16 * z, 2, hex('#8a2a1a', 0.8));
  g.line({ x: at.x + 12 * z, y: at.y - 12 * z }, { x: at.x + 22 * z, y: at.y - 22 * z }, 2, hex('#8a2a1a', 0.8));
}
