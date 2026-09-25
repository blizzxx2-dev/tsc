// Minimal GitHub REST helper for the QA workflows (no third-party actions needed).
// Needs GITHUB_TOKEN and GITHUB_REPOSITORY (owner/repo), both provided by GitHub Actions.

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';

export function repo() {
  const r = process.env.GITHUB_REPOSITORY;
  if (!r) throw new Error('GITHUB_REPOSITORY is not set');
  return r;
}

export async function gh(method, path, body) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** All pages of a list endpoint. */
export async function paginate(path) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const items = await gh('GET', `${path}${sep}per_page=100&page=${page}`);
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

/**
 * Open an issue with `title` and `labels`, or comment on the open one with the same title
 * (so a recurring failure is tracked in one place). Returns the issue number.
 */
export async function upsertIssue(title, body, labels) {
  const open = await paginate(`/repos/${repo()}/issues?state=open&labels=${encodeURIComponent(labels[0])}`);
  const existing = open.find((i) => i.title === title && !i.pull_request);
  if (existing) {
    await gh('POST', `/repos/${repo()}/issues/${existing.number}/comments`, { body });
    return existing.number;
  }
  const created = await gh('POST', `/repos/${repo()}/issues`, { title, body, labels });
  return created.number;
}

/** Append markdown to the job summary when running in Actions (stdout otherwise). */
export async function summary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(file, markdown + '\n');
  } else console.log(markdown);
}

export const runUrl = () =>
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '(local run)';
