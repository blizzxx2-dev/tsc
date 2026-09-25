// Nightly benchmark tracking (QAT-0072): compares `vitest bench --outputJson` results with the
// previous night's and reports medians; a slowdown above the threshold (default 20 %) exits 2 so the
// workflow opens an issue. Usage: node scripts/qa/bench-compare.mjs <current.json> [baseline.json] [--threshold 0.2]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { summary } from './gh.mjs';

const args = process.argv.slice(2);
const tIdx = args.indexOf('--threshold');
const threshold = tIdx >= 0 ? Number(args[tIdx + 1]) : 0.2;
const [currentFile, baselineFile] = args.filter((a, i) => !a.startsWith('--') && (tIdx < 0 || i !== tIdx + 1));

const medians = (file) => {
  const out = {};
  for (const f of JSON.parse(readFileSync(file, 'utf8')).files ?? [])
    for (const g of f.groups ?? []) for (const b of g.benchmarks ?? []) out[`${g.fullName} › ${b.name}`] = b.median ?? b.mean;
  return out;
};

const cur = medians(currentFile);
const base = baselineFile && existsSync(baselineFile) ? medians(baselineFile) : null;
let md = '### Simulation benchmarks\n\n| Benchmark | Median (ms) | Previous (ms) | Change |\n|---|---:|---:|---:|\n';
const regressions = [];
for (const [name, m] of Object.entries(cur)) {
  const prev = base?.[name];
  const change = prev ? (m - prev) / prev : null;
  if (change !== null && change > threshold) regressions.push({ name, m, prev, change });
  md += `| ${name} | ${m.toFixed(4)} | ${prev ? prev.toFixed(4) : '—'} | ${change === null ? 'new' : `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)} %`} |\n`;
}
if (!base) md += '\n_No previous nightly results to compare against._\n';
if (regressions.length) {
  md += `\n**Regressions over ${(threshold * 100).toFixed(0)} %:** ${regressions.map((r) => r.name).join('; ')}\n`;
  writeFileSync('reports/bench-regressions.md', md);
}
await summary(md);
process.exit(regressions.length ? 2 : 0);
