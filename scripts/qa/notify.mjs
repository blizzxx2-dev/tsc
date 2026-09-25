// Posts a nightly summary to the team Discord (QAT-0014) and, on failure, opens/updates an issue
// labelled `nightly`. The webhook URL comes from the QA_DISCORD_WEBHOOK secret; without it the
// Discord step is skipped (and says so).
// Usage: node scripts/qa/notify.mjs <success|failure> [summary.md]
import { existsSync, readFileSync } from 'node:fs';
import { runUrl, upsertIssue } from './gh.mjs';

const [status = 'success', file] = process.argv.slice(2);
const details = file && existsSync(file) ? readFileSync(file, 'utf8') : '';
const date = new Date().toISOString().slice(0, 10);
const headline = `${status === 'success' ? '✅' : '❌'} Nightly QA ${date}: ${status} — ${runUrl()}`;

const hook = process.env.QA_DISCORD_WEBHOOK;
if (hook) {
  const content = `${headline}\n${details}`.slice(0, 1900);
  const res = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) });
  if (!res.ok) console.error(`Discord webhook failed: ${res.status}`);
} else console.log('QA_DISCORD_WEBHOOK not configured — skipping Discord');

if (status !== 'success' && process.env.GITHUB_TOKEN) {
  const n = await upsertIssue(`Nightly QA failing`, `${headline}\n\n${details}`, ['nightly']);
  console.log(`nightly failure tracked in #${n}`);
}
