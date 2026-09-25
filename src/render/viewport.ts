/**
 * Aspect policy (ENG-0182/0183): the 1280×720 safe area is always fully
 * visible and as large as possible; any extra window width (21:9, 32:9) or
 * height (16:10, 4:3) shows more of the world instead of letterbox bars.
 */
export interface View {
  /** Visible size in virtual units. */
  w: number;
  h: number;
  /** Margin left of / above the safe area, virtual units. */
  ox: number;
  oy: number;
  /** CSS pixels per virtual unit. */
  scale: number;
}

/** Aspect ratios beyond these still extend, but no further (ultra-tall portrait windows, 48:9 triple monitors). */
export const MAX_ASPECT = 32 / 9;
export const MIN_ASPECT = 4 / 3;

/** Range of the `uiScale` setting the view honours (UIX-0015 / ENG-0188). */
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.5;

/**
 * @param uiScale UI scale (UIX-0015 / ENG-0188): the view is fitted at `uiScale` times the base
 * scale, so HUD and menus grow while the anchors keep them on the real screen edges — or shrink,
 * revealing more of the world around the safe area. The effective scale is clamped so the whole
 * 1280×720 safe area always fits: it never crops the HUD, and the canvas box is unchanged (the
 * aspect policy still letterboxes beyond 32:9 / 4:3). Above 100 % only takes effect where the window
 * has more room than the safe area needs, which the base policy already uses up on ordinary
 * displays; see `effectiveUiScale`.
 */
export function computeView(winW: number, winH: number, safeW = 1280, safeH = 720, uiScale = 1): View {
  winW = Math.max(1, winW);
  winH = Math.max(1, winH);
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, winW / winH));
  // Fit the (clamped-aspect) view into the window, then derive its virtual size.
  let w: number;
  let h: number;
  if (aspect >= safeW / safeH) {
    h = safeH;
    w = safeH * aspect;
  } else {
    w = safeW;
    h = safeW / aspect;
  }
  const base = Math.min(winW / w, winH / h);
  const ui = Number.isFinite(uiScale) ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, uiScale)) : 1;
  // The safe area must stay fully visible: the scale never exceeds the one at which it exactly fits.
  const fit = Math.min(winW / safeW, winH / safeH);
  const scale = Math.min(fit, base * ui);
  // The canvas box (w·base × h·base CSS px) is unchanged; a smaller scale shows more virtual units in it.
  const vw = (w * base) / scale;
  const vh = (h * base) / scale;
  return { w: vw, h: vh, ox: (vw - safeW) / 2, oy: (vh - safeH) / 2, scale };
}

/** The UI scale actually in force for a window (the setting after the fits-on-screen clamp). */
export function effectiveUiScale(winW: number, winH: number, uiScale: number, safeW = 1280, safeH = 720): number {
  const base = computeView(winW, winH, safeW, safeH, 1).scale;
  return computeView(winW, winH, safeW, safeH, uiScale).scale / base;
}

/**
 * Convert a safe-area virtual rect to a GL scissor rect (device pixels,
 * bottom-left origin) for a target of `tw`×`th` pixels showing view `v`
 * (ENG-0027). Correct under letterboxing, DPR and render scale.
 */
export function scissorRect(r: { x: number; y: number; w: number; h: number }, v: { w: number; h: number; ox: number; oy: number }, tw: number, th: number): { x: number; y: number; w: number; h: number } {
  const sx = tw / v.w;
  const sy = th / v.h;
  const x0 = Math.floor((r.x + v.ox) * sx);
  const x1 = Math.ceil((r.x + r.w + v.ox) * sx);
  const yTop = Math.floor((r.y + v.oy) * sy);
  const yBot = Math.ceil((r.y + r.h + v.oy) * sy);
  const x = Math.max(0, x0);
  const w = Math.max(0, Math.min(tw, x1) - x);
  const y = Math.max(0, th - yBot);
  const h = Math.max(0, Math.min(th, th - yTop) - y);
  return { x, y, w, h };
}
