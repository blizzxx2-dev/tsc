/**
 * The UI kit: an apothecary's instrument case. Oxblood leather, brass fittings,
 * parchment, wax and gilt. Everything is procedural so it scales crisply at any
 * resolution until painted art replaces it.
 */
import type { Vec } from '../core/math';
import { hex, type RGBA } from '../render/color';
import type { Gfx, TextOpts } from '../render/gfx';
import type { Rect } from './widgets';
import { debossText, leatherArt, medallionArt, oakArt, parchmentArt, plaqueArt, ribbonArt, sandGlassArt, sealArt } from '../art/kit';

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
  // Pebbled, blind-tooled, saddle-stitched leather (UI_ART_FS).
  leatherArt(g, r, a, seed);
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

/** Soot-stained oak bound with iron straps: the dark panel for the HUD and pause menus. */
export function oakPanel(g: Gfx, r: Rect, o: { alpha?: number; seed?: number } = {}): void {
  const a = o.alpha ?? 0.97;
  g.rect(r.x + 6, r.y + 8, r.w, r.h, hex('#000000', 0.5 * a));
  oakArt(g, r, a, o.seed ?? r.x + r.y);
  g.rectLine(r.x, r.y, r.w, r.h, 1.5, hex('#0a0604', 0.9 * a));
}

/** Parchment sheet with darkened, slightly burnt edges. */
export function parchmentSheet(g: Gfx, r: Rect, seed = 1, kind: 'fresh' | 'foxed' | 'burnt' = 'foxed'): void {
  g.rect(r.x + 6, r.y + 8, r.w - 4, r.h - 4, hex('#000000', 0.45));
  parchmentArt(g, r, kind, 1, seed);
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
  medallionArt(g, x, y, r, inset);
}

/** A wax seal. `glyph` is drawn in relief. */
export function waxSeal(g: Gfx, x: number, y: number, r: number, color: string = UI.wax, glyph?: string, glyphSize?: number): void {
  sealArt(g, x, y, r, color, { seed: x * 0.13 + y * 0.07 });
  if (glyph) debossText(g, glyph, x, y + (glyphSize ?? r) * 0.36, glyphSize ?? r, '#1e0204', '#ff9a90');
}

/** Hourglass icon; `frac` is the share of sand still in the top bulb. */
export function hourglass(g: Gfx, x: number, y: number, h: number, frac: number, _t = 0): void {
  sandGlassArt(g, x, y, h * 1.2, Math.max(0, Math.min(1, frac)));
}

/** Engraved brass plaque (for numbers and labels). */
export function plaque(g: Gfx, r: Rect): void {
  plaqueArt(g, r);
  rivet(g, r.x + 7, r.y + r.h / 2, 2.5);
  rivet(g, r.x + r.w - 7, r.y + r.h / 2, 2.5);
}

/** A hanging cloth banner with swallow-tail ends. */
export function banner(g: Gfx, cx: number, y: number, w: number, h: number, color = '#5a0c10', unfurl = 1): void {
  g.rect(cx - w / 2 + 3, y + 4, w * unfurl, h, hex('#000000', 0.35));
  ribbonArt(g, cx, y, w + 44, h, color, unfurl);
}

// ------------------------------------------------------------ woodcut border kit
// Gersdorff/Holbein-style cut lines: every stroke tapers and breaks as if gouged from a block.

/** A tapered woodcut stroke along a quadratic curve (thick in the middle, broken tips). */
function cut(g: Gfx, a: Vec, ctrl: Vec, b: Vec, w: number, c: RGBA, steps = 10): void {
  let prev = a;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const p = { x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y };
    const k = Math.sin(((i - 0.5) / steps) * Math.PI);
    g.line(prev, p, Math.max(0.6, w * (0.35 + 0.65 * k)), c);
    prev = p;
  }
}

const alphaOfC = (c: RGBA): number => ((c >>> 24) & 255) / 255;
function withA(c: RGBA, a: number): RGBA {
  return ((c & 0x00ffffff) | ((Math.round(a * 255) & 255) << 24)) >>> 0;
}

/**
 * Corner ornament (4 designs: 0 acanthus curl, 1 interlace knot, 2 rose, 3 pomegranate),
 * anchored at the corner (x, y) and opening toward (dx, dy).
 */
export function woodcutCorner(g: Gfx, x: number, y: number, dx: number, dy: number, variant: number, c: RGBA, s = 1, ground = '#e6d6ae'): void {
  const p = (px: number, py: number): Vec => ({ x: x + px * dx * s, y: y + py * dy * s });
  const v = ((variant % 4) + 4) % 4;
  // Shared L-bracket frame.
  g.line(p(0, 0), p(34, 0), 2.2 * s, c);
  g.line(p(0, 0), p(0, 34), 2.2 * s, c);
  g.line(p(5, 5), p(26, 5), 1 * s, c);
  g.line(p(5, 5), p(5, 26), 1 * s, c);
  if (v === 0) {
    cut(g, p(6, 6), p(26, 4), p(30, 18), 2.6 * s, c);
    cut(g, p(30, 18), p(31, 28), p(20, 25), 1.8 * s, c);
    cut(g, p(6, 6), p(4, 26), p(18, 30), 2.6 * s, c);
    cut(g, p(18, 30), p(28, 31), p(25, 20), 1.8 * s, c);
    cut(g, p(10, 10), p(18, 12), p(20, 20), 1.6 * s, c);
    g.poly([p(16, 16), p(24, 13), p(21, 21), p(13, 24)], c);
  } else if (v === 1) {
    const o = p(16, 16);
    for (let k = 0; k < 3; k++) g.arc(o.x, o.y, (6 + k * 5) * s, 1.4 * s, c, 0.75, (k * Math.PI) / 3);
    g.circle(o.x, o.y, 2.4 * s, c);
    cut(g, p(28, 8), p(34, 18), p(28, 28), 1.4 * s, c);
    cut(g, p(8, 28), p(18, 34), p(28, 28), 1.4 * s, c);
  } else if (v === 2) {
    const o = p(15, 15);
    for (let k = 0; k < 5; k++) {
      const a0 = (k / 5) * TAU;
      g.circle(o.x + Math.cos(a0) * 5 * s, o.y + Math.sin(a0) * 5 * s, 4.2 * s, c);
    }
    g.circle(o.x, o.y, 3.4 * s, hex(ground, alphaOfC(c)));
    g.circle(o.x, o.y, 1.6 * s, c);
    cut(g, p(24, 10), p(32, 8), p(36, 4), 1.4 * s, c);
    cut(g, p(10, 24), p(8, 32), p(4, 36), 1.4 * s, c);
  } else {
    const o = p(16, 17);
    g.ellipse(o.x, o.y, 8 * s, 9 * s, 0, c);
    g.poly([p(12, 8), p(16, 4), p(20, 8)], c);
    for (let k = 0; k < 6; k++) g.circle(o.x + (grain(k, 1) - 0.5) * 9 * s, o.y + (grain(k, 2) - 0.3) * 9 * s, 1.1 * s, hex(ground, 0.9 * alphaOfC(c)));
    cut(g, p(24, 16), p(32, 12), p(34, 24), 1.5 * s, c);
    cut(g, p(16, 25), p(12, 33), p(24, 34), 1.5 * s, c);
  }
}

/**
 * Tiling edge strip between two points: kind 0 twisted rope, 1 running vine with leaves.
 * The pattern repeats every ~18 px (snapped to the length) so any span tiles cleanly.
 */
export function woodcutEdge(g: Gfx, x0: number, y0: number, x1: number, y1: number, c: RGBA, kind = 0): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const at = (s: number, o: number): Vec => ({ x: x0 + ux * s - uy * o, y: y0 + uy * s + ux * o });
  const n = Math.max(1, Math.round(len / 18));
  const step = len / n;
  g.line(at(0, -5), at(len, -5), 0.9, c);
  g.line(at(0, 5), at(len, 5), 0.9, c);
  for (let i = 0; i < n; i++) {
    const s = i * step;
    if (kind === 0) {
      cut(g, at(s, -4), at(s + step * 0.5, 0), at(s + step, 4), 2.2, c, 6);
    } else {
      const side = i % 2 ? 1 : -1;
      cut(g, at(s, 0), at(s + step * 0.5, side * 4), at(s + step, 0), 1.6, c, 6);
      g.poly([at(s + step * 0.5, side * 1.5), at(s + step * 0.7, side * 4.2), at(s + step * 0.35, side * 3.2)], c);
    }
  }
}

/** Divider rules: 0 lozenge and flourish, 1 chain of dots with a fleuron, 2 twin rule with a rosette. */
export function woodcutRule(g: Gfx, cx: number, y: number, w: number, variant: number, c: RGBA): void {
  if (variant === 0) {
    divider(g, cx, y, w, c);
    return;
  }
  if (variant === 1) {
    for (let x = cx - w / 2; x <= cx + w / 2; x += 7) if (Math.abs(x - cx) > 16) g.circle(x, y, Math.abs(x - cx) > w / 2 - 20 ? 1 : 1.6, c);
    fleuron(g, cx, y - 2, 12, c);
    return;
  }
  g.line({ x: cx - w / 2, y: y - 3 }, { x: cx - 12, y: y - 3 }, 1.4, c);
  g.line({ x: cx - w / 2 + 8, y: y + 3 }, { x: cx - 12, y: y + 3 }, 0.8, c);
  g.line({ x: cx + 12, y: y - 3 }, { x: cx + w / 2, y: y - 3 }, 1.4, c);
  g.line({ x: cx + 12, y: y + 3 }, { x: cx + w / 2 - 8, y: y + 3 }, 0.8, c);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    g.circle(cx + Math.cos(a) * 5, y + Math.sin(a) * 5, 2.6, c);
  }
  g.circle(cx, y, 2, c);
}

/** ❦ Fleuron: a heart-shaped leaf on a curled stem. */
export function fleuron(g: Gfx, x: number, y: number, s: number, c: RGBA): void {
  const k = s / 16;
  g.circle(x - 3.2 * k, y - 2 * k, 4 * k, c);
  g.circle(x + 3.2 * k, y - 2 * k, 4 * k, c);
  g.tri(x - 7 * k, y - 1 * k, x + 7 * k, y - 1 * k, x, y + 8 * k, c);
  cut(g, { x, y: y + 7 * k }, { x: x + 9 * k, y: y + 12 * k }, { x: x + 12 * k, y: y + 4 * k }, 1.6 * k, c, 6);
  cut(g, { x, y: y + 7 * k }, { x: x - 9 * k, y: y + 12 * k }, { x: x - 12 * k, y: y + 4 * k }, 1.6 * k, c, 6);
}

/** ☞ Manicule: the printer's pointing hand. */
export function manicule(g: Gfx, x: number, y: number, s: number, c: RGBA): void {
  const k = s / 16;
  g.ellipse(x - 4 * k, y, 7 * k, 5 * k, 0, c);
  g.line({ x, y: y - 2 * k }, { x: x + 12 * k, y: y - 2 * k }, 2.6 * k, c);
  for (let i = 0; i < 3; i++) g.line({ x: x - 2 * k, y: y + (1 + i * 1.6) * k }, { x: x + 3 * k, y: y + (1 + i * 1.6) * k }, 1.4 * k, c);
  g.rect(x - 14 * k, y - 4 * k, 4 * k, 8 * k, c);
  g.line({ x: x - 16 * k, y: y - 5 * k }, { x: x - 16 * k, y: y + 5 * k }, 1 * k, c);
}

/** § Section mark and ¶ pilcrow, from the body face. */
export function sectionMark(g: Gfx, x: number, y: number, s: number, c: RGBA, pilcrow = false): void {
  g.text(pilcrow ? '¶' : '§', x, y + s * 0.4, { size: s * 1.4, font: 'body', color: c, align: 'center', shadow: false });
}

/** A small vellum slip pinned with a brass pin (tooltips). The slip can point left at its target. */
export function tooltipSlip(g: Gfx, r: Rect, alpha = 1, pointLeft = true): void {
  g.rect(r.x + 3, r.y + 4, r.w, r.h, hex('#000000', 0.4 * alpha));
  parchmentArt(g, r, 'fresh', 0.6, r.y * 0.1, alpha * 0.97);
  if (pointLeft) g.tri(r.x + 1, r.y + r.h / 2 - 7, r.x + 1, r.y + r.h / 2 + 7, r.x - 8, r.y + r.h / 2, hex('#e0cfa6', 0.95 * alpha));
  g.circle(r.x + r.w - 9, r.y + 7, 3.4, hex('#000000', 0.35 * alpha));
  g.circleGrad(r.x + r.w - 10, r.y + 6, 3.2, hex(UI.brassHi, alpha), hex(UI.brassLo, alpha));
}

/** A keybind plate: a small brass key-cap with an engraved label. */
export function keyPlate(g: Gfx, x: number, y: number, label: string, size = 15): void {
  const w = Math.max(size * 1.6, g.measure(label, size, 'body') + size);
  const h = size * 1.5;
  g.rect(x - w / 2 + 1.5, y - h / 2 + 2.5, w, h, hex('#000000', 0.5));
  g.rectGrad(x - w / 2, y - h / 2, w, h, hex(UI.brassHi), hex(UI.brassLo));
  g.rectGrad(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 5, hex('#d8b868'), hex('#9a7430'));
  g.text(label, x, y + size * 0.36, { size, color: hex('#1a0e02'), align: 'center', shadow: hex('#f8e8b0', 0.5) });
}

/** Speaker name-plate cartouche: a scrolled brass frame around a plate tinted by the speaker's colour. */
export function nameCartouche(g: Gfx, cx: number, cy: number, w: number, h: number, tint: string): void {
  const x = cx - w / 2;
  const y = cy - h / 2;
  g.rect(x + 3, y + 4, w, h, hex('#000000', 0.45));
  g.rectGrad(x, y, w, h, hex('#2a0a0c'), hex('#12040a'));
  g.rectGrad(x + 3, y + 3, w - 6, h - 6, hex(tint, 0.24), hex(tint, 0.06));
  brassBorder(g, { x, y, w, h }, 2.5);
  for (const d of [-1, 1] as const) {
    const ex = d < 0 ? x - 3 : x + w + 3;
    g.quadCurve({ x: ex, y: y - 2 }, { x: ex + d * 18, y: y - 6 }, { x: ex + d * 16, y: cy - h * 0.18 }, 1.6, hex(UI.brass));
    g.quadCurve({ x: ex, y: y + h + 2 }, { x: ex + d * 18, y: y + h + 6 }, { x: ex + d * 16, y: cy + h * 0.18 }, 1.6, hex(UI.brass));
    g.circle(ex + d * 8, cy + 1.5, h * 0.3, hex('#000000', 0.4));
    g.circleGrad(ex + d * 8, cy, h * 0.3, hex(UI.brassHi), hex(UI.brassLo));
    g.circle(ex + d * 8, cy, h * 0.15, hex(tint));
  }
}

/** Continue glyph: a quill nib that dips as if writing. */
export function quillGlyph(g: Gfx, x: number, y: number, s: number, t: number, c: RGBA = hex(UI.gilt)): void {
  const dip = Math.max(0, Math.sin(t * 5)) * 3;
  const k = s / 16;
  g.save();
  g.translate(x, y + dip);
  g.rotate(0.6);
  g.poly([{ x: 0, y: 8 * k }, { x: -3 * k, y: -2 * k }, { x: 0, y: -14 * k }, { x: 3 * k, y: -2 * k }], c);
  g.line({ x: 0, y: 6 * k }, { x: 0, y: -2 * k }, 0.8, hex('#1a0e04', 0.8));
  g.quadCurve({ x: 0, y: -12 * k }, { x: -9 * k, y: -20 * k }, { x: -5 * k, y: -30 * k }, 2.2 * k, hex('#e8dcc0', alphaOfC(c)));
  g.restore();
  g.circle(x - 2, y + 11 + dip * 0.2, 1.6 * k, withA(c, 0.6));
}

/** Auto/skip indicator: a small ledger mark (» skip, ∞ auto) in gilt. */
export function flowMark(g: Gfx, x: number, y: number, mode: 'auto' | 'skip', t: number): void {
  const c = hex(UI.gilt, 0.6 + 0.3 * Math.sin(t * 4));
  if (mode === 'skip') for (let i = 0; i < 2; i++) g.poly([{ x: x + i * 8, y: y - 6 }, { x: x + i * 8 + 7, y }, { x: x + i * 8, y: y + 6 }], c);
  else {
    g.arc(x + 3, y, 4.5, 1.8, c);
    g.arc(x + 12, y, 4.5, 1.8, c);
  }
}

/** Rubricated drop-cap: a gilt letter on a red ground with vine marginalia. */
export function dropCap(g: Gfx, letter: string, x: number, y: number, size: number, gilt = true): void {
  const s = size;
  g.rect(x + 3, y + 4, s, s, hex('#000000', 0.35));
  g.rectGrad(x, y, s, s, hex('#8a1016'), hex('#4a0608'));
  g.rectLine(x + 3, y + 3, s - 6, s - 6, 1.2, hex(UI.gilt, 0.8));
  const vc = hex(gilt ? '#c8a040' : '#e6d6ae', 0.55);
  for (let k = 0; k < 4; k++) {
    const cx = x + (k % 2 ? s * 0.8 : s * 0.2);
    const cy = y + (k < 2 ? s * 0.2 : s * 0.8);
    g.arc(cx, cy, s * 0.09, 1.2, vc, 0.8, k * 1.4);
    g.circle(cx + s * 0.05, cy, 1.4, vc);
  }
  g.text(letter.toUpperCase(), x + s / 2, y + s * 0.8, {
    size: s * 0.82,
    font: 'display',
    color: hex(gilt ? '#fff0b8' : '#f0e4c8'),
    color2: hex(gilt ? UI.giltLo : '#b8a888'),
    align: 'center',
    shadow: hex('#1a0204', 0.9),
  });
}

/** Gilt numerals with a heavy dark outline, legible over red flesh down to ~18 px. */
export function giltNumerals(g: Gfx, str: string, x: number, y: number, size: number, alpha = 1, align: TextOpts['align'] = 'center'): void {
  const o = Math.max(1.2, size * 0.08);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.text(str, x + Math.cos(a) * o, y + Math.sin(a) * o, { size, font: 'body', color: hex('#140802', 0.85 * alpha), align, shadow: false });
  }
  g.text(str, x, y, { size, font: 'body', color: hex('#fff4c8', alpha), color2: hex(UI.gilt, alpha), align, shadow: false });
}

/** The pause veil: the candle snuffed — a smoky dark vignette with a rising curl of smoke. */
export function snuffedVeil(g: Gfx, w: number, h: number, t: number): void {
  g.rect(0, 0, w, h, hex('#050302', 0.5));
  const r = Math.hypot(w, h) * 0.5;
  for (let i = 0; i < 6; i++) g.circleGrad(w / 2, h / 2, r * (1.4 - i * 0.12), hex('#000000', 0), hex('#000000', 0.12));
  for (let i = 0; i < 14; i++) {
    const k = i / 14;
    const sx = w / 2 + Math.sin(t * 0.7 + k * 5) * 30 * k;
    const sy = h * 0.95 - k * h * 0.55;
    g.circleGrad(sx, sy, 20 + k * 60, hex('#8a8078', 0.05 * (1 - k)), hex('#8a8078', 0));
  }
}
