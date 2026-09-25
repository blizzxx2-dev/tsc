import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTasks, readRoadmap } from '../scripts/ops/roadmap.mjs';
import { plan } from '../scripts/ops/roadmap-sync.mjs';
import { forecast, points } from '../scripts/ops/burnup.mjs';

const SAMPLE = `## Epic
- [ ] OPS-0001 · Demo · P0 · S · Two-week sprint cadence — planning, review
- [x] OPS-0002 · Demo · P1 · M · Sprint-review build — tagged build
- [ ] LOC-0010 · Beta · P2 · L · Something big — detail
not a task line
`;

type Issue = { number: number; title: string; state: 'open' | 'closed'; state_reason: string | null; labels: string[] };

/** Apply a plan to an in-memory issue list, as the GitHub calls would. */
function applyPlan(tasks: ReturnType<typeof parseTasks>, issues: Issue[], actions: ReturnType<typeof plan>): Issue[] {
  const out = issues.map((i) => ({ ...i, labels: [...i.labels] }));
  for (const a of actions) {
    if (a.kind === 'create') out.push({ number: out.length + 1, title: a.title ?? "", state: a.close ? 'closed' : 'open', state_reason: a.close ? 'completed' : null, labels: a.labels });
    const i = out.find((x) => x.number === a.number);
    if (a.kind === 'update' && i) Object.assign(i, { title: a.title ?? i.title, labels: a.labels });
    if (a.kind === 'close' && i) Object.assign(i, { state: 'closed', state_reason: 'completed' });
    if (a.kind === 'mark-done') {
      const t = tasks.find((x) => x.id === a.id);
      if (t) t.done = true;
    }
  }
  return out;
}

describe('roadmap parsing', () => {
  it('parses id, phase, priority, size, title and acceptance', () => {
    const t = parseTasks(SAMPLE, 'x.md');
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({ id: 'OPS-0001', phase: 'Demo', pri: 'P0', size: 'S', title: 'Two-week sprint cadence', acceptance: 'planning, review', done: false, line: 2 });
    expect(t[1].done).toBe(true);
  });

  it('reads every roadmap file without duplicates', () => {
    const all = readRoadmap(join(__dirname, '..'));
    expect(all.length).toBeGreaterThan(2000);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
  });
});

describe('roadmap → issue sync', () => {
  it('creates, then converges to an empty plan (idempotent)', () => {
    const tasks = parseTasks(SAMPLE, 'x.md');
    const first = plan(tasks, []);
    expect(first.filter((a) => a.kind === 'create')).toHaveLength(3);
    const issues = applyPlan(tasks, [], first);
    expect(plan(tasks, issues)).toEqual([]);
  });

  it('updates changed lines, closes done tasks, writes back GitHub-completed issues and keeps foreign labels', () => {
    const tasks = parseTasks(SAMPLE, 'x.md');
    let issues = applyPlan(tasks, [], plan(tasks, []));
    issues[0].labels.push('good first issue');
    issues[2].state = 'closed';
    issues[2].state_reason = 'completed';
    const changed = parseTasks(SAMPLE.replace('P0 · S · Two-week', 'P1 · S · Two-week').replace('- [ ] OPS-0001', '- [x] OPS-0001'), 'x.md');
    const actions = plan(changed, issues);
    expect(actions.map((a) => `${a.kind}:${a.id}`).sort()).toEqual(['close:OPS-0001', 'mark-done:LOC-0010', 'update:OPS-0001']);
    const upd = actions.find((a) => a.kind === 'update')!;
    expect(upd.labels).toContain('good first issue');
    expect(upd.labels).toContain('P1');
    expect(upd.labels).not.toContain('P0');
    issues = applyPlan(changed, issues, actions);
    expect(plan(changed, issues)).toEqual([]);
  });

  it('leaves issues closed as not planned alone', () => {
    const tasks = parseTasks(SAMPLE, 'x.md');
    const issues = applyPlan(tasks, [], plan(tasks, []));
    issues[0].state = 'closed';
    issues[0].state_reason = 'not_planned';
    expect(plan(tasks, issues)).toEqual([]);
  });
});

describe('burn-up', () => {
  it('weights S/M/L as 1/3/8', () => {
    const p = points(parseTasks(SAMPLE));
    expect(p.Demo).toEqual({ total: 4, done: 3 });
    expect(p.Beta).toEqual({ total: 8, done: 0 });
  });

  it('forecasts from mean weekly velocity', () => {
    const today = new Date('2026-10-26T00:00:00Z');
    const f = forecast(
      [
        { date: '2026-09-28', done: 0, total: 100 },
        { date: '2026-10-05', done: 10, total: 100 },
        { date: '2026-10-12', done: 20, total: 100 },
        { date: '2026-10-19', done: 30, total: 100 },
        { date: '2026-10-26', done: 40, total: 100 },
      ],
      today,
    );
    expect(f.velocity).toBeCloseTo(10);
    expect(f.date!.toISOString().slice(0, 10)).toBe('2026-12-07');
    expect(forecast([{ date: '2026-10-26', done: 0, total: 5 }], today).date).toBeNull();
  });
});
