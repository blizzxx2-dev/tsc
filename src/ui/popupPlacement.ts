/**
 * Rating popups never print over the HUD (GAM-0144). A popup's box — the rating stamp, its label
 * above and the chain "×N" below — is nudged the shortest way off every HUD plate it would touch,
 * staying inside the visible view. Everything is in the 1280×720 virtual layout, so the same
 * placement holds at every resolution (1280×720, 3840×2160…).
 */
import { anchorShift, VIEW, VIEW_W, viewRect } from './layout';
import { trayFrame, type TraySide } from '../input/hud';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The HUD plates of the operation screen, laid out against the 720-high safe area (drawHud uses these). */
export const HUD_VITALS: Box = { x: 16, y: 14, w: 316, h: 86 };
export const HUD_TIMER: Box = { x: VIEW_W / 2 - 130, y: 14, w: 260, h: 70 };
export const HUD_SCORE: Box = { x: VIEW_W - 16 - 250, y: 14, w: 250, h: 70 };
/** The chain counter under the score plate. */
export const HUD_COMBO: Box = { x: HUD_SCORE.x + HUD_SCORE.w - 128, y: HUD_SCORE.y + HUD_SCORE.h + 10, w: 128, h: 34 };
/** The Litany reliquary (bottom corner opposite the tray's mirror) and the callout plate at its smallest. */
const LITANY_Y = 664;
const CALLOUT: Box = { x: VIEW_W / 2 - 400, y: 704 - 78, w: 800, h: 78 };

/** How far a rating popup reaches around its anchor: label above, stamp, chain line below. */
export const POPUP_REACH = { left: 64, right: 64, up: 62, down: 30 } as const;
const GAP = 4;

export function popupBox(x: number, y: number): Box {
  return { x: x - POPUP_REACH.left, y: y - POPUP_REACH.up, w: POPUP_REACH.left + POPUP_REACH.right, h: POPUP_REACH.up + POPUP_REACH.down };
}

export const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export interface HudOpts {
  tools: number;
  traySide: TraySide;
  litany: boolean;
  /** A callout plate is showing. */
  callout: boolean;
  /** Extra plates (the boss bar, the pause button). */
  extra?: readonly Box[];
  view?: typeof VIEW;
}

/** Every HUD plate on the operation screen, in safe-area coordinates. */
export function operationHud(o: HudOpts): Box[] {
  const view = o.view ?? VIEW;
  const top = anchorShift('top', view);
  const bottom = anchorShift('bottom', view);
  const down = (b: Box, dy: number): Box => ({ ...b, y: b.y + dy });
  const out = [down(HUD_VITALS, top), down(HUD_TIMER, top), down(HUD_SCORE, top), down(HUD_COMBO, top), trayFrame(o.tools, o.traySide)];
  if (o.litany) {
    const lx = o.traySide === 'left' ? VIEW_W - 60 : 60;
    out.push({ x: lx - 40, y: LITANY_Y + bottom - 40, w: 80, h: 80 });
  }
  if (o.callout) out.push(down(CALLOUT, bottom));
  return [...out, ...(o.extra ?? [])];
}

/**
 * Where to draw a popup anchored at (x, y) so its box clears every HUD plate: repeatedly take the
 * smallest move (down, up, left or right) off the first plate it touches that keeps it on screen.
 */
export function clearOfHud(x: number, y: number, hud: readonly Box[], bounds: Box = viewRect()): { x: number; y: number } {
  const fits = (px: number, py: number) => {
    const b = popupBox(px, py);
    return b.x >= bounds.x && b.y >= bounds.y && b.x + b.w <= bounds.x + bounds.w && b.y + b.h <= bounds.y + bounds.h;
  };
  let p = { x, y };
  for (let guard = 0; guard < 12; guard++) {
    const box = popupBox(p.x, p.y);
    const hit = hud.find((r) => overlaps(box, r));
    if (!hit) return p;
    const moves = [
      { x: p.x, y: hit.y + hit.h + GAP + POPUP_REACH.up },
      { x: p.x, y: hit.y - GAP - POPUP_REACH.down },
      { x: hit.x - GAP - POPUP_REACH.right, y: p.y },
      { x: hit.x + hit.w + GAP + POPUP_REACH.left, y: p.y },
    ].filter((m) => fits(m.x, m.y));
    if (!moves.length) return p;
    moves.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    // Prefer a move that clears every plate at once; else the shortest, and look again.
    p = moves.find((m) => !hud.some((r) => overlaps(popupBox(m.x, m.y), r))) ?? moves[0];
  }
  return p;
}
