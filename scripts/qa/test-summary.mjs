// CI test reporting (QAT-0009): turns reports/**/qa-summary*.json (written by
// tests/reporters/qa-summary.ts) into the job summary — passed/failed/skipped/flaky counts per
// project, the 10 slowest tests, and a warning annotation for every unit test slower than 2 s.
// Usage: node scripts/qa/test-summary.mjs [reportsDir] [--fail-on-slow]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { summary } from './gh.mjs';

const dir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'reports';
const failOnSlow = process.argv.includes('--fail-on-slow');
const SLOW_UNIT_MS = 2000;

function findSummaries(d) {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) return findSummaries(p);
    return /^qa-summary.*\.json$/.test(f) ? [p] : [];
  });
}

const rows = findSummaries(dir).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).tests);
if (!rows.length) {
  await summary(`### Tests\nNo qa-summary reports found under \`${dir}/\`.`);
  process.exit(0);
}

const projects = [...new Set(rows.map((r) => r.project))].sort();
const count = (rs, pred) => rs.filter(pred).length;
let md = '### Test results\n\n| Project | Passed | Failed | Skipped | Flaky (passed on retry) | Time |\n|---|---:|---:|---:|---:|---:|\n';
for (const p of projects) {
  const rs = rows.filter((r) => r.project === p);
  const ms = rs.reduce((n, r) => n + r.durationMs, 0);
  md += `| ${p} | ${count(rs, (r) => r.state === 'passed' && !r.flaky)} | ${count(rs, (r) => r.state === 'failed')} | ${count(rs, (r) => r.state === 'skipped' || r.state === 'pending')} | ${count(rs, (r) => r.flaky)} | ${(ms / 1000).toFixed(1)} s |\n`;
}

const slowest = [...rows].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
md += '\n**Slowest 10**\n\n| Test | Project | Time |\n|---|---|---:|\n';
for (const r of slowest) md += `| ${r.name.replace(/\|/g, '\\|')} | ${r.project} | ${(r.durationMs / 1000).toFixed(2)} s |\n`;

const failed = rows.filter((r) => r.state === 'failed');
if (failed.length) {
  md += '\n**Failed**\n\n';
  for (const r of failed) md += `- \`${r.file}\` — ${r.name}${r.error ? `: ${r.error.split('\n')[0]}` : ''}\n`;
}
const flaky = rows.filter((r) => r.flaky);
if (flaky.length) {
  md += '\n**Flaky (passed only on retry — see tests/QUARANTINE.md)**\n\n';
  for (const r of flaky) md += `- \`${r.file}\` — ${r.name} (${r.retries} retr${r.retries === 1 ? 'y' : 'ies'})\n`;
}
const slowUnit = rows.filter((r) => r.project === 'unit' && r.durationMs > SLOW_UNIT_MS);
if (slowUnit.length) {
  md += `\n**Unit tests over ${SLOW_UNIT_MS / 1000} s** (move to the sim project or speed up)\n\n`;
  for (const r of slowUnit) {
    md += `- \`${r.file}\` — ${r.name}: ${(r.durationMs / 1000).toFixed(2)} s\n`;
    console.log(`::warning file=${r.file}::slow unit test (${(r.durationMs / 1000).toFixed(2)} s > 2 s): ${r.name}`);
  }
}
await summary(md);
if (failOnSlow && slowUnit.length) process.exit(1);
