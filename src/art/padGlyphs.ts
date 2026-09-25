/**
 * Button-prompt glyph art (ART-0273) for the Xbox, PlayStation and Steam Deck families (Nintendo and
 * generic pads reuse the lettered set). Drawn in the house style — dark enamel discs and pills with a
 * gilt rim — rather than copied console art: face buttons carry their letter or a vector shape, the
 * shoulders and triggers are pills, the sticks are knurled discs and the D-pad is a cross with the
 * pressed arm lit. `keycap()` (src/ui/hudKit.ts) hands pad labels here when a pad is in use.
 */
import type { GlyphSet } from '../input/bindings';
import { PAD_GLYPHS } from '../input/glyphs';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';

type Family = Exclude<GlyphSet, 'auto'>;

/** Face-button ink per family, indexed by standard mapping 0–3 (bottom, right, left, top). */
const FACE_INK: Record<'lettered' | 'playstation', readonly string[]> = {
  lettered: ['#8ccf7a', '#e0705a', '#6a9ae0', '#e8c060'],
  playstation: ['#8ab0e8', '#e07a80', '#d898c8', '#78c8b0'],
};

/** Standard-mapping index for a label in a family, or −1. */
export function padIndexOf(label: string, family: Family): number {
  return PAD_GLYPHS[family].indexOf(label);
}

/** Width the glyph takes at `size` (the keycap's text size). */
export function padGlyphWidth(g: Gfx, family: Family, index: number, size: number): number {
  if (index <= 3 || index === 10 || index === 11 || (index >= 12 && index <= 15)) return size * 1.9;
  return Math.max(size * 2.4, g.measure(PAD_GLYPHS[family][index], size * 0.8, 'display') + size * 1.2);
}

/**
 * Draw pad button `index` of `family` with its left edge at x, centred on the text baseline row
 * the keycap would use (`y` = keycap baseline). Returns the width used.
 */
export function padGlyph(g: Gfx, family: Family, index: number, x: number, y: number, size = 12, a = 1): number {
  const w = padGlyphWidth(g, family, index, size);
  const cx = x + w / 2;
  const cy = y - size * 0.05;
  const r = size * 0.92;
  const rim = hex(SWATCHES.gilt, 0.8 * a);
  const enamel = hex('#1a1410', 0.95 * a);
  const label = PAD_GLYPHS[family][index];
  if (index <= 3) {
    // Face buttons.
    g.circle(cx + 1, cy + 1.5, r, hex('#000000', 0.5 * a));
    g.circle(cx, cy, r, enamel);
    g.arc(cx, cy, r, 1.2, rim);
    const ps = family === 'playstation';
    const ink = hex((ps ? FACE_INK.playstation : FACE_INK.lettered)[index], a);
    if (ps) {
      const s = r * 0.48;
      if (index === 0) {
        g.line({ x: cx - s, y: cy - s }, { x: cx + s, y: cy + s }, 1.8, ink);
        g.line({ x: cx + s, y: cy - s }, { x: cx - s, y: cy + s }, 1.8, ink);
      } else if (index === 1) g.arc(cx, cy, s, 1.8, ink);
      else if (index === 2) g.rectLine(cx - s * 0.85, cy - s * 0.85, s * 1.7, s * 1.7, 1.8, ink);
      else
        g.polyline(
          [
            { x: cx, y: cy - s },
            { x: cx + s, y: cy + s * 0.75 },
            { x: cx - s, y: cy + s * 0.75 },
          ],
          1.8,
          ink,
          true,
        );
    } else g.text(label, cx, cy + size * 0.42, { size: size * 1.05, font: 'display', color: ink, align: 'center', shadow: false });
    return w;
  }
  if (index >= 12 && index <= 15) {
    // D-pad: a cross with the pressed arm lit.
    const arm = r * 0.42;
    const len = r;
    g.rect(cx - arm, cy - len, arm * 2, len * 2, enamel);
    g.rect(cx - len, cy - arm, len * 2, arm * 2, enamel);
    g.rectLine(cx - arm, cy - len, arm * 2, len * 2, 1, rim);
    g.rectLine(cx - len, cy - arm, len * 2, arm * 2, 1, rim);
    const lit = hex(SWATCHES.gilt, a);
    if (index === 12) g.rect(cx - arm + 1, cy - len + 1, arm * 2 - 2, len - arm, lit);
    if (index === 13) g.rect(cx - arm + 1, cy + arm, arm * 2 - 2, len - arm - 1, lit);
    if (index === 14) g.rect(cx - len + 1, cy - arm + 1, len - arm, arm * 2 - 2, lit);
    if (index === 15) g.rect(cx + arm, cy - arm + 1, len - arm - 1, arm * 2 - 2, lit);
    return w;
  }
  if (index === 10 || index === 11) {
    // Stick click: a knurled disc marked L or R.
    g.circle(cx, cy, r, enamel);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      g.line({ x: cx + Math.cos(ang) * r * 0.78, y: cy + Math.sin(ang) * r * 0.78 }, { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }, 1, rim);
    }
    g.text(index === 10 ? 'L' : 'R', cx, cy + size * 0.38, { size: size * 0.9, font: 'display', color: hex(SWATCHES.tallowHi, a), align: 'center', shadow: false });
    return w;
  }
  // Shoulders, triggers and system buttons: a pill (triggers get a sloped top).
  const h = size * 1.6;
  const trigger = index === 6 || index === 7;
  g.plate(x, cy - h / 2, w, h, { radius: trigger ? h * 0.2 : h / 2, top: hex('#2c241c', 0.95 * a), bottom: hex('#120c08', 0.95 * a), border: rim, borderW: 1, bevel: 0.8 });
  if (trigger) g.rect(x + 3, cy - h / 2 + 2, w - 6, 2, hex(SWATCHES.gilt, 0.45 * a));
  g.text(label, cx, cy + size * 0.36, { size: size * 0.85, font: 'display', color: hex(SWATCHES.tallowHi, a), align: 'center', tracking: 0.04, shadow: false });
  return w;
}
