/** Demo gameplay roadmap checks (GAM-*) that scan content or drive the sim directly. */
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import type { OperationDef } from '../src/surgery/operation';
import { TOOL_INFO } from '../src/surgery/types';
import { opData, type EntitySpec } from '../src/content/schema';
import { SALVE_MAX } from '../src/surgery/entities';
import { playWithBot } from './bot';
import { RANK_TABLE } from '../src/surgery/ranks';

const demoOps = (): OperationDef[] => [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));
const callouts = (d: OperationDef): string[] => [...d.phases.flatMap((p) => p.callout ?? []), ...(d.events ?? []).flatMap((e) => e.say ?? [])];

const byId = (id: string) => demoOps().find((d) => d.id === id)!;
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('GAM-J per-operation tuning', () => {
  it('GAM-0191: op1-1 — two cuts and one pool, nothing hidden; novice min vitals ≥ 60; steady uses ≤ 50 % of the time', () => {
    const data = opData(byId('op1-1'))!;
    const specs = data.phases.flatMap((p) => (p.spawn ?? []) as readonly EntitySpec[]);
    const deep = specs.filter((s) => s.e === 'laceration' && s.len > SALVE_MAX);
    expect(deep.length).toBe(2);
    expect(specs.filter((s) => s.e === 'pool').length).toBe(1);
    // Everything else is a salve nick (the Saint's Salve lesson), and nothing hides from the eye.
    expect(specs.filter((s) => s.e !== 'pool' && !deep.includes(s)).every((s) => s.e === 'laceration' && s.len <= SALVE_MAX)).toBe(true);
    expect(specs.some((s) => 'hidden' in s && s.hidden)).toBe(false);
    for (const s of seeds(5)) {
      const novice = playWithBot(byId('op1-1'), { profile: 'novice', seed: 11000 + s, botSeed: s }).op;
      expect(novice.status).toBe('won');
      expect(novice.minVitals, `seed ${s}`).toBeGreaterThanOrEqual(60);
    }
    const steady = playWithBot(byId('op1-1'), { profile: 'steady' }).op;
    expect(steady.timeLimit - steady.timeLeft).toBeLessThanOrEqual(steady.timeLimit * 0.5);
  });
});

describe('GAM-J per-operation tuning (op1-2)', () => {
  it('GAM-0192: op1-2 — the barb nick is taught; a sloppy bot that skips it still wins at B/C; ranks match the calibration', () => {
    const def = byId('op1-2');
    expect(callouts(def).some((l) => /Lancet first — two nicks/.test(l))).toBe(true);
    for (const s of seeds(6)) {
      const labels: string[] = [];
      const op = playWithBot(def, {
        profile: 'sloppy',
        mistakes: ['nick'],
        seed: 12000 + s,
        botSeed: s,
        collect: (e) => e.kind === 'rated' && e.label && labels.push(e.label),
      }).op;
      expect(labels).toContain('Torn');
      expect(op.status, `seed ${s}`).toBe('won');
      expect(['B', 'C'], `seed ${s}`).toContain(op.rank());
    }
    // S = 96 % of the steady bot (tests/balance.test.ts CALIBRATE), A = 80 % of S, B = 60 % of S.
    const steady = playWithBot(def, { profile: 'steady' }).op;
    const S = Math.round((steady.score * 0.96) / 10) * 10;
    expect(RANK_TABLE['op1-2']).toEqual({ S, A: Math.round((S * 0.8) / 10) * 10, B: Math.round((S * 0.6) / 10) * 10 });
    expect(steady.rank()).toBe('S');
  });
});

describe('GAM-0252: callout audit', () => {
  const alias = /\b(?:lancet|tongs|leech(?:-pipe)?|thread|salve|tincture|brand|lens)\b/i;
  it('every demo op callout is ≤ 90 characters and names instruments by their TOOL_INFO display names', () => {
    for (const d of demoOps()) {
      for (const line of callouts(d)) {
        expect(line.length, `${d.id}: ${line}`).toBeLessThanOrEqual(90);
        // Strip every display name; any instrument word left over is an off-book name ("the brand", "gut thread").
        const rest = TOOL_INFO.reduce((s, t) => s.split(t.name).join('·'), line);
        expect(rest, `${d.id}: ${line}`).not.toMatch(alias);
      }
    }
  });
});
