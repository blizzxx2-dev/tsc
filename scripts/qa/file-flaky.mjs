// Flaky-test policy (QAT-0015): every test that passed only on retry gets (or updates) an issue
// labelled `flaky`. Quarantine and the 2-week fix deadline are tracked in tests/QUARANTINE.md.
// Usage (CI, main branch): node scripts/qa/file-flaky.mjs [reportsDir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runUrl, upsertIssue } from './gh.mjs';

const dir = process.argv[2] ?? 'reports';
const files = [];
const walk = (d) => {
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/^qa-summary.*\.json$/.test(f)) files.push(p);
  }
};
walk(dir);
const flaky = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).tests).filter((t) => t.flaky);
if (!flaky.length) {
  console.log('no flaky tests');
  process.exit(0);
}
const deadline = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
for (const t of flaky) {
  const title = `Flaky test: ${t.name}`.slice(0, 250);
  const body = [
    `\`${t.file}\` (${t.project}) passed only after ${t.retries} retr${t.retries === 1 ? 'y' : 'ies'} in ${runUrl()}.`,
    '',
    `Per tests/QUARANTINE.md: fix or quarantine by **${deadline}** (2 weeks). Quarantining means adding a row to`,
    'tests/QUARANTINE.md and `.skip` with a link to this issue; the lint rule rejects skips without one.',
  ].join('\n');
  const n = await upsertIssue(title, body, ['flaky']);
  console.log(`flaky: ${t.name} → #${n}`);
}
