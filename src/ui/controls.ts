/**
 * Renderers for the UI context's nodes (UIX-0004/0006/0008/0021): menu entries,
 * wax-seal primary buttons, option rows (stepper, toggle, slider, dropdown),
 * tab bars, list items, the shared focus ring and tooltips. Drawing only — all
 * input handling lives in `kit.ts`.
 *
 * Look: dark oak/leather and brass for menus, ink on parchment for documents,
 * gilt only for focus and headings, never flat neon highlights.
 */
import { diamond, glass, hglow, INK, menuItem, meter, rule } from './hudKit';
import { hex, mix, withAlpha, type RGBA } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Ui, UiNode, NodeState, Rect } from './kit';
import { UI } from './ornaments';
import { candleFlicker, pulse } from './motion';
import { fitText, wrapLines } from './text';
import { VIEW_W } from './layout';

/** Horizontal band fading to transparent at both ends. */
export function hband(g: Gfx, x: number, y: number, w: number, h: number, c: RGBA, edge = 0.3): void {
  const e = w * edge;
  const clear = withAlpha(c, 0);
  // Left fade, solid middle, right fade (per-vertex colours on two triangles each).
  g.tri(x, y, x + e, y, x + e, y + h, clear, c, c);
  g.tri(x, y, x + e, y + h, x, y + h, clear, c, clear);
  g.rect(x + e, y, w - 2 * e, h, c);
  g.tri(x + w - e, y, x + w, y, x + w, y + h, c, clear, clear);
  g.tri(x + w - e, y, x + w, y + h, x + w - e, y + h, c, clear, c);
}

/** Horizontal rule fading out at both ends. */
export function hrule(g: Gfx, x: number, y: number, w: number, c: RGBA, t = 1): void {
  hband(g, x, y - t / 2, w, t, c, 0.35);
}

/** A small lozenge fleuron. */
export function lozenge(g: Gfx, x: number, y: number, s: number, c: RGBA): void {
  g.poly(
    [
      { x, y: y - s },
      { x: x + s * 0.62, y },
      { x, y: y + s },
      { x: x - s * 0.62, y },
    ],
    c,
  );
}

/**
 * Focus ring (UIX-0004): gold rim with a soft candle glow; `k` 0..1 fades it.
 * Drawn for keyboard/gamepad focus and mouse hover alike.
 */
export function focusRing(g: Gfx, r: Rect, k: number, t: number): void {
  if (k <= 0.01) return;
  const glowA = (0.1 + 0.05 * pulse(t, 0.7)) * k * candleFlicker(t);
  g.glow(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.6, hex('#ffb050', glowA));
  const c = hex(UI.gilt, 0.85 * k);
  g.rectLine(r.x - 1, r.y - 1, r.w + 2, r.h + 2, 1.5, c);
  g.rectLine(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 1, hex(UI.brassLo, 0.6 * k));
  // Corner ticks.
  const L = Math.min(14, r.w / 4, r.h / 2);
  for (const [cx, cy, dx, dy] of [
    [r.x - 4, r.y - 4, 1, 1],
    [r.x + r.w + 4, r.y - 4, -1, 1],
    [r.x - 4, r.y + r.h + 4, 1, -1],
    [r.x + r.w + 4, r.y + r.h + 4, -1, -1],
  ] as const) {
    g.line({ x: cx, y: cy }, { x: cx + L * dx, y: cy }, 2, c);
    g.line({ x: cx, y: cy }, { x: cx, y: cy + L * dy }, 2, c);
  }
}

/** Drawn ◀ / ▶ arrow (the bundled fonts have no arrow glyphs). */
export function arrow(g: Gfx, x: number, y: number, dir: -1 | 1, s: number, c: RGBA): void {
  g.tri(x + dir * s * 0.6, y, x - dir * s * 0.4, y - s * 0.6, x - dir * s * 0.4, y + s * 0.6, c);
}

// ------------------------------------------------------------------ node renderers

const textY = (r: Rect, size: number) => r.y + r.h / 2 + size * 0.34;

/** Title-screen / pause menu entry: centred lettering on dark leather. */
export function menuEntry(g: Gfx, n: UiNode, s: NodeState, _t: number, size = 30): void {
  menuItem(g, n.rect, n.label, s.glow, n.enabled, size, s.active);
}

/** Button on parchment: dark ink, red ink when focused, with a ruled underline. */
export function parchmentEntry(g: Gfx, n: UiNode, s: NodeState, _t: number, size = 28): void {
  const r = n.rect;
  const k = s.glow;
  const cx = r.x + r.w / 2;
  if (k > 0) {
    hband(g, r.x, r.y, r.w, r.h, hex('#8a6a3a', 0.22 * k));
    hrule(g, r.x + 8, r.y + r.h - 2, r.w - 16, hex('#6a0a10', 0.7 * k), 1.5);
  }
  const col = !n.enabled ? hex('#8a7a60') : mix(hex(UI.inkDark), hex('#7a0c12'), k);
  fitText(g, n.id, n.label, cx, textY(r, size), r.w - 20, { size, color: col, align: 'center', shadow: false });
}

/**
 * Primary action button (UIX-0021): a raised gilt-edged plate with a tracked caps label; it
 * lifts and glows on focus, sinks while held, and goes cold grey when disabled.
 */
export function sealButton(g: Gfx, n: UiNode, s: NodeState, _t: number, size = 28): void {
  const r = n.rect;
  const k = s.glow;
  const on = n.enabled;
  const dy = s.active ? 1 : 0;
  g.plate(r.x, r.y + dy, r.w, r.h, {
    radius: 3,
    chamfer: true,
    top: hex(on ? mixHex('#3a2a18', '#5a3e1e', k) : '#262422', 0.97),
    bottom: hex(on ? '#1a120a' : '#141312', 0.97),
    border: hex(on ? INK.gold : '#5a5650', on ? 0.85 + 0.15 * k : 0.6),
    borderW: 1.4,
    inset: hex('#fff1c4', on ? 0.12 + 0.12 * k : 0.04),
    insetD: 4,
    bevel: s.active ? 0.3 : 0.85,
    shadow: [0.6, s.active ? 4 : 10, s.active ? 1 : 4],
    glow: on && k > 0 ? hex(INK.gold, 0.28 * k) : undefined,
    glowR: 16,
  });
  const fs = Math.round(size * 0.72);
  const label = n.label.toUpperCase();
  const top = on ? (k > 0.5 ? INK.goldHi : '#f0e2c0') : '#8a8680';
  const bot = on ? INK.gold : '#6a6660';
  g.text(label, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.36 + dy, { size: fs, font: 'display', color: hex(top), color2: hex(bot), align: 'center', tracking: 0.14, shadow: hex('#000000', 0.85), soft: true });
}

const mixHex = (a: string, b: string, k: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};

/** Options row: label on the left, control on the right. */
export function optionRow(g: Gfx, n: UiNode, s: NodeState, _t: number, o: { size?: number; split?: number; light?: boolean } = {}): void {
  const r = n.rect;
  const k = s.glow;
  const size = Math.round((o.size ?? 24) * 0.86);
  const light = o.light ?? false;
  const split = o.split ?? 0.5;
  if (k > 0) {
    hglow(g, { x: r.x - r.w * 0.1, y: r.y + 1, w: r.w * 1.2, h: r.h - 2 }, light ? hex('#8a6a3a', 0.2 * k) : hex('#7a5626', 0.26 * k));
    g.rect(r.x, r.y + 6, 2, r.h - 12, hex(INK.gold, 0.95 * k));
    g.glow(r.x + 1, r.y + r.h / 2, 16, hex(INK.gold, 0.2 * k));
  }
  const labelCol = light ? (!n.enabled ? hex('#8a7a60') : mix(hex(UI.inkDark), hex('#7a0c12'), k)) : !n.enabled ? hex(INK.faint) : mix(hex('#d8ccb4'), hex('#fff4dc'), k);
  const cy = textY(r, size);
  fitText(g, n.id, n.label, r.x + 20, cy, r.w * split - 28, { size, color: labelCol, shadow: light ? false : hex('#000000', 0.7) });
  const cx0 = r.x + r.w * split;
  const cw = r.w * (1 - split) - 16;
  const valCol = light ? hex('#5a0a10') : hex(INK.gold);
  const valOpts = (align: 'left' | 'center' | 'right') => ({ size: Math.round(size * 0.62), font: 'display' as const, color: valCol, align, tracking: 0.12, shadow: light ? (false as const) : hex('#000000', 0.8) });
  if (n.kind === 'slider') {
    const tr = { x: cx0 + 10, y: r.y + r.h / 2 - 3, w: cw - 84, h: 6 };
    const f = n.frac ?? 0;
    meter(g, tr, f, INK.goldHi, INK.goldLo, 10);
    const kx = tr.x + tr.w * f;
    diamond(g, kx, tr.y + 3, 7 + k, hex(k > 0.5 ? INK.goldHi : INK.gold), hex('#000000', 0.8));
    diamond(g, kx, tr.y + 3, 2.2, hex('#3a2a10'));
    if (n.value) g.text(n.value.toUpperCase(), r.x + r.w - 16, cy - size * 0.1, valOpts('right'));
  } else if (n.kind === 'toggle') {
    const on = !!n.on;
    const sw = { x: r.x + r.w - 16 - 54, y: r.y + r.h / 2 - 11, w: 54, h: 22 };
    g.plate(sw.x, sw.y, sw.w, sw.h, { radius: 11, top: hex(on ? '#6a4a1c' : '#0c0a08', 0.95), bottom: hex(on ? '#3a2810' : '#16120e', 0.95), border: hex(on ? INK.gold : '#4a4034', 0.9), borderW: 1.2, bevel: -0.5, shadow: [0, 0, 0] });
    const kx = on ? sw.x + sw.w - 11 : sw.x + 11;
    g.plate(kx - 8, sw.y + 3, 16, 16, { radius: 8, top: hex(on ? '#fff1c4' : '#8a8070'), bottom: hex(on ? '#c9a55c' : '#4a4238'), border: hex('#000000', 0.5), borderW: 1, bevel: 0.8, shadow: [0.5, 3, 1] });
    if (on) g.glow(kx, sw.y + 11, 14, hex(INK.gold, 0.25));
    if (n.value) g.text(n.value.toUpperCase(), sw.x - 14, cy - size * 0.1, valOpts('right'));
  } else if (n.kind === 'stepper' || n.kind === 'dropdown') {
    const ax0 = cx0 + 16;
    const ax1 = r.x + r.w - 20;
    const ac = hex(n.enabled ? INK.gold : '#5a5040', 0.45 + 0.55 * k);
    arrow(g, ax0, r.y + r.h / 2, -1, 8, ac);
    arrow(g, ax1, r.y + r.h / 2, 1, 8, ac);
    fitText(g, `${n.id}.value`, (n.value ?? '').toUpperCase(), (ax0 + ax1) / 2, cy - size * 0.1, ax1 - ax0 - 36, valOpts('center'));
  } else if (n.value) {
    fitText(g, `${n.id}.value`, n.value.toUpperCase(), r.x + r.w - 16, cy - size * 0.1, cw, valOpts('right'));
  }
}

/** Tab-bar tab (UIX-0006): tracked caps; the selected tab is gold with a lit bar beneath it. */
export function tab(g: Gfx, n: UiNode, s: NodeState, _t: number, selected: boolean, size = 22): void {
  const r = n.rect;
  const k = s.glow;
  const fs = Math.round(size * 0.66);
  const cx = r.x + r.w / 2;
  if (selected) {
    hglow(g, { x: r.x, y: r.y, w: r.w, h: r.h }, hex('#7a5626', 0.3));
    rule(g, cx, r.y + r.h - 2, r.w * 0.9, hex(INK.gold, 0.95), 2);
    g.glow(cx, r.y + r.h - 1, r.w * 0.35, hex(INK.gold, 0.18));
  } else if (k > 0) rule(g, cx, r.y + r.h - 2, r.w * 0.7, hex(INK.gilt, 0.5 * k), 1);
  const col = selected ? hex(INK.goldHi) : mix(hex(INK.dim), hex('#f0e2c0'), k);
  fitText(g, n.id, n.label.toUpperCase(), cx, textY(r, fs) + 1, r.w - 12, { size: fs, font: 'display', color: col, color2: selected ? hex(INK.gold) : undefined, align: 'center', tracking: 0.14, shadow: hex('#000000', 0.8) });
}

/** List item in a scroll list (chapter steps, operating theatre, backlog). */
export function listItem(g: Gfx, n: UiNode, s: NodeState, _t: number, selected = false): void {
  const r = n.rect;
  const k = Math.max(s.glow, selected ? 0.6 : 0);
  if (k > 0) {
    hglow(g, { x: r.x - r.w * 0.1, y: r.y + 1, w: r.w * 1.2, h: r.h - 2 }, hex('#7a5626', 0.26 * k));
    g.rect(r.x, r.y + 5, 2, r.h - 10, hex(INK.gold, 0.95 * k));
  }
  g.rect(r.x + 8, r.y + r.h, r.w - 16, 1, hex(INK.gilt, 0.14));
}

/** Draw every node of a UI with its default renderer (galleries, simple menus). */
export function drawNodes(g: Gfx, ui: Ui, t: number, o: { light?: boolean; size?: number } = {}): void {
  for (const n of ui.nodes) {
    const s = ui.state(n.id);
    if (n.style === 'seal') sealButton(g, n, s, t, o.size ?? 26);
    else if (n.kind === 'button') (o.light ? parchmentEntry : menuEntry)(g, n, s, t, o.size ?? 28);
    else if (n.kind === 'tab') tab(g, n, s, t, !!n.on);
    else if (n.kind === 'item') listItem(g, n, s, t, !!n.on);
    else optionRow(g, n, s, t, { light: o.light, size: o.size });
  }
}

// ------------------------------------------------------------------ tooltip (UIX-0008)

export const TOOLTIP_MAX_W = 360;

/** Where a tooltip for `anchor` goes: right of it by default, flipped left/up to stay on screen. */
export function tooltipRect(anchor: Rect, w: number, h: number, view = { x: 0, y: 0, w: VIEW_W, h: 720 }): Rect {
  let x = anchor.x + anchor.w + 12;
  if (x + w > view.x + view.w - 8) x = anchor.x - w - 12;
  if (x < view.x + 8) x = Math.max(view.x + 8, Math.min(view.x + view.w - w - 8, anchor.x + anchor.w / 2 - w / 2));
  let y = anchor.y + anchor.h / 2 - h / 2;
  if (x === anchor.x + anchor.w + 12 || x === anchor.x - w - 12) {
    // beside the anchor
  } else y = anchor.y + anchor.h + 10 + h > view.y + view.h - 8 ? anchor.y - h - 10 : anchor.y + anchor.h + 10;
  y = Math.max(view.y + 8, Math.min(view.y + view.h - h - 8, y));
  return { x, y, w, h };
}

/** A parchment slip with a title line and wrapped body text. */
export function tooltip(g: Gfx, anchor: Rect, title: string | undefined, body: string, alpha = 1): Rect {
  const size = 18;
  const pad = 12;
  const m = (s: string) => g.measure(s, size, 'body');
  const lines = wrapLines(m, body, TOOLTIP_MAX_W - pad * 2);
  const bodyW = Math.max(...lines.map(m), title ? g.measure(title, 20, 'body') : 0);
  const w = Math.min(TOOLTIP_MAX_W, bodyW + pad * 2);
  const h = pad * 2 + (title ? 26 : 0) + lines.length * size * 1.3 - 4;
  const vr = g.viewRect();
  const r = tooltipRect(anchor, w, h, vr);
  glass(g, r, { alpha, strength: 1.1 });
  let y = r.y + pad + 16;
  if (title) {
    g.text(title.toUpperCase(), r.x + pad, y - 2, { size: 13, font: 'display', color: hex(INK.gold, alpha), tracking: 0.14, shadow: false });
    y += 26;
  }
  lines.forEach((l, i) => g.text(l, r.x + pad, y + i * size * 1.3, { size, color: hex(INK.text, alpha), shadow: false }));
  return r;
}

/** Draw the UI's current tooltip (hover after the delay, or keyboard/gamepad focus). */
export function drawTooltip(g: Gfx, ui: Ui): void {
  const n = ui.tipNode();
  if (n?.tip) tooltip(g, n.rect, undefined, n.tip);
}
