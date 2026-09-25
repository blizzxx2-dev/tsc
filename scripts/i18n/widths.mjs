// Width budgets (LOC-0032) and HUD text budgets (LOC-0033).
//
//   node scripts/i18n/widths.mjs [--strict] [--locale <code>]
//
// Each key's budget comes from src/i18n/strings/en.meta.json (font role, size, maxPx, maxLines,
// trayPx). Widths are computed from the advance widths in the shipped font files (first bundled face of
// the locale's role map that has the glyph; a 0.6 em estimate otherwise, flagged "~"). Placeholders are
// filled with representative values ({score} = 88888, {title} = the longest operation title, …).
// Shipped locales fail the run on overflow; others (pseudo-locales, unreviewed translations) report only
// unless --strict. Output lists key, locale and overflow in px, grouped for the UIX owner.
import { join } from 'node:path';
import { collect } from './content.mjs';
import { fontPath, loadFont, loadTs, localeTables, messagesOf, readJson, STRINGS_DIR } from './lib.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.includes('--locale') ? args[args.indexOf('--locale') + 1] : undefined;

const { LOCALES } = await loadTs('src/i18n/locales.ts');
const { FACES, fontRoles } = await loadTs('src/i18n/fonts.ts');
const { pseudoTable } = await loadTs('src/i18n/pseudo.ts');
const icu = await loadTs('src/i18n/icu.ts');
const meta = readJson(join(STRINGS_DIR, 'en.meta.json'));
const tables = localeTables();
const en = messagesOf(tables.en);
const { content } = await collect();

const longest = (scope, suffix) => content.filter((c) => c.scope === scope && c.id.endsWith(suffix)).reduce((a, c) => (c.text.length > a.length ? c.text : a), '');
const SAMPLE = { score: 88888, combo: 88, n: 88, value: 1, version: '0.1', rank: 'XS', chapter: 'II', index: 5, title: longest('ops', '.title'), patient: longest('ops', '.patient') };

const cache = new Map();
const faceFont = (id) => {
  if (!cache.has(id)) {
    const f = FACES[id];
    const p = f.shipped && f.file ? fontPath(f.file) : undefined;
    cache.set(id, p ? loadFont(p) : null);
  }
  return cache.get(id);
};

function measure(str, role, size, code) {
  const faces = fontRoles(code)[role].map(faceFont).filter(Boolean);
  let w = 0;
  let estimated = false;
  for (const ch of str) {
    const f = faces.find((x) => x.has(ch.codePointAt(0)));
    if (f) w += f.width(ch, size);
    else {
      w += (/[　-鿿가-힯＀-￯]/.test(ch) ? 1 : 0.6) * size;
      estimated = true;
    }
  }
  return { w, estimated };
}

/** Greedy word wrap into lines no wider than maxPx (CJK breaks anywhere). */
function lines(str, role, size, code, maxPx) {
  const tokens = /[　-鿿＀-￯]/.test(str) ? [...str] : str.split(/(?<= )/);
  let n = 1;
  let cur = 0;
  for (const tok of tokens) {
    const { w } = measure(tok, role, size, code);
    if (cur + w > maxPx && cur > 0) {
      n++;
      cur = w;
    } else cur += w;
  }
  return n;
}

let failed = 0;
for (const loc of LOCALES) {
  if (only && loc.code !== only) continue;
  let msgs;
  if (loc.pseudo) msgs = pseudoTable(en, loc.pseudo);
  else if (tables[loc.code]) msgs = messagesOf(tables[loc.code]);
  else continue;
  const problems = [];
  for (const [key, m] of Object.entries(meta)) {
    const msg = msgs[key];
    if (msg === undefined) continue;
    let text;
    try {
      text = icu.format(msg, SAMPLE, loc.intl);
    } catch {
      continue; // validate.mjs reports syntax errors
    }
    if (m.maxLines && m.maxLines > 1) {
      const n = lines(text, m.font, m.size, loc.code, m.maxPx);
      if (n > m.maxLines) problems.push(`${key}: ${n} lines > ${m.maxLines} at ${m.maxPx}px`);
      continue;
    }
    const { w, estimated } = measure(text, m.font, m.size, loc.code);
    if (w > m.maxPx) problems.push(`${key}: ${Math.round(w)}px > ${m.maxPx}px (+${Math.round(w - m.maxPx)})${estimated ? ' ~' : ''}  [${m.scene}]`);
    if (m.trayPx) {
      const tw = measure(text, m.font, m.size, loc.code).w;
      if (tw > m.trayPx) problems.push(`${key}: tray label ${Math.round(tw)}px > ${m.trayPx}px (+${Math.round(tw - m.trayPx)}) [HUD tray, UIX]`);
    }
    if (m.charLimit && [...text].length > m.charLimit) problems.push(`${key}: ${[...text].length} chars > ${m.charLimit} (soft limit)`);
  }
  const hard = loc.shipped || strict;
  // Character limits and tray labels are advisory; pixel overflows of the current layout are errors.
  const errors = problems.filter((p) => /px \(\+|lines >/.test(p) && !p.includes('tray label'));
  if (errors.length && hard) failed++;
  console.log(`${loc.code.padEnd(9)} ${errors.length ? (hard ? 'FAIL' : 'warn') : 'ok  '} ${problems.length} budget issue(s)`);
  problems.forEach((p) => console.log(`  ${p}`));
}
process.exit(failed ? 1 : 0);
