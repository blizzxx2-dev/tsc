/**
 * Kessendorf's heraldry and the Merciful Order's iconography, designed for this game (ART-0018,
 * ART-0019), and the achievement medallions built from them (ART-0069).
 *
 * - City arms: gules, a gold kettle (Kessel-dorf) under a silver tower, on a heater shield.
 * - Six guild marks: Founders (a crucible pouring), Gunsmiths (a barrel and match-cord),
 *   Tanners (a hide on its frame), Barber-Surgeons (a lancet over a bleeding basin), Drapers (a bolt
 *   of cloth and shears), Brewers (a tun and mash-rake).
 * - The Hospice of Saint Ildra's seal: the sun-in-palm within a lettered ring.
 * - Faith glyphs, single colour for UI use: the sun-in-palm and the dove-and-lancet.
 * - Wax medallions: a pressed seal per achievement, in colour or greyed for locked.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export type GuildId = 'founders' | 'gunsmiths' | 'tanners' | 'barbers' | 'drapers' | 'brewers';
export const GUILDS: readonly GuildId[] = ['founders', 'gunsmiths', 'tanners', 'barbers', 'drapers', 'brewers'];

const GOLD = '#d8b040';
const SILVER = '#e0e0d8';
const GULES = '#a01818';
const INK = '#2a1a10';

/** A heater shield outline around (x, y), `s` px tall. */
function shieldPts(x: number, y: number, s: number): Vec[] {
  const w = s * 0.42;
  const top = y - s * 0.5;
  const pts: Vec[] = [
    { x: x - w, y: top },
    { x: x + w, y: top },
    { x: x + w, y: y },
  ];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const a = (k * Math.PI) / 2;
    pts.push({ x: x + w * Math.cos(a), y: y + s * 0.5 * Math.sin(a) });
  }
  for (let i = 10; i >= 0; i--) {
    const k = i / 10;
    const a = (k * Math.PI) / 2;
    pts.push({ x: x - w * Math.cos(a), y: y + s * 0.5 * Math.sin(a) });
  }
  pts.push({ x: x - w, y: y });
  return pts;
}

/** Fill `pts` as a fan from its centroid (shields are convex). */
function fill(g: Gfx, pts: readonly Vec[], c: string): void {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    g.tri(cx, cy, p.x, p.y, q.x, q.y, hex(c));
  }
}

/** The city arms of Kessendorf, `s` px tall. */
export function cityArms(g: Gfx, x: number, y: number, s: number): void {
  const pts = shieldPts(x, y, s);
  fill(g, pts, GULES);
  g.polyline(pts, s * 0.03, hex(GOLD), true);
  // The silver tower in chief.
  const k = s / 100;
  g.rect(x - 9 * k, y - 38 * k, 18 * k, 20 * k, hex(SILVER));
  for (const dx of [-9, -3, 3]) g.rect(x + dx * k, y - 43 * k, 5 * k, 5 * k, hex(SILVER));
  g.rect(x - 2.5 * k, y - 28 * k, 5 * k, 8 * k, hex(INK));
  // The gold kettle in base: a round belly, a bail handle and three feet.
  g.circle(x, y + 12 * k, 17 * k, hex(GOLD));
  g.rect(x - 14 * k, y - 4 * k, 28 * k, 5 * k, hex(GOLD));
  g.arc(x, y - 4 * k, 14 * k, 2.2 * k, hex(GOLD), 0.5, -Math.PI);
  for (const dx of [-10, 0, 10]) g.rect(x + (dx - 1.5) * k, y + 27 * k, 3 * k, 6 * k, hex(GOLD));
}

/** A guild's mark in one ink colour, on a roundel `s` px across. */
export function guildMark(g: Gfx, id: GuildId, x: number, y: number, s: number, c = INK): void {
  const k = s / 100;
  const L = (ax: number, ay: number, bx: number, by: number, w: number) => g.line({ x: x + ax * k, y: y + ay * k }, { x: x + bx * k, y: y + by * k }, w * k, hex(c));
  g.arc(x, y, s * 0.47, 3 * k, hex(c));
  switch (id) {
    case 'founders': // a crucible tipped, pouring a stream into a mould
      g.tri(x - 22 * k, y - 20 * k, x + 6 * k, y - 20 * k, x - 8 * k, y + 2 * k, hex(c));
      L(-2, -4, 8, 22, 4);
      g.rect(x - 4 * k, y + 22 * k, 26 * k, 8 * k, hex(c));
      break;
    case 'gunsmiths': // a barrel on its stock, with a coiled match-cord
      L(-30, 10, 26, -18, 8);
      L(-30, 10, -22, 24, 10);
      g.arc(x + 12 * k, y + 14 * k, 9 * k, 2.5 * k, hex(c));
      break;
    case 'tanners': // a hide stretched on a frame
      g.rectLine(x - 26 * k, y - 26 * k, 52 * k, 52 * k, 4 * k, hex(c));
      g.ellipse(x, y, 18 * k, 21 * k, 0, hex(c));
      for (const [ax, ay] of [[-26, -26], [26, -26], [-26, 26], [26, 26]] as const) L(ax, ay, ax * 0.55, ay * 0.6, 2);
      break;
    case 'barbers': // a lancet over a bleeding basin, three drops
      g.arc(x, y + 8 * k, 22 * k, 5 * k, hex(c), 0.5, 0);
      L(-22, 8, 22, 8, 4);
      L(-18, -28, 18, 2, 4);
      g.tri(x + 14 * k, y - 2 * k, x + 22 * k, y + 4 * k, x + 20 * k, y - 4 * k, hex(c));
      for (let i = 0; i < 3; i++) g.circle(x + (-8 + i * 8) * k, y + (18 + (i % 2) * 5) * k, 3 * k, hex(c));
      break;
    case 'drapers': // a bolt of cloth and open shears
      g.rect(x - 26 * k, y - 8 * k, 30 * k, 20 * k, hex(c));
      L(8, -22, 30, 18, 3);
      L(30, -22, 8, 18, 3);
      g.arc(x + 6 * k, y + 22 * k, 5 * k, 2.5 * k, hex(c));
      g.arc(x + 32 * k, y + 22 * k, 5 * k, 2.5 * k, hex(c));
      break;
    case 'brewers': // a tun and a crossed mash-rake
      g.ellipse(x - 6 * k, y + 4 * k, 18 * k, 22 * k, 0, hex(c));
      L(-24, -6, 12, -6, 2);
      L(-24, 14, 12, 14, 2);
      L(14, -28, 30, 26, 4);
      for (let i = 0; i < 3; i++) L(10 + i * 4, -26 + i * 2, 20 + i * 4, -30 + i * 2, 2);
      break;
  }
}

/** The sun-in-palm (ART-0019): an open hand holding a rayed sun — single colour for UI glyphs. */
export function sunInPalm(g: Gfx, x: number, y: number, s: number, c = GOLD): void {
  const k = s / 100;
  // Palm and four fingers, thumb out to the left.
  g.ellipse(x, y + 16 * k, 22 * k, 18 * k, 0, hex(c));
  for (let i = 0; i < 4; i++) g.ellipse(x + (-13 + i * 9) * k, y - 4 * k, 4 * k, 12 * k, 0, hex(c));
  g.ellipse(x - 26 * k, y + 10 * k, 5 * k, 11 * k, -0.7, hex(c));
  // The sun held above the palm, with twelve rays.
  g.circle(x, y - 30 * k, 11 * k, hex(c));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.line({ x: x + Math.cos(a) * 14 * k, y: y - 30 * k + Math.sin(a) * 14 * k }, { x: x + Math.cos(a) * 21 * k, y: y - 30 * k + Math.sin(a) * 21 * k }, 2.5 * k, hex(c));
  }
}

/** The dove-and-lancet (ART-0019): a dove in flight carrying a lancet — the Merciful Order's badge. */
export function doveAndLancet(g: Gfx, x: number, y: number, s: number, c = SILVER): void {
  const k = s / 100;
  g.ellipse(x, y, 20 * k, 11 * k, -0.2, hex(c));
  g.circle(x + 20 * k, y - 8 * k, 7 * k, hex(c));
  g.tri(x + 26 * k, y - 9 * k, x + 34 * k, y - 6 * k, x + 26 * k, y - 5 * k, hex(c));
  g.tri(x - 6 * k, y - 4 * k, x + 8 * k, y - 4 * k, x - 16 * k, y - 34 * k, hex(c));
  g.tri(x - 18 * k, y + 2 * k, x - 36 * k, y - 6 * k, x - 32 * k, y + 8 * k, hex(c));
  // The lancet, held crosswise under the dove.
  g.line({ x: x - 26 * k, y: y + 20 * k }, { x: x + 28 * k, y: y + 14 * k }, 3 * k, hex(c));
  g.tri(x + 28 * k, y + 11 * k, x + 40 * k, y + 13 * k, x + 28 * k, y + 17 * k, hex(c));
}

/** The Hospice of Saint Ildra's seal: the sun-in-palm within a ticked, double-ruled ring. */
export function hospiceSeal(g: Gfx, x: number, y: number, s: number, c = INK, field = '#e8dcc0'): void {
  const r = s / 2;
  g.circle(x, y, r, hex(field));
  g.arc(x, y, r * 0.95, Math.max(1.5, r * 0.05), hex(c));
  g.arc(x, y, r * 0.72, Math.max(1, r * 0.03), hex(c));
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    g.line({ x: x + Math.cos(a) * r * 0.76, y: y + Math.sin(a) * r * 0.76 }, { x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 }, Math.max(1, r * 0.025), hex(c, i % 3 ? 0.35 : 0.8));
  }
  sunInPalm(g, x, y + r * 0.08, s * 0.6, c);
}

// ---------------------------------------------------------------- wax medallions (ART-0069)

/** Achievement id → the emblem pressed into its seal. */
export const MEDAL_EMBLEM: Record<string, (g: Gfx, x: number, y: number, s: number, c: string) => void> = {
  FIRST_PATIENT: (g, x, y, s, c) => {
    const k = s / 100;
    // A heart closed with three stitches.
    g.circle(x - 10 * k, y - 6 * k, 13 * k, hex(c));
    g.circle(x + 10 * k, y - 6 * k, 13 * k, hex(c));
    g.tri(x - 22 * k, y, x + 22 * k, y, x, y + 26 * k, hex(c));
    for (let i = 0; i < 3; i++) g.line({ x: x - 8 * k, y: y + (-6 + i * 8) * k }, { x: x + 8 * k, y: y + (-2 + i * 8) * k }, 2.5 * k, hex('#000000', 0.45));
  },
  HOUR_OF_MATINS: (g, x, y, s, c) => {
    const k = s / 100;
    g.ellipse(x, y, 26 * k, 13 * k, 0, hex(c));
    g.circle(x, y, 8 * k, hex('#000000', 0.45));
    g.circle(x, y, 3.5 * k, hex(c));
  },
  HOUR_OF_LAUDS: (g, x, y, s, c) => {
    const k = s / 100;
    g.circle(x, y + 6 * k, 12 * k, hex(c));
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      g.line({ x: x + Math.cos(a) * 16 * k, y: y + 6 * k + Math.sin(a) * 16 * k }, { x: x + Math.cos(a) * 26 * k, y: y + 6 * k + Math.sin(a) * 26 * k }, 3 * k, hex(c));
    }
    g.line({ x: x - 28 * k, y: y + 8 * k }, { x: x + 28 * k, y: y + 8 * k }, 3 * k, hex(c));
  },
  CHAPTER_ONE: (g, x, y, s, c) => sunInPalm(g, x, y + s * 0.04, s * 0.7, c),
  CHAPTER_TWO: (g, x, y, s, c) => {
    const k = s / 100;
    // A tent between two crossed pikes: the muster.
    g.tri(x - 20 * k, y + 20 * k, x + 20 * k, y + 20 * k, x, y - 14 * k, hex(c));
    g.line({ x: x - 30 * k, y: y + 26 * k }, { x: x + 24 * k, y: y - 30 * k }, 3 * k, hex(c));
    g.line({ x: x + 30 * k, y: y + 26 * k }, { x: x - 24 * k, y: y - 30 * k }, 3 * k, hex(c));
  },
  RANK_XS: (g, x, y, s, c) => {
    const k = s / 100;
    // Two open hands under a halo.
    g.arc(x, y - 18 * k, 12 * k, 3 * k, hex(c));
    g.ellipse(x - 12 * k, y + 12 * k, 10 * k, 16 * k, 0.4, hex(c));
    g.ellipse(x + 12 * k, y + 12 * k, 10 * k, 16 * k, -0.4, hex(c));
  },
  NO_STILLNESS: (g, x, y, s, c) => {
    const k = s / 100;
    // A lancet struck through a broken five-pointed star.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const b = -Math.PI / 2 + ((i + 1) * 4 * Math.PI) / 5;
      if (i === 2) continue;
      g.line({ x: x + Math.cos(a) * 24 * k, y: y + Math.sin(a) * 24 * k }, { x: x + Math.cos(b) * 24 * k, y: y + Math.sin(b) * 24 * k }, 2.5 * k, hex(c));
    }
    g.line({ x: x - 26 * k, y: y + 26 * k }, { x: x + 26 * k, y: y - 26 * k }, 4 * k, hex(c));
  },
};

/** A pressed wax medallion for an achievement, `s` px across; `locked` greys it. */
export function waxMedallion(g: Gfx, id: string, x: number, y: number, s: number, locked = false): void {
  const r = s / 2;
  const wax = locked ? '#6a6660' : '#9a1a14';
  const waxHi = locked ? '#8a8680' : '#c8382a';
  const waxLo = locked ? '#3a3834' : '#5a0a08';
  // An irregular blob edge where the wax spread, then the pressed disc.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + id.length;
    g.circle(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, r * (0.78 + ((i * 37) % 7) / 60), hex(wax));
  }
  g.circleGrad(x - r * 0.15, y - r * 0.15, r * 0.82, hex(waxHi), hex(waxLo));
  g.arc(x, y, r * 0.7, Math.max(1, r * 0.05), hex(waxLo, 0.9));
  g.arc(x - r * 0.02, y - r * 0.03, r * 0.7, Math.max(1, r * 0.02), hex(waxHi, 0.6));
  const emblem = MEDAL_EMBLEM[id];
  if (emblem) {
    // Embossed: a dark offset under a light face.
    emblem(g, x + r * 0.03, y + r * 0.04, s * 0.78, locked ? '#2a2826' : '#3a0404');
    emblem(g, x, y, s * 0.78, locked ? '#a8a49c' : '#e86a50');
  }
  g.ellipse(x - r * 0.35, y - r * 0.45, r * 0.22, r * 0.1, -0.6, hex('#ffffff', locked ? 0.12 : 0.25));
}
