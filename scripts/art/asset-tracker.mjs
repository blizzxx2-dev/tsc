// Asset tracker (ART-0345): one row per Demo asset task in docs/roadmap/06-art.md, as a CSV the
// art lead keeps up to date (asset ID, vendor, stage, due, cost, approved-by). Re-running keeps the
// hand-edited columns of rows that already exist and adds rows for new Demo tasks.
// Usage: node scripts/art/asset-tracker.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/art/tracker/demo-assets.csv';
const COLS = ['asset_id', 'task', 'class', 'priority', 'size', 'vendor', 'stage', 'due', 'cost_usd', 'approved_by'];

const csvCell = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const parseCsv = (text) => {
  const rows = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q && c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = !q;
      else if (c === ',' && !q) {
        cells.push(cur);
        cur = '';
      } else cur += c;
    }
    cells.push(cur);
    rows.push(Object.fromEntries(COLS.map((k, i) => [k, cells[i] ?? ''])));
  }
  return rows;
};

const md = readFileSync('docs/roadmap/06-art.md', 'utf8');
const prev = existsSync(OUT) ? new Map(parseCsv(readFileSync(OUT, 'utf8')).map((r) => [r.asset_id, r])) : new Map();
// The asset class is the roadmap part the task sits in ("## ART-E · Character portraits (visual novel)").
let part = '';
const rows = [];
for (const line of md.split('\n')) {
  const h = line.match(/^## ART-[A-Z] · (.*)$/);
  if (h) part = h[1].replace(/ \(.*\)$/, '');
  const m = line.match(/^- \[( |x)\] (ART-\d{4}) · Demo · (P\d) · (S|M|L|XL) · (.*)$/);
  if (!m) continue;
  const [, done, id, prio, size, text] = m;
  const old = prev.get(id);
  const procedural = done === 'x';
  rows.push({
    asset_id: id,
    task: text.replace(/`/g, ''),
    class: part,
    priority: prio,
    size,
    vendor: old?.vendor || (procedural ? 'in-house (procedural)' : 'TBD'),
    stage: procedural ? 'done' : old?.stage || 'not started',
    due: old?.due ?? '',
    cost_usd: old?.cost_usd || (procedural ? '0' : ''),
    approved_by: old?.approved_by ?? '',
  });
}
writeFileSync(OUT, [COLS.join(','), ...rows.map((r) => COLS.map((k) => csvCell(r[k])).join(','))].join('\n') + '\n');
console.log(`${OUT}: ${rows.length} Demo assets (${rows.filter((r) => r.stage === 'done').length} done)`);
