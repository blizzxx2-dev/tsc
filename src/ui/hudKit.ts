/**
 * The HUD and menu kit: one material (smoked glass on dark iron with a gilt hairline, drawn by
 * PLATE_FS) and one type system (tracked Cinzel caps for labels and numbers, EB Garamond for
 * reading). Everything on screen should be built from these so the game reads as one design.
 */
import { hex, withAlpha, type RGBA } from '../render/color';
import type { Align, Gfx, PlateOpts } from '../render/gfx';
import type { Rect } from './widgets';

export const INK = {
  text: '#efe6d2',
  dim: '#a8987a',
  faint: '#6f624c',
  gold: '#e6c77a',
  goldHi: '#fff1c4',
  goldLo: '#9c7433',
  gilt: '#c9a55c',
  blood: '#d0333a',
  bloodLo: '#6e0f14',
  verdigris: '#7fc4a4',
  curse: '#b98cff', // curse-violet: the Malison's phase banner
};

/** Dark smoked-glass plate with a gilt hairline — the default surface. */
export function glass(g: Gfx, r: Rect, o: PlateOpts & { strength?: number } = {}): void {
  const k = o.strength ?? 1;
  g.plate(r.x, r.y, r.w, r.h, {
    radius: 3,
    top: hex('#1a1411', Math.min(0.97, 0.86 * k)),
    bottom: hex('#0a0807', Math.min(0.98, 0.92 * k)),
    border: hex(INK.gilt, 0.75 * k),
    borderW: 1.1,
    inset: hex('#f3d9a0', 0.1 * k),
    insetD: 4,
    bevel: 0.7,
    shadow: [0.6 * k, 16, 5],
    ...o,
  });
}

/** A recessed well inside a plate (trace windows, meter troughs, slot insides). */
export function well(g: Gfx, r: Rect, a = 1): void {
  g.plate(r.x, r.y, r.w, r.h, {
    radius: 2,
    top: hex('#050404', 0.85 * a),
    bottom: hex('#0e0b09', 0.85 * a),
    border: hex('#000000', 0.6 * a),
    borderW: 1,
    bevel: -0.6,
    shadow: [0, 0, 0],
    grain: 0.5,
  });
  // Lower lip catches the light: the well reads as cut into the plate.
  g.rect(r.x + 2, r.y + r.h, r.w - 4, 1, hex('#f3d9a0', 0.08 * a));
}

/** Engraved small caps label: Cinzel, tracked. */
export function caps(g: Gfx, s: string, x: number, y: number, size = 12, color: RGBA = hex(INK.dim), align: Align = 'left'): void {
  g.text(s.toUpperCase(), x, y, { size, font: 'display', color, align, tracking: 0.16, shadow: hex('#000000', 0.7), soft: true });
}

/** Big lining numerals with a warm gradient (vitals, timer, score). */
export function numerals(g: Gfx, s: string, x: number, y: number, size: number, top: string = INK.goldHi, bottom: string = INK.gold, align: Align = 'left', a = 1): void {
  g.text(s, x, y, { size, font: 'display', color: hex(top, a), color2: hex(bottom, a), align, tracking: 0.04, shadow: hex('#000000', 0.85 * a), soft: true });
}

/** Reading text on a dark surface. */
export function prose(g: Gfx, s: string, x: number, y: number, size = 20, color: string = INK.text, a = 1, align: Align = 'left'): void {
  g.text(s, x, y, { size, font: 'body', color: hex(color, a), align, shadow: hex('#000000', 0.8 * a), soft: true });
}

/** A hairline rule that fades out at both ends. */
export function rule(g: Gfx, cx: number, y: number, w: number, c: RGBA = hex(INK.gilt, 0.8), thick = 1): void {
  const clear = withAlpha(c, 0);
  const h = w / 2;
  g.tri(cx - h, y, cx, y, cx, y + thick, clear, c, c);
  g.tri(cx - h, y, cx, y + thick, cx - h, y + thick, clear, c, clear);
  g.tri(cx, y, cx + h, y, cx + h, y + thick, c, clear, clear);
  g.tri(cx, y, cx + h, y + thick, cx, y + thick, c, clear, c);
}

/** A small lozenge (phase pips, list markers, rule centres). */
export function diamond(g: Gfx, x: number, y: number, s: number, fill: RGBA, edge?: RGBA): void {
  if (edge !== undefined) g.poly([{ x, y: y - s - 1.2 }, { x: x + s + 1.2, y }, { x, y: y + s + 1.2 }, { x: x - s - 1.2, y }], edge);
  g.poly([{ x, y: y - s }, { x: x + s, y }, { x, y: y + s }, { x: x - s, y }], fill);
}

/** A title rule: two fading hairlines with a lozenge between (under headings). */
export function titleRule(g: Gfx, cx: number, y: number, w: number, a = 1): void {
  rule(g, cx - w * 0.27, y, w * 0.46, hex(INK.gilt, 0.85 * a));
  rule(g, cx + w * 0.27, y, w * 0.46, hex(INK.gilt, 0.85 * a));
  diamond(g, cx, y + 0.5, 3.5, hex(INK.gold, a), hex('#000000', 0.6 * a));
}

/** A full-width dark band that fades at the sides, behind centred title cards. */
export function band(g: Gfx, y: number, h: number, a: number, viewX: number, viewW: number): void {
  const c = hex('#060404', 0.78 * a);
  const clear = withAlpha(c, 0);
  const mid = viewX + viewW / 2;
  const half = viewW / 2;
  g.tri(mid - half, y, mid, y, mid, y + h, clear, c, c);
  g.tri(mid - half, y, mid, y + h, mid - half, y + h, clear, c, clear);
  g.tri(mid, y, mid + half, y, mid + half, y + h, c, clear, clear);
  g.tri(mid, y, mid + half, y + h, mid, y + h, c, clear, c);
}

/** Keycap chip for key prompts (`E`, `1`, `Space`). */
export function keycap(g: Gfx, label: string, x: number, y: number, size = 12, a = 1): number {
  const w = Math.max(size * 1.5, g.measure(label, size, 'display', 0.06) + size * 0.9);
  g.plate(x, y - size * 0.8, w, size * 1.55, {
    radius: 3,
    top: hex('#2c241c', 0.95 * a),
    bottom: hex('#15100c', 0.95 * a),
    border: hex(INK.gilt, 0.7 * a),
    borderW: 1,
    bevel: 0.8,
    shadow: [0.5 * a, 4, 1.5],
  });
  g.text(label, x + w / 2, y + size * 0.45, { size, font: 'display', color: hex(INK.goldHi, a), align: 'center', tracking: 0.06, shadow: false });
  return w;
}

/** A segmented meter in a well: `frac` filled, colours top→bottom, with a bright leading edge. */
export function meter(g: Gfx, r: Rect, frac: number, top: string, bottom: string, segments = 0, a = 1): void {
  well(g, r, a);
  const f = Math.max(0, Math.min(1, frac));
  const w = (r.w - 2) * f;
  if (w > 0.5) {
    g.rectGrad(r.x + 1, r.y + 1, w, r.h - 2, hex(top, a), hex(bottom, a));
    g.rect(r.x + 1, r.y + 1, w, 1, hex('#ffffff', 0.25 * a));
    g.rect(r.x + w - 1, r.y + 1, 2, r.h - 2, hex('#ffffff', 0.45 * a));
  }
  for (let i = 1; i < segments; i++) g.rect(r.x + (r.w * i) / segments, r.y + 1, 1, r.h - 2, hex('#000000', 0.55 * a));
}

/** A horizontal highlight that fades at both ends (menu hover). */
export function hglow(g: Gfx, r: Rect, c: RGBA): void {
  const clear = withAlpha(c, 0);
  const m = r.x + r.w / 2;
  g.tri(r.x, r.y, m, r.y, m, r.y + r.h, clear, c, c);
  g.tri(r.x, r.y, m, r.y + r.h, r.x, r.y + r.h, clear, c, clear);
  g.tri(m, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, c, clear, clear);
  g.tri(m, r.y, r.x + r.w, r.y + r.h, m, r.y + r.h, c, clear, c);
}

/**
 * The one menu item look: tracked Cinzel caps; focus `k` (0..1) fades in a warm band, two
 * hairline rules and lozenge markers, and turns the label gold. `onLight` inks it for parchment.
 */
export function menuItem(g: Gfx, r: Rect, label: string, k: number, enabled: boolean, size: number, pressed = false, onLight = false, align: Align = 'center'): void {
  const cx = align === 'center' ? r.x + r.w / 2 : r.x + 26;
  const cy = r.y + r.h / 2;
  const fs = Math.round(size * 0.74);
  const tw = Math.min(g.measure(label.toUpperCase(), fs, 'display', 0.14), r.w - 48);
  if (k > 0.01 && enabled) {
    if (onLight) hglow(g, { x: r.x, y: r.y + 2, w: r.w, h: r.h - 4 }, hex('#8a6a3a', 0.2 * k));
    else {
      hglow(g, { x: r.x, y: r.y + 2, w: r.w, h: r.h - 4 }, hex('#6a4a22', 0.34 * k));
      rule(g, r.x + r.w / 2, r.y + 2, r.w * 0.9, hex(INK.gilt, 0.7 * k));
      rule(g, r.x + r.w / 2, r.y + r.h - 3, r.w * 0.9, hex(INK.gilt, 0.7 * k));
    }
    const gap = tw / 2 + 20;
    const mc = hex(onLight ? '#7a0c12' : INK.gold, k);
    if (align === 'center') {
      diamond(g, cx - gap, cy, 3.5 * k + 0.5, mc);
      diamond(g, cx + gap, cy, 3.5 * k + 0.5, mc);
    } else diamond(g, r.x + 12, cy, 3.5 * k + 0.5, mc);
  }
  const dy = pressed ? 1 : 0;
  const ty = cy + fs * 0.36 + dy;
  const up = label.toUpperCase();
  const tx = align === 'center' ? cx : cx;
  if (onLight) {
    const c = !enabled ? hex('#8a7a60', 0.7) : k > 0.5 ? hex('#7a0c12') : hex('#2a1a10');
    g.text(up, tx, ty, { size: fs, font: 'display', color: c, align, tracking: 0.14, shadow: false });
    return;
  }
  if (!enabled) {
    g.text(up, tx, ty, { size: fs, font: 'display', color: hex(INK.faint, 0.8), align, tracking: 0.14, shadow: hex('#000000', 0.6), soft: true });
    return;
  }
  const top = k > 0.5 ? INK.goldHi : '#e8dcc4';
  const bot = k > 0.5 ? INK.gold : '#b8aa90';
  g.text(up, tx, ty, { size: fs, font: 'display', color: hex(top), color2: hex(bot), align, tracking: 0.14, shadow: hex('#000000', 0.85), soft: true });
}

/** A panel heading: tracked Cinzel caps in gold leaf over a lozenge rule. */
export function heading(g: Gfx, s: string, cx: number, y: number, w: number, a = 1, size = 26): void {
  g.text(s.toUpperCase(), cx, y, { size, font: 'display', color: hex(INK.goldHi, a), color2: hex(INK.gold, a), align: 'center', tracking: 0.16, shadow: hex('#000000', 0.9 * a), soft: true });
  titleRule(g, cx, y + 18, w, a);
}

/**
 * An action rating over the field: the word in tracked caps (light→dark gradient in the rating's
 * inks), punching in over the first 0.15 s and settling, with a rule that draws out beneath.
 */
export function ratingCallout(g: Gfx, word: string, x: number, y: number, t: number, a: number, inks: [string, string], size = 30): void {
  const pop = t < 0.15 ? 1.35 - (t / 0.15) * 0.35 : 1;
  const s = size * pop;
  const up = word.toUpperCase();
  g.text(up, x, y, { size: s, font: 'display', color: hex('#ffffff', a), color2: hex(inks[0], a), align: 'center', tracking: 0.12, shadow: hex('#000000', 0.9 * a), soft: true });
  const w = g.measure(up, s, 'display', 0.12) * Math.min(1, t / 0.25);
  rule(g, x, y + s * 0.3, w + 20, hex(inks[0], 0.8 * a), 1.5);
  if (t < 0.3) g.glow(x, y - s * 0.3, s * 2, hex(inks[0], 0.25 * (1 - t / 0.3) * a));
}

// ---------------------------------------------------------------- in-operation stamps and seals

/**
 * Woodcut rating stamps (UIX-0046): each rating has its own shape as well as its ink, so it reads
 * without colour — COOL a gilt sunburst seal, GOOD a laurel lozenge, BAD a rust chevron, MISS a
 * blood blot. `t` is seconds since the stamp landed.
 */
export function ratingStamp(g: Gfx, rating: 'cool' | 'good' | 'bad' | 'miss', word: string, x: number, y: number, t: number, a: number, inks: [string, string], size = 30): void {
  const pop = t < 0.15 ? 1.35 - (t / 0.15) * 0.35 : 1;
  const s = size * pop;
  const up = word.toUpperCase();
  const w = g.measure(up, s, 'display', 0.12);
  const ink = hex(inks[0], 0.9 * a);
  const dark = hex('#000000', 0.55 * a);
  const cy = y - s * 0.32;
  if (rating === 'cool') {
    // Sunburst: twelve rays round a ring.
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2 + t * 0.6;
      const r = (i % 2 ? s * 0.55 : s * 0.8) * (0.8 + 0.2 * Math.min(1, t / 0.25));
      pts.push({ x: x + Math.cos(ang) * r * 2.4, y: cy + Math.sin(ang) * r });
    }
    g.poly(pts, hex(inks[1], 0.18 * a), ink);
    g.arc(x, cy, s * 0.72, 2, ink);
    g.glow(x, cy, s * 2.2, hex(inks[0], 0.22 * Math.max(0, 1 - t / 0.6) * a));
  } else if (rating === 'good') {
    // Laurel lozenge: a soft diamond with two leaf ticks.
    const hw = w * 0.62 + 14;
    const hh = s * 0.62;
    g.poly([{ x: x - hw, y: cy }, { x: x, y: cy - hh }, { x: x + hw, y: cy }, { x: x, y: cy + hh }], hex(inks[1], 0.16 * a), ink);
    for (const sx of [-1, 1]) g.line({ x: x + sx * (hw + 4), y: cy }, { x: x + sx * (hw + 14), y: cy - 6 }, 2, ink);
  } else if (rating === 'bad') {
    // Rust chevron pointing down: a warning, not a wound.
    const hw = w * 0.55 + 10;
    g.poly([{ x: x - hw, y: cy - s * 0.55 }, { x: x + hw, y: cy - s * 0.55 }, { x: x, y: cy + s * 0.75 }], hex(inks[1], 0.22 * a), ink);
    g.poly([{ x: x - hw * 0.6, y: cy - s * 0.55 }, { x: x + hw * 0.6, y: cy - s * 0.55 }, { x: x, y: cy + s * 0.25 }], dark);
  } else {
    // Blood blot: irregular splash, spreading for a moment.
    const k = 0.7 + 0.3 * Math.min(1, t / 0.3);
    for (let i = 0; i < 7; i++) {
      const ang = i * 2.4;
      const r = (i === 0 ? s * 0.75 : s * (0.28 + 0.12 * (i % 3))) * k;
      const d = i === 0 ? 0 : s * (0.5 + 0.25 * (i % 2)) * k;
      g.circle(x + Math.cos(ang) * d * 1.6, cy + Math.sin(ang) * d * 0.6, r, hex(inks[1], 0.55 * a));
    }
  }
  g.text(up, x, y, { size: s, font: 'display', color: hex('#ffffff', a), color2: hex(inks[0], a), align: 'center', tracking: 0.12, shadow: hex('#000000', 0.9 * a), soft: true });
}

/** The vitals heart (UIX-0040): steady, hurried, failing (arrhythmic, red-lit) or stopped (grey, cracked). `beat` is 0..1 within the pulse. */
export function heartIcon(g: Gfx, x: number, y: number, r: number, state: 'good' | 'warn' | 'danger' | 'dead', beat: number): void {
  const squeeze = state === 'dead' ? 1 : 1 + 0.12 * Math.exp(-beat * 6);
  const R = r * squeeze;
  const col = state === 'dead' ? '#6a5a58' : state === 'danger' ? '#ff4a3a' : state === 'warn' ? '#e8664a' : '#c83a3a';
  const hi = state === 'dead' ? '#8a7a78' : '#ff9a8a';
  if (state === 'danger') g.glow(x, y, R * 2.6, hex('#ff2a1a', 0.35 * Math.exp(-beat * 4)));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 28; i++) {
    const u = (i / 28) * Math.PI * 2;
    // The classic cardioid-ish heart curve.
    const hx = 16 * Math.sin(u) ** 3;
    const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
    pts.push({ x: x + (hx / 17) * R, y: y + (hy / 17) * R });
  }
  g.poly(pts, hex(col), hex(hi, 0.8));
  g.circle(x - R * 0.35, y - R * 0.3, R * 0.22, hex('#ffffff', 0.25));
  if (state === 'dead') g.polyline([{ x: x - R * 0.1, y: y - R * 0.8 }, { x: x + R * 0.15, y: y - R * 0.2 }, { x: x - R * 0.12, y: y + R * 0.2 }, { x: x + R * 0.1, y: y + R * 0.7 }], 1.5, hex('#2a1a18', 0.9));
}

/** A phase seal (UIX-0045): pressed gold once done, lit while current, an empty ring to come. */
export function phaseSeal(g: Gfx, x: number, y: number, r: number, state: 'done' | 'current' | 'todo', time: number): void {
  if (state === 'todo') {
    g.arc(x, y, r, 1.2, hex('#5a4a34', 0.9));
    return;
  }
  if (state === 'current') g.glow(x, y, r * 3, hex(INK.gold, 0.22 + 0.08 * Math.sin(time * 3)));
  g.circleGrad(x, y, r, hex(state === 'current' ? INK.goldHi : INK.gold), hex(state === 'current' ? INK.gold : '#7a5a2a'));
  g.arc(x, y, r, 1, hex('#000000', 0.6));
  diamond(g, x, y, r * 0.45, hex('#2a1a08', 0.8));
}

/** Ledger tally marks: four strokes and a bar through them per five. */
export function tallyMarks(g: Gfx, x: number, y: number, n: number, c: RGBA): void {
  let cx = x;
  for (let i = 0; i < n; i++) {
    const k = i % 5;
    if (k < 4) g.line({ x: cx + k * 5, y }, { x: cx + k * 5 + 1.5, y: y + 14 }, 1.5, c);
    else {
      g.line({ x: cx - 3, y: y + 11 }, { x: cx + 19, y: y + 3 }, 1.5, c);
      cx += 26;
    }
  }
}
