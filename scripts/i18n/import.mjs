// Import translated XLIFF 1.2 files returned by the TMS.
//
//   node scripts/i18n/import.mjs <file.xliff> [more.xliff…]
//
// ui.*.xliff      → src/i18n/strings/<target-language>.json (merged; keys absent from English are dropped)
// content.*.xliff → loc/content/<target-language>.json      (story/operation/bark translations by line id)
// Only non-empty <target> elements are imported. Run `npm run i18n` afterwards: validation rejects
// placeholder drift and syntax errors, and the glyph/width checks cover the new text.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/i18n/import.mjs <file.xliff>…');
  process.exit(2);
}
const en = readJson(join(STRINGS_DIR, 'en.json'));
for (const file of files) {
  const xml = readFileSync(file, 'utf8');
  const fileTag = /<file\b([^>]*)>/.exec(xml)?.[1] ?? '';
  const lang = /target-language="([^"]+)"/.exec(fileTag)?.[1];
  const kind = /original="([^"]+)"/.exec(fileTag)?.[1];
  if (!lang || (kind !== 'ui' && kind !== 'content')) {
    console.error(`${file}: needs target-language and original="ui|content"`);
    process.exit(1);
  }
  const units = {};
  for (const m of xml.matchAll(/<trans-unit\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g)) {
    const target = /<target\b[^>]*>([\s\S]*?)<\/target>/.exec(m[2])?.[1];
    if (target && target.trim()) units[unesc(m[1])] = unesc(target);
  }
  const out = kind === 'ui' ? join(STRINGS_DIR, `${lang}.json`) : join(ROOT, `loc/content/${lang}.json`);
  mkdirSync(join(out, '..'), { recursive: true });
  const prev = existsSync(out) ? readJson(out) : {};
  const merged = { ...prev, ...units };
  if (kind === 'ui') for (const k of Object.keys(merged)) if (!k.startsWith('@') && !(k in en)) delete merged[k];
  writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
  console.log(`${file}: ${Object.keys(units).length} ${kind} strings → ${out}`);
}
