/**
 * Master palette (ART-0011): 32 named swatches. UI tokens (`UI` in src/ui/ornaments.ts, `PALETTE`
 * in src/ui/layout.ts) take their colours from here; `tests/unit/art/palette.test.ts` keeps them
 * within ΔE 6 of a swatch, and `node scripts/art/palette-export.mjs` writes the swatch file for
 * painting tools (`docs/art/palette.gpl`). See docs/art/bible §4.
 */
export const SWATCHES = {
  // Light and fire
  tallow: '#e8d8a8',
  tallowHi: '#fff4d0',
  gilt: '#f5d76e',
  giltLo: '#a8741c',
  ember: '#d98a5f',
  // Brass and metal
  brassHi: '#f0d898',
  brass: '#b8903c',
  brassLo: '#5a4018',
  pewter: '#8a8a86',
  // Paper and cloth
  vellum: '#e6d6ae',
  vellumMid: '#d8c8a0',
  vellumLo: '#bda678',
  foxing: '#9a8660',
  linen: '#e8dcc0',
  bone: '#e8e0d0',
  ash: '#a89c80',
  // Ink, wood and leather
  inkDark: '#2a1a10',
  oak: '#5a4630',
  leather: '#3a1812',
  leatherLo: '#1a0a08',
  soot: '#140f0c',
  // Flesh and fluids
  oxblood: '#8a1016',
  gore: '#5a0a10',
  flesh: '#c0605a',
  bile: '#26240e',
  pus: '#c8b040',
  verdigris: '#4a8a70',
  // Signals
  mercy: '#9fd3a8',
  danger: '#ff5040',
  frost: '#9ec8ff',
  // Reserved (docs/art/bible §5)
  curseViolet: '#b060ff',
  curseDeep: '#4a1a60',
} as const;

export type SwatchId = keyof typeof SWATCHES;

/** CIE L*a*b* of a `#rrggbb` colour (D65). */
export function toLab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The closest swatch to a colour. */
export function nearestSwatch(hex: string): { id: SwatchId; dE: number } {
  let best: { id: SwatchId; dE: number } = { id: 'soot', dE: Infinity };
  for (const [id, c] of Object.entries(SWATCHES) as [SwatchId, string][]) {
    const d = deltaE(hex, c);
    if (d < best.dE) best = { id, dE: d };
  }
  return best;
}
