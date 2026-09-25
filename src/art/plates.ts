/**
 * Woodcut plates (ART-0060/0061): small printed scenes in ink on vellum, drawn procedurally so
 * they sit in the UI kit without painted assets. Each takes a rect and a time for gentle motion
 * (smoke, a guttering glow) that stops under reduced motion when `t` is held.
 */
import { SWATCHES } from '../render/palette';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Rect } from '../ui/widgets';
import { parchmentArt } from './kit';
import { drawWoundMan } from './woundMan';

const INK = '#1e140c';

function frame(g: Gfx, r: Rect, a: number): void {
  parchmentArt(g, r, 'foxed', 1, 7, a);
  g.rectLine(r.x + 10, r.y + 10, r.w - 20, r.h - 20, 2.2, hex(INK, 0.85 * a));
  g.rectLine(r.x + 15, r.y + 15, r.w - 30, r.h - 30, 0.8, hex(INK, 0.6 * a));
}

/** Horizontal hatching between y0 and y1 inside the plate, denser toward y1 (a woodcut sky). */
function skyHatch(g: Gfx, r: Rect, y0: number, y1: number, a: number): void {
  for (let y = y0, i = 0; y < y1; i++) {
    const k = (y - y0) / (y1 - y0);
    g.line({ x: r.x + 18 + (i % 3) * 3, y }, { x: r.x + r.w - 18 - (i % 2) * 5, y }, 0.8 + k * 0.6, hex(INK, (0.18 + k * 0.3) * a));
    y += 9 - k * 5;
  }
}

/**
 * The Chapter III teaser: the Kiln Rows at night. Bottle kilns and forge chimneys under a hatched
 * sky, the furnace mouths glowing, and a banderole of names being written across the smoke —
 * Prime, the Hour that writes.
 */
export function kilnRowsPlate(g: Gfx, r: Rect, t: number, caption: string, a = 1): void {
  frame(g, r, a);
  const ground = r.y + r.h * 0.78;
  g.save();
  g.pushClip({ x: r.x + 16, y: r.y + 16, w: r.w - 32, h: r.h - 32 });
  skyHatch(g, r, r.y + 18, ground - 40, a);
  // Bottle kilns: a swelling body with a narrow neck.
  const kilns = [0.14, 0.34, 0.62, 0.84];
  kilns.forEach((fx, i) => {
    const cx = r.x + r.w * fx;
    const hgt = r.h * (0.38 + (i % 2) * 0.1);
    const w = r.w * 0.075;
    const top = ground - hgt;
    const body = [
      { x: cx - w, y: ground },
      { x: cx - w * 1.15, y: ground - hgt * 0.45 },
      { x: cx - w * 0.35, y: top + hgt * 0.12 },
      { x: cx - w * 0.3, y: top },
      { x: cx + w * 0.3, y: top },
      { x: cx + w * 0.35, y: top + hgt * 0.12 },
      { x: cx + w * 1.15, y: ground - hgt * 0.45 },
      { x: cx + w, y: ground },
    ];
    g.poly(body, hex(INK, 0.92 * a));
    // Brick courses cut in light lines.
    for (let k = 1; k < 7; k++) {
      const y = ground - hgt * 0.55 * (k / 7);
      g.line({ x: cx - w * 1.05, y }, { x: cx + w * 1.05, y }, 0.7, hex('#e0cfa4', 0.25 * a));
    }
    // The furnace mouth.
    const glow = 0.75 + 0.25 * Math.sin(t * 3 + i * 2.1);
    g.glow(cx, ground - 10, w * 1.4, hex('#ff7a20', 0.35 * glow * a));
    g.poly([{ x: cx - w * 0.35, y: ground }, { x: cx - w * 0.35, y: ground - 14 }, { x: cx, y: ground - 22 }, { x: cx + w * 0.35, y: ground - 14 }, { x: cx + w * 0.35, y: ground }], hex('#ffb040', 0.9 * glow * a));
    // Smoke, drawn as broken ink curls.
    for (let s = 0; s < 5; s++) {
      const f = (t * 0.12 + s / 5 + i * 0.13) % 1;
      const sx = cx + Math.sin(f * 6 + i) * (6 + f * 18) + f * 26;
      const sy = top - 6 - f * (top - r.y - 30);
      g.circleGrad(sx, sy, 7 + f * 16, hex(INK, 0.4 * (1 - f) * a), hex(INK, 0));
    }
  });
  // Ground: a band of cross-hatching.
  g.rect(r.x + 16, ground, r.w - 32, r.y + r.h - 16 - ground, hex(INK, 0.85 * a));
  for (let x = r.x + 20; x < r.x + r.w - 20; x += 7) g.line({ x, y: ground + 3 }, { x: x - 10, y: r.y + r.h - 18 }, 0.7, hex('#e0cfa4', 0.18 * a));
  // A banderole across the smoke with names in a cramped hand: Prime writing its ledger.
  const by = r.y + r.h * 0.2;
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: r.x + r.w * (0.12 + 0.76 * (i / 20)), y: by + Math.sin(i * 0.55 + t * 0.6) * 6 });
  g.polyline(pts.map((p) => ({ x: p.x, y: p.y + 7 })), 18, hex('#e8d8b0', 0.95 * a));
  g.polyline(pts, 1, hex(INK, 0.8 * a));
  g.polyline(pts.map((p) => ({ x: p.x, y: p.y + 14 })), 1, hex(INK, 0.8 * a));
  const written = Math.min(1, 0.35 + ((t * 0.08) % 1));
  for (let i = 0; i < 20 * written; i++) {
    const p = pts[i];
    const q = pts[i + 1] ?? p;
    // Scribbled "letters": short ink strokes on the band, violet-black like the Malison's ink.
    g.line({ x: p.x + 2, y: p.y + 10 }, { x: (p.x + q.x) / 2, y: p.y + 4 + (i % 3) }, 1.2, hex('#2a1030', 0.85 * a));
    g.line({ x: (p.x + q.x) / 2, y: p.y + 4 + (i % 3) }, { x: q.x - 2, y: q.y + 10 - (i % 2) * 3 }, 1.2, hex('#2a1030', 0.85 * a));
  }
  g.popClip();
  g.restore();
  // Caption beneath, in the plate margin.
  g.text(caption, r.x + r.w / 2, r.y + r.h - 24, { size: 18, font: 'italic', color: hex('#e0cfa4', 0.95 * a), align: 'center', shadow: false });
}

/** The Wound Man plate: the anatomical figure pierced by every hazard of the trade. */
export function woundManPlate(g: Gfx, r: Rect, t: number, caption: string, a = 1): void {
  frame(g, r, a);
  skyHatch(g, r, r.y + 18, r.y + r.h - 40, a * 0.5);
  const h = r.h * 0.72;
  drawWoundMan(g, r.x + r.w / 2, r.y + 28, h, [
    { site: 'head', at: { x: 0.03, y: 0.04 } },
    { site: 'shoulder', at: { x: -0.17, y: 0.2 } },
    { site: 'chest', at: { x: 0.07, y: 0.27 } },
    { site: 'belly', at: { x: -0.03, y: 0.42 } },
    { site: 'thigh', at: { x: 0.08, y: 0.6 } },
    { site: 'leg', at: { x: -0.09, y: 0.8 } },
  ], t, a);
  g.text(caption, r.x + r.w / 2, r.y + r.h - 24, { size: 18, font: 'italic', color: hex(INK, 0.9 * a), align: 'center', shadow: false });
}

/** The leech jar: a stoppered apothecary jar, leeches drifting inside. */
export function leechJarPlate(g: Gfx, r: Rect, t: number, caption: string, a = 1): void {
  frame(g, r, a);
  skyHatch(g, r, r.y + 18, r.y + r.h * 0.3, a * 0.6);
  const cx = r.x + r.w / 2;
  const base = r.y + r.h * 0.8;
  const w = r.w * 0.22;
  const hgt = r.h * 0.5;
  // Shelf.
  g.rect(r.x + 16, base, r.w - 32, 10, hex(INK, 0.9 * a));
  for (let x = r.x + 20; x < r.x + r.w - 20; x += 6) g.line({ x, y: base + 12 }, { x: x - 8, y: r.y + r.h - 44 }, 0.6, hex(INK, 0.3 * a));
  // Jar body: glass tinted by the water, a cut outline and a highlight.
  const jar = [
    { x: cx - w, y: base },
    { x: cx - w * 1.05, y: base - hgt * 0.8 },
    { x: cx - w * 0.7, y: base - hgt * 0.95 },
    { x: cx + w * 0.7, y: base - hgt * 0.95 },
    { x: cx + w * 1.05, y: base - hgt * 0.8 },
    { x: cx + w, y: base },
  ];
  g.poly(jar, hex('#8a9a78', 0.35 * a));
  g.polyline(jar, 2.2, hex(INK, 0.9 * a), true);
  g.line({ x: cx - w * 0.8, y: base - hgt * 0.7 }, { x: cx - w * 0.78, y: base - hgt * 0.2 }, 3, hex('#fff8e0', 0.5 * a));
  // Stopper and tied cloth.
  g.rect(cx - w * 0.55, base - hgt * 1.1, w * 1.1, hgt * 0.16, hex(INK, 0.9 * a));
  g.line({ x: cx - w * 0.72, y: base - hgt * 0.96 }, { x: cx + w * 0.72, y: base - hgt * 0.96 }, 2, hex(INK, 0.9 * a));
  // Leeches: banded, looping slowly.
  for (let i = 0; i < 4; i++) {
    const ph = t * 0.5 + i * 1.6;
    const lx = cx + Math.sin(ph) * w * 0.55;
    const ly = base - hgt * (0.2 + 0.15 * i) + Math.cos(ph * 1.3) * 6;
    const ang = Math.cos(ph) * 0.8;
    g.ellipse(lx, ly, 13, 4.5, ang, hex(INK, 0.95 * a));
    for (let b = -1; b <= 1; b++) g.circle(lx + Math.cos(ang) * b * 5, ly + Math.sin(ang) * b * 5, 1, hex('#8a6a60', 0.8 * a));
  }
  g.text(caption, r.x + r.w / 2, r.y + r.h - 24, { size: 18, font: 'italic', color: hex(INK, 0.9 * a), align: 'center', shadow: false });
}

/** The Pyre: a stake and faggots under a hatched sky, flames cut in bold tongues. */
export function pyrePlate(g: Gfx, r: Rect, t: number, caption: string, a = 1): void {
  frame(g, r, a);
  skyHatch(g, r, r.y + 18, r.y + r.h * 0.7, a);
  const cx = r.x + r.w / 2;
  const base = r.y + r.h * 0.78;
  g.pushClip({ x: r.x + 16, y: r.y + 16, w: r.w - 32, h: r.h - 32 });
  // A plain stake, iron chains wound about it (no crossbar: the Pyre is not a church).
  g.rect(cx - 6, base - r.h * 0.55, 12, r.h * 0.55, hex(INK, 0.95 * a));
  g.tri(cx - 6, base - r.h * 0.55, cx + 6, base - r.h * 0.55, cx, base - r.h * 0.6, hex(INK, 0.95 * a));
  for (let i = 0; i < 5; i++) g.ellipse(cx, base - r.h * (0.42 - i * 0.025), 11, 4, 0.2, hex('#6a6a66', 0.9 * a), hex(INK, 0.5 * a));
  // Flames: tongues rising and licking, each a filled triangle-fan.
  for (let i = 0; i < 9; i++) {
    const fx = cx + (i - 4) * 18;
    const hh = 40 + Math.sin(t * 5 + i * 1.9) * 12 + (4 - Math.abs(i - 4)) * 12;
    const sway = Math.sin(t * 3 + i) * 6;
    g.tri(fx - 12, base - 8, fx + 12, base - 8, fx + sway, base - 8 - hh, hex('#ff8a30', 0.85 * a), hex('#ff8a30', 0.85 * a), hex('#fff0a0', 0.9 * a));
    g.line({ x: fx - 12, y: base - 8 }, { x: fx + sway, y: base - 8 - hh }, 1.4, hex(INK, 0.8 * a));
    g.line({ x: fx + 12, y: base - 8 }, { x: fx + sway, y: base - 8 - hh }, 1.4, hex(INK, 0.8 * a));
  }
  g.glow(cx, base - 30, 120, hex('#ff7020', 0.25 * a));
  // Faggot bundles.
  for (let i = 0; i < 7; i++) g.ellipse(cx + (i - 3) * 26, base, 20, 9, 0, hex(INK, 0.95 * a));
  g.rect(r.x + 16, base + 6, r.w - 32, r.y + r.h - 16 - base, hex(INK, 0.85 * a));
  g.popClip();
  g.text(caption, r.x + r.w / 2, r.y + r.h - 24, { size: 18, font: 'italic', color: hex('#e0cfa4', 0.95 * a), align: 'center', shadow: false });
}

/** The Choir mask: a faceless cloth mask with its sewn mouth-slit, candles either side. */
export function choirMaskPlate(g: Gfx, r: Rect, t: number, caption: string, a = 1): void {
  frame(g, r, a);
  g.rect(r.x + 16, r.y + 16, r.w - 32, r.h - 32, hex(INK, 0.9 * a));
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h * 0.45;
  const mw = r.w * 0.2;
  const mh = r.h * 0.3;
  // ART-0303: the hooded head tilts slowly about the neck (a 12 s sway), and a violet glow breathes
  // out through the sewn mouth on a 5 s breath.
  g.save();
  g.translate(cx, cy + mh * 1.2);
  g.rotate(Math.sin((t * Math.PI * 2) / 12) * 0.07);
  g.translate(-cx, -(cy + mh * 1.2));
  // Hood behind, then the mask of undyed cloth.
  g.ellipse(cx, cy + mh * 0.2, mw * 1.6, mh * 1.4, 0, hex('#3a3028', a));
  g.ellipse(cx, cy, mw, mh, 0, hex('#d8ccb0', 0.95 * a));
  // Cloth folds hatched down the mask's shadow side.
  for (let i = 0; i < 9; i++) g.line({ x: cx + mw * 0.35 + i * 2.2, y: cy - mh * 0.7 + i * 5 }, { x: cx + mw * 0.45 + i * 2.2, y: cy + mh * 0.7 - i * 4 }, 0.8, hex(INK, 0.35 * a));
  // Sewn mouth-slit: a line crossed by stitches. No eyes: the Choir has no faces.
  g.line({ x: cx - mw * 0.45, y: cy + mh * 0.35 }, { x: cx + mw * 0.45, y: cy + mh * 0.35 }, 2, hex(INK, 0.9 * a));
  for (let i = -3; i <= 3; i++) g.line({ x: cx + i * mw * 0.12, y: cy + mh * 0.28 }, { x: cx + i * mw * 0.12 + 2, y: cy + mh * 0.42 }, 1.4, hex('#6a0a10', 0.9 * a));
  const breath = 0.5 - 0.5 * Math.cos((t * Math.PI * 2) / 5);
  g.setBlend('add');
  g.ellipse(cx, cy + mh * 0.35, mw * (0.6 + 0.25 * breath), mh * (0.1 + 0.08 * breath), 0, hex(SWATCHES.curseViolet, (0.25 + 0.45 * breath) * a), hex(SWATCHES.curseViolet, 0));
  g.circleGrad(cx, cy + mh * 0.5, mw * (0.9 + 0.4 * breath), hex(SWATCHES.curseViolet, 0.18 * breath * a), hex(SWATCHES.curseViolet, 0));
  g.line({ x: cx - mw * 0.4, y: cy + mh * 0.35 }, { x: cx + mw * 0.4, y: cy + mh * 0.35 }, 1.2, hex('#e8d0ff', 0.5 * breath * a));
  g.setBlend('alpha');
  g.restore();
  // Beeswax candles either side, guttering.
  for (const s of [-1, 1]) {
    const x = cx + s * r.w * 0.32;
    const top = r.y + r.h * 0.5;
    g.rect(x - 7, top, 14, r.h * 0.28, hex('#e8d8a8', 0.9 * a));
    const fl = 1 + Math.sin(t * 9 + s) * 0.15;
    g.glow(x, top - 12, 30 * fl, hex('#ffb040', 0.3 * a));
    g.ellipse(x, top - 10, 4, 10 * fl, 0, hex('#fff0c0', 0.95 * a), hex('#ff9030', 0.6 * a));
  }
  g.text(caption, r.x + r.w / 2, r.y + r.h - 24, { size: 18, font: 'italic', color: hex('#e0cfa4', 0.95 * a), align: 'center', shadow: false });
}
