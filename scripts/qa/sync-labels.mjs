// Label sync (QAT-0087): creates or updates every label in .github/labels.json. Never deletes labels.
// Usage (Actions, or locally with GITHUB_TOKEN + GITHUB_REPOSITORY): node scripts/qa/sync-labels.mjs
import { readFileSync } from 'node:fs';
import { gh, paginate, repo } from './gh.mjs';

const wanted = JSON.parse(readFileSync('.github/labels.json', 'utf8'));
const have = new Map((await paginate(`/repos/${repo()}/labels`)).map((l) => [l.name.toLowerCase(), l]));
for (const l of wanted) {
  const cur = have.get(l.name.toLowerCase());
  if (!cur) {
    await gh('POST', `/repos/${repo()}/labels`, l);
    console.log(`created ${l.name}`);
  } else if (cur.color !== l.color || (cur.description ?? '') !== l.description) {
    await gh('PATCH', `/repos/${repo()}/labels/${encodeURIComponent(cur.name)}`, { new_name: l.name, color: l.color, description: l.description });
    console.log(`updated ${l.name}`);
  }
}
console.log(`${wanted.length} labels in sync`);
