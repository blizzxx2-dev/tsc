// Weekly QA metrics (QAT-0089 trend chart, QAT-0092 metrics): open bugs by severity and area,
// found vs fixed per week, reopen rate and escaped defects (first reported by players: `community`)
// per build. Writes reports/qa-metrics.md (with a Mermaid trend chart) for the weekly status note
// and the job summary. Usage: node scripts/qa/bug-metrics.mjs [weeks=8]
import { mkdirSync, writeFileSync } from 'node:fs';
import { paginate, repo, summary } from './gh.mjs';

const WEEKS = Number(process.argv[2] ?? 8);
const SEVS = ['S1', 'S2', 'S3', 'S4'];
const issues = (await paginate(`/repos/${repo()}/issues?state=all&since=${new Date(Date.now() - WEEKS * 7 * 864e5 - 365 * 864e5).toISOString()}`)).filter(
  (i) => !i.pull_request && i.labels.some((l) => SEVS.includes(l.name)),
);
const labels = (i) => i.labels.map((l) => l.name);
const sev = (i) => SEVS.find((s) => labels(i).includes(s));
const area = (i) =>
  labels(i)
    .find((l) => l.startsWith('area:'))
    ?.slice(5) ?? 'none';
const foundIn = (i) => /found in[^\n]*?\b(\d+\.\d+\.\d+[\w.+-]*)/i.exec(i.body ?? '')?.[1] ?? 'unknown';

const open = issues.filter((i) => i.state === 'open');
const table = (rows, keys) => `| ${keys.join(' | ')} |\n|${keys.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;

let md = `## QA metrics — ${new Date().toISOString().slice(0, 10)}\n\n### Open bugs by severity\n\n`;
md += table([SEVS.map((s) => String(open.filter((i) => sev(i) === s).length))], SEVS);
const areas = [...new Set(open.map(area))].sort();
md +=
  `\n### Open bugs by area\n\n` +
  table(
    areas.map((a) => [a, ...SEVS.map((s) => String(open.filter((i) => area(i) === a && sev(i) === s).length))]),
    ['Area', ...SEVS],
  );

// Found vs fixed per ISO week.
const weekStart = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};
const weeks = [];
for (let w = WEEKS - 1; w >= 0; w--) weeks.push(weekStart(Date.now() - w * 7 * 864e5));
const found = weeks.map((w) => issues.filter((i) => weekStart(i.created_at) === w).length);
const fixed = weeks.map((w) => issues.filter((i) => i.closed_at && i.state_reason !== 'not_planned' && weekStart(i.closed_at) === w).length);
md +=
  `\n### Find vs fix rate\n\n` +
  table(
    weeks.map((w, k) => [w, String(found[k]), String(fixed[k])]),
    ['Week of', 'Found', 'Fixed'],
  );
md += `\n\`\`\`mermaid\nxychart-beta\n  title "Bugs found vs fixed per week"\n  x-axis [${weeks.map((w) => `"${w.slice(5)}"`).join(', ')}]\n  y-axis "Bugs"\n  line [${found.join(', ')}]\n  bar [${fixed.join(', ')}]\n\`\`\`\n_Line: found. Bars: fixed._\n`;

const closed = issues.filter((i) => i.state === 'closed');
const reopened = issues.filter((i) => labels(i).includes('regression') || (i.state === 'open' && i.closed_at));
md += `\n### Reopen rate\n\n${closed.length ? ((reopened.length / closed.length) * 100).toFixed(1) : '0.0'} % (${reopened.length} reopened or regressed / ${closed.length} closed)\n`;

const builds = [...new Set(issues.map(foundIn))].sort();
md +=
  `\n### Escaped defects per build (first reported by players)\n\n` +
  table(
    builds.map((b) => [
      b,
      String(issues.filter((i) => foundIn(i) === b).length),
      String(issues.filter((i) => foundIn(i) === b && labels(i).includes('community')).length),
    ]),
    ['Found in', 'All bugs', 'Escaped (community)'],
  );

mkdirSync('reports', { recursive: true });
writeFileSync('reports/qa-metrics.md', md);
await summary(md);
