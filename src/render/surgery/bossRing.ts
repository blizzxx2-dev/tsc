import type { Vec } from '../../core/math';
import { TAU } from '../../surgery/bosses/common';
import { hex } from '../color';
import type { Gfx } from '../gfx';

/** Boss health ring with phase notches. */
export function drawBossRing(g: Gfx, p: Vec, r: number, frac: number, notches: number[], color = '#b478ff'): void {
  g.arc(p.x, p.y, r, 3, hex(color, 0.75), Math.max(0, frac));
  for (const n of notches) {
    const a = -Math.PI / 2 + TAU * n;
    g.line({ x: p.x + Math.cos(a) * (r - 5), y: p.y + Math.sin(a) * (r - 5) }, { x: p.x + Math.cos(a) * (r + 5), y: p.y + Math.sin(a) * (r + 5) }, 2, hex('#f0e0c0', 0.8));
  }
}
