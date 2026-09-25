/**
 * The results card's suture vignette (ART-0188): an oval of the patient's skin with every wound
 * closed on the table drawn as its sutured scar, in the same place as on the operating field.
 */
import { hex, rgba } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { FIELD, type Operation } from '../surgery/operation';
import { scarArt } from './ailmentArt';

export function sutureVignette(g: Gfx, op: Operation, cx: number, cy: number, alpha = 1): void {
  const rx = 128;
  const ry = rx * (FIELD.ry / FIELD.rx);
  const s = rx / FIELD.rx;
  const skin = organPalette(op.def).species.skin;
  const c = (k: number, a: number) => rgba(Math.round(skin[0] * 255 * k), Math.round(skin[1] * 255 * k), Math.round(skin[2] * 255 * k), a);
  g.ellipse(cx + 4, cy + 6, rx + 6, ry + 6, 0, hex('#000000', 0.35 * alpha), hex('#000000', 0));
  g.ellipse(cx, cy, rx, ry, 0, c(0.95, alpha), c(0.62, alpha));
  for (const sc of op.scars) {
    const pts = sc.map((p) => ({ x: cx + (p.x - FIELD.cx) * s, y: cy + (p.y - FIELD.cy) * s }));
    scarArt(g, pts, 3.5, 0.15, alpha);
  }
  const ring = Array.from({ length: 49 }, (_, i) => ({ x: cx + Math.cos((i / 48) * Math.PI * 2) * (rx + 3), y: cy + Math.sin((i / 48) * Math.PI * 2) * (ry + 3) }));
  g.polyline(ring, 2, hex('#c9a13a', 0.6 * alpha));
}
