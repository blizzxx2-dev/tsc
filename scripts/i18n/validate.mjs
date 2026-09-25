// Locale file validation (LOC-0016) and termbase consistency (LOC-0042).
//
//   node scripts/i18n/validate.mjs
//
// For English: every message compiles and en.meta.json describes every key.
// For every other src/i18n/strings/<lang>.json:
//  - valid JSON, only keys that exist in English, every message compiles as ICU;
//  - placeholder names identical to English;
//  - no leading/trailing whitespace drift from English;
//  - no untranslated key (missing, or identical to English) unless listed in "@fallback";
//  - termbase: where the English source contains an approved term, the approved target term must appear
//    (report only — reviewers decide; see docs/loc/termbase.csv).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTs, localeTables, messagesOf, readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const icu = await loadTs('src/i18n/icu.ts');
const errors = [];
const warnings = [];
const tables = localeTables();
const en = messagesOf(tables.en);
const meta = readJson(join(STRINGS_DIR, 'en.meta.json'));

const compile = (lang, key, msg) => {
  try {
    icu.parse(msg);
    return true;
  } catch (e) {
    errors.push(`${lang} ${key}: ICU syntax — ${e.message}`);
    return false;
  }
};

for (const [k, v] of Object.entries(en)) {
  compile('en', k, v);
  if (!meta[k]) errors.push(`en ${k}: no entry in en.meta.json`);
  else for (const f of ['scene', 'font', 'size', 'maxPx', 'context']) if (meta[k][f] === undefined) errors.push(`en.meta ${k}: missing "${f}"`);
}
for (const k of Object.keys(meta)) if (!(k in en)) errors.push(`en.meta ${k}: key not in en.json`);

// Termbase: approved rows only.
function termbase() {
  const p = join(ROOT, 'docs/loc/termbase.csv');
  if (!existsSync(p)) return [];
  const rows = readFileSync(p, 'utf8').trim().split('\n').map(parseCsvLine);
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') out.push(cur), (cur = '');
    else cur += c;
  }
  out.push(cur);
  return out;
}
const terms = termbase();

const termReport = {};
for (const [lang, table] of Object.entries(tables)) {
  if (lang === 'en') continue;
  const msgs = messagesOf(table);
  const fallback = new Set(table['@fallback'] ?? []);
  termReport[lang] = { checked: 0, misses: [] };
  for (const k of Object.keys(msgs)) if (!(k in en)) errors.push(`${lang} ${k}: key does not exist in English`);
  for (const [k, src] of Object.entries(en)) {
    const tr = msgs[k];
    if (tr === undefined || (tr === src && !/^[\s\d{}#×+\-:()]*$/.test(src))) {
      if (!fallback.has(k)) errors.push(`${lang} ${k}: untranslated (add to "@fallback" if intentional)`);
      continue;
    }
    if (!compile(lang, k, tr)) continue;
    const a = icu.argNames(src).join(',');
    const b = icu.argNames(tr).join(',');
    if (a !== b) errors.push(`${lang} ${k}: placeholders {${b}} differ from English {${a}}`);
    if (/^\s/.test(src) !== /^\s/.test(tr) || /\s$/.test(src) !== /\s$/.test(tr)) errors.push(`${lang} ${k}: leading/trailing whitespace differs from English`);
    for (const t of terms) {
      if (t.status !== 'approved' || !t[lang]) continue;
      if (!new RegExp(`\\b${t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(src)) continue;
      termReport[lang].checked++;
      if (!tr.toLowerCase().includes(t[lang].toLowerCase())) termReport[lang].misses.push(`${k}: "${t.term}" → expected "${t[lang]}"`);
    }
  }
}

console.log(`i18n:validate — ${Object.keys(tables).length} locale file(s), ${Object.keys(en).length} English keys, ${terms.length} termbase rows (${terms.filter((t) => t.status === 'approved').length} approved)`);
for (const [lang, r] of Object.entries(termReport)) {
  console.log(`  termbase ${lang}: ${r.checked} checks, ${r.misses.length} misses`);
  r.misses.forEach((m) => warnings.push(`${lang} termbase ${m}`));
}
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ${warnings.join('\n  ')}`);
if (errors.length) {
  console.log(`\nErrors (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('OK');
