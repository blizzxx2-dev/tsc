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

export function computeView(winW: number, winH: number, safeW = 1280, safeH = 720): View {
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
  const scale = Math.min(winW / w, winH / h);
  return { w, h, ox: (w - safeW) / 2, oy: (h - safeH) / 2, scale };
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
