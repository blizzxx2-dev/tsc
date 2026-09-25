/**
 * Title screen animated layers (ART-0305): a slow parallax drift of the key-art set, drifting ash,
 * and two candles in the foreground whose flicker lights the lower corners. Everything loops every
 * 10 s (`TITLE_LOOP`), so a capture of any 10 s window is seamless.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';

export const TITLE_LOOP = 10;
const TAU = Math.PI * 2;

/** The parallax "pointer" for the key art: a slow figure-eight over the loop, blended with the real pointer. */
export function titleParallax(t: number, w: number, h: number, pointer?: Vec): Vec {
  const k = (t % TITLE_LOOP) / TITLE_LOOP;
  const drift = { x: w / 2 + Math.sin(k * TAU) * w * 0.2, y: h / 2 + Math.sin(k * TAU * 2) * h * 0.12 };
  return pointer ? { x: (drift.x + pointer.x) / 2, y: (drift.y + pointer.y) / 2 } : drift;
}

/** Candle flicker on a 10 s loop: summed sines with whole-number cycles per loop, so it wraps seamlessly. */
export function candleFlicker(t: number, seed: number): number {
  const k = ((t % TITLE_LOOP) / TITLE_LOOP) * TAU;
  return 0.82 + 0.08 * Math.sin(k * 23 + seed) + 0.06 * Math.sin(k * 37 + seed * 2.3) + 0.04 * Math.sin(k * 61 + seed * 0.7);
}

/** Ash flakes: each crosses the view once per loop (or twice), falling and swaying. */
function ash(g: Gfx, v: { x: number; y: number; w: number; h: number }, t: number): void {
  const k = (t % TITLE_LOOP) / TITLE_LOOP;
  for (let i = 0; i < 46; i++) {
    const laps = 1 + (i % 2);
    const u = (k * laps + i * 0.137) % 1;
    const x = v.x + ((i * 0.618) % 1) * v.w + Math.sin(u * TAU * 2 + i) * 30 + u * 60;
    const y = v.y - 20 + u * (v.h + 40);
    const s = 1 + (i % 4) * 0.6;
    const a = 0.25 + 0.3 * Math.sin(u * Math.PI);
    const tumble = Math.cos(u * TAU * 3 + i);
    g.ellipse(x, y, s * 1.4, s * Math.max(0.3, Math.abs(tumble)), u * 6 + i, hex(i % 5 ? SWATCHES.ash : SWATCHES.ember, a));
  }
}

function candle(g: Gfx, x: number, y: number, t: number, seed: number): void {
  const f = candleFlicker(t, seed);
  g.setBlend('add');
  g.circleGrad(x, y - 30, 260 * f, hex('#ff9a40', 0.14 * f), hex('#ff9a40', 0));
  g.circleGrad(x, y - 30, 60 * f, hex('#ffd080', 0.35 * f), hex('#ffd080', 0));
  g.setBlend('alpha');
  // Tallow stick with a wax run, then the flame.
  g.rectGrad(x - 11, y, 22, 140, hex(SWATCHES.tallow), hex(SWATCHES.vellumLo));
  g.ellipse(x - 8, y + 18, 3, 12, 0, hex(SWATCHES.tallowHi, 0.9));
  g.line({ x, y }, { x, y: y - 8 }, 1.5, hex(SWATCHES.soot));
  const sway = Math.sin(((t % TITLE_LOOP) / TITLE_LOOP) * TAU * 7 + seed) * 2;
  g.ellipse(x + sway * 0.5, y - 16, 5, 13 * f, sway * 0.03, hex('#fff4d0', 0.95), hex('#ff9030', 0.5));
  g.ellipse(x + sway * 0.3, y - 12, 2.5, 5, 0, hex('#8ab0ff', 0.35));
}

/** Draw the foreground layers over the title backdrop (screen space, after `endWorld`). */
export function titleLayers(g: Gfx, v: { x: number; y: number; w: number; h: number }, t: number): void {
  ash(g, v, t);
  candle(g, v.x + 70, v.y + v.h - 120, t, 1.3);
  candle(g, v.x + v.w - 80, v.y + v.h - 105, t, 4.1);
}
