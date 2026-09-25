// PR policy checks run by .github/workflows/qa-policy.yml.
//
// behaviour-change (QAT-0032/0057): changes to characterisation snapshots, the tool×entity matrix
//   or golden replays need the `behaviour-change` label (and CODEOWNERS routes them to GAM).
// regression (QAT-0090): a PR that closes an S1/S2 bug must add or change an automated test,
//   snapshot or golden replay under tests/.
// replay (QAT-0058): the S1/S2 issue must carry an F8 replay/bundle or a stated reason why not.
//
// Usage: node scripts/qa/check-pr-policy.mjs <changed-files.txt>
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_BODY, PR_LABELS (comma-separated).
import { readFileSync } from 'node:fs';
import { gh, repo } from './gh.mjs';

const changed = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
const labels = (process.env.PR_LABELS ?? '').split(',').filter(Boolean);
const body = process.env.PR_BODY ?? '';
const problems = [];

const BEHAVIOUR = [/^tests\/characterisation\/__snapshots__\//, /^docs\/qa\/tool-entity-matrix\.md$/, /^tests\/replays\//, /^tests\/golden\//];
const touched = changed.filter((f) => BEHAVIOUR.some((re) => re.test(f)));
if (touched.length && !labels.includes('behaviour-change')) {
  problems.push(
    `These files pin current gameplay behaviour and changed without the \`behaviour-change\` label:\n${touched.map((f) => `  - ${f}`).join('\n')}\nIf the change is intended, add the label (a GAM reviewer is requested via CODEOWNERS). Bot-only changes must never rewrite them.`,
  );
}

const closes = [...body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi)].map((m) => Number(m[1]));
for (const n of closes) {
  let issue;
  try {
    issue = await gh('GET', `/repos/${repo()}/issues/${n}`);
  } catch {
    continue;
  }
  const names = issue.labels.map((l) => l.name);
  const severe = names.find((l) => l === 'S1' || l === 'S2');
  if (!severe) continue;
  if (!changed.some((f) => f.startsWith('tests/'))) {
    problems.push(
      `#${n} is ${severe}: the fix must add or update an automated test, snapshot or golden replay under tests/ before it can be Verified (docs/qa/bug-process.md § Regression policy).`,
    );
  }
  const text = `${issue.body ?? ''}`;
  const hasReplay = /\.(ssreplay|zip)\b|F8 bundle|replay:/i.test(text) || /no replay because|replay not possible/i.test(text);
  if (names.includes('area:sim') && !hasReplay) {
    problems.push(`#${n} (${severe}, gameplay) has no F8 replay or reason why not — attach it or explain (docs/qa/bug-process.md § Replay-first).`);
  }
}

if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(1);
}
console.log('PR policy checks passed');
