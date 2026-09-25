// ART-0084 glyph coverage audit: each shipped face against the demo languages' alphabets.
//   node scripts/art/glyph-audit.mjs   → prints a table; exit 1 if a letter is missing from both the
//                                        shipped faces and the chosen fallback (Atkinson Hyperlegible latin-ext)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadFont, ROOT } from '../i18n/lib.mjs';

const LETTERS = {
  en: '',
  de: 'äöüÄÖÜß„“‚‘',
  fr: 'àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ«»',
  es: 'áéíñóúüÁÉÍÑÓÚÜ¿¡',
  pl: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”',
  'pt-BR': 'àáâãçéêíóôõúÀÁÂÃÇÉÊÍÓÔÕÚ',
};
const BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?\'"()-–—…’';
// The shipped assets/fonts/*.woff2 are the same subsets as these @fontsource .woff files, which the cmap reader can parse.
const shipped = new Set(
  readdirSync(join(ROOT, 'assets/fonts'))
    .filter((n) => n.endsWith('.woff2'))
    .map((n) => n.replace(/\.woff2$/, '.woff')),
);
const missing = new Set();
for (const pkg of readdirSync(join(ROOT, 'node_modules/@fontsource')))
  for (const f of readdirSync(join(ROOT, 'node_modules/@fontsource', pkg, 'files')).filter((n) => shipped.has(n))) {
    const font = loadFont(join(ROOT, 'node_modules/@fontsource', pkg, 'files', f));
    const row = Object.entries(LETTERS).map(([lang, extra]) => {
      const miss = [...new Set(BASE + extra)].filter((c) => !font.has(c.codePointAt(0)));
      miss.forEach((c) => missing.add(c));
      return `${lang}:${miss.length ? miss.join('') : 'ok'}`;
    });
    console.log(`${f.padEnd(48)} ${row.join('  ')}`);
  }
const fallback = loadFont(join(ROOT, 'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-400-normal.woff'));
const uncovered = [...missing].filter((c) => !fallback.has(c.codePointAt(0)));
console.log(
  `fallback atkinson-hyperlegible latin-ext: ${uncovered.length ? `still missing ${uncovered.join('')}` : `covers all ${missing.size} missing letters`}`,
);
process.exit(uncovered.length ? 1 : 0);
