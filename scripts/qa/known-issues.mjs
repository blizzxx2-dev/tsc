// Known-issues list for a public build (QAT-0091): every open issue labelled `known-issue`, grouped by severity,
// with the player-facing summary and workaround taken from the issue body sections
// "### Player-facing summary" and "### Workaround" (add them when labelling).
// Usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/qa/known-issues.mjs <build-id>
import { writeFileSync } from 'node:fs';
import { paginate, repo } from './gh.mjs';

const build = process.argv[2];
if (!build) {
  console.error('usage: node scripts/qa/known-issues.mjs <build-id>');
  process.exit(2);
}
const section = (body, title) => new RegExp(`###\\s*${title}\\s*\\n+([\\s\\S]*?)(?=\\n###|$)`, 'i').exec(body ?? '')?.[1].trim();
const issues = (await paginate(`/repos/${repo()}/issues?state=open&labels=known-issue`)).filter((i) => !i.pull_request);
const sevOf = (i) => ['S1', 'S2', 'S3', 'S4'].find((s) => i.labels.some((l) => l.name === s)) ?? 'S4';
const groups = { S1: 'Serious', S2: 'Major', S3: 'Minor', S4: 'Cosmetic' };

let md = `# Known issues — ${build}\n\nLast updated ${new Date().toISOString().slice(0, 10)}. Pinned on the Steam discussions and Discord #known-issues.\nReport new problems with **F8** in game or in the Steam forum "Bug Reports".\n`;
for (const [sev, label] of Object.entries(groups)) {
  const list = issues.filter((i) => sevOf(i) === sev);
  if (!list.length) continue;
  md += `\n## ${label}\n\n`;
  for (const i of list) {
    const summary = section(i.body, 'Player-facing summary') ?? i.title;
    const workaround = section(i.body, 'Workaround');
    md += `- ${summary}${workaround ? ` — *Workaround:* ${workaround}` : ''} (ref #${i.number})\n`;
  }
}
if (!issues.length) md += '\nNo known issues for this build.\n';
writeFileSync('docs/qa/known-issues.md', md);
console.log(`docs/qa/known-issues.md: ${issues.length} known issue(s) for ${build}`);
