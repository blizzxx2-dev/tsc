/**
 * Headless operation simulator (CON-0014) and phase timeline report (CON-0017).
 *
 *   npm run sim -- op2-3                       steady bot, 5 seeds
 *   npm run sim -- op2-3 --bot novice --seeds 10
 *   npm run sim -- op3-12 --bot expert --html out/op3-12.html
 *   npm run sim -- all --seeds 3               every campaign operation
 *
 * Prints score, clear time, rank and the lowest vitals per seed; `--html` writes a timeline of
 * each phase's duration and how many entities it put on the table.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { allCampaignOperations } from '../src/content/campaign';
import type { OperationDef } from '../src/surgery/operation';
import { playWithBot, type Profile } from '../tests/bot';

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const target = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true) ?? 'op1-1';
const bot = opt('bot', 'steady') as Profile;
const seeds = Number(opt('seeds', '5'));
const html = opt('html', '');

const ops: OperationDef[] = target === 'all' ? allCampaignOperations() : allCampaignOperations().filter((d) => d.id === target);
if (!ops.length) {
  console.error(`no operation "${target}" (try op1-1 … op5-10, or all)`);
  process.exit(1);
}

interface Row {
  op: string;
  seed: number;
  status: string;
  score: number;
  time: number;
  rank: string;
  minVitals: number;
  phases: { t: number; entities: number }[];
}
const rows: Row[] = [];
for (const def of ops) {
  for (let s = 1; s <= seeds; s++) {
    const phases: { t: number; entities: number }[] = [];
    let lastPhase = -1;
    let phaseStart = 0;
    const res = playWithBot(def, {
      profile: bot,
      seed: (def.seed ?? 1) * 1000 + s,
      botSeed: s,
      onFrame: (op) => {
        if (op.phase !== lastPhase) {
          if (lastPhase >= 0) phases[phases.length - 1].t = op.elapsed - phaseStart;
          phases.push({ t: 0, entities: op.entities.filter((e) => e.alive && e.required).length });
          lastPhase = op.phase;
          phaseStart = op.elapsed;
        }
      },
    }).op;
    if (phases.length) phases[phases.length - 1].t = res.elapsed - phaseStart;
    rows.push({
      op: def.id,
      seed: s,
      status: res.status,
      score: res.score,
      time: res.elapsed,
      rank: res.status === 'won' ? res.rank() : '—',
      minVitals: res.minVitals,
      phases,
    });
  }
}

const pad = (v: string | number, n: number) => String(v).padEnd(n);
console.log(`${pad('op', 10)}${pad('seed', 6)}${pad('result', 8)}${pad('score', 8)}${pad('time', 8)}${pad('rank', 6)}min vitals`);
for (const r of rows)
  console.log(`${pad(r.op, 10)}${pad(r.seed, 6)}${pad(r.status, 8)}${pad(r.score, 8)}${pad(r.time.toFixed(1), 8)}${pad(r.rank, 6)}${Math.round(r.minVitals)}`);
const won = rows.filter((r) => r.status === 'won').length;
console.log(`\n${bot}: ${won}/${rows.length} won`);

if (html) {
  const colours = ['#c8a060', '#9fd3a8', '#a0a8c8', '#d05040', '#c8b070', '#b060ff', '#d08a50'];
  const scale = 3;
  const body = rows
    .map((r) => {
      let x = 0;
      const bars = r.phases
        .map((p, i) => {
          const w = Math.max(1, p.t * scale);
          const bar = `<rect x="${x}" y="0" width="${w}" height="18" fill="${colours[i % colours.length]}"><title>phase ${i + 1}: ${p.t.toFixed(1)} s, ${p.entities} to treat</title></rect>`;
          x += w;
          return bar;
        })
        .join('');
      return `<tr><td>${r.op}</td><td>${r.seed}</td><td>${r.status}</td><td>${r.rank}</td><td><svg width="${x + 4}" height="18">${bars}</svg> ${r.time.toFixed(0)} s</td></tr>`;
    })
    .join('\n');
  const page = `<!doctype html><meta charset="utf-8"><title>Phase timeline — ${target}</title><style>body{font:14px system-ui;background:#1a1410;color:#e8dcc0;padding:16px}td{padding:2px 8px}</style><h1>Phase timeline — ${target} (${bot})</h1><table>${body}</table>`;
  mkdirSync(dirname(html), { recursive: true });
  writeFileSync(html, page);
  console.log(`timeline written to ${html}`);
}
