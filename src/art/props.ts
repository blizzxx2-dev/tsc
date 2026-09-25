/**
 * Story props (NAR-0057): documents held up to the reader between scenes, drawn in the woodcut
 * manner of the rest of the book. The requisition writ: a folded paper writ under the Watch's seal
 * (a tower over crossed pikes) and the Burgomaster's signature.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export type PropId = 'writ';
export const PROPS: readonly PropId[] = ['writ'];

/** The writ, centred at (cx, cy); `k` 0..1 eases it in (it rises and settles). */
export function drawWrit(g: Gfx, cx: number, cy: number, k = 1): void {
  const w = 460;
  const h = 290;
  const y = cy + (1 - k) * 40;
  const a = k;
  const x0 = cx - w / 2;
  const y0 = y - h / 2;
  // Drop shadow, then the paper with a fold down the middle and foxed edges.
  g.rect(x0 + 10, y0 + 14, w, h, hex('#000000', 0.45 * a));
  g.rectGrad(x0, y0, w, h, hex('#e6d8b4', a), hex('#cdb98e', a));
  g.rect(cx - 1, y0, 2, h, hex('#9a865e', 0.6 * a));
  g.rectGrad(cx + 1, y0, 26, h, hex('#7a6444', 0.18 * a), hex('#7a6444', 0));
  for (const [ex, ey] of [
    [x0, y0],
    [x0 + w, y0],
    [x0, y0 + h],
    [x0 + w, y0 + h],
  ])
    g.circleGrad(ex, ey, 70, hex('#8a6a3a', 0.35 * a), hex('#8a6a3a', 0));
  // A heading in large strokes, then ruled lines of a clerk's hand.
  const ink = hex('#2a1a10', 0.85 * a);
  g.line({ x: x0 + 40, y: y0 + 44 }, { x: x0 + 200, y: y0 + 44 }, 5, ink);
  g.line({ x: cx + 40, y: y0 + 44 }, { x: x0 + w - 40, y: y0 + 44 }, 5, ink);
  for (let i = 0; i < 7; i++) {
    const ly = y0 + 78 + i * 22;
    const len = i === 6 ? 0.45 : 0.85 + 0.1 * Math.sin(i * 2.7);
    const pts: Vec[] = [];
    for (let s = 0; s <= 24; s++) {
      const px = x0 + 40 + (w - 80) * len * (s / 24);
      pts.push({ x: px, y: ly + Math.sin(s * 1.9 + i) * 1.6 });
    }
    g.polyline(pts, 1.6, hex('#3a2616', 0.6 * a));
  }
  // The Burgomaster's signature: one confident loop and a long tail.
  const sig: Vec[] = [];
  for (let s = 0; s <= 40; s++) {
    const t = s / 40;
    sig.push({ x: x0 + 70 + t * 160, y: y0 + h - 46 - Math.sin(t * Math.PI * 3) * 12 * (1 - t) });
  }
  g.polyline(sig, 2, hex('#1a0e08', 0.9 * a));
  // The Watch's seal in red wax: a tower over crossed pikes.
  const sx = x0 + w - 90;
  const sy = y0 + h - 70;
  g.circle(sx + 3, sy + 4, 42, hex('#000000', 0.35 * a));
  g.circle(sx, sy, 42, hex('#8a1a14', a));
  g.circle(sx, sy, 34, hex('#a8281c', a));
  const emb = hex('#5a0c08', 0.9 * a);
  g.line({ x: sx - 22, y: sy + 20 }, { x: sx + 22, y: sy - 20 }, 3, emb);
  g.line({ x: sx + 22, y: sy + 20 }, { x: sx - 22, y: sy - 20 }, 3, emb);
  g.rect(sx - 8, sy - 16, 16, 26, emb);
  for (const dx of [-8, -1, 6]) g.rect(sx + dx, sy - 21, 3, 6, emb);
  g.circleGrad(sx - 12, sy - 14, 14, hex('#ffb0a0', 0.35 * a), hex('#ffb0a0', 0));
}

/** Draw a prop by id. */
export function drawProp(g: Gfx, id: PropId, cx: number, cy: number, k = 1): void {
  if (id === 'writ') drawWrit(g, cx, cy, k);
}
