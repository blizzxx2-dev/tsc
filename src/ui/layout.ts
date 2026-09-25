/** Virtual resolution: everything is laid out in these units and scaled to the window. */
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PALETTE = {
  ink: '#e8dcc0',
  inkDim: '#a89c80',
  parchment: '#d8c8a0',
  parchmentDark: '#9a8660',
  blood: '#8a1016',
  gold: '#f5d76e',
  curse: '#b060ff',
  panel: '#140f0c',
  panelEdge: '#5a4630',
  good: '#9fd3a8',
  bad: '#d98a5f',
} as const;

/**
 * The visible view in safe-area coordinates (ENG-0182/0184), updated by the
 * shell on resize: the safe area is [0, VIEW_W]×[0, VIEW_H]; `ox`/`oy` are the
 * extra margins the window's aspect ratio reveals on each side.
 */
export const VIEW = { w: VIEW_W, h: VIEW_H, ox: 0, oy: 0 };

/** Platform safe-area insets in virtual units (TV overscan, Deck bezel), applied inside the anchor rect. */
export const SAFE_INSETS = { l: 0, t: 0, r: 0, b: 0 };

export type AnchorPoint = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

/**
 * The rect HUD and menus anchor to: horizontally the 16:9 safe area (so
 * 21:9/32:9 keep the HUD near the eye line), vertically the full visible
 * height (so 16:10 and 4:3 put it on the real screen edges), minus insets.
 */
export function anchorRect(view = VIEW, inset = SAFE_INSETS): { x: number; y: number; w: number; h: number } {
  return { x: inset.l, y: -view.oy + inset.t, w: VIEW_W - inset.l - inset.r, h: view.h - inset.t - inset.b };
}

/** Safe-area coordinates of an anchor point plus an offset (ENG-0184). */
export function anchor(a: AnchorPoint, dx = 0, dy = 0, view = VIEW, inset = SAFE_INSETS): { x: number; y: number } {
  const r = anchorRect(view, inset);
  const fx = a.endsWith('left') ? 0 : a.endsWith('right') ? 1 : 0.5;
  const fy = a.startsWith('top') ? 0 : a.startsWith('bottom') ? 1 : 0.5;
  return { x: r.x + r.w * fx + dx, y: r.y + r.h * fy + dy };
}

/** Vertical shift that moves an element laid out against the 720-high safe area onto the anchor rect's top/bottom edge. */
export const anchorShift = (edge: 'top' | 'bottom', view = VIEW, inset = SAFE_INSETS): number => (edge === 'top' ? anchor('top', 0, 0, view, inset).y : anchor('bottom', 0, 0, view, inset).y - VIEW_H);

/** Full visible view in safe-area coordinates (for full-bleed fills and dims). */
export const viewRect = (view = VIEW): { x: number; y: number; w: number; h: number } => ({ x: -view.ox, y: -view.oy, w: view.w, h: view.h });
