/**
 * Marketing cards rendered in-engine in the woodcut style (ART-0335 trailer title card and end
 * slates, ART-0325 store section-header banners). `?scene=cards&card=<id>` shows one on its own
 * and `node scripts/art/export-cards.mjs` writes each at its delivery size to
 * docs/art/marketing/renders/. English text; other languages swap the strings.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import { diamond, rule } from '../ui/hudKit';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { fleuron, woodcutCorner, woodcutEdge } from '../ui/ornaments';
import { parchmentArt, sealArt } from './kit';
import { drawWoundMan, ENGRAVED_INKS, VELLUM_INKS, type Pin } from './woundMan';

export type CardId =
  | 'title'
  | 'slate-demo'
  | 'slate'
  | 'banner-operate'
  | 'banner-malison'
  | 'banner-kessendorf'
  | 'social-avatar'
  | 'x-banner'
  | 'youtube-banner'
  | 'discord-icon'
  | 'discord-banner'
  | 'stream-frame'
  | 'stream-lower-third'
  | 'stream-wishlist'
  | 'promo-cuts'
  | 'promo-shafts'
  | 'promo-burns'
  | 'promo-plague'
  | 'promo-venom'
  | 'promo-curses';

/**
 * Each card's delivery size (px), the virtual rect it is drawn in (the export's device scale is
 * out / rect), and whether it is a transparent overlay (exported by difference matting over black
 * and white grounds).
 */
export const CARDS: Record<CardId, { out: [number, number]; rect: { x: number; y: number; w: number; h: number }; matte?: boolean }> = {
  title: { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  'slate-demo': { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  slate: { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  'banner-operate': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
  'banner-malison': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
  'banner-kessendorf': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
  // Social kit (ART-0328).
  'social-avatar': { out: [400, 400], rect: { x: 0, y: 0, w: 400, h: 400 } },
  'x-banner': { out: [1500, 500], rect: { x: 0, y: 0, w: 1200, h: 400 } },
  'youtube-banner': { out: [2560, 1440], rect: { x: 0, y: 0, w: 1280, h: 720 } },
  'discord-icon': { out: [512, 512], rect: { x: 0, y: 0, w: 512, h: 512 } },
  'discord-banner': { out: [960, 540], rect: { x: 0, y: 0, w: 960, h: 540 } },
  // Livestream overlays (ART-0337), transparent.
  'stream-frame': { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H }, matte: true },
  'stream-lower-third': { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H }, matte: true },
  'stream-wishlist': { out: [400, 120], rect: { x: 0, y: 0, w: 400, h: 120 }, matte: true },
  // "Wound Man" promo plates, one per demo ailment family (ART-0330), square for social posts.
  'promo-cuts': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
  'promo-shafts': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
  'promo-burns': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
  'promo-plague': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
  'promo-venom': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
  'promo-curses': { out: [1080, 1080], rect: { x: 0, y: 0, w: 720, h: 720 } },
};

/** The six promo plates: title, the Wound Man's pinned sites and the family's motif. */
const PROMO: Record<string, { title: string; line: string; sites: Pin[]; motif: 'cuts' | 'shafts' | 'burns' | 'plague' | 'venom' | 'curses' }> = {
  'promo-cuts': { title: 'OF CUTS', line: 'Trace the line. Close every wound.', sites: [pin(0.05, 0.27), pin(-0.25, 0.36), pin(0.0, 0.42)], motif: 'cuts' },
  'promo-shafts': { title: 'OF SHAFTS & SHOT', line: 'Nick the barb. Draw it true.', sites: [pin(-0.17, 0.2), pin(-0.08, 0.6)], motif: 'shafts' },
  'promo-burns': { title: 'OF BURNS', line: 'Pluck the eschar. Salve the raw.', sites: [pin(-0.3, 0.52), pin(-0.25, 0.36), pin(0.05, 0.27)], motif: 'burns' },
  'promo-plague': { title: 'OF PESTILENCE', line: 'Lance the bubo. Drain the humour.', sites: [pin(0.02, 0.155), pin(-0.12, 0.39), pin(0.09, 0.6)], motif: 'plague' },
  'promo-venom': { title: 'OF VENOM & GRUBS', line: 'Stay the poison. Sear the brood.', sites: [pin(-0.09, 0.78), pin(0.0, 0.42)], motif: 'venom' },
  'promo-curses': { title: 'OF CURSES', line: 'Sear the sigil, stroke by stroke.', sites: [pin(0.06, 0.29)], motif: 'curses' },
};

function pin(x: number, y: number): Pin {
  return { site: 'chest', at: { x, y } };
}

/** A Wound Man promo plate (ART-0330): the figure on foxed vellum with its family's wounds drawn in. */
function promoPlate(g: Gfx, id: CardId, r: { x: number; y: number; w: number; h: number }, t: number): void {
  const pr = PROMO[id];
  parchmentArt(g, r, 'foxed', 1, 3);
  const cx = r.x + r.w / 2;
  const top = r.y + 110;
  const h = 470;
  drawWoundMan(g, cx, top, h, pr.sites, t, 1, VELLUM_INKS);
  const ink = hex(SWATCHES.inkDark, 0.9);
  const P = (x: number, y: number) => ({ x: cx + x * h, y: top + y * h });
  for (const [i, s] of pr.sites.entries()) {
    const p = P(s.at.x, s.at.y);
    switch (pr.motif) {
      case 'cuts':
        g.line({ x: p.x - 18, y: p.y - 6 }, { x: p.x + 18, y: p.y + 6 }, 2, hex(SWATCHES.oxblood));
        for (let k = -2; k <= 2; k++) g.line({ x: p.x + k * 7 - 3, y: p.y + k * 2.3 - 6 }, { x: p.x + k * 7 + 3, y: p.y + k * 2.3 + 6 }, 1, ink);
        break;
      case 'shafts': {
        const a = i ? 0.4 : -0.5;
        g.line(p, { x: p.x - Math.cos(a) * 80, y: p.y - Math.sin(a) * 80 - 20 }, 3, hex('#7a5a36'));
        const e = { x: p.x - Math.cos(a) * 80, y: p.y - Math.sin(a) * 80 - 20 };
        g.tri(e.x, e.y, e.x - 10, e.y - 12, e.x + 4, e.y - 14, hex(SWATCHES.linen));
        break;
      }
      case 'burns':
        g.circleGrad(p.x, p.y, 16, hex(SWATCHES.soot, 0.8), hex(SWATCHES.ember, 0));
        break;
      case 'plague':
        g.circleGrad(p.x, p.y, 11, hex(SWATCHES.pus), hex('#6a5010'));
        g.arc(p.x, p.y, 12, 1, ink);
        break;
      case 'venom':
        for (let k = 0; k < 4; k++) g.circle(p.x - k * 5, p.y + Math.sin(k) * 2, 4 - k * 0.6, hex('#d8d0a8'));
        g.circle(p.x, p.y, 1.5, ink);
        break;
      case 'curses':
        // The Choir's mark: an eye with a stroke through it, seared into the breast.
        g.ellipse(p.x, p.y, 20, 9, 0, hex(SWATCHES.curseViolet, 0.25));
        g.arc(p.x, p.y, 5, 1.5, hex(SWATCHES.curseDeep));
        g.quadCurve({ x: p.x - 20, y: p.y }, { x: p.x, y: p.y - 14 }, { x: p.x + 20, y: p.y }, 1.5, hex(SWATCHES.curseDeep), 10);
        g.quadCurve({ x: p.x - 20, y: p.y }, { x: p.x, y: p.y + 14 }, { x: p.x + 20, y: p.y }, 1.5, hex(SWATCHES.curseDeep), 10);
        g.line({ x: p.x - 24, y: p.y + 14 }, { x: p.x + 24, y: p.y - 14 }, 2, hex(SWATCHES.curseDeep));
        break;
    }
  }
  g.text(pr.title, cx, r.y + 72, { size: 40, font: 'display', color: hex(SWATCHES.inkDark), align: 'center', tracking: 0.14, shadow: false });
  rule(g, cx, r.y + 88, 300, hex(SWATCHES.giltLo, 0.9));
  g.text(pr.line, cx, r.y + r.h - 70, { size: 24, font: 'italic', color: hex('#5a3a18'), align: 'center', shadow: false });
  g.text('SUTURE & STEEL', cx, r.y + r.h - 34, { size: 16, font: 'display', color: hex(SWATCHES.oxblood), align: 'center', tracking: 0.3, shadow: false });
}

/** The ampersand seal: the game's mark (app icon, avatar, Discord icon). */
function markSeal(g: Gfx, cx: number, cy: number, r: number): void {
  sealArt(g, cx, cy, r, '#8a1016', { press: 1, gilt: false, seed: 11 });
  g.text('S&S', cx, cy + r * 0.3, { size: r * 0.78, font: 'display', color: hex('#fff1c4'), color2: hex('#c9a55c'), align: 'center', tracking: 0.02, shadow: hex('#2a0204', 0.9) });
}

/** A black woodcut band with the lockup: the social banners. */
function bannerBand(g: Gfx, r: { x: number; y: number; w: number; h: number }, scale: number, t: number, safe?: { w: number; h: number }): void {
  frame(g, r, 10 * scale);
  const s = safe ?? r;
  candle(g, r.x + r.w / 2 - s.w * 0.42, r.y + r.h / 2 - 20 * scale, t);
  candle(g, r.x + r.w / 2 + s.w * 0.42, r.y + r.h / 2 - 20 * scale, t + 1.7);
  lockup(g, r.x + r.w / 2, r.y + r.h / 2 + 4 * scale, scale);
}

const GILT = hex(SWATCHES.gilt);
const INK = SWATCHES.soot;

function frame(g: Gfx, r: { x: number; y: number; w: number; h: number }, inset: number): void {
  const c = hex(SWATCHES.giltLo, 0.9);
  const x0 = r.x + inset;
  const y0 = r.y + inset;
  const x1 = r.x + r.w - inset;
  const y1 = r.y + r.h - inset;
  woodcutEdge(g, x0, y0, x1, y0, c, 1);
  woodcutEdge(g, x1, y1, x0, y1, c, 1);
  woodcutEdge(g, x0, y1, x0, y0, c, 1);
  woodcutEdge(g, x1, y0, x1, y1, c, 1);
  const s = Math.min(1, r.h / 300);
  woodcutCorner(g, x0, y0, 1, 1, 0, c, s, INK);
  woodcutCorner(g, x1, y0, -1, 1, 1, c, s, INK);
  woodcutCorner(g, x0, y1, 1, -1, 2, c, s, INK);
  woodcutCorner(g, x1, y1, -1, -1, 3, c, s, INK);
}

function lockup(g: Gfx, cx: number, y: number, scale: number): void {
  g.glow(cx, y - 20 * scale, 460 * scale, hex('#7a3a10', 0.25));
  g.text('SUTURE & STEEL', cx, y, { size: 84 * scale, font: 'display', color: hex('#fff4d0'), color2: hex('#c8923c'), align: 'center', tracking: 0.09, shadow: hex('#000000', 0.9), soft: true });
  const sub = 'THE MALISON HOURS';
  const sw = g.measure(sub, 18 * scale, 'display', 0.45);
  g.text(sub, cx, y + 48 * scale, { size: 18 * scale, font: 'display', color: hex('#e8c060'), align: 'center', tracking: 0.45, shadow: hex('#000000', 0.9), soft: true });
  rule(g, cx - sw / 2 - 110 * scale, y + 41 * scale, 180 * scale, hex(SWATCHES.gilt, 0.8));
  rule(g, cx + sw / 2 + 110 * scale, y + 41 * scale, 180 * scale, hex(SWATCHES.gilt, 0.8));
  diamond(g, cx - sw / 2 - 18 * scale, y + 41.5 * scale, 3 * scale, GILT);
  diamond(g, cx + sw / 2 + 18 * scale, y + 41.5 * scale, 3 * scale, GILT);
}

function candle(g: Gfx, x: number, y: number, t: number): void {
  const f = 0.9 + 0.1 * Math.sin(t * 9) * Math.sin(t * 4.3);
  g.circleGrad(x, y - 20, 220 * f, hex('#ff9a40', 0.16 * f), hex('#ff9a40', 0));
  g.rectGrad(x - 12, y, 24, 170, hex(SWATCHES.tallow), hex(SWATCHES.vellumLo));
  g.ellipse(x, y - 16, 6, 15 * f, 0, hex('#fff4d0', 0.95), hex('#ff9030', 0.5));
}

/** Draw card `id` into its rect at time t; `ground` is the matte ground for transparent overlays. */
export function drawCard(g: Gfx, id: CardId, t = 1.5, ground = '#000000'): void {
  const r = CARDS[id].rect;
  if (CARDS[id].matte) return drawOverlay(g, id, r, ground);
  if (id in PROMO) return promoPlate(g, id, r, t);
  g.rect(r.x, r.y, r.w, r.h, hex('#070404'));
  if (id === 'social-avatar' || id === 'discord-icon') {
    // A circle-safe mark: the seal fills the middle 80 %.
    g.circleGrad(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.5, hex('#3a2216'), hex('#070404'));
    markSeal(g, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.3);
    return;
  }
  if (id === 'x-banner') return bannerBand(g, r, 0.85, t);
  if (id === 'discord-banner') return bannerBand(g, r, 0.7, t);
  // YouTube: only the centre 1546×423 (773×211.5 here) is safe on every device.
  if (id === 'youtube-banner') return bannerBand(g, r, 0.9, t, { w: 773, h: 211 });
  if (id === 'title') {
    frame(g, r, 28);
    candle(g, r.x + 170, r.y + 420, t);
    lockup(g, r.x + r.w / 2, r.y + 350, 1.1);
    fleuron(g, r.x + r.w / 2, r.y + 480, 22, GILT);
    return;
  }
  if (id === 'slate' || id === 'slate-demo') {
    frame(g, r, 28);
    lockup(g, r.x + r.w / 2, r.y + 190, 0.85);
    const demo = id === 'slate-demo';
    // The call to action on a wax seal.
    sealArt(g, r.x + r.w / 2, r.y + 350, 80, '#8a1016', { press: 1, gilt: true, seed: 5 });
    g.text(demo ? 'FREE DEMO' : 'WISHLIST', r.x + r.w / 2, r.y + 356, { size: 17, font: 'display', color: hex('#ffe8c0'), align: 'center', tracking: 0.12, shadow: hex('#2a0204', 0.9) });
    g.text(demo ? 'Play the free demo on Steam' : 'Wishlist on Steam', r.x + r.w / 2, r.y + 470, { size: 34, font: 'display', color: hex('#fff1c4'), color2: hex('#c9a55c'), align: 'center', tracking: 0.08, shadow: hex('#000000', 0.9) });
    if (demo) g.text('and wishlist the full game', r.x + r.w / 2, r.y + 506, { size: 22, font: 'italic', color: hex(SWATCHES.linen, 0.85), align: 'center' });
    g.text('WINDOWS  ·  MACOS  ·  LINUX  ·  STEAM DECK', r.x + r.w / 2, r.y + 580, { size: 18, font: 'display', color: hex(SWATCHES.ash), align: 'center', tracking: 0.2 });
    // Rating placeholder: a plain box, replaced by the issued rating mark.
    g.rectLine(r.x + r.w - 190, r.y + 560, 120, 110, 2, hex(SWATCHES.ash, 0.8));
    g.text('RATING', r.x + r.w - 130, r.y + 608, { size: 16, font: 'display', color: hex(SWATCHES.ash), align: 'center', tracking: 0.15 });
    g.text('PENDING', r.x + r.w - 130, r.y + 630, { size: 16, font: 'display', color: hex(SWATCHES.ash), align: 'center', tracking: 0.15 });
    return;
  }
  // Store section-header banners: a black woodcut band, a small motif and the word in gilt capitals.
  frame(g, r, 6);
  const word = id === 'banner-operate' ? 'OPERATE' : id === 'banner-malison' ? 'THE MALISON' : 'KESSENDORF';
  const cy = r.y + r.h / 2;
  g.text(word, r.x + r.w / 2 + 40, cy + 16, { size: 44, font: 'display', color: hex('#fff1c4'), color2: hex('#c9a55c'), align: 'center', tracking: 0.16, shadow: hex('#000000', 0.9), soft: true });
  const mx = r.x + 78;
  if (id === 'banner-operate') drawWoundMan(g, mx, r.y + 12, r.h - 24, [], t, 1, ENGRAVED_INKS);
  else if (id === 'banner-malison') {
    // The watcher's eye, in curse violet (reserved for the Malison).
    g.ellipse(mx, cy, 34, 16, 0, hex('#1a1020'), hex('#0a0608'));
    g.circleGrad(mx, cy, 13, hex(SWATCHES.curseViolet), hex(SWATCHES.curseDeep));
    g.circle(mx, cy, 5, hex('#050305'));
    g.circle(mx - 4, cy - 4, 2, hex('#ffffff', 0.7));
    for (const s of [-1, 1]) g.quadCurve({ x: mx - 36, y: cy }, { x: mx, y: cy + s * 26 }, { x: mx + 36, y: cy }, 2, GILT, 14);
  } else {
    // A bell tower and gabled roofs in silhouette under a moon.
    g.circle(mx + 22, cy - 26, 11, hex(SWATCHES.tallow, 0.9));
    const roofs = [
      { x: mx - 48, y: cy + 38 },
      { x: mx - 48, y: cy + 10 },
      { x: mx - 36, y: cy - 4 },
      { x: mx - 24, y: cy + 10 },
      { x: mx - 14, y: cy + 10 },
      { x: mx - 14, y: cy - 40 },
      { x: mx - 6, y: cy - 52 },
      { x: mx + 2, y: cy - 40 },
      { x: mx + 2, y: cy + 6 },
      { x: mx + 20, y: cy - 10 },
      { x: mx + 38, y: cy + 6 },
      { x: mx + 48, y: cy + 38 },
    ];
    // Filled as convex pieces (poly() fans from the centroid): house, tower and spire, second house.
    const fill = hex('#1a1210');
    g.rect(mx - 48, cy + 10, 34, 28, fill);
    g.tri(mx - 48, cy + 10, mx - 36, cy - 4, mx - 24, cy + 10, fill);
    g.rect(mx - 14, cy - 40, 16, 78, fill);
    g.tri(mx - 14, cy - 40, mx - 6, cy - 52, mx + 2, cy - 40, fill);
    g.rect(mx + 2, cy + 6, 46, 32, fill);
    g.tri(mx + 2, cy + 6, mx + 20, cy - 10, mx + 38, cy + 6, fill);
    g.tri(mx + 38, cy + 6, mx + 48, cy + 38, mx + 38, cy + 38, fill);
    g.rect(mx - 9, cy - 30, 6, 8, hex(SWATCHES.gilt, 0.7));
    g.polyline(roofs, 1.5, GILT);
  }
}

/** Stream overlays (ART-0337): drawn on `ground` so the export can recover their alpha. */
function drawOverlay(g: Gfx, id: CardId, r: { x: number; y: number; w: number; h: number }, ground: string): void {
  g.rect(r.x, r.y, r.w, r.h, hex(ground));
  if (id === 'stream-frame') {
    // A gilt woodcut border round a 16:9 game window, with the mark in the top-left corner.
    const b = 18;
    g.rect(r.x, r.y, r.w, b, hex('#0c0806'));
    g.rect(r.x, r.y + r.h - b, r.w, b, hex('#0c0806'));
    g.rect(r.x, r.y, b, r.h, hex('#0c0806'));
    g.rect(r.x + r.w - b, r.y, b, r.h, hex('#0c0806'));
    frame(g, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, 6);
    markSeal(g, r.x + 46, r.y + 46, 30);
    return;
  }
  if (id === 'stream-lower-third') {
    // Name plate on a torn ribbon, bottom left; the text is added live by the streaming tool.
    const y = r.y + r.h - 150;
    g.rectGrad(r.x + 40, y, 560, 84, hex('#1a0c08', 0.95), hex('#0c0604', 0.95));
    g.rect(r.x + 40, y, 560, 3, hex(SWATCHES.gilt));
    g.rect(r.x + 40, y + 81, 560, 3, hex(SWATCHES.gilt));
    g.poly([{ x: r.x + 600, y }, { x: r.x + 640, y: y + 42 }, { x: r.x + 600, y: y + 84 }], hex('#0c0604', 0.95));
    markSeal(g, r.x + 84, y + 42, 26);
    g.rect(r.x + 124, y + 44, 420, 1.5, hex(SWATCHES.gilt, 0.5));
    return;
  }
  // Wishlist bug: a small seal and "WISHLIST ON STEAM" for a corner of the stream.
  g.rectGrad(r.x + 8, r.y + 20, r.w - 16, r.h - 40, hex('#1a0c08', 0.92), hex('#0c0604', 0.92));
  g.rectLine(r.x + 8, r.y + 20, r.w - 16, r.h - 40, 2, hex(SWATCHES.gilt, 0.9));
  sealArt(g, r.x + 52, r.y + r.h / 2, 26, '#8a1016', { press: 1, gilt: true, seed: 5 });
  g.text('WISHLIST', r.x + 230, r.y + r.h / 2 - 2, { size: 24, font: 'display', color: hex('#fff1c4'), color2: hex('#c9a55c'), align: 'center', tracking: 0.14 });
  g.text('ON STEAM', r.x + 230, r.y + r.h / 2 + 22, { size: 16, font: 'display', color: hex(SWATCHES.ash), align: 'center', tracking: 0.3 });
}

/** `?scene=cards&card=<id>`: one card on its own for review and export. */
export class CardsScene implements Scene {
  private t = 0;
  private card: CardId;
  private ground = '#000000';
  constructor() {
    const q = new URLSearchParams(location.search);
    const c = q.get('card') as CardId | null;
    this.card = c && c in CARDS ? c : 'title';
    if (q.get('t')) this.t = Number(q.get('t'));
    if (q.get('ground') === 'white') this.ground = '#ffffff';
  }
  update(dt: number): void {
    this.t += dt;
  }
  render(g: Gfx, _game: Game): void {
    g.beginScreen([0.02, 0.01, 0.01]);
    drawCard(g, this.card, this.t, this.ground);
    g.endFrame();
  }
}
