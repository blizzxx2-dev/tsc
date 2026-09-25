// Steam patch-notes draft from conventional commits (PLT-0148).
//   node scripts/changelog.mjs [fromRef] [toRef=HEAD] [--edition=demo|full]
// Groups feat/fix/perf (player-facing) and drops chore/ci/docs/test/refactor/build. The draft is
// written to stdout in Steam's BBCode dialect for pasting into an event/announcement.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const edition = process.argv.find((a) => a.startsWith('--edition='))?.split('=')[1] ?? 'demo';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
let from = args[0];
if (!from) {
  try {
    from = git('describe', '--tags', '--abbrev=0', '--match', `${edition}-v*`);
  } catch {
    from = git('rev-list', '--max-parents=0', 'HEAD').split('\n')[0];
  }
}
const to = args[1] ?? 'HEAD';
const version = JSON.parse(readFileSync('versions.json', 'utf8'))[edition];

const SECTIONS = { feat: 'New', fix: 'Fixed', perf: 'Performance' };
const groups = { feat: [], fix: [], perf: [] };
const re = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
for (const line of git('log', '--no-merges', '--format=%s', `${from}..${to}`).split('\n').filter(Boolean)) {
  const m = re.exec(line);
  if (!m || !(m[1] in groups)) continue;
  const scope = m[2] && !['platform', 'ci', 'build'].includes(m[2]) ? `${m[2][0].toUpperCase()}${m[2].slice(1)}: ` : '';
  groups[m[1]].push(`${scope}${m[4][0].toUpperCase()}${m[4].slice(1)}`);
}
const out = [`[h2]Suture & Steel ${edition === 'demo' ? 'Demo ' : ''}${version}[/h2]`, ''];
for (const [k, title] of Object.entries(SECTIONS)) {
  if (!groups[k].length) continue;
  out.push(`[h3]${title}[/h3]`, '[list]', ...groups[k].map((s) => `[*]${s}`), '[/list]', '');
}
if (out.length === 2) out.push('Minor stability improvements.');
console.log(out.join('\n'));
