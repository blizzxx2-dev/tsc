// Generates a release-candidate sign-off sheet (QAT-0147 demo RC, QAT-0166 1.0 RC) from the facts a
// script can collect — build SHA, automated suite results, open S1/S2/S3 counts and the open-issue list,
// cert checklist progress — leaving the manual rows for the QA lead to fill and sign.
// Usage: node scripts/qa/signoff.mjs <demo-rc|1.0-rc> [--reports reports] [--out docs/qa/signoff/<name>.md]
// GitHub data needs GITHUB_TOKEN + GITHUB_REPOSITORY; without them those sections say "not collected".
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--')) ?? 'demo-rc';
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const reportsDir = opt('--reports', 'reports');
const out = opt('--out', `docs/qa/signoff/${name}.md`);
const cert = name.startsWith('1.0') ? 'docs/qa/cert-1.0.md' : 'docs/qa/cert-demo.md';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
const date = new Date().toISOString().slice(0, 10);

// Automated suites from the QA summary reports.
const summaries = [];
const walk = (d) => {
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/^qa-summary.*\.json$/.test(f)) summaries.push(p);
  }
};
walk(reportsDir);
const rows = summaries.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).tests);
const projects = [...new Set(rows.map((r) => r.project))].sort();
const suiteTable = projects.length
  ? projects
      .map((p) => {
        const rs = rows.filter((r) => r.project === p);
        const failed = rs.filter((r) => r.state === 'failed').length;
        return `| ${p} | ${rs.filter((r) => r.state === 'passed').length} | ${failed} | ${rs.filter((r) => r.flaky).length} | ${failed ? '❌' : '✅'} |`;
      })
      .join('\n')
  : '| _no reports found in ' + reportsDir + '_ | | | | ⏳ |';

// Open bugs from GitHub.
let bugs = null;
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  const { paginate, repo } = await import('./gh.mjs');
  bugs = (await paginate(`/repos/${repo()}/issues?state=open`)).filter((i) => !i.pull_request);
}
const sev = (s) => (bugs ? bugs.filter((i) => i.labels.some((l) => l.name === s)) : null);
const count = (s) => (bugs ? String(sev(s).length) : 'not collected');
const openList = bugs
  ? ['S1', 'S2', 'S3']
      .flatMap((s) => sev(s).map((i) => `| #${i.number} | ${s} | ${i.title.replace(/\|/g, '\\|')} | ${i.assignee?.login ?? '—'} | |`))
      .join('\n') || '| — | | none | | |'
  : '| _not collected (no GITHUB_TOKEN)_ | | | | |';

// Cert checklist progress.
const certText = existsSync(cert) ? readFileSync(cert, 'utf8') : '';
const certRows = certText.split('\n').filter((l) => /^\| [A-Z]-\d{2} /.test(l));
const certDone = certRows.filter((l) => l.includes('| ✅ |')).length;

const s1 = count('S1');
const s2 = count('S2');
const s3 = count('S3');
const md = `# ${name === 'demo-rc' ? 'Demo' : '1.0'} release-candidate sign-off

| | |
|---|---|
| Build SHA | \`${sha}\` |
| Generated | ${date} |
| Build id(s) | _fill in: e.g. demo 0.9.0+${sha.slice(0, 8)}_ |
| Test plan | ${name === 'demo-rc' ? 'docs/qa/demo-test-plan.md' : 'docs/qa/beta-test-plan.md'} |

## Automated suites (from ${reportsDir}/)

| Project | Passed | Failed | Flaky | Status |
|---|---:|---:|---:|---|
${suiteTable}

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|
| 0 open S1 | ${s1 === '0' ? '✅' : s1 === 'not collected' ? '⏳' : '❌'} ${s1} | open-issue list below |
| 0 open S2 | ${s2 === '0' ? '✅' : s2 === 'not collected' ? '⏳' : '❌'} ${s2} | open-issue list below |
| ≤ 15 open S3, each with owner sign-off | ${s3 === 'not collected' ? '⏳' : Number(s3) <= 15 ? '✅' : '❌'} ${s3} | sign-off column below |
| Crash-free sessions ≥ 99.5 % in the RC playtest round | ⏳ _fill in_ | crash reporting export |
| Performance budgets met on Deck and min-spec | ⏳ _fill in_ | perf-protocol captures |
| Every suite executed on the RC (automated above + manual regression set) | ⏳ _fill in run sheet link_ | docs/qa/cases |
| Certification checklist all green | ${certRows.length && certDone === certRows.length ? '✅' : '⏳'} ${certDone}/${certRows.length} | ${cert} |

## Open issues (S1–S3)

| Issue | Sev | Title | Owner | Ship-with sign-off |
|---|---|---|---|---|
${openList}

## Decision

- [ ] **GO** — all exit criteria met; build may be set live.
- [ ] **NO-GO** — blocking items: _list_

| Role | Name | Date | Signature |
|---|---|---|---|
| QA lead | | | |
| Producer | | | |
| Tech lead | | | |
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md);
console.log(`wrote ${out}`);
