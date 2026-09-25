import { hex, vec3 } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Backdrop } from '../content/story';
import type { Character } from '../content/characters';
import { VIEW_H, VIEW_W } from '../ui/layout';

/**
 * Story scenery. Uses period artwork when available (slow Ken Burns drift, candle-lit
 * grading), otherwise procedural placeholder scenery. Drawn in the world layer.
 */
export function drawBackdrop(g: Gfx, kind: Backdrop | 'title' | 'results', t: number): void {
  if (kind === 'title' || kind === 'results') kind = kind === 'title' ? 'night' : 'chapel';
  const KIND: Record<Backdrop, number> = { hospice: 0, street: 1, theatre: 2, chapel: 3, night: 4, camp: 5 };
  g.sceneField(KIND[kind]);
  // Drifting embers and dust motes over the environment.
  g.setBlend('add');
  for (let i = 0; i < 30; i++) {
    const ex = (i * 97 + Math.sin(t * 0.5 + i) * 40) % VIEW_W;
    const ey = VIEW_H - ((t * (14 + (i % 5) * 7) + i * 53) % VIEW_H);
    g.circleGrad(ex, ey, 3, hex(i % 3 ? '#ffa050' : '#fff0d0', 0.35), hex('#ffa050', 0));
  }
  g.setBlend('alpha');
}

/** Legacy flat scenery, kept for low-end fallback. */
export function drawFlatBackdrop(g: Gfx, kind: Backdrop, t: number): void {
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

const STYLE: Record<Character['silhouette'], number> = { hood: 0, coif: 1, cap: 2, hat: 3, helm: 4, bare: 5, none: 5 };

/** A character portrait: a raymarched, candle-lit bust (PORTRAIT_FS). */
export function drawPortrait(g: Gfx, c: Character, x: number, y: number, t: number, active: boolean, talking = false): void {
  if (c.silhouette === 'none') return;
  const w = 420;
  const h = 540;
  g.glow(x, y - 200, 260, hex(c.color, 0.16 * (active ? 1 : 0.5)));
  g.portrait(x - w / 2, y - h + 70, w, h, {
    style: STYLE[c.silhouette],
    rim: vec3(c.color),
    cloth: vec3(c.cloth ?? '#3a3028'),
    skin: vec3(c.skin ?? '#c89a80'),
    active: active ? 1 : 0,
    seed: c.name.length * 1.7,
    talk: talking ? 0.5 + 0.5 * Math.sin(t * 16) : 0,
    beard: c.beard ?? 0,
    hair: vec3(c.hair ?? '#2a1c14'),
  });
}
