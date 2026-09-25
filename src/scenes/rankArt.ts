import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { UI, waxSeal } from '../ui/ornaments';

/** Wax colour per rank: XS gold leaf, S oxblood, A verdigris, B lapis, C tallow. */
export const RANK_WAX: Record<string, string> = { XS: '#b8861c', S: '#8a1016', A: '#2a5a3a', B: '#2a3a6a', C: '#4a4038' };

/**
 * A rank seal: wax disc with the rank letter in relief. XS adds a gold-leaf rim
 * and rays; ranks also differ by rim notches (XS 8, S 6, A 4, B 3, C 0) so they
 * read without colour.
 */
export function rankSeal(g: Gfx, x: number, y: number, r: number, rank: string, alpha = 1): void {
  if (rank === 'XS') {
    g.glow(x, y, r * 1.9, hex(UI.gilt, 0.25 * alpha));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.line({ x: x + Math.cos(a) * r * 1.1, y: y + Math.sin(a) * r * 1.1 }, { x: x + Math.cos(a) * r * 1.45, y: y + Math.sin(a) * r * 1.45 }, Math.max(1, r * 0.05), hex(UI.gilt, 0.6 * alpha));
    }
  }
  waxSeal(g, x, y, r, RANK_WAX[rank] ?? RANK_WAX.C);
  if (rank === 'XS') g.arc(x, y, r * 0.86, Math.max(1.5, r * 0.07), hex(UI.gilt, 0.9 * alpha));
  const notches = { XS: 8, S: 6, A: 4, B: 3, C: 0 }[rank] ?? 0;
  for (let i = 0; i < notches; i++) {
    const a = -Math.PI / 2 + (i / notches) * Math.PI * 2;
    g.circle(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, Math.max(1, r * 0.06), hex('#2a0204', 0.55 * alpha));
  }
  const size = r * (rank === 'XS' ? 0.9 : 1.1);
  g.text(rank, x, y + size * 0.36, { size, font: 'display', color: hex('#ffe8c0', 0.95 * alpha), color2: hex('#f0b070', 0.95 * alpha), align: 'center', shadow: hex('#2a0204', 0.8 * alpha) });
}
