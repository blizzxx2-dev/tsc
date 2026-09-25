// Word counts for localisation quotes (LOC-0048).
//
//   node scripts/i18n/wordcount.mjs              → table per chapter × scope, plus new/changed words
//                                                  since the last handoff baseline
//   node scripts/i18n/wordcount.mjs --json       → machine-readable
//   node scripts/i18n/wordcount.mjs --baseline   → record the current strings as the handoff baseline
//                                                  (loc/handoff-baseline.json) after sending a batch
//
// Store and legal scopes count the English source documents under docs/production/store and
// docs/production/legal (only the sections marked for translation).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect, words } from './content.mjs';
import { ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const BASELINE = join(ROOT, 'loc/handoff-baseline.json');
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

const { ui, content } = await collect();
const entries = [...ui, ...content].map((e) => ({ ...e, scope: e.scope === 'ops' || e.scope === 'names' ? 'story' : e.scope }));

// Store/legal source documents: only text between <!-- loc:start --> and <!-- loc:end --> markers.
for (const [scope, dir] of [
  ['store', 'docs/production/store'],
  ['legal', 'docs/production/legal'],
]) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs).filter((x) => x.endsWith('.md'))) {
    const md = readFileSync(join(abs, f), 'utf8');
    const blocks = [...md.matchAll(/<!-- loc:start -->([\s\S]*?)<!-- loc:end -->/g)].map((m) => m[1]);
    blocks.forEach((text, i) => entries.push({ id: `${scope}.${f.replace(/\.md$/, '')}.${i + 1}`, text: text.replace(/[#*_>`|-]/g, ' '), scope, chapter: 'global' }));
  }
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const SCOPES = ['ui', 'callouts', 'barks', 'story', 'store', 'legal'];
const chapters = [...new Set(entries.map((e) => e.chapter))].sort();
const table = {};
let total = 0;
let fresh = 0;
for (const e of entries) {
  const n = words(e.text);
  total += n;
  table[e.chapter] ??= Object.fromEntries(SCOPES.map((s) => [s, 0]));
  table[e.chapter][e.scope] += n;
  if (base[e.id] !== hash(e.text)) fresh += n;
}

if (args.includes('--baseline')) {
  writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(entries.map((e) => [e.id, hash(e.text)])), null, 1) + '\n');
  console.log(`baseline written: ${entries.length} strings, ${total} words`);
} else if (args.includes('--json')) {
  console.log(JSON.stringify({ total, newOrChanged: fresh, byChapter: table }, null, 2));
} else {
  const pad = (s, n) => String(s).padStart(n);
  console.log(`${'chapter'.padEnd(8)}${SCOPES.map((s) => pad(s, 10)).join('')}${pad('total', 10)}`);
  for (const c of chapters) {
    const row = table[c];
    console.log(`${c.padEnd(8)}${SCOPES.map((s) => pad(row[s], 10)).join('')}${pad(Object.values(row).reduce((a, b) => a + b, 0), 10)}`);
  }
  console.log(`\n${total} words in ${entries.length} strings; ${fresh} new or changed since the last handoff${existsSync(BASELINE) ? '' : ' (no baseline yet)'}.`);
}
