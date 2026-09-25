// Triage SLA watch (QAT-0089): S1 bugs must be acknowledged (labelled `triaged`, assigned, or
// commented on by a maintainer) within 24 h, S2 within 72 h. Breaches get the `sla-breach` label
// and one reminder comment. Runs hourly from .github/workflows/qa-triage.yml.
import { gh, paginate, repo } from './gh.mjs';

const SLA_HOURS = { S1: 24, S2: 72 };
const MAINTAINER = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const now = Date.now();

const acknowledged = async (issue) => {
  if (issue.labels.some((l) => l.name === 'triaged') || issue.assignees?.length) return true;
  const comments = await paginate(`/repos/${repo()}/issues/${issue.number}/comments`);
  return comments.some((c) => MAINTAINER.has(c.author_association));
};

let breaches = 0;
for (const [sev, hours] of Object.entries(SLA_HOURS)) {
  const issues = (await paginate(`/repos/${repo()}/issues?state=open&labels=${sev}`)).filter((i) => !i.pull_request);
  for (const issue of issues) {
    const age = (now - new Date(issue.created_at).getTime()) / 36e5;
    if (age < hours || issue.labels.some((l) => l.name === 'sla-breach')) continue;
    if (await acknowledged(issue)) continue;
    breaches++;
    await gh('POST', `/repos/${repo()}/issues/${issue.number}/labels`, { labels: ['sla-breach'] });
    await gh('POST', `/repos/${repo()}/issues/${issue.number}/comments`, {
      body: `⏰ This ${sev} bug has not been acknowledged within ${hours} h (docs/qa/bug-process.md § Triage). Please triage: confirm severity, set area, assign an owner.`,
    });
    console.log(`SLA breach: #${issue.number} (${sev}, ${Math.round(age)} h)`);
  }
}
console.log(`${breaches} new SLA breach(es)`);
