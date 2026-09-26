/**
 * Book-of-Hours card template (ART-0227): the frame every Malison's card and boss-intro splash is
 * built on — an illuminated miniature under a round arch, blue-and-gilt spandrels, a gilt and
 * rubric double rule, the Hour's name in the display (title) face and a clock-face marginal
 * border: a 24-hour dial run round the page's margin, numbered every three hours, so the eight
 * canonical Hours fall exactly on the eight numerals and the card's own Hour is marked in red.
 *
 * Callers pass localised strings and, optionally, their own miniature painter; without one the
 * template paints the Hour's sky with its sun or moon at the Hour's place in the day.
 */
import type { Gfx } from '../render/gfx';
import { hex, rgba } from '../render/color';
import type { Hour } from './curse';
import { parchmentArt } from './kit';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The clock hour (0–23) each canonical Hour keeps. */
export const HOUR_OF_DAY: Record<Hour, number> = { matins: 0, lauds: 3, prime: 6, terce: 9, sext: 12, none: 15, vespers: 18, compline: 21 };

const NUMERALS = ['XXIV', 'III', 'VI', 'IX', 'XII', 'XV', 'XVIII', 'XXI'];

/** Default miniature skies: [zenith, horizon] per Hour. */
const SKY: Record<Hour, [string, string]> = {
  matins: ['#0a0c1c', '#1c1830'],
  lauds: ['#2a2848', '#c88a58'],
  prime: ['#5a7aa0', '#e8c890'],
  terce: ['#4a78b0', '#d8d0b0'],
  sext: ['#3a6ab0', '#e0e0c8'],
  none: ['#4a6a98', '#e0b878'],
  vespers: ['#2a2040', '#d06838'],
  compline: ['#080816', '#20183a'],
};

/** A point on the rect's perimeter at fraction k (0 = top centre, clockwise). */
function perimeter(r: Rect, k: number): { x: number; y: number; nx: number; ny: number } {
  const P = 2 * (r.w + r.h);
  let d = (((k % 1) + 1) % 1) * P;
  // Start at the top centre and walk clockwise.
  const legs: [number, (t: number) => { x: number; y: number; nx: number; ny: number }][] = [
    [r.w / 2, (t) => ({ x: r.x + r.w / 2 + t, y: r.y, nx: 0, ny: -1 })],
    [r.h, (t) => ({ x: r.x + r.w, y: r.y + t, nx: 1, ny: 0 })],
    [r.w, (t) => ({ x: r.x + r.w - t, y: r.y + r.h, nx: 0, ny: 1 })],
    [r.h, (t) => ({ x: r.x, y: r.y + r.h - t, nx: -1, ny: 0 })],
    [r.w / 2, (t) => ({ x: r.x + t, y: r.y, nx: 0, ny: -1 })],
  ];
  for (const [len, at] of legs) {
    if (d <= len) return at(d);
    d -= len;
  }
  return legs[0][1](0);
}

/**
 * Draw a Book-of-Hours card in `r` (designed at 240×360, scales with the rect). `title` is the Hour's
 * name (display face, never below 28 px); `sub` an optional italic line under it.
 */
export function bookOfHoursCard(g: Gfx, r: Rect, hour: Hour, o: { title: string; sub?: string; miniature?: (g: Gfx, inner: Rect) => void; seed?: number } = { title: '' }): void {
  const s = Math.min(r.w / 240, r.h / 360);
  parchmentArt(g, r, 'fresh', 0.35, o.seed ?? HOUR_OF_DAY[hour] + 1);
  // Double rule: gilt outside, rubric inside.
  const m = 30 * s;
  const frame = { x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m };
  g.rectLine(frame.x - 3 * s, frame.y - 3 * s, frame.w + 6 * s, frame.h + 6 * s, 2.5 * s, hex('#c9a13a'));
  g.rectLine(frame.x, frame.y, frame.w, frame.h, 1.2 * s, hex('#8a1a14'));

  // The clock-face marginal border: 24 hour ticks round the margin, numerals every three hours.
  const dial = { x: r.x + m * 0.45, y: r.y + m * 0.45, w: r.w - m * 0.9, h: r.h - m * 0.9 };
  const mine = HOUR_OF_DAY[hour];
  for (let h = 0; h < 24; h++) {
    const p = perimeter(dial, h / 24);
    const major = h % 3 === 0;
    if (major) {
      const own = h === mine;
      const size = Math.max(16, 15 * s);
      const label = NUMERALS[h / 3];
      const w = g.measure(label, size, 'body');
      // Numerals on the side margins sit inward so they never leave the page.
      const px = p.x - p.nx * Math.max(0, w / 2 - 8 * s);
      if (own) g.ellipse(px, p.y, Math.max(12 * s, w / 2 + 6 * s), 12 * s, 0, hex('#8a1a14'));
      g.text(label, px, p.y + 5.5 * s, { size, font: 'body', color: hex(own ? '#f6e6b8' : '#5a3a1c'), align: 'center', shadow: false });
    } else {
      const t = perimeter(dial, h / 24);
      g.line({ x: t.x - t.nx * 4 * s, y: t.y - t.ny * 4 * s }, { x: t.x + t.nx * 4 * s, y: t.y + t.ny * 4 * s }, 1.4 * s, hex('#5a3a1c', 0.8));
    }
  }

  // The miniature under a round arch.
  const win = { x: frame.x + 16 * s, y: frame.y + 16 * s, w: frame.w - 32 * s, h: frame.h * 0.66 };
  if (o.miniature) o.miniature(g, win);
  else defaultMiniature(g, win, hour, s);
  // Spandrels: blue diaper with gold dots, filling the corners above the arch.
  const cx = win.x + win.w / 2;
  const rad = win.w / 2;
  const top = win.y + rad;
  for (const side of [-1, 1]) {
    const pts = [{ x: cx + side * rad, y: win.y }];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push({ x: cx + side * rad * Math.cos(a), y: top - rad * Math.sin(a) });
    }
    for (let i = 1; i < pts.length - 1; i++) g.tri(pts[0].x, pts[0].y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, hex('#1a2a6a'));
    for (let i = 0; i < 4; i++) {
      const dx = cx + side * rad * (0.72 + 0.14 * (i % 2));
      const dy = win.y + rad * (0.12 + 0.14 * Math.floor(i / 2));
      g.circle(dx, dy, 1.8 * s, hex('#e0b850'));
    }
  }
  g.arc(cx, top, rad, 2.5 * s, hex('#c9a13a'), 0.5, Math.PI);
  g.rectLine(win.x, win.y, win.w, win.h, 2.5 * s, hex('#c9a13a'));
  g.line({ x: win.x, y: top }, { x: win.x, y: win.y + win.h }, 2.5 * s, hex('#c9a13a'));

  // The Hour's name and its rubric.
  const ty = win.y + win.h + 44 * s;
  // The name fits the page: shrunk to its width, and broken at the dash onto two lines when a
  // small card would otherwise shrink it past reading.
  const room = r.w - 28 * s;
  const want = Math.max(28, 30 * s);
  const fit = (t: string) => Math.min(want, (want * room) / Math.max(1, g.measure(t, want, 'display')));
  const style = { font: 'display' as const, color: hex('#8a1a14'), color2: hex('#4a0a08'), align: 'center' as const, shadow: false as const };
  const parts = o.title.split(/\s+[—–-]\s+/);
  if (fit(o.title) >= 18 || parts.length < 2) g.text(o.title, cx, ty, { ...style, size: Math.max(16, fit(o.title)) });
  else {
    const size = Math.max(16, Math.min(fit(parts[0]), fit(parts.slice(1).join(' — '))));
    g.text(parts[0], cx, ty - size * 0.55, { ...style, size });
    g.text(parts.slice(1).join(' — '), cx, ty + size * 0.45, { ...style, size });
  }
  if (o.sub) g.text(o.sub, cx, ty + 26 * s, { size: Math.max(16, 16 * s), font: 'italic', color: hex('#3a2a18'), align: 'center', shadow: false });
}

/** The template's own miniature: the Hour's sky, with the sun or moon where it stands at that hour. */
export function defaultMiniature(g: Gfx, r: Rect, hour: Hour, s: number): void {
  const [zen, hor] = SKY[hour];
  g.rectGrad(r.x, r.y, r.w, r.h, hex(zen), hex(hor));
  const h = HOUR_OF_DAY[hour];
  const day = h >= 6 && h <= 18;
  // The body rises from the left horizon at 6 (or 18 for the moon) and sets on the right 12 hours later.
  const k = (((day ? h - 6 : h - 18) % 24) + 24) % 24 / 12;
  const bx = r.x + r.w * (0.1 + 0.8 * k);
  const by = r.y + r.h * (0.78 - 0.55 * Math.sin(Math.min(1, k) * Math.PI));
  if (day) {
    g.glow(bx, by, 40 * s, hex('#ffd890', 0.5));
    g.circle(bx, by, 11 * s, hex('#f8e0a0'));
  } else {
    g.circle(bx, by, 10 * s, hex('#e8e4d0'));
    g.circle(bx + 4 * s, by - 2 * s, 9 * s, hex(zen));
    for (let i = 0; i < 14; i++) g.circle(r.x + ((i * 53) % 97) / 97 * r.w, r.y + ((i * 31) % 61) / 61 * r.h * 0.6, 1.1 * s, rgba(240, 236, 210, 0.8));
  }
  // A hill line and a chapel spire: the Hours are kept.
  const base = r.y + r.h;
  g.poly([{ x: r.x, y: base }, { x: r.x, y: base - r.h * 0.18 }, { x: r.x + r.w * 0.35, y: base - r.h * 0.26 }, { x: r.x + r.w * 0.7, y: base - r.h * 0.2 }, { x: r.x + r.w, y: base - r.h * 0.24 }, { x: r.x + r.w, y: base }], hex(day ? '#3a4a2a' : '#0c0c14'));
  const sx = r.x + r.w * 0.62;
  const sy = base - r.h * 0.22;
  g.rect(sx - 8 * s, sy - 26 * s, 16 * s, 26 * s, hex(day ? '#5a4a3a' : '#141420'));
  g.tri(sx - 10 * s, sy - 26 * s, sx + 10 * s, sy - 26 * s, sx, sy - 52 * s, hex(day ? '#4a3a2a' : '#101018'));
}
