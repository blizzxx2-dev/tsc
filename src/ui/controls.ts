/**
 * Renderers for the UI context's nodes (UIX-0004/0006/0008/0021): menu entries,
 * wax-seal primary buttons, option rows (stepper, toggle, slider, dropdown),
 * tab bars, list items, the shared focus ring and tooltips. Drawing only — all
 * input handling lives in `kit.ts`.
 *
 * Look: dark oak/leather and brass for menus, ink on parchment for documents,
 * gilt only for focus and headings, never flat neon highlights.
 */
import { hex, mix, withAlpha, type RGBA } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Ui, UiNode, NodeState, Rect } from './kit';
import { UI } from './ornaments';
import { candleFlicker, pulse } from './motion';
import { fitText, wrapLines } from './text';
import { VIEW_W } from './layout';
import { palette } from './theme';

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
export function menuEntry(g: Gfx, n: UiNode, s: NodeState, t: number, size = 30): void {
  const r = n.rect;
  const k = s.glow;
  const cx = r.x + r.w / 2;
  if (k > 0) {
    hband(g, r.x, r.y, r.w, r.h, hex('#5a1418', 0.5 * k * candleFlicker(t)));
    hrule(g, r.x + 10, r.y, r.w - 20, hex(UI.brass, 0.8 * k));
    hrule(g, r.x + 10, r.y + r.h, r.w - 20, hex(UI.brass, 0.8 * k));
    g.glow(cx, r.y + r.h / 2, r.w * 0.4, hex('#ffb050', 0.07 * k));
  }
  const tw = Math.min(g.measure(n.label, size, 'body'), r.w - 60);
  if (k > 0.05) {
    const gap = tw / 2 + 22;
    lozenge(g, cx - gap, r.y + r.h / 2, 5 * k, hex(UI.gilt, k));
    lozenge(g, cx + gap, r.y + r.h / 2, 5 * k, hex(UI.gilt, k));
  }
  const col = !n.enabled ? hex('#6a6050') : mix(hex(palette().ink), hex('#fff0c0'), k);
  const col2 = !n.enabled ? hex('#4a4238') : mix(hex('#b8a888'), hex(UI.gilt), k);
  fitText(g, n.id, n.label, cx, textY(r, size), r.w - 40, { size, color: col, color2: col2, align: 'center' });
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
 * Wax-seal button (UIX-0021) for primary actions: a poured wax plaque with the
 * label pressed into it; squashes while held (MOTION.press) and turns to cold
 * grey wax when disabled.
 */
export function sealButton(g: Gfx, n: UiNode, s: NodeState, t: number, size = 28): void {
  const r = n.rect;
  const k = s.glow;
  const squash = s.active ? 0.93 : 1;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const w = r.w * (s.active ? 1.02 : 1);
  const h = r.h * squash;
  const base = n.enabled ? '#8a1016' : '#4a4a4e';
  const lo = n.enabled ? '#4a0608' : '#2a2a2e';
  // Poured wax: a rounded bar whose edge wobbles slightly, like wax that ran before it set.
  const pts: { x: number; y: number }[] = [];
  const rad = h / 2;
  const hw = w / 2 - rad;
  const N = 14;
  for (let side = 0; side < 2; side++) {
    const sx = side === 0 ? cx + hw : cx - hw;
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI + side * Math.PI;
      const wob = 1 + 0.05 * Math.sin(i * 2.3 + side * 4 + r.x * 0.07);
      pts.push({ x: sx + Math.cos(a) * rad * wob, y: cy + Math.sin(a) * rad * wob });
    }
  }
  g.poly(
    pts.map((p) => ({ x: p.x + 3, y: p.y + 4 })),
    hex('#000000', 0.5),
  );
  g.poly(pts, hex(lo), hex(base));
  // Glossy highlight and an inner pressed ring.
  hband(g, cx - w * 0.38, cy - h * 0.36, w * 0.76, h * 0.16, hex('#ff9a9a', n.enabled ? 0.18 + 0.12 * k : 0.08), 0.4);
  g.rectLine(cx - w / 2 + 10, cy - h / 2 + 7, w - 20, h - 14, 1, hex('#000000', 0.25));
  if (k > 0) g.glow(cx, cy, w * 0.55, hex('#ff6040', 0.12 * k * candleFlicker(t)));
  const col = n.enabled ? mix(hex('#f0c8b0'), hex('#fff2dc'), k) : hex('#9a9aa0');
  fitText(g, n.id, n.label, cx, cy + size * 0.34, w - 36, { size, color: col, align: 'center', shadow: hex('#2a0204', 0.9) });
  if (s.focus && k > 0) focusRing(g, { x: r.x - 4, y: r.y - 2, w: r.w + 8, h: r.h + 4 }, k * 0.8, t);
}

/** Options row: label on the left, control on the right. */
export function optionRow(g: Gfx, n: UiNode, s: NodeState, t: number, o: { size?: number; split?: number; light?: boolean } = {}): void {
  const r = n.rect;
  const k = s.glow;
  const size = o.size ?? 24;
  const light = o.light ?? false;
  const split = o.split ?? 0.5;
  if (k > 0) {
    hband(g, r.x, r.y, r.w, r.h, light ? hex('#8a6a3a', 0.2 * k) : hex('#5a1418', 0.45 * k * candleFlicker(t)), 0.08);
    g.rect(r.x, r.y + 4, 3, r.h - 8, hex(UI.gilt, 0.9 * k));
  }
  const ink = light ? hex(UI.inkDark) : hex(palette().ink);
  const hi = light ? hex('#7a0c12') : hex(UI.gilt);
  const labelCol = !n.enabled ? hex('#6a6050') : mix(ink, hi, k);
  const cy = textY(r, size);
  fitText(g, n.id, n.label, r.x + 18, cy, r.w * split - 24, { size, color: labelCol, shadow: light ? false : undefined });
  const cx0 = r.x + r.w * split;
  const cw = r.w * (1 - split) - 16;
  const valCol = light ? hex('#5a0a10') : hex(UI.gilt);
  if (n.kind === 'slider') {
    const tr = { x: cx0 + 10, y: r.y + r.h / 2 - 3, w: cw - 70, h: 6 };
    g.rect(tr.x, tr.y, tr.w, tr.h, hex('#000000', 0.55));
    const f = n.frac ?? 0;
    g.rectGrad(tr.x, tr.y, tr.w * f, tr.h, hex(UI.gilt), hex(UI.giltLo));
    g.rectLine(tr.x - 1, tr.y - 1, tr.w + 2, tr.h + 2, 1, hex(UI.brass, 0.8));
    for (let i = 1; i < 10; i++) g.rect(tr.x + (tr.w * i) / 10, tr.y + tr.h + 3, 1, 4, hex(UI.brass, 0.5));
    const kx = tr.x + tr.w * f;
    // A wax bead on a brass rule (ART-0058).
    g.circle(kx + 1, tr.y + 5, 10, hex('#000000', 0.5));
    g.circleGrad(kx, tr.y + 3, 9, hex(k > 0.5 ? '#c02028' : '#8a1016'), hex('#3a0406'));
    g.circleGrad(kx - 3, tr.y, 3.5, hex('#ffb0a0', 0.55), hex('#ffb0a0', 0));
    if (n.value) g.text(n.value, r.x + r.w - 16, cy, { size: size * 0.85, color: valCol, align: 'right', shadow: light ? false : undefined });
  } else if (n.kind === 'toggle') {
    const sw = { x: r.x + r.w - 16 - 64, y: r.y + r.h / 2 - 12, w: 64, h: 24 };
    g.rectGrad(sw.x, sw.y, sw.w, sw.h, hex('#0a0604'), hex('#24140c'));
    g.rectLine(sw.x, sw.y, sw.w, sw.h, 1.5, hex(UI.brass));
    const on = !!n.on;
    if (on) g.rectGrad(sw.x + 2, sw.y + 2, sw.w / 2 - 2, sw.h - 4, hex('#a8741c', 0.9), hex('#6a4410', 0.9));
    const kx = on ? sw.x + sw.w - 16 : sw.x + 16;
    g.circleGrad(kx, sw.y + sw.h / 2 - 1, 10, hex(on ? UI.brassHi : '#8a8070'), hex(on ? UI.brassLo : '#3a3430'));
    // Shape redundancy: a check for on, a bar for off.
    if (on) g.polyline([{ x: kx - 4, y: sw.y + 12 }, { x: kx - 1, y: sw.y + 15 }, { x: kx + 5, y: sw.y + 8 }], 2, hex('#2a1a08'));
    else g.rect(kx - 4, sw.y + 11, 8, 2, hex('#1a1410'));
    if (n.value) g.text(n.value, sw.x - 12, cy, { size: size * 0.85, color: valCol, align: 'right', shadow: light ? false : undefined });
  } else if (n.kind === 'stepper' || n.kind === 'dropdown') {
    const ax0 = cx0 + 16;
    const ax1 = r.x + r.w - 20;
    const ac = hex(n.enabled ? UI.brass : '#5a5040', 0.6 + 0.4 * k);
    arrow(g, ax0, r.y + r.h / 2, -1, 12, ac);
    arrow(g, ax1, r.y + r.h / 2, 1, 12, ac);
    fitText(g, `${n.id}.value`, n.value ?? '', (ax0 + ax1) / 2, cy, ax1 - ax0 - 36, { size, color: valCol, align: 'center', shadow: light ? false : undefined });
  } else if (n.value) {
    fitText(g, `${n.id}.value`, n.value, r.x + r.w - 16, cy, cw, { size: size * 0.85, color: valCol, align: 'right', shadow: light ? false : undefined });
  }
}

/** Tab-bar tab (UIX-0006): engraved label on a brass-edged leather tab; the selected tab is lit and joined to the page. */
export function tab(g: Gfx, n: UiNode, s: NodeState, t: number, selected: boolean, size = 22): void {
  const r = n.rect;
  const k = s.glow;
  if (selected) {
    g.rectGrad(r.x, r.y, r.w, r.h, hex('#5a2418'), hex('#2a100a'));
    g.rect(r.x, r.y, r.w, 2, hex(UI.gilt));
    g.rect(r.x, r.y, 1.5, r.h, hex(UI.brass));
    g.rect(r.x + r.w - 1.5, r.y, 1.5, r.h, hex(UI.brass));
  } else {
    g.rectGrad(r.x + 2, r.y + 4, r.w - 4, r.h - 4, hex('#241410', 0.9), hex('#140a08', 0.9));
    g.rect(r.x + 2, r.y + r.h - 1, r.w - 4, 1, hex(UI.brass, 0.6));
    if (k > 0) g.rect(r.x + 6, r.y + 5, r.w - 12, 2, hex(UI.gilt, 0.6 * k));
  }
  const col = selected ? hex('#fff0c0') : mix(hex(palette().inkDim), hex(UI.gilt), k);
  fitText(g, n.id, n.label, r.x + r.w / 2, textY(r, size) + 1, r.w - 12, { size, color: col, color2: selected ? hex(UI.gilt) : undefined, align: 'center' });
  if (s.focus && k > 0.3 && !selected) focusRing(g, r, k * 0.6, t);
}

/** List item in a scroll list (chapter steps, operating theatre, backlog). */
export function listItem(g: Gfx, n: UiNode, s: NodeState, t: number, selected = false): void {
  const r = n.rect;
  const k = Math.max(s.glow, selected ? 0.6 : 0);
  if (k > 0) {
    hband(g, r.x, r.y, r.w, r.h, hex('#5a1418', 0.42 * k * candleFlicker(t)), 0.06);
    g.rect(r.x, r.y + 3, 3, r.h - 6, hex(UI.gilt, 0.9 * k));
  }
  hrule(g, r.x + 8, r.y + r.h, r.w - 16, hex(UI.brass, 0.25));
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
  g.rect(r.x + 3, r.y + 5, r.w, r.h, hex('#000000', 0.45 * alpha));
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#efe0b8', 0.97 * alpha), hex('#d2bb8c', 0.97 * alpha));
  g.rectLine(r.x, r.y, r.w, r.h, 1, hex('#6a4a22', 0.8 * alpha));
  let y = r.y + pad + 16;
  if (title) {
    g.text(title, r.x + pad, y, { size: 20, color: hex('#6a0a10', alpha), shadow: false });
    y += 26;
  }
  lines.forEach((l, i) => g.text(l, r.x + pad, y + i * size * 1.3, { size, color: hex(UI.inkDark, alpha), shadow: false }));
  return r;
}

/** Draw the UI's current tooltip (hover after the delay, or keyboard/gamepad focus). */
export function drawTooltip(g: Gfx, ui: Ui): void {
  const n = ui.tipNode();
  if (n?.tip) tooltip(g, n.rect, undefined, n.tip);
}
