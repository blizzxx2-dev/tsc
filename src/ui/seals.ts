/** Wax seals for the Trials' rules (ART-0062, UIX-0187): on the notice-board bills and in the HUD corner. */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

/** A wax seal with a short label at (x, y); returns its width. */
export function drawSeal(g: Gfx, x: number, y: number, label: string): number {
  const w = g.measure(label, 16) + 22;
  g.plate(x, y - 14, w, 26, { radius: 13, top: hex('#8a1a16'), bottom: hex('#5a0e0c'), border: hex('#c04030', 0.8), borderW: 1 });
  g.text(label, x + 11, y + 5, { size: 16, color: hex('#f4e0c8'), shadow: false });
  return w;
}
