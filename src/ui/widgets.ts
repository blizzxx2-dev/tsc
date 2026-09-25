import { cursorColour } from './hudPrefs';
import { nineSlice } from './nineSlice';
import { settings } from '../core/settings';
import type { Input } from '../core/input';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { ToolId } from '../surgery/types';
import { PALETTE } from './layout';
import { leatherPanel, parchmentSheet, UI } from './ornaments';
import { uiButton } from '../audio/ui-hooks';
import { crosshairArt, toolArt, type ToolState } from '../art/kit';

const TAU = Math.PI * 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inRect = (p: Vec, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** A tooled leather panel with brass edging (see ui/ornaments). */
export function panel(g: Gfx, r: Rect, alpha = 0.96): void {
  if (!nineSlice(g, 'ui/panel-oak', r, { alpha })) leatherPanel(g, r, { alpha });
}

/** An aged parchment sheet. */
export function parchment(g: Gfx, r: Rect): void {
  if (!nineSlice(g, 'ui/parchment-frame', r)) parchmentSheet(g, r, r.x + r.y);
}

let surface: 'dark' | 'parchment' = 'dark';

/** Set the surface the following buttons sit on (parchment switches them to dark ink). */
export function buttonSurface(on: 'dark' | 'parchment'): void {
  surface = on;
}

/** A rubbed smear of wax behind a hovered choice: irregular, a little glossy. */
function waxRub(g: Gfx, r: Rect, pressed: boolean, onLight: boolean): void {
  const n = Math.max(4, Math.round(r.w / 18));
  const base = onLight ? (pressed ? '#6a0a10' : '#8a1016') : pressed ? '#3a0608' : '#5a1418';
  const a = onLight ? (pressed ? 0.3 : 0.2) : pressed ? 0.75 : 0.55;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const wob = Math.sin(i * 2.7 + r.x) * 0.25;
    g.circleGrad(r.x + 8 + k * (r.w - 16), r.y + r.h * (0.5 + wob * 0.2), r.h * (0.62 + 0.12 * Math.sin(i * 1.3)), hex(base, a), hex(base, 0));
  }
  g.line({ x: r.x + 14, y: r.y + r.h * 0.22 }, { x: r.x + r.w - 20, y: r.y + r.h * 0.18 }, 1, hex('#ffb0a0', onLight ? 0.12 : 0.18));
}

/**
 * Menu-style text button with three states: idle, hover (a wax rub; darker while pressed)
 * and disabled (faded). Returns true when clicked this frame. `onLight` (or a parchment
 * `buttonSurface`) switches to dark ink.
 */
export function button(g: Gfx, input: Input, label: string, x: number, y: number, size = 30, enabled = true, onLight = surface === 'parchment'): boolean {
  const w = g.measure(label, size, 'body') + 56;
  const r = { x: x - w / 2, y: y - size * 0.95, w, h: size * 1.35 };
  const hover = enabled && inRect(input.pos, r);
  const pressed = hover && input.down;
  const dy = pressed ? 1.5 : 0;
  if (hover) {
    waxRub(g, r, pressed, onLight);
    if (!onLight) {
      g.line({ x: r.x + 10, y: r.y }, { x: r.x + r.w - 10, y: r.y }, 1, hex(UI.brass, 0.8));
      g.line({ x: r.x + 10, y: r.y + r.h }, { x: r.x + r.w - 10, y: r.y + r.h }, 1, hex(UI.brass, 0.8));
      g.glow(x, y - size * 0.3, w * 0.45, hex('#ffb050', 0.08));
    }
    const dc = hex(onLight ? '#8a1016' : UI.gilt);
    for (const dx of [r.x + 12, r.x + r.w - 12]) g.poly([{ x: dx, y: y - size * 0.55 }, { x: dx + 5, y: y - size * 0.3 }, { x: dx, y: y - size * 0.05 }, { x: dx - 5, y: y - size * 0.3 }], dc);
  }
  if (onLight) g.text(label, x, y + dy, { size, color: hex(!enabled ? '#8a7a60' : hover ? '#6a0a10' : '#2a1a10', enabled ? 1 : 0.6), align: 'center', shadow: false });
  else if (!enabled) g.text(label, x, y, { size, color: hex('#5a5040', 0.8), align: 'center' });
  else if (hover) g.text(label, x, y + dy, { size, color: hex('#fff0c0'), color2: hex(UI.gilt), align: 'center' });
  else g.text(label, x, y, { size, color: hex(PALETTE.ink), color2: hex('#b8a888'), align: 'center' });
  uiButton(label, hover, hover && input.pressed);
  return hover && input.pressed;
}

/**
 * Brass-engraved instrument icon (UI_ART_FS), centred on (x, y). `s` = 1 draws it about
 * 50 px across; `state` gives the tray states (idle, selected gilt rim, disabled tarnish,
 * cooldown shutter with `cooldown` 0..1).
 */
export function toolIcon(g: Gfx, tool: ToolId, x: number, y: number, s = 1, _t = 0, state: ToolState = 'idle', cooldown = 0): void {
  toolArt(g, tool, x, y, 50 * s, state, cooldown);
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

/**
 * The pointer. Menus get a quill (nib at the hotspot); in the operating field pass a tint
 * for a brass crosshair (e.g. green over a valid target, red over an invalid one).
 */
export function reticle(g: Gfx, p: Vec, tint?: string): void {
  // Cursor visibility (UIX-0056): size and colour settings, and a dark outline behind the crosshair.
  const size = settings.cursorSize;
  if (tint) {
    crosshairArt(g, p, '#000000', 34 * size);
    crosshairArt(g, p, cursorColour(tint, settings.cursorColor), 30 * size);
    return;
  }
  // Quill: the nib tip sits exactly on the pointer.
  g.save();
  g.translate(p.x, p.y);
  g.rotate(-0.55);
  g.scale(size, size);
  g.poly([{ x: 0, y: 0 }, { x: -2.6, y: 9 }, { x: 0, y: 13 }, { x: 2.6, y: 9 }], hex('#000000', 0.35));
  g.poly([{ x: 0, y: -0.5 }, { x: -2.4, y: 8.5 }, { x: 0, y: 12 }, { x: 2.4, y: 8.5 }], hex(UI.brassHi), hex(UI.brassLo));
  g.line({ x: 0, y: 1.5 }, { x: 0, y: 7.5 }, 0.8, hex('#1a0e04', 0.9));
  g.quadCurve({ x: 0, y: 11 }, { x: 8, y: 22 }, { x: 3, y: 36 }, 5, hex('#e8dcc0', 0.95));
  g.quadCurve({ x: 0, y: 11 }, { x: 5, y: 22 }, { x: 2, y: 35 }, 1, hex('#8a7a60', 0.9));
  g.restore();
}

/**
 * A slider drawn as an engraved brass rule with a wax bead. Drag anywhere on the rule to
 * set it; returns the (possibly changed) value.
 */
export function brassSlider(g: Gfx, input: Input, x: number, y: number, w: number, value: number, min = 0, max = 1): number {
  const hit = { x: x - 10, y: y - 12, w: w + 20, h: 24 };
  let v = value;
  if (input.down && inRect(input.pos, hit)) v = min + Math.max(0, Math.min(1, (input.pos.x - x) / w)) * (max - min);
  const k = (v - min) / (max - min || 1);
  g.rect(x, y - 2, w, 5, hex('#000000', 0.45));
  g.rectGrad(x, y - 3, w, 5, hex(UI.brassHi), hex(UI.brassLo));
  for (let i = 0; i <= 10; i++) g.rect(x + (w * i) / 10 - 0.5, y + 3, 1, i % 5 ? 3 : 6, hex(UI.brassLo, 0.9));
  const bx = x + w * k;
  g.circle(bx + 1.5, y + 2.5, 8, hex('#000000', 0.45));
  g.circleGrad(bx, y, 8, hex('#c8303a'), hex('#5a0810'));
  g.circle(bx - 2.5, y - 2.5, 2.2, hex('#ffb0a0', 0.45));
  return v;
}
