/**
 * Semantic colour tokens (UIX-0146/0149). HUD and menus ask for a *meaning*
 * ("vitals danger", "rating BAD", "curse") instead of a hex literal, and the
 * active palette is chosen from Options → Accessibility → Colour filter.
 *
 * Colour-blind palettes keep every pair that must be told apart (good/danger,
 * COOL/GOOD/BAD/MISS, blood/pus/black bile, curse/Litany) separated in
 * luminance as well as hue; shapes carry the same information (UIX-0147).
 */
import { settings } from '../core/settings';

export interface Palette {
  ink: string;
  inkDim: string;
  /** Faded ink on parchment (must stay ≥ 4.5:1 on `parch`). */
  inkFaded: string;
  parch: string;
  vitalsGood: string;
  vitalsWarn: string;
  vitalsDanger: string;
  cool: [string, string];
  good: [string, string];
  bad: [string, string];
  miss: [string, string];
  blood: string;
  pus: string;
  bile: string;
  curse: string;
  litany: string;
  validTarget: string;
  wrongTarget: string;
  /** Plate drawn behind HUD text in high-contrast mode (alpha 0 otherwise). */
  plate: number;
}

const BASE: Palette = {
  ink: '#e8dcc0',
  inkDim: '#b4a888',
  inkFaded: '#4a3418',
  parch: '#e0cfa4',
  vitalsGood: '#8fe0a0',
  vitalsWarn: '#f0c060',
  vitalsDanger: '#ff5040',
  cool: ['#f5d76e', '#a8741c'],
  good: ['#e8f0f0', '#8aa0a8'],
  bad: ['#e0955a', '#7a3a14'],
  miss: ['#ff5a5a', '#6a0808'],
  blood: '#8a1016',
  pus: '#c8b040',
  bile: '#1a1410',
  curse: '#b060ff',
  litany: '#f5d76e',
  validTarget: '#9fe0a8',
  wrongTarget: '#ff7a50',
  plate: 0,
};

/** Okabe–Ito-derived swaps: blue/orange axis instead of red/green. */
const DEUTER: Partial<Palette> = {
  vitalsGood: '#56b4e9',
  vitalsWarn: '#f0e442',
  vitalsDanger: '#e69f00',
  good: ['#bfe6ff', '#3a78a8'],
  bad: ['#f0a830', '#8a5400'],
  miss: ['#ffffff', '#5a5a5a'],
  pus: '#f0e442',
  validTarget: '#56b4e9',
  wrongTarget: '#e69f00',
};

const PROTAN: Partial<Palette> = {
  ...DEUTER,
  vitalsDanger: '#f0a000',
  miss: ['#ffffff', '#505050'],
  blood: '#5a3a10',
};

const TRITAN: Partial<Palette> = {
  vitalsGood: '#7ae0c8',
  vitalsWarn: '#ff9ab0',
  vitalsDanger: '#ff3050',
  cool: ['#ffd0e0', '#c05070'],
  pus: '#ff9ab0',
  curse: '#e04080',
  litany: '#ffe0f0',
  validTarget: '#7ae0c8',
  wrongTarget: '#ff3050',
};

const HIGH_CONTRAST: Partial<Palette> = {
  ink: '#ffffff',
  inkDim: '#e8e0d0',
  inkFaded: '#20140a',
  vitalsGood: '#80ffa0',
  vitalsWarn: '#ffe040',
  vitalsDanger: '#ff4040',
  plate: 0.78,
};

export const PALETTES = {
  none: BASE,
  deuteranopia: { ...BASE, ...DEUTER },
  protanopia: { ...BASE, ...PROTAN },
  tritanopia: { ...BASE, ...TRITAN },
  highContrast: { ...BASE, ...HIGH_CONTRAST },
} as const satisfies Record<string, Palette>;

export type PaletteId = keyof typeof PALETTES;

/** The active palette. */
export function palette(): Palette {
  return PALETTES[(settings.colorFilter as PaletteId) ?? 'none'] ?? BASE;
}

/** High-contrast mode (UIX-0149): solid plates behind HUD text, stronger outlines. */
export const highContrast = (): boolean => settings.colorFilter === 'highContrast';

// ------------------------------------------------------------------ contrast (UIX-0025)

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(h: string): number {
  const n = parseInt(h.slice(1, 7), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG contrast ratio between two `#rrggbb` colours (1..21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
