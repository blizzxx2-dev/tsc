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
import { sealArt } from './kit';
import { drawWoundMan, ENGRAVED_INKS } from './woundMan';

export type CardId = 'title' | 'slate-demo' | 'slate' | 'banner-operate' | 'banner-malison' | 'banner-kessendorf';

/** Each card's delivery size (px) and the virtual rect it is drawn in (the export sets DPR so they match). */
export const CARDS: Record<CardId, { out: [number, number]; rect: { x: number; y: number; w: number; h: number } }> = {
  title: { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  'slate-demo': { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  slate: { out: [1920, 1080], rect: { x: 0, y: 0, w: VIEW_W, h: VIEW_H } },
  'banner-operate': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
  'banner-malison': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
  'banner-kessendorf': { out: [616, 120], rect: { x: 0, y: 0, w: 616, h: 120 } },
};

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

/** Draw card `id` into its rect at time t. */
export function drawCard(g: Gfx, id: CardId, t = 1.5): void {
  const r = CARDS[id].rect;
  g.rect(r.x, r.y, r.w, r.h, hex('#070404'));
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

/** `?scene=cards&card=<id>`: one card on its own for review and export. */
export class CardsScene implements Scene {
  private t = 0;
  private card: CardId;
  constructor() {
    const q = new URLSearchParams(location.search);
    const c = q.get('card') as CardId | null;
    this.card = c && c in CARDS ? c : 'title';
    if (q.get('t')) this.t = Number(q.get('t'));
  }
  update(dt: number): void {
    this.t += dt;
  }
  render(g: Gfx, _game: Game): void {
    g.beginScreen([0.02, 0.01, 0.01]);
    drawCard(g, this.card, this.t);
    g.endFrame();
  }
}
