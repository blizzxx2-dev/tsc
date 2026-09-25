/**
 * Colour-blind pass report (ART-0357): for each CVD type, the simulated ΔE of every checked pair
 * with the default palette and with that type's colour filter. Prints Markdown rows for
 * docs/art/colour-blind-pass.md. Run: `npx vite-node scripts/art/cvd-report.ts`.
 */
import { cvdPairs, MIN_DE, pairDe, type Cvd } from '../../src/art/cvd';
import { PALETTES } from '../../src/ui/theme';
import { RATING_INK } from '../../src/art/kit';

const TYPES: Cvd[] = ['protanopia', 'deuteranopia', 'tritanopia'];
const base = cvdPairs(PALETTES.none, RATING_INK);
console.log(`| Pair | Normal | ${TYPES.map((t) => `${t} (default) | ${t} (filter)`).join(' | ')} |`);
console.log(`| --- | --- | ${TYPES.map(() => '--- | ---').join(' | ')} |`);
base.forEach((pair, i) => {
  const cells = TYPES.flatMap((t) => {
    const d = pairDe(pair, t);
    const f = pairDe(cvdPairs(PALETTES[t])[i], t);
    const mark = (v: number) => `${v.toFixed(1)}${v < MIN_DE ? ' ⚠' : ''}`;
    return [mark(d), mark(f)];
  });
  console.log(`| ${pair.label} | ${pairDe(pair, null).toFixed(1)} | ${cells.join(' | ')} |`);
});
