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
