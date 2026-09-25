import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Backdrop } from '../content/story';
import type { Character } from '../content/characters';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { artUrl, BACKDROP_ART, PORTRAIT_ART } from '../content/art';
import type { CharacterId } from '../content/characters';
import { brassBorder, UI } from '../ui/ornaments';

/**
 * Story scenery. Uses period artwork when available (slow Ken Burns drift, candle-lit
 * grading), otherwise procedural placeholder scenery. Drawn in the world layer.
 */
export function drawBackdrop(g: Gfx, kind: Backdrop | 'title' | 'results', t: number): void {
  const art = BACKDROP_ART[kind];
  if (art) {
    const h = g.image(artUrl(art));
    if (h.ready) {
      const [fx, fy] = art.focus ?? [0.5, 0.5];
      const drift = Math.sin(t * 0.03) * 0.5 + 0.5;
      g.drawImageCover(h, 0, 0, VIEW_W, VIEW_H, {
        pan: [Math.min(1, Math.max(0, fx + (drift - 0.5) * 0.2)), fy],
        zoom: 1.06 + 0.03 * Math.sin(t * 0.05),
        sepia: art.sepia ?? 0.35,
        contrast: 1.1,
        vignette: 0.75,
        light: [0.3 + Math.sin(t * 0.4) * 0.03, 0.55],
      });
      // Drifting embers over the art.
      g.setBlend('add');
      for (let i = 0; i < 24; i++) {
        const ex = (i * 97 + Math.sin(t * 0.5 + i) * 40) % VIEW_W;
        const ey = VIEW_H - ((t * (20 + (i % 5) * 8) + i * 53) % VIEW_H);
        g.circle(ex, ey, 1.5, hex('#ffa050', 0.45));
      }
      g.setBlend('alpha');
      return;
    }
  }
  if (kind === 'title' || kind === 'results') kind = kind === 'title' ? 'night' : 'chapel';
  drawProceduralBackdrop(g, kind, t);
}

function drawProceduralBackdrop(g: Gfx, kind: Backdrop, t: number): void {
  const sky: Record<Backdrop, [string, string]> = {
    hospice: ['#2a1c14', '#0c0806'],
    street: ['#1a1e2a', '#080808'],
    theatre: ['#2a1a14', '#0a0605'],
    chapel: ['#1c1a24', '#080608'],
    night: ['#0c1020', '#030306'],
    camp: ['#2a1a10', '#080604'],
  };
  const [top, bottom] = sky[kind];
  g.rectGrad(0, 0, VIEW_W, VIEW_H, hex(top), hex(bottom));

  if (kind === 'hospice' || kind === 'theatre' || kind === 'chapel') {
    // Stone arcade.
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 280;
      g.rect(x - 30, 120, 60, 520, hex('#1a1410'));
      g.rect(x - 34, 110, 68, 18, hex('#241c16'));
      g.arc(x + 140, 260, 110, 22, hex('#1a1410'), 0.5, Math.PI);
    }
    if (kind === 'chapel') {
      // Stained-glass window.
      const wx = VIEW_W / 2;
      g.glow(wx, 230, 260, hex('#6040a0', 0.25));
      g.rect(wx - 70, 140, 140, 220, hex('#302050'));
      for (let i = 0; i < 6; i++) g.rect(wx - 60 + (i % 3) * 42, 150 + Math.floor(i / 3) * 105, 36, 96, hex(['#8a2030', '#2a4a8a', '#c8a040'][i % 3], 0.7));
      g.circle(wx, 140, 70, hex('#302050'));
      g.circle(wx, 140, 58, hex('#c8a040', 0.5));
    }
    // Candles.
    for (const [cx, cy] of [
      [200, 520],
      [640, 560],
      [1080, 510],
    ]) {
      const f = 0.8 + 0.2 * Math.sin(t * 9 + cx) * Math.sin(t * 5.3 + cy);
      g.rect(cx - 6, cy, 12, 50, hex('#d8d0b0'));
      g.glow(cx, cy - 10, 160 * f, hex('#ffb050', 0.35));
      g.ellipse(cx, cy - 10, 5, 12 * f, 0, hex('#fff0b0'), hex('#ff9030'));
    }
    g.rectGrad(0, 600, VIEW_W, 120, hex('#140e0a'), hex('#060403'));
  } else if (kind === 'street' || kind === 'night') {
    if (kind === 'night') {
      g.glow(1000, 120, 200, hex('#a0b0d0', 0.2));
      g.circle(1000, 120, 40, hex('#d8dce8'));
    }
    // Timber-framed gables.
    for (let i = 0; i < 7; i++) {
      const x = i * 200 - 20;
      const h = 260 + ((i * 73) % 120);
      const base = 620;
      g.rect(x, base - h, 180, h, hex('#161210'));
      g.tri(x - 10, base - h, x + 190, base - h, x + 90, base - h - 110, hex('#120e0c'));
      for (let w = 0; w < 3; w++) {
        const lit = (i + w) % 3 === 0;
        g.rect(x + 20 + w * 55, base - h + 60, 30, 40, hex(lit ? '#e8a040' : '#0a0806', lit ? 0.85 : 1));
        if (lit) g.glow(x + 35 + w * 55, base - h + 80, 50, hex('#ffa040', 0.25));
      }
      g.line({ x, y: base - h + 30 }, { x: x + 180, y: base - h + 130 }, 6, hex('#2a1e14'));
    }
    g.rectGrad(0, 620, VIEW_W, 100, hex('#0e0c0a'), hex('#040303'));
    // Snow.
    for (let i = 0; i < 60; i++) {
      const sx = (i * 131 + t * 20 * (1 + (i % 3))) % VIEW_W;
      const sy = (i * 71 + t * 40 * (1 + (i % 2))) % VIEW_H;
      g.circle(sx, sy, 1.5 + (i % 3), hex('#e8e8f0', 0.6));
    }
  } else if (kind === 'camp') {
    g.glow(640, 560, 300, hex('#ff8030', 0.3));
    for (let i = 0; i < 4; i++) g.tri(100 + i * 330, 600, 260 + i * 330, 600, 180 + i * 330, 420, hex('#1a140e'));
  }

  // Drifting embers.
  g.setBlend('add');
  for (let i = 0; i < 24; i++) {
    const ex = (i * 97 + Math.sin(t * 0.5 + i) * 40) % VIEW_W;
    const ey = VIEW_H - ((t * (20 + (i % 5) * 8) + i * 53) % VIEW_H);
    g.circle(ex, ey, 1.5, hex('#ffa050', 0.5));
  }
  g.setBlend('alpha');
}

/** A placeholder portrait: a backlit silhouette bust with headwear by character type. */
export function drawPortrait(g: Gfx, c: Character, x: number, y: number, t: number, active: boolean): void {
  if (c.silhouette === 'none') return;
  const a = active ? 1 : 0.55;
  const bob = Math.sin(t * 1.5 + x) * 2;
  g.glow(x, y - 120, 240, hex(c.color, 0.22 * a));
  const body = hex('#0a0806', 0.95);
  // Shoulders and head.
  g.ellipse(x, y + 40, 150, 120, 0, body);
  g.rect(x - 150, y + 40, 300, 200, body);
  g.circle(x, y - 110 + bob, 62, body);
  g.rect(x - 26, y - 60 + bob, 52, 60, body);
  switch (c.silhouette) {
    case 'hood':
      g.ellipse(x, y - 110 + bob, 84, 96, 0, body);
      g.tri(x - 84, y - 90 + bob, x + 84, y - 90 + bob, x, y - 230 + bob, body);
      break;
    case 'coif':
      g.ellipse(x, y - 105 + bob, 78, 82, 0, body);
      g.rect(x - 78, y - 110 + bob, 156, 110, body);
      g.rect(x - 90, y - 176 + bob, 180, 16, hex('#d8d0c0', 0.25 * a));
      break;
    case 'cap':
      g.ellipse(x, y - 160 + bob, 70, 24, 0, body);
      break;
    case 'hat':
      g.ellipse(x, y - 158 + bob, 130, 20, 0, body);
      g.rect(x - 56, y - 240 + bob, 112, 84, body);
      g.rect(x - 58, y - 172 + bob, 116, 10, hex(c.color, 0.35 * a));
      break;
    case 'helm':
      g.ellipse(x, y - 130 + bob, 76, 60, 0, body);
      g.ellipse(x, y - 150 + bob, 110, 14, 0, body);
      g.tri(x - 10, y - 185 + bob, x + 10, y - 185 + bob, x, y - 215 + bob, body);
      break;
    default:
      break;
  }
  // Eyes catch the light.
  g.circle(x - 20, y - 112 + bob, 3, hex(c.color, 0.5 * a));
  g.circle(x + 20, y - 112 + bob, 3, hex(c.color, 0.5 * a));
  // Rim light.
  g.arc(x, y - 110 + bob, 63, 2, hex(c.color, 0.35 * a), 0.35, -Math.PI * 0.95);
}

/**
 * A VN portrait: period artwork in a gilt oval frame when available, else the silhouette.
 * Returns true if artwork was drawn.
 */
export function drawFramedPortrait(g: Gfx, id: CharacterId, c: Character, x: number, y: number, t: number): boolean {
  const art = PORTRAIT_ART[id];
  if (!art) return false;
  const h = g.image(artUrl(art));
  if (!h.ready) return false;
  const w = 300;
  const hh = 380;
  const bob = Math.sin(t * 1.2) * 1.5;
  const r = { x: x - w / 2, y: y - hh + bob, w, h: hh };
  g.rect(r.x + 8, r.y + 10, w, hh, hex('#000000', 0.5));
  g.glow(x, y - hh / 2, 300, hex(c.color, 0.18));
  const [fx, fy] = art.focus ?? [0.5, 0.3];
  g.drawImageCover(h, r.x, r.y, w, hh, { pan: [fx, fy], sepia: art.sepia ?? 0.25, contrast: 1.08, vignette: 0.55, light: [0.25, 0.3] });
  brassBorder(g, r, 10);
  g.rectLine(r.x - 10, r.y - 10, w + 20, hh + 20, 2, hex(UI.giltLo));
  g.rectLine(r.x + 3, r.y + 3, w - 6, hh - 6, 1, hex(UI.brassHi, 0.5));
  return true;
}
