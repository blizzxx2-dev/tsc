/**
 * Cursor art (ART-0271, ART-0273): the menu quill and busy hourglass as software cursors, the
 * gamepad virtual-cursor ring (1.5× size), and the hardware-cursor fallback. The fallback PNGs at
 * 32² and 64² are rasterised from `cursorSvg()` by `npx vite-node scripts/art/make-cursors.ts` into
 * `public/cursors/`, and `applyHardwareCursor()` points the canvas's CSS cursor at them when the
 * "Hardware cursor" option is on (the software cursor then isn't drawn).
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import { sandGlassArt } from './kit';

export type CursorKind = 'quill' | 'busy' | 'crosshair';
export const CURSOR_KINDS: readonly CursorKind[] = ['quill', 'busy', 'crosshair'];
export const CURSOR_SIZES = [32, 64] as const;

/** Hotspot of each cursor in the 32 px design grid (scaled ×2 for the 64 px file). */
export const CURSOR_HOTSPOT: Record<CursorKind, [number, number]> = { quill: [2, 2], busy: [16, 16], crosshair: [16, 16] };

/** The cursor as SVG, drawn on a 32-unit grid and scaled to `size` px. */
export function cursorSvg(kind: CursorKind, size: number): string {
  const body =
    kind === 'quill'
      ? // Nib at (2,2); the feather sweeps down-right.
        `<path d="M2 2 L8.5 5.2 L6.8 6.8 L5.2 8.5 Z" fill="${SWATCHES.brass}" stroke="${SWATCHES.soot}" stroke-width="1.1" stroke-linejoin="round"/>
         <path d="M3.2 3.2 L6.2 6.2" stroke="${SWATCHES.soot}" stroke-width=".7"/>
         <path d="M6.6 6.6 C15 6 25 14 29 29 C16 25 7 16 6.6 6.6 Z" fill="${SWATCHES.linen}" stroke="${SWATCHES.soot}" stroke-width="1.1"/>
         <path d="M6.6 6.6 C13 13 20 20 28 28" stroke="${SWATCHES.foxing}" stroke-width=".8" fill="none"/>`
      : kind === 'busy'
        ? `<path d="M9 4 H23 V6 C23 11 18 13.5 17 16 C18 18.5 23 21 23 26 V28 H9 V26 C9 21 14 18.5 15 16 C14 13.5 9 11 9 6 Z" fill="${SWATCHES.tallow}" fill-opacity=".35" stroke="${SWATCHES.soot}" stroke-width="1.4"/>
           <path d="M11.5 8 H20.5 C20 10.5 17.5 12.5 16 14.5 C14.5 12.5 12 10.5 11.5 8 Z" fill="${SWATCHES.ember}"/>
           <path d="M16 17 L16 23 M11 26 C12 23.5 20 23.5 21 26 Z" stroke="${SWATCHES.ember}" stroke-width="1.2" fill="${SWATCHES.ember}"/>
           <rect x="7" y="2.5" width="18" height="2.5" rx="1" fill="${SWATCHES.brass}" stroke="${SWATCHES.soot}" stroke-width=".8"/>
           <rect x="7" y="27" width="18" height="2.5" rx="1" fill="${SWATCHES.brass}" stroke="${SWATCHES.soot}" stroke-width=".8"/>`
        : `<circle cx="16" cy="16" r="9" fill="none" stroke="${SWATCHES.soot}" stroke-width="3.2"/>
           <circle cx="16" cy="16" r="9" fill="none" stroke="${SWATCHES.gilt}" stroke-width="1.6"/>
           <path d="M16 2 V10 M16 22 V30 M2 16 H10 M22 16 H30" stroke="${SWATCHES.soot}" stroke-width="3.2"/>
           <path d="M16 2.8 V10 M16 22 V29.2 M2.8 16 H10 M22 16 H29.2" stroke="${SWATCHES.gilt}" stroke-width="1.6"/>
           <circle cx="16" cy="16" r="1.4" fill="${SWATCHES.gilt}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${body}</svg>`;
}

/** Path of the fallback PNG as served (public/cursors/<kind>-<size>.png). */
export const cursorFile = (kind: CursorKind, size: number): string => `cursors/${kind}-${size}.png`;

/** The CSS `cursor` value for a kind: the 64 px file on HiDPI screens, else 32 px, with its hotspot. */
export function cursorCss(kind: CursorKind, dpr: number): string {
  const size = dpr >= 1.5 ? 64 : 32;
  const k = size / 32;
  const [hx, hy] = CURSOR_HOTSPOT[kind];
  return `url(${cursorFile(kind, size)}) ${hx * k} ${hy * k}, ${kind === 'busy' ? 'progress' : kind === 'crosshair' ? 'crosshair' : 'default'}`;
}

let applied: string | null = null;

/** Show the OS cursor with the fallback art (or hide it again with `null`). Cheap to call every frame. */
export function applyHardwareCursor(kind: CursorKind | null): void {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const css = kind ? cursorCss(kind, window.devicePixelRatio || 1) : 'none';
  if (css === applied) return;
  applied = css;
  canvas.style.cursor = css;
}

/** The busy cursor (ART-0271): a small brass hourglass whose sand runs on a 2.5 s loop. */
export function busyCursor(g: Gfx, p: Vec, t: number, size = 1): void {
  g.circleGrad(p.x, p.y, 20 * size, hex('#000000', 0.35), hex('#000000', 0));
  sandGlassArt(g, p.x, p.y, 30 * size, (t / 2.5) % 1);
}

/**
 * The gamepad/Steam Deck virtual cursor (ART-0273): the pointer is drawn 1.5× larger inside a
 * wide brass ring with four ticks, so it reads from the sofa and on the Deck's 7" screen.
 */
export const PAD_CURSOR_SCALE = 1.5;
export function padCursorRing(g: Gfx, p: Vec, t: number, size = 1): void {
  const r = 22 * PAD_CURSOR_SCALE * size;
  g.arc(p.x, p.y, r, 5, hex('#000000', 0.5));
  g.arc(p.x, p.y, r, 2.4, hex(SWATCHES.gilt, 0.9));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t * 0.6;
    g.line({ x: p.x + Math.cos(a) * (r - 5), y: p.y + Math.sin(a) * (r - 5) }, { x: p.x + Math.cos(a) * (r + 5), y: p.y + Math.sin(a) * (r + 5) }, 2.5, hex(SWATCHES.brassHi, 0.9));
  }
}
