/**
 * The UI kit: an apothecary's instrument case. Oxblood leather, brass fittings,
 * parchment, wax and gilt. Everything is procedural so it scales crisply at any
 * resolution until painted art replaces it.
 */
import type { Vec } from '../core/math';
import { hex, type RGBA } from '../render/color';
import type { Gfx, TextOpts } from '../render/gfx';
import type { Rect } from './widgets';

const TAU = Math.PI * 2;

export const UI = {
  brassHi: '#f0d898',
  brass: '#b8903c',
  brassLo: '#5a4018',
  leather: '#3a1812',
  leatherLo: '#1a0a08',
  parch: '#e6d6ae',
  parchLo: '#bda678',
  inkDark: '#2a1a10',
  gilt: '#f5d76e',
  giltLo: '#a8741c',
  wax: '#8a1016',
} as const;

/** Stable pseudo-random per rect, so leather grain doesn't shimmer frame to frame. */
function grain(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Gilt blackletter/serif text: vertical gold gradient with a dark under-stroke. */
export function giltText(g: Gfx, str: string, x: number, y: number, o: TextOpts = {}): void {
  g.text(str, x, y, { font: 'display', ...o, color: hex(UI.gilt, 1), color2: hex(UI.giltLo, 1), shadow: hex('#1a0c04', 0.9) });
}

export function rivet(g: Gfx, x: number, y: number, r = 3.5): void {
  g.circle(x + 0.8, y + 1, r, hex('#000000', 0.5));
  g.circleGrad(x, y, r, hex(UI.brassHi), hex(UI.brassLo));
}

/** A curling filigree flourish in a corner. dx/dy = which way the corner opens (+1/-1). */
export function filigree(g: Gfx, x: number, y: number, dx: number, dy: number, s = 1, c: RGBA = hex(UI.brass)): void {
  const p = (px: number, py: number): Vec => ({ x: x + px * dx * s, y: y + py * dy * s });
  g.quadCurve(p(0, 0), p(18, -2), p(22, 10), 2, c);
  g.quadCurve(p(22, 10), p(24, 18), p(14, 16), 1.6, c);
  g.quadCurve(p(0, 0), p(-2, 18), p(10, 22), 2, c);
  g.quadCurve(p(10, 22), p(18, 24), p(16, 14), 1.6, c);
  g.circle(p(8, 8).x, p(8, 8).y, 2.2 * s, c);
}

/** Bevelled brass band around a rect (drawn outside it by `w`). */
export function brassBorder(g: Gfx, r: Rect, w = 5): void {
  const { x, y, w: rw, h } = r;
  g.rect(x - w, y - w, rw + 2 * w, w, hex(UI.brassHi));
  g.rect(x - w, y + h, rw + 2 * w, w, hex(UI.brassLo));
  g.rect(x - w, y, w, h, hex(UI.brass));
  g.rect(x + rw, y, w, h, hex('#8a6a28'));
  g.rectLine(x - w, y - w, rw + 2 * w, h + 2 * w, 1, hex('#1a0e04', 0.9));
  g.rectLine(x, y, rw, h, 1, hex('#1a0e04', 0.7));
}

/** Tooled leather panel with brass edging, rivets and optional filigree corners. */
export function leatherPanel(g: Gfx, r: Rect, o: { alpha?: number; corners?: boolean; border?: number; seed?: number } = {}): void {
  const a = o.alpha ?? 0.96;
  const seed = o.seed ?? r.x * 0.37 + r.y * 1.13;
  g.rect(r.x + 5, r.y + 7, r.w, r.h, hex('#000000', 0.45 * a));
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#44201a', a), hex(UI.leatherLo, a));
  // Grain: faint mottling.
  const n = Math.min(60, Math.floor((r.w * r.h) / 2500));
  for (let i = 0; i < n; i++) {
    const gx = r.x + grain(seed, i) * r.w;
    const gy = r.y + grain(seed + 3.1, i) * r.h;
    g.circleGrad(gx, gy, 10 + grain(seed + 7, i) * 26, hex('#000000', 0.12 * a), hex('#000000', 0));
  }
  // Tooled inner line and stitching.
  g.rectLine(r.x + 8, r.y + 8, r.w - 16, r.h - 16, 1, hex('#6a3a24', 0.7 * a));
  const stitch = hex('#c8a878', 0.35 * a);
  for (let sx = r.x + 14; sx < r.x + r.w - 14; sx += 10) {
    g.rect(sx, r.y + 12, 5, 1.2, stitch);
    g.rect(sx, r.y + r.h - 13, 5, 1.2, stitch);
  }
  if (o.border !== 0) brassBorder(g, r, o.border ?? 4);
  if (o.corners !== false && r.w > 120 && r.h > 70) {
    filigree(g, r.x + 6, r.y + 6, 1, 1, 0.9);
    filigree(g, r.x + r.w - 6, r.y + 6, -1, 1, 0.9);
    filigree(g, r.x + 6, r.y + r.h - 6, 1, -1, 0.9);
    filigree(g, r.x + r.w - 6, r.y + r.h - 6, -1, -1, 0.9);
  }
  for (const [cx, cy] of [
    [r.x - 2, r.y - 2],
    [r.x + r.w + 2, r.y - 2],
    [r.x - 2, r.y + r.h + 2],
    [r.x + r.w + 2, r.y + r.h + 2],
  ])
    rivet(g, cx, cy, 4.5);
}

/** Parchment sheet with darkened, slightly burnt edges. */
export function parchmentSheet(g: Gfx, r: Rect, seed = 1): void {
  g.rect(r.x + 6, r.y + 8, r.w, r.h, hex('#000000', 0.5));
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#ecdcb4'), hex('#cdb688'));
  for (let i = 0; i < 18; i++) {
    const fx = r.x + grain(seed, i) * r.w;
    const fy = r.y + grain(seed + 1.7, i) * r.h;
    g.circleGrad(fx, fy, 16 + grain(seed + 4, i) * 40, hex('#8a6a3a', 0.1), hex('#8a6a3a', 0));
  }
  // Edge burn.
  const e = 18;
  g.rectGrad(r.x, r.y, r.w, e, hex('#6a4a22', 0.45), hex('#6a4a22', 0));
  g.rectGrad(r.x, r.y + r.h - e, r.w, e, hex('#6a4a22', 0), hex('#6a4a22', 0.5));
  g.rect(r.x, r.y, 3, r.h, hex('#6a4a22', 0.5));
  g.rect(r.x + r.w - 3, r.y, 3, r.h, hex('#6a4a22', 0.5));
}

/** A parchment scroll with rolled wooden ends, for dialogue. */
export function scroll(g: Gfx, r: Rect): void {
  parchmentSheet(g, r, r.x + r.y);
  for (const x of [r.x - 8, r.x + r.w - 8]) {
    g.rectGrad(x, r.y - 6, 16, r.h + 12, hex('#d8c498'), hex('#8a7048'));
    g.rectLine(x, r.y - 6, 16, r.h + 12, 1, hex('#4a3418'));
    g.circleGrad(x + 8, r.y - 8, 7, hex(UI.brassHi), hex(UI.brassLo));
    g.circleGrad(x + 8, r.y + r.h + 8, 7, hex(UI.brassHi), hex(UI.brassLo));
  }
}

/** Ornamental divider: rule, diamond, flourishes. */
export function divider(g: Gfx, cx: number, y: number, w: number, c: RGBA = hex(UI.brass)): void {
  g.line({ x: cx - w / 2, y }, { x: cx - 14, y }, 1.5, c);
  g.line({ x: cx + 14, y }, { x: cx + w / 2, y }, 1.5, c);
  g.poly(
    [
      { x: cx, y: y - 7 },
      { x: cx + 9, y },
      { x: cx, y: y + 7 },
      { x: cx - 9, y },
    ],
    c,
  );
  g.circle(cx - w / 2, y, 2.5, c);
  g.circle(cx + w / 2, y, 2.5, c);
  g.quadCurve({ x: cx - 14, y }, { x: cx - 30, y: y - 10 }, { x: cx - 44, y: y - 2 }, 1.2, c);
  g.quadCurve({ x: cx + 14, y }, { x: cx + 30, y: y - 10 }, { x: cx + 44, y: y - 2 }, 1.2, c);
}

/** Round brass-rimmed medallion with a dark inset. */
export function medallion(g: Gfx, x: number, y: number, r: number, inset: RGBA = hex('#140a08')): void {
  g.circle(x + 2, y + 3, r + 5, hex('#000000', 0.5));
  g.circleGrad(x, y - r * 0.3, r + 5, hex(UI.brassHi), hex(UI.brassLo));
  g.circle(x, y, r, hex('#1a0e04'));
  g.circleGrad(x, y, r - 1.5, inset, hex('#000000'));
  g.arc(x, y, r + 2.5, 1, hex('#fff0c0', 0.35), 0.3, -Math.PI * 0.9);
}

/** A wax seal. `glyph` is drawn in relief. */
export function waxSeal(g: Gfx, x: number, y: number, r: number, color: string = UI.wax, glyph?: string, glyphSize?: number): void {
  const pts: Vec[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const rr = r * (1 + 0.08 * Math.sin(i * 2.7) + 0.05 * Math.sin(i * 5.3));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.poly(
    pts.map((p) => ({ x: p.x + 2, y: p.y + 3 })),
    hex('#000000', 0.45),
  );
  g.poly(pts, hex(color), hex('#c83038'));
  g.arc(x, y, r * 0.72, 2, hex('#000000', 0.25));
  g.arc(x, y, r * 0.76, 1, hex('#ff8080', 0.25), 0.4, -Math.PI);
  if (glyph) g.text(glyph, x, y + (glyphSize ?? r) * 0.36, { size: glyphSize ?? r, font: 'display', color: hex('#3a0406', 0.9), align: 'center', shadow: hex('#ff9090', 0.25) });
}

/** Hourglass icon; `frac` is the share of sand still in the top bulb. */
export function hourglass(g: Gfx, x: number, y: number, h: number, frac: number, t: number): void {
  const w = h * 0.55;
  const top = y - h / 2;
  const bot = y + h / 2;
  g.rect(x - w / 2 - 3, top - 4, w + 6, 4, hex(UI.brass));
  g.rect(x - w / 2 - 3, bot, w + 6, 4, hex(UI.brass));
  const glass = hex('#c8d8e0', 0.18);
  g.tri(x - w / 2, top, x + w / 2, top, x, y, glass);
  g.tri(x - w / 2, bot, x + w / 2, bot, x, y, glass);
  const sand = hex('#e0b860');
  const f = Math.max(0, Math.min(1, frac));
  // Top bulb: sand shrinks toward the neck.
  if (f > 0) {
    const sw = (w / 2) * f;
    g.tri(x - sw, y - (h / 2) * f, x + sw, y - (h / 2) * f, x, y, sand);
    g.line({ x, y }, { x, y: bot - 2 }, 1, hex('#e0b860', 0.6 + 0.4 * Math.sin(t * 20)));
  }
  // Bottom bulb: a growing mound.
  const mh = (h / 2) * (1 - f);
  g.tri(x - w / 2 + 2, bot, x + w / 2 - 2, bot, x, bot - mh, sand);
  g.line({ x: x - w / 2, y: top }, { x: x + w / 2, y: bot }, 1, hex(UI.brassLo, 0.6));
  g.line({ x: x + w / 2, y: top }, { x: x - w / 2, y: bot }, 1, hex(UI.brassLo, 0.6));
}

/** Engraved brass plaque (for numbers and labels). */
export function plaque(g: Gfx, r: Rect): void {
  g.rect(r.x + 3, r.y + 4, r.w, r.h, hex('#000000', 0.5));
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#8a6a30'), hex('#4a3412'));
  g.rectGrad(r.x + 3, r.y + 3, r.w - 6, r.h - 6, hex('#241608'), hex('#120a04'));
  g.rectLine(r.x, r.y, r.w, r.h, 1, hex(UI.brassHi, 0.6));
  rivet(g, r.x + 7, r.y + r.h / 2, 2.5);
  rivet(g, r.x + r.w - 7, r.y + r.h / 2, 2.5);
}

/** A hanging cloth banner with swallow-tail ends. */
export function banner(g: Gfx, cx: number, y: number, w: number, h: number, color = '#5a0c10'): void {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  g.rect(x0 + 3, y + 4, w, h, hex('#000000', 0.45));
  g.rectGrad(x0, y, w, h, hex(color), hex('#2a0406'));
  for (const [x, d] of [
    [x0, -1],
    [x1, 1],
  ] as const) {
    g.tri(x, y, x + d * 22, y, x + d * 12, y + h / 2, hex(color));
    g.tri(x, y + h, x + d * 22, y + h, x + d * 12, y + h / 2, hex('#2a0406'));
    g.tri(x, y, x + d * 12, y + h / 2, x, y + h, hex('#3a0608'));
  }
  g.line({ x: x0, y: y + 3 }, { x: x1, y: y + 3 }, 1, hex(UI.gilt, 0.5));
  g.line({ x: x0, y: y + h - 3 }, { x: x1, y: y + h - 3 }, 1, hex(UI.gilt, 0.5));
}
