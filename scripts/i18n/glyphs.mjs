// Glyph coverage check (LOC-0022) and per-locale glyph lists for baking (LOC-0023).
//
//   node scripts/i18n/glyphs.mjs                → coverage report; exit 1 if a shipped locale has a
//                                                code point no face in its role map covers
//   node scripts/i18n/glyphs.mjs --emit [dir]   → also write <dir>/<locale>.txt (default loc/glyphs/):
//                                                every code point the locale needs, one string, sorted
//   node scripts/i18n/glyphs.mjs --strict       → unshipped and pseudo locales fail too
//
// Fonts are read directly (WOFF cmap tables) per role through the font-role map in src/i18n/fonts.ts.
// A locale's strings are its UI table (per key font role from en.meta.json), its content translation
// (loc/content/<lang>.json; English uses the story/operation export) and the characters the runtime
// adds on its own: digits, number-format spaces (U+00A0, U+202F) and HUD punctuation.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect } from './content.mjs';
import { fontPath, hex, loadFont, loadTs, localeTables, messagesOf, readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const emitAt = args.indexOf('--emit');
const emitDir = emitAt >= 0 ? (args[emitAt + 1] && !args[emitAt + 1].startsWith('--') ? args[emitAt + 1] : join(ROOT, 'loc/glyphs')) : undefined;

const { LOCALES } = await loadTs('src/i18n/locales.ts');
const { FACES, fontRoles } = await loadTs('src/i18n/fonts.ts');
const { pseudoTable } = await loadTs('src/i18n/pseudo.ts');
const icu = await loadTs('src/i18n/icu.ts');
const meta = readJson(join(STRINGS_DIR, 'en.meta.json'));
const tables = localeTables();
const en = messagesOf(tables.en);
const { content } = await collect();

/** Characters the runtime draws regardless of locale. */
const RUNTIME = '0123456789 :-+×%()‹›—…’';
/** Characters Intl number formatting produces for a locale (group/decimal separators, e.g. U+202F in fr). */
const numberChars = (intl) => new Intl.NumberFormat(intl).format(-1234567.5) + new Intl.NumberFormat(intl, { style: 'percent' }).format(0.5);
/** Unified KS X 1001 Hangul set (2,350 syllables), decoded from EUC-KR rows 0xB0–0xC8 (LOC-0028 safety set). */
function ksx1001() {
  const dec = new TextDecoder('euc-kr');
  let s = '';
  for (let hi = 0xb0; hi <= 0xc8; hi++) for (let lo = 0xa1; lo <= 0xfe; lo++) s += dec.decode(new Uint8Array([hi, lo]));
  return s.replace(/�/g, '');
}

const fonts = new Map();
const face = (id) => {
  if (!fonts.has(id)) {
    const f = FACES[id];
    const p = f.shipped && f.file ? fontPath(f.file) : undefined;
    fonts.set(id, p ? loadFont(p) : null);
  }
  return fonts.get(id);
};

let failed = 0;
const plain = (m) => {
  try {
    return icu.plainText(m);
  } catch {
    return m;
  }
};

for (const loc of LOCALES) {
  let msgs;
  if (loc.pseudo) msgs = pseudoTable(en, loc.pseudo);
  else if (tables[loc.code]) msgs = messagesOf(tables[loc.code]);
  else continue;
  const contentPath = join(ROOT, `loc/content/${loc.code}.json`);
  const contentText = loc.code === 'en' ? content.map((c) => c.text) : existsSync(contentPath) ? Object.values(readJson(contentPath)).map((v) => (typeof v === 'string' ? v : v.text)) : [];
  // Code points per font role.
  const byRole = { body: new Set(), italic: new Set(), display: new Set() };
  const add = (role, s) => {
    for (const ch of s) byRole[role].add(ch.codePointAt(0));
  };
  for (const [k, v] of Object.entries(msgs)) add(meta[k]?.font ?? 'body', plain(v));
  for (const s of contentText) {
    add('body', s);
    add('italic', s);
  }
  add('body', RUNTIME + numberChars(loc.intl));
  add('italic', RUNTIME + numberChars(loc.intl));
  const roles = fontRoles(loc.code);
  const report = [];
  for (const role of Object.keys(byRole)) {
    const faces = roles[role];
    const bundled = faces.filter((f) => face(f));
    const miss = [...byRole[role]].filter((cp) => cp !== 0x20 && cp !== 0x0a && !bundled.some((f) => face(f).has(cp)));
    const unbundled = faces.filter((f) => !face(f));
    if (miss.length) report.push(`  ${role.padEnd(7)} ${miss.length} uncovered: ${miss.slice(0, 24).map((cp) => `${String.fromCodePoint(cp)} ${hex(cp)}`).join(', ')}${miss.length > 24 ? ' …' : ''}${unbundled.length ? `  (not bundled yet: ${unbundled.join(', ')})` : ''}`);
  }
  const hard = loc.shipped || strict;
  if (report.length && hard) failed++;
  console.log(`${loc.code.padEnd(9)} ${report.length ? (hard ? 'FAIL' : 'warn') : 'ok  '} ${[...new Set([...byRole.body, ...byRole.italic, ...byRole.display])].length} code points${loc.shipped ? '' : ' (not shipped)'}`);
  report.forEach((r) => console.log(r));
  if (emitDir) {
    mkdirSync(emitDir, { recursive: true });
    const all = new Set([...byRole.body, ...byRole.italic, ...byRole.display]);
    if (loc.script === 'hangul') for (const ch of ksx1001()) all.add(ch.codePointAt(0));
    writeFileSync(join(emitDir, `${loc.code}.txt`), String.fromCodePoint(...[...all].sort((a, b) => a - b)) + '\n');
  }
}
if (emitDir) console.log(`glyph lists written to ${emitDir}`);
process.exit(failed ? 1 : 0);
