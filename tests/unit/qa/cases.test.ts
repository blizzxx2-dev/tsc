/**
 * QAT-0130: the manual test-case repository stays well-formed — stable unique ids, valid priorities and
 * tags, and budgets: the `regression` set fits one tester in 4 h, the `smoke` set in 60 min.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = 'docs/qa/cases';

interface Case {
  id: string;
  file: string;
  pri: string;
  tags: string[];
  minutes: number;
}

function parse(): Case[] {
  const out: Case[] = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const text = readFileSync(`${DIR}/${file}`, 'utf8');
    const mult = Number(/<!-- multiplier: (\d+) -->/.exec(text)?.[1] ?? 1);
    for (const line of text.split('\n')) {
      const m = /^\| (TC-[A-Z]+-\d{3}) \| ([^|]+) \| (P[0-3]) \| ([a-z,]+) \| (\d+)(?: ×(\d+))? \|/.exec(line);
      if (!m) {
        expect(line.startsWith('| TC-'), `${file}: malformed case row: ${line.slice(0, 60)}`).toBe(false);
        continue;
      }
      out.push({ id: m[1], file, pri: m[3], tags: m[4].split(','), minutes: Number(m[5]) * Number(m[6] ?? mult) });
    }
  }
  return out;
}

describe('test-case repository', () => {
  const cases = parse();

  it('has every demo suite', () => {
    const prefixes = new Set(cases.map((c) => c.id.split('-')[1]));
    for (const p of ['FE', 'STORY', 'OP', 'TUT', 'SAVE', 'OPT', 'AUD', 'END', 'STEAM']) expect(prefixes).toContain(p);
  });

  it('ids are unique and belong to their file', () => {
    const ids = cases.map((c) => c.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    for (const c of cases)
      expect(
        cases.filter((d) => d.id.split('-')[1] === c.id.split('-')[1]).every((d) => d.file === c.file),
        c.id,
      ).toBe(true);
  });

  it('tags are smoke / regression / full only', () => {
    for (const c of cases) for (const t of c.tags) expect(['smoke', 'regression', 'full'], `${c.id} tag ${t}`).toContain(t);
  });

  it('the regression set runs in 4 h or less for one tester; smoke in 60 min', () => {
    const total = (tag: string) => cases.filter((c) => c.tags.includes(tag)).reduce((n, c) => n + c.minutes, 0);
    expect(total('regression')).toBeLessThanOrEqual(240);
    expect(total('regression')).toBeGreaterThan(120);
    expect(total('smoke')).toBeLessThanOrEqual(60);
  });
});
