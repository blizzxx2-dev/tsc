/**
 * Drawing for the visual cues for sound: closed captions (with a side arrow
 * when the source is off-centre), VO subtitles (speaker in character colour,
 * size S–XL, background opacity, max two lines) and the visual heartbeat (an
 * edge vignette that pulses on each beat when the thump cannot be heard).
 */
import { hex, type RGBA } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_H, VIEW_W } from '../ui/layout';
import type { AudioSystem } from './system';

const SUB_SIZE = { S: 18, M: 22, L: 27, XL: 33 } as const;

/** Horizontal gradient quad from two vertex-coloured triangles. */
function hgrad(g: Gfx, x: number, y: number, w: number, h: number, left: RGBA, right: RGBA): void {
  g.tri(x, y, x + w, y, x + w, y + h, left, right, right);
  g.tri(x, y, x + w, y + h, x, y + h, left, right, left);
}

/** Captions and subtitles; `baseY` is the bottom edge of the caption stack. */
export function drawSoundCues(g: Gfx, sys: AudioSystem, baseY = 630): void {
  const eng = sys.engine;
  const prefs = eng.prefs;
  // Subtitles for voiced lines.
  const sub = eng.subtitles.current;
  let y = baseY;
  if (sub && prefs.subtitles) {
    const size = SUB_SIZE[prefs.subtitleSize];
    eng.subtitles.width = Math.round(1000 / (size * 0.5));
    const card = eng.subtitles.lines();
    const lines = card.map((l, i) => (i === 0 ? `${sub.speaker}: ${l}` : l));
    const h = lines.length * size * 1.3 + 14;
    const w = Math.max(...lines.map((l) => g.measure(l, size))) + 40;
    g.rect(VIEW_W / 2 - w / 2, y - h, w, h, hex('#000000', prefs.subtitleBg / 100));
    lines.forEach((l, i) => {
      const ly = y - h + 7 + (i + 1) * size * 1.3 - size * 0.3;
      if (i === 0) {
        const name = `${sub.speaker}: `;
        const nw = g.measure(name, size);
        const lw = g.measure(l, size);
        const x0 = VIEW_W / 2 - lw / 2;
        g.text(name, x0, ly, { size, color: hex(sub.color) });
        g.text(l.slice(name.length), x0 + nw, ly, { size, color: hex('#f4ead0') });
      } else g.text(l, VIEW_W / 2, ly, { size, color: hex('#f4ead0'), align: 'center' });
    });
    y -= h + 6;
  }
  // Sound captions.
  if (!prefs.captions) return;
  const size = SUB_SIZE[prefs.subtitleSize] - 3;
  for (const c of [...eng.captions.items].reverse()) {
    const age = eng.captions.now - c.born;
    const left = c.until - eng.captions.now;
    const a = Math.min(1, age * 6, left * 3);
    const arrowL = c.side < -0.25 ? '◂ ' : '';
    const arrowR = c.side > 0.25 ? ' ▸' : '';
    const text = `${arrowL}${c.text}${arrowR}`;
    const w = g.measure(text, size, 'italic') + 28;
    const h = size * 1.45;
    const cx = VIEW_W / 2 + c.side * 180;
    g.rect(cx - w / 2, y - h, w, h, hex('#000000', (prefs.subtitleBg / 100) * 0.9 * a));
    g.text(text, cx, y - h * 0.3, { size, font: 'italic', color: hex('#e8dcc0', a), align: 'center', shadow: false });
    y -= h + 4;
  }
}

/** Edge vignette pulse for the visual heartbeat. `pulse` 0..1. */
export function drawVisualHeartbeat(g: Gfx, pulse: number, soften = 1): void {
  if (pulse <= 0.01) return;
  const a = 0.32 * pulse * soften;
  const red = hex('#8c0508', a);
  const none = hex('#8c0508', 0);
  const e = 120;
  g.rectGrad(0, 0, VIEW_W, e, hex('#8c0508', a), hex('#8c0508', 0));
  g.rectGrad(0, VIEW_H - e, VIEW_W, e, hex('#8c0508', 0), hex('#8c0508', a));
  hgrad(g, 0, 0, e, VIEW_H, red, none);
  hgrad(g, VIEW_W - e, 0, e, VIEW_H, none, red);
}
