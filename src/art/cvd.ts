/**
 * Colour-vision-deficiency simulation for the colour-blind art pass (ART-0357): Machado, Oliveira
 * and Fernandes (2009) matrices at full severity, applied in linear sRGB. Used by
 * tests/unit/art/cvd.test.ts and `npx vite-node scripts/art/cvd-report.ts` (docs/art/colour-blind-pass.md).
 */
import { deltaE } from '../render/palette';
import type { Palette } from '../ui/theme';
import { ORGAN_VEINS } from '../render/organs';

export type Cvd = 'protanopia' | 'deuteranopia' | 'tritanopia';

const M: Record<Cvd, readonly number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** How `hex` looks to a viewer with `cvd` (full severity), as `#rrggbb`. */
export function simulate(hex: string, cvd: Cvd): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLin(v / 255));
  const m = M[cvd];
  const out = [0, 1, 2].map((r) => m[r * 3] * rgb[0] + m[r * 3 + 1] * rgb[1] + m[r * 3 + 2] * rgb[2]);
  return '#' + out.map((v) => Math.round(Math.max(0, Math.min(1, toSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}

/** Minimum simulated ΔE (CIE76) for two signals to count as told apart at HUD sizes. */
export const MIN_DE = 12;

export interface CvdPair {
  group: 'ratings' | 'vitals' | 'sigil vs vein' | 'curse vs blood';
  label: string;
  a: string;
  b: string;
}

/**
 * The pairs the pass checks for a palette: rating stamps, the vitals states, sigils against veins,
 * curse against blood. With no colour filter the stamps are inked from `RATING_INK` (src/art/kit.ts),
 * so pass that as `stampInk` for the default palette.
 */
export function cvdPairs(p: Palette, stampInk?: Record<'cool' | 'good' | 'bad' | 'miss', readonly [string, string]>): CvdPair[] {
  const pairs: CvdPair[] = [];
  const ink = stampInk ?? { cool: p.cool, good: p.good, bad: p.bad, miss: p.miss };
  const ratings: [string, string][] = [
    ['COOL', ink.cool[0]],
    ['GOOD', ink.good[0]],
    ['BAD', ink.bad[0]],
    ['MISS', ink.miss[0]],
  ];
  for (let i = 0; i < ratings.length; i++) for (let j = i + 1; j < ratings.length; j++) pairs.push({ group: 'ratings', label: `${ratings[i][0]} / ${ratings[j][0]}`, a: ratings[i][1], b: ratings[j][1] });
  const vitals: [string, string][] = [
    ['good', p.vitalsGood],
    ['warn', p.vitalsWarn],
    ['danger', p.vitalsDanger],
  ];
  for (let i = 0; i < vitals.length; i++) for (let j = i + 1; j < vitals.length; j++) pairs.push({ group: 'vitals', label: `vitals ${vitals[i][0]} / ${vitals[j][0]}`, a: vitals[i][1], b: vitals[j][1] });
  for (const [organ, vein] of Object.entries(ORGAN_VEINS)) pairs.push({ group: 'sigil vs vein', label: `sigil / ${organ} vein`, a: p.curse, b: vein });
  pairs.push({ group: 'curse vs blood', label: 'curse motes / blood', a: p.curse, b: p.blood });
  return pairs;
}

/** Simulated ΔE of a pair under `cvd` (or as seen with normal vision when `cvd` is null). */
export const pairDe = (pair: CvdPair, cvd: Cvd | null): number => (cvd ? deltaE(simulate(pair.a, cvd), simulate(pair.b, cvd)) : deltaE(pair.a, pair.b));
