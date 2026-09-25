/**
 * The eight Hours' miniatures for their Book-of-Hours cards and boss-intro splashes
 * (ART-0234, 0240, 0243, 0246, 0249, 0252, 0255, 0259), painted over the template's sky in the
 * manner of a limner's miniature: flat robes, gilt highlights, one clear image per Hour. Plus the
 * Unsung Hour's blank card (ART-0262): an illuminated page with its text scraped away.
 */
import { hex, rgba } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Hour } from './curse';
import { bookOfHoursCard, defaultMiniature, type Rect } from './hoursCard';
import { parchmentArt } from './kit';

type Painter = (g: Gfx, r: Rect, s: number, t: number) => void;

const GILT = '#e0b850';
const VIOLET = '#6a3a9a';

/** A robed figure: a bell of cloth with a hooded head, standing on (x, base). */
function robe(g: Gfx, x: number, base: number, h: number, cloth: string, face = '#e8d0b0', hood = true): void {
  const w = h * 0.42;
  g.tri(x - w / 2, base, x + w / 2, base, x, base - h * 0.82, hex(cloth));
  g.circle(x, base - h * 0.84, h * 0.11, hex(hood ? cloth : face));
  if (hood) g.circle(x, base - h * 0.82, h * 0.065, hex(face));
}

/** Candle on the ground line with its flame. */
function candle(g: Gfx, x: number, base: number, s: number, t: number): void {
  g.rect(x - 2 * s, base - 14 * s, 4 * s, 14 * s, hex('#efe4c8'));
  g.glow(x, base - 18 * s, 14 * s, hex('#ffc070', 0.45));
  g.ellipse(x, base - 18 * s + Math.sin(t * 7 + x) * 0.5, 2 * s, 4 * s, 0, hex('#ffe0a0'));
}

const PAINTERS: Record<Hour, Painter> = {
  // Matins: the night vigil — a shrouded mass with one great eye, between two altar candles.
  matins: (g, r, s, t) => {
    const cx = r.x + r.w / 2;
    const base = r.y + r.h - 8 * s;
    g.ellipse(cx, base - 34 * s, 34 * s, 38 * s, 0, hex('#d8ccb0'), hex('#a89878'));
    g.ellipse(cx, base - 40 * s, 14 * s, 6 * s, 0, hex('#f0e0c0'));
    g.circle(cx, base - 40 * s, 5 * s, hex('#c03020'));
    g.circle(cx, base - 40 * s, 2 * s, hex('#100808'));
    candle(g, cx - 50 * s, base, s, t);
    candle(g, cx + 50 * s, base, s, t);
  },
  // Lauds: the dawn psalm — two choristers answering, a gilt thread of song between their mouths.
  lauds: (g, r, s) => {
    const base = r.y + r.h - 6 * s;
    const lx = r.x + r.w * 0.28;
    const rx = r.x + r.w * 0.72;
    robe(g, lx, base, 80 * s, '#4a3a6a');
    robe(g, rx, base, 80 * s, '#4a3a6a');
    const my = base - 64 * s;
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push({ x: lx + ((rx - lx) * i) / 16, y: my - Math.sin((i / 16) * Math.PI) * 18 * s });
    g.polyline(pts, 2 * s, hex(GILT));
    for (const x of [lx, rx]) g.circle(x, my + 6 * s, 2.5 * s, hex('#200a10'));
  },
  // Prime: the reading of the roll — a scribe-thing with quill fingers at a lectern of names.
  prime: (g, r, s) => {
    const base = r.y + r.h - 6 * s;
    const x = r.x + r.w * 0.4;
    robe(g, x, base, 86 * s, '#2a2a38');
    const lx = r.x + r.w * 0.68;
    g.rect(lx - 3 * s, base - 46 * s, 6 * s, 46 * s, hex('#5a3a1c'));
    g.tri(lx - 28 * s, base - 46 * s, lx + 28 * s, base - 46 * s, lx + 22 * s, base - 62 * s, hex('#efe4c8'));
    for (let i = 0; i < 4; i++) g.line({ x: lx - 20 * s + i * 4 * s, y: base - 50 * s - i * 3 * s }, { x: lx + 12 * s + i * 2 * s, y: base - 50 * s - i * 3 * s }, 1 * s, hex('#3a2010'));
    for (let i = 0; i < 4; i++) g.line({ x: x + 10 * s, y: base - 50 * s }, { x: lx - 20 * s + i * 5 * s, y: base - 58 * s + i * 2 * s }, 1.4 * s, hex('#e8e0d0'));
  },
  // Terce: Pentecost's third hour — tongues of hexfire leaping between three bowed heads.
  terce: (g, r, s, t) => {
    const base = r.y + r.h - 6 * s;
    for (let i = 0; i < 3; i++) {
      const x = r.x + r.w * (0.25 + 0.25 * i);
      robe(g, x, base, 64 * s, '#3a2a28');
      const fy = base - 72 * s;
      const flick = Math.sin(t * 6 + i * 2) * 2 * s;
      g.glow(x, fy, 18 * s, hex('#c060ff', 0.35));
      g.tri(x - 6 * s, fy + 6 * s, x + 6 * s, fy + 6 * s, x + flick, fy - 14 * s, hex('#e090ff'));
      g.tri(x - 3 * s, fy + 5 * s, x + 3 * s, fy + 5 * s, x + flick * 0.5, fy - 6 * s, hex('#fff0ff'));
    }
  },
  // Sext: the noonday demon — a slumped stone figure under a false-calm halo, the sun overhead.
  sext: (g, r, s) => {
    const base = r.y + r.h - 6 * s;
    const x = r.x + r.w / 2;
    g.ellipse(x, base - 22 * s, 34 * s, 22 * s, 0, hex('#9a9690'), hex('#6a6660'));
    g.circle(x - 16 * s, base - 38 * s, 12 * s, hex('#8a8680'));
    g.line({ x: x - 26 * s, y: base - 30 * s }, { x: x + 10 * s, y: base - 18 * s }, 1.2 * s, hex('#4a4640'));
    g.arc(x - 16 * s, base - 54 * s, 12 * s, 2 * s, hex(GILT));
  },
  // None: the ninth hour — a hourglass-segmented burrower tunnelling down toward a heart.
  none: (g, r, s) => {
    const ground = r.y + r.h * 0.45;
    g.rect(r.x, ground, r.w, r.y + r.h - ground, hex('#4a3420'));
    for (let i = 0; i < 20; i++) g.circle(r.x + ((i * 37) % 101) / 101 * r.w, ground + ((i * 53) % 89) / 89 * (r.y + r.h - ground), 1.2 * s, hex('#2a1a10'));
    const hx = r.x + r.w * 0.7;
    const hy = r.y + r.h - 22 * s;
    g.circle(hx - 5 * s, hy, 8 * s, hex('#a02028'));
    g.circle(hx + 5 * s, hy, 8 * s, hex('#a02028'));
    g.tri(hx - 13 * s, hy + 2 * s, hx + 13 * s, hy + 2 * s, hx, hy + 16 * s, hex('#a02028'));
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      const x = r.x + r.w * (0.25 + 0.35 * k);
      const y = ground + (hy - ground - 20 * s) * k;
      g.ellipse(x, y, 7 * s, 5 * s, 0.6, hex(i % 2 ? '#c8b89a' : '#a8987a'));
    }
  },
  // Vespers: the lamp-lighting — a figure of wick-filaments lighting lamps that will not stay lit.
  vespers: (g, r, s, t) => {
    const base = r.y + r.h - 6 * s;
    const x = r.x + r.w * 0.3;
    robe(g, x, base, 80 * s, '#5a4020');
    g.line({ x: x + 8 * s, y: base - 56 * s }, { x: x + 60 * s, y: base - 96 * s }, 1.6 * s, hex('#3a2010'));
    for (let i = 0; i < 3; i++) {
      const lx = r.x + r.w * (0.6 + 0.15 * i);
      const ly = base - 50 * s - i * 8 * s;
      g.line({ x: lx, y: ly }, { x: lx, y: base }, 1.2 * s, hex('#2a1a10'));
      const lit = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      g.glow(lx, ly, 14 * s, hex('#ffb060', 0.4 * lit));
      g.circle(lx, ly, 3.5 * s, hex('#ffd890', 0.3 + 0.7 * lit));
    }
  },
  // Compline: the last office — a veiled sleeper on a bier, the other Hours' motifs keeping watch.
  compline: (g, r, s) => {
    const base = r.y + r.h - 10 * s;
    const cx = r.x + r.w / 2;
    g.rect(cx - 50 * s, base - 10 * s, 100 * s, 10 * s, hex('#3a2a20'));
    g.ellipse(cx, base - 16 * s, 46 * s, 9 * s, 0, hex('#d8d4e0'), hex('#a8a0b8'));
    g.circle(cx - 40 * s, base - 20 * s, 7 * s, hex('#d8d4e0'));
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i / 6));
      g.circle(cx - Math.cos(a) * 60 * s, base - 30 * s - Math.sin(a) * 40 * s, 3 * s, hex(i % 2 ? GILT : VIOLET));
    }
  },
};

/** The miniature painter for an Hour's card: its sky, then its image. */
export function hourMiniature(hour: Hour, t = 0): (g: Gfx, inner: Rect) => void {
  return (g, r) => {
    const s = r.w / 176;
    defaultMiniature(g, r, hour, s);
    PAINTERS[hour](g, r, s, t);
  };
}

/** The Hour's full card with its own miniature. */
export function hourCard(g: Gfx, r: Rect, hour: Hour, title: string, t = 0, sub?: string): void {
  bookOfHoursCard(g, r, hour, { title, sub, miniature: hourMiniature(hour, t) });
}

/** The Unsung Hour's card (ART-0262): an illuminated page whose miniature and text were scraped away. */
export function unsungCard(g: Gfx, r: Rect, seed = 9): void {
  const s = Math.min(r.w / 240, r.h / 360);
  parchmentArt(g, r, 'fresh', 0.35, seed);
  const m = 30 * s;
  g.rectLine(r.x + m - 3 * s, r.y + m - 3 * s, r.w - 2 * m + 6 * s, r.h - 2 * m + 6 * s, 2.5 * s, hex('#c9a13a', 0.5));
  // The arch's ghost, and the raw scraped vellum where the picture was.
  const win = { x: r.x + m + 16 * s, y: r.y + m + 16 * s, w: r.w - 2 * m - 32 * s, h: (r.h - 2 * m) * 0.66 };
  g.rect(win.x, win.y, win.w, win.h, hex('#d8c8a0'));
  for (let i = 0; i < 40; i++) {
    const y = win.y + ((i * 17) % 97) / 97 * win.h;
    const x = win.x + ((i * 43) % 89) / 89 * win.w * 0.7;
    g.line({ x, y }, { x: x + win.w * 0.3, y: y + 2 * s }, 1.2 * s, rgba(150, 120, 80, 0.35));
  }
  g.arc(win.x + win.w / 2, win.y + win.w / 2, win.w / 2, 2 * s, hex('#c9a13a', 0.25), 0.5, Math.PI);
  // Where the Hour's name was: a smudge of rubric that no longer reads.
  const ty = win.y + win.h + 40 * s;
  g.ellipse(r.x + r.w / 2, ty, 60 * s, 9 * s, 0, hex('#8a1a14', 0.22), hex('#8a1a14', 0));
}
