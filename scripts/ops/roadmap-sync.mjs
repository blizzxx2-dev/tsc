// Roadmap → GitHub issue sync (OPS-0007).
//
//   GITHUB_TOKEN=… node scripts/ops/roadmap-sync.mjs [--repo owner/name] [--apply] [--only DEMO|<PREFIX>]
//
// Without --apply it prints the plan and changes nothing (dry run). With --apply it:
//  - creates one issue per task line in docs/roadmap/0*.md that has none, titled "<ID> · <title>",
//    labelled roadmap, ws:<PREFIX>, phase:<Phase>, <P0-3>, size:<S|M|L>;
//  - updates title/labels of existing issues whose task line changed;
//  - closes issues whose task is marked [x], and writes [x] back into the roadmap for issues closed
//    on GitHub (state_reason "completed" only; "not planned" is left for a human to re-scope).
// Idempotent: the plan after an --apply run is empty. Issues are matched by the ID at the start of the
// title, so renaming a task never creates a duplicate.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRoadmap } from './roadmap.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const labelsFor = (t) => ['roadmap', `ws:${t.prefix}`, `phase:${t.phase}`, t.pri, `size:${t.size}`];
export const titleFor = (t) => `${t.id} · ${t.title}`.slice(0, 250);
export const bodyFor = (t) =>
  `${t.acceptance ? `**Acceptance:** ${t.acceptance}\n\n` : ''}Source: \`${t.file}\` · ${t.phase} · ${t.pri} · size ${t.size}\n\n<!-- roadmap-id: ${t.id} -->`;

/**
 * Compute the actions that bring GitHub and the roadmap into agreement.
 * `issues`: [{ number, title, state: 'open'|'closed', state_reason, labels: string[] }].
 */
export function plan(tasks, issues) {
  const byId = new Map();
  for (const i of issues) {
    const m = /^([A-Z]{3}-\d{4})\b/.exec(i.title);
    if (m && !byId.has(m[1])) byId.set(m[1], i);
  }
  const actions = [];
  for (const t of tasks) {
    const issue = byId.get(t.id);
    const labels = labelsFor(t);
    if (!issue) {
      actions.push({ kind: 'create', id: t.id, title: titleFor(t), body: bodyFor(t), labels, close: t.done });
      continue;
    }
    const have = new Set(issue.labels);
    const managed = issue.labels.filter((l) => l === 'roadmap' || /^(ws|phase|size):|^P[0-3]$/.test(l));
    const labelsDiffer = labels.some((l) => !have.has(l)) || managed.some((l) => !labels.includes(l));
    if (issue.title !== titleFor(t) || labelsDiffer) {
      const keep = issue.labels.filter((l) => !managed.includes(l));
      actions.push({ kind: 'update', id: t.id, number: issue.number, title: titleFor(t), labels: [...keep, ...labels] });
    }
    if (t.done && issue.state === 'open') actions.push({ kind: 'close', id: t.id, number: issue.number });
    if (!t.done && issue.state === 'closed' && issue.state_reason === 'completed') actions.push({ kind: 'mark-done', id: t.id, file: t.file, line: t.line });
  }
  return actions;
}

/** Apply the mark-done actions to roadmap files (the only local writes). */
export function markDone(root, actions) {
  const byFile = new Map();
  for (const a of actions.filter((x) => x.kind === 'mark-done')) {
    if (!byFile.has(a.file)) byFile.set(a.file, []);
    byFile.get(a.file).push(a.line);
  }
  for (const [file, lines] of byFile) {
    const p = join(root, file);
    const text = readFileSync(p, 'utf8').split('\n');
    for (const n of lines) text[n - 1] = text[n - 1].replace(/^- \[ \]/, '- [x]');
    writeFileSync(p, text.join('\n'));
  }
}

async function gh(token, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return { data: await res.json(), link: res.headers.get('link') ?? '' };
}

async function listIssues(token, repo) {
  const out = [];
  for (let page = 1; ; page++) {
    const { data, link } = await gh(token, 'GET', `/repos/${repo}/issues?labels=roadmap&state=all&per_page=100&page=${page}`);
    for (const i of data) if (!i.pull_request) out.push({ number: i.number, title: i.title, state: i.state, state_reason: i.state_reason, labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)) });
    if (!link.includes('rel="next"')) return out;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const repo = args.includes('--repo') ? args[args.indexOf('--repo') + 1] : process.env.GITHUB_REPOSITORY;
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  let tasks = readRoadmap(ROOT);
  if (only === 'DEMO') tasks = tasks.filter((t) => t.phase === 'Demo' || t.phase === 'M0');
  else if (only) tasks = tasks.filter((t) => t.prefix === only);
  const token = process.env.GITHUB_TOKEN;
  const issues = token && repo ? await listIssues(token, repo) : [];
  if (!token || !repo) console.log('(no GITHUB_TOKEN/--repo: planning against an empty issue list)');
  const actions = plan(tasks, issues);
  const count = (k) => actions.filter((a) => a.kind === k).length;
  console.log(`${tasks.length} tasks, ${issues.length} roadmap issues → create ${count('create')}, update ${count('update')}, close ${count('close')}, mark-done ${count('mark-done')}`);
  if (!apply) {
    actions.slice(0, 30).forEach((a) => console.log(`  ${a.kind.padEnd(9)} ${a.id}${a.number ? ` #${a.number}` : ''}`));
    if (actions.length > 30) console.log(`  … ${actions.length - 30} more (dry run; pass --apply)`);
    process.exit(0);
  }
  if (!token || !repo) throw new Error('--apply needs GITHUB_TOKEN and --repo owner/name');
  for (const a of actions) {
    if (a.kind === 'create') {
      const { data } = await gh(token, 'POST', `/repos/${repo}/issues`, { title: a.title, body: a.body, labels: a.labels });
      if (a.close) await gh(token, 'PATCH', `/repos/${repo}/issues/${data.number}`, { state: 'closed', state_reason: 'completed' });
    } else if (a.kind === 'update') await gh(token, 'PATCH', `/repos/${repo}/issues/${a.number}`, { title: a.title, labels: a.labels });
    else if (a.kind === 'close') await gh(token, 'PATCH', `/repos/${repo}/issues/${a.number}`, { state: 'closed', state_reason: 'completed' });
  }
  markDone(ROOT, actions);
  console.log('applied');
}
