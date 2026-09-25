import { mapText } from './icu';

/**
 * Pseudo-localisation (LOC-0029…0031). Every variant keeps ICU placeholders,
 * plural selectors and `#` intact, so a pseudo build exercises the same code
 * paths as a real translation while staying readable to an English speaker.
 *
 *  - `qps`      accented look-alikes, +40 % padding, ⟦ ⟧ brackets (truncation shows as a missing bracket)
 *  - `qps-long` as `qps`, but strings under 12 characters grow by 100 % (German/Polish single words)
 *  - `qps-cjk`  full-width characters and no spaces, to exercise CJK wrapping and atlas pressure
 */
export type PseudoVariant = 'qps' | 'qps-long' | 'qps-cjk';

const ACCENTS: Record<string, string> = {
  a: 'à', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'ï', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ŧ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ÿ', z: 'ž',
  A: 'À', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Ï', J: 'Ĵ', K: 'Ķ', L: 'Ŀ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Ƥ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ŧ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ÿ', Z: 'Ž',
};

const PAD = '·ẋŷžǫ';

const accent = (s: string): string => s.replace(/[A-Za-z]/g, (c) => ACCENTS[c] ?? c);

/** Full-width forms for printable ASCII (U+FF01…U+FF5E); spaces are dropped as in CJK text. */
const fullWidth = (s: string): string =>
  s.replace(/ /g, '').replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x21 + 0xff01));

function padding(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += PAD[i % PAD.length];
  return out;
}

/** Pseudo-localise one ICU message. */
export function pseudoMessage(message: string, variant: PseudoVariant = 'qps'): string {
  if (variant === 'qps-cjk') return mapText(message, fullWidth);
  let visible = 0;
  mapText(message, (t) => {
    visible += t.length;
    return t;
  });
  const growth = variant === 'qps-long' && visible < 12 ? 1 : 0.4;
  const extra = Math.max(1, Math.round(visible * growth));
  const body = mapText(message, accent);
  return `⟦${body} ${padding(extra)}⟧`;
}

/** Build a whole pseudo table from the English one. */
export function pseudoTable(en: Record<string, string>, variant: PseudoVariant): Record<string, string> {
  return Object.fromEntries(Object.entries(en).map(([k, v]) => [k, pseudoMessage(v, variant)]));
}
