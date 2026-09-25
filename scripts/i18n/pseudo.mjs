// Write the pseudo-locale tables (LOC-0029…0031) for tools outside the game (TMS previews, the
// width/glyph reports, screenshot runs). The game itself generates them from English at load time,
// so they can never go stale in a build: select them with ?lang=qps | qps-long | qps-cjk or in the
// options menu of a development build.
//
//   node scripts/i18n/pseudo.mjs [outDir]     (default loc/pseudo/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTs, readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const out = process.argv[2] ?? join(ROOT, 'loc/pseudo');
const { pseudoTable } = await loadTs('src/i18n/pseudo.ts');
const en = readJson(join(STRINGS_DIR, 'en.json'));
mkdirSync(out, { recursive: true });
for (const v of ['qps', 'qps-long', 'qps-cjk']) {
  writeFileSync(join(out, `${v}.json`), JSON.stringify(pseudoTable(en, v), null, 2) + '\n');
  console.log(`${v}.json`);
}
