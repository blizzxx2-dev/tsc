import type { Input } from '../core/input';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { ToolId } from '../surgery/types';
import { PALETTE } from './layout';

const TAU = Math.PI * 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inRect = (p: Vec, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** A dark wooden panel with a brass edge. */
export function panel(g: Gfx, r: Rect, alpha = 0.92): void {
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#1e1611', alpha), hex('#0e0a08', alpha));
  g.rectLine(r.x, r.y, r.w, r.h, 2, hex(PALETTE.panelEdge, alpha));
  g.rectLine(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 1, hex('#3a2c1e', alpha * 0.8));
}

/** An aged parchment sheet. */
export function parchment(g: Gfx, r: Rect): void {
  g.rect(r.x + 6, r.y + 8, r.w, r.h, hex('#000000', 0.45));
  g.rectGrad(r.x, r.y, r.w, r.h, hex('#e2d3ab'), hex('#c4ae80'));
  // Foxing and burnt edges.
  for (let i = 0; i < 14; i++) {
    const fx = r.x + ((i * 97.3) % r.w);
    const fy = r.y + ((i * 53.9) % r.h);
    g.circleGrad(fx, fy, 18 + (i % 4) * 8, hex('#8a6a3a', 0.12), hex('#8a6a3a', 0));
  }
  g.rectLine(r.x, r.y, r.w, r.h, 3, hex('#6a4e2a', 0.8));
}

/** Menu-style text button. Returns true when clicked this frame. `onLight` switches to dark ink for parchment. */
export function button(g: Gfx, input: Input, label: string, x: number, y: number, size = 30, enabled = true, onLight = false): boolean {
  const w = g.measure(label, size, 'body') + 40;
  const r = { x: x - w / 2, y: y - size * 0.9, w, h: size * 1.3 };
  const hover = enabled && inRect(input.pos, r);
  if (hover) {
    g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.35));
    g.text('•', r.x + 8, y, { size, color: hex(PALETTE.gold), align: 'left' });
  }
  const color = onLight ? (hover ? '#8a1016' : '#2a1a10') : enabled ? (hover ? PALETTE.gold : PALETTE.ink) : '#5a5040';
  g.text(label, x, y, { size, color: hex(color), align: 'center', shadow: onLight ? false : undefined });
  return hover && input.pressed;
}

/** Procedural icons for each instrument, drawn centred on (x, y) at the given scale. */
export function toolIcon(g: Gfx, tool: ToolId, x: number, y: number, s = 1, t = 0): void {
  g.save();
  g.translate(x, y);
  g.scale(s);
  const steel = hex('#c8ccd2');
  const wood = hex('#6a4a2a');
  switch (tool) {
    case 'lancet':
      g.rotate(-0.8);
      g.rect(-3, 4, 6, 20, wood);
      g.tri(-4, 4, 4, 4, 0, -22, steel);
      g.line({ x: 0, y: 2 }, { x: 0, y: -18 }, 1, hex('#ffffff', 0.6));
      break;
    case 'tongs':
      g.rotate(-0.6);
      g.line({ x: -3, y: 20 }, { x: -6, y: -20 }, 3, steel);
      g.line({ x: 3, y: 20 }, { x: 6, y: -20 }, 3, steel);
      g.circle(0, 20, 4, steel);
      break;
    case 'leech':
      g.line({ x: -14, y: 14 }, { x: 10, y: -10 }, 5, hex('#9aa0a0'));
      g.circleGrad(12, -12, 10, hex('#5a1a20'), hex('#2a0a10'));
      g.circle(-15, 15, 3, hex('#3a2a20'));
      break;
    case 'thread':
      g.arc(0, 4, 13, 2.5, steel, 0.5, Math.PI);
      g.quadCurve({ x: 13, y: 4 }, { x: 20, y: -18 }, { x: -6, y: -16 }, 1.5, hex('#e8dcb0'));
      break;
    case 'salve':
      g.rect(-13, -4, 26, 20, hex('#8a6a3a'));
      g.rect(-15, -10, 30, 7, hex('#4a3420'));
      g.circleGrad(0, 6, 8, hex('#a8e0b0', 0.9), hex('#a8e0b0', 0));
      break;
    case 'tincture':
      g.rotate(0.7);
      g.rect(-5, -16, 10, 26, hex('#9ad0e0', 0.7));
      g.rect(-5, -4, 10, 14, hex('#6ae08a', 0.8));
      g.line({ x: 0, y: 10 }, { x: 0, y: 22 }, 1.5, steel);
      g.rect(-8, -20, 16, 4, steel);
      break;
    case 'brand': {
      g.rotate(-0.8);
      g.rect(-3, 0, 6, 22, wood);
      g.rect(-2, -16, 4, 16, hex('#555a60'));
      const heat = 0.7 + 0.3 * Math.sin(t * 8);
      g.glow(0, -18, 14, hex('#ff7020', 0.6 * heat));
      g.circle(0, -18, 4, hex('#ffb040', heat));
      break;
    }
    case 'lens':
      g.line({ x: 8, y: 8 }, { x: 20, y: 20 }, 5, wood);
      g.circleGrad(-2, -2, 13, hex('#b9d7ff', 0.25), hex('#b9d7ff', 0.5));
      g.arc(-2, -2, 13, 3, hex('#c8a040'));
      break;
  }
  g.restore();
}

/** A simple five-pointed star, used for the Litany indicator. */
export function star(g: Gfx, x: number, y: number, r: number, c: number): void {
  const pts: Vec[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 10;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.poly(pts, c);
}

/** The mouse pointer: a small brass reticle. */
export function reticle(g: Gfx, p: Vec): void {
  g.arc(p.x, p.y, 6, 1.5, hex(PALETTE.gold, 0.9));
  g.circle(p.x, p.y, 1.5, hex(PALETTE.gold));
}
