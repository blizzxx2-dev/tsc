/**
 * Where the operation happens (ENG-0272, ENG-0274): the flesh pass's drape and table, the light
 * rig and the view overlays per venue.
 *
 * - hospice: linen over an oak table by candlelight (the default look).
 * - field: field triage — mud-spattered tent canvas over trampled earth, torch-lit with a cold
 *   moonlit fill, rain streaking the view and grime at its edges.
 * - forensic: the inquisition's slab — a grey sheet on stone under a cold lamp; the flesh is a
 *   corpse's (no pulse, waxy pallor, livor mortis pooled on the dependent side).
 */
import { hex } from './color';
import { candleFlicker } from './flicker';
import type { Gfx } from './gfx';

export type Venue = 'hospice' | 'field' | 'forensic';

/** Flesh-shader `u_venue` per venue. */
export const VENUE_ID: Record<Venue, number> = { hospice: 0, field: 1, forensic: 2 };

export interface RigLight {
  x: number;
  y: number;
  h: number;
  i: number;
  col: [number, number, number];
}

/**
 * The light rig for a venue around the field (centre cx, cy; radii rx, ry), in world px. `key` is
 * the moving overhead lamp the hospice rig already uses.
 */
export function venueLights(venue: Venue, key: { x: number; y: number }, f: { cx: number; cy: number; rx: number; ry: number }, t: number, flicker: number): RigLight[] {
  if (venue === 'field') {
    // A torch held low at the left (strong, guttering), a lantern on a pole at the right, moonlight above.
    return [
      { x: f.cx - f.rx - 40, y: f.cy - 40, h: 0.55, i: 1.25 * candleFlicker(t, 5, Math.max(flicker, 0.6)), col: [1.0, 0.55, 0.22] },
      { x: f.cx + f.rx + 80, y: f.cy - f.ry, h: 0.5, i: 0.5 * candleFlicker(t, 7, flicker), col: [1.0, 0.7, 0.35] },
      { x: f.cx + 120, y: f.cy - f.ry - 300, h: 1.4, i: 0.35, col: [0.55, 0.65, 0.95] },
    ];
  }
  if (venue === 'forensic') {
    // One cold lamp over the slab, a grey window fill; nothing warm in the room.
    return [
      { x: f.cx - 60, y: f.cy - f.ry - 120, h: 1.2, i: 1.2, col: [0.86, 0.92, 1.0] },
      { x: f.cx + f.rx + 200, y: f.cy, h: 0.6, i: 0.35, col: [0.7, 0.75, 0.82] },
    ];
  }
  return [
    { x: key.x, y: key.y, h: 1.1, i: 1.1, col: [0.95, 0.9, 0.82] },
    { x: f.cx - f.rx - 60, y: f.cy + 120, h: 0.35, i: 0.45 * candleFlicker(t, 0, flicker), col: [1.0, 0.6, 0.3] },
    { x: f.cx + f.rx + 60, y: f.cy - 60, h: 0.35, i: 0.4 * candleFlicker(t, 2, flicker), col: [1.0, 0.62, 0.32] },
  ];
}

/** Rain streak count on the view at full intensity. */
export const RAIN_STREAKS = 90;

/** One streak's segment at time `t` (view px): fixed per index, falling on a slant and wrapping. */
export function rainStreak(i: number, t: number, w: number, h: number): { x0: number; y0: number; x1: number; y1: number; a: number } {
  const hx = ((i * 7919) % 1000) / 1000;
  const hy = ((i * 104729) % 1000) / 1000;
  const speed = 900 + ((i * 31) % 7) * 90;
  const len = 26 + ((i * 13) % 5) * 8;
  const y = (((hy * (h + 200) + t * speed) % (h + 200)) + (h + 200)) % (h + 200) - 100;
  const x = hx * (w + 200) - 100 + (y + 100) * 0.18;
  return { x0: x, y0: y, x1: x - len * 0.18, y1: y - len, a: 0.1 + ((i * 17) % 5) * 0.03 };
}

/** Rain streaks on the view (screen space). Reduce-motion freezes them into a faint still veil. */
export function drawRain(g: Gfx, t: number, k: number, w: number, h: number, reduceMotion: boolean): void {
  if (k <= 0) return;
  const n = Math.round(RAIN_STREAKS * k);
  const time = reduceMotion ? 0 : t;
  for (let i = 0; i < n; i++) {
    const s = rainStreak(i, time, w, h);
    g.line({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, 1.2, hex('#c8d4e8', s.a * (reduceMotion ? 0.5 : 1)));
  }
}

/** Grime at the view's edges: mud smears and soot in the corners (fixed per seed). */
export function drawGrime(g: Gfx, w: number, h: number, seed = 1): void {
  for (let i = 0; i < 14; i++) {
    const a = ((i * 2.399 + seed) % (Math.PI * 2)) - Math.PI;
    const edge = { x: w / 2 + Math.cos(a) * w * 0.56, y: h / 2 + Math.sin(a) * h * 0.58 };
    const r = 110 + ((i * 37 + seed * 11) % 90);
    g.circleGrad(edge.x, edge.y, r, hex(i % 3 === 0 ? '#1a120a' : '#3a2a18', 0.32), hex('#3a2a18', 0));
  }
}
