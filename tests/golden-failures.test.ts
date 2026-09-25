import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import type { OperationDef } from '../src/surgery/operation';
import { runLastSecondLitany, runTimerLoss, runVitalsLoss, type FailureFingerprint } from './helpers/failure-paths';

/**
 * Failure-path goldens (QAT-0054): for every demo operation a seeded loss by vitals and a seeded
 * loss by the timer, plus a last-second Litany replay for the two Malison fights (op1-5 Matins,
 * op2-5 Lauds). Each replay is a deterministic driver, so the decisive end state (cause, score,
 * vitals, time, ratings, phase reached) is regression-tested the same way the win goldens are.
 * Regenerate deliberately with UPDATE_GOLDEN=1 after an intended change.
 *
 * Replays:
 *  - `idle`      — no input at all: the patient drains (or, where nothing drains, the clock runs out);
 *  - `butcher`   — where an idle patient never drains, a surgeon who sears healthy flesh with the
 *                  brand (or slashes it with the lancet) until the patient dies;
 *  - `stall`     — a surgeon who only keeps the patient alive (red tincture whenever it is off
 *                  cooldown and vitals fall below 50) and never works: the clock runs out;
 *  - `short`     — where stalling cannot outlast the drain, the steady bot on a shortened clock
 *                  (`timeLimit × factor`, halved until the time runs out first);
 *  - `litany-1s` — the steady bot on that shortened clock, invoking the Litany when one second is
 *                  left, so the frozen-timer path at the last second is covered.
 */
const FILE = join(__dirname, 'golden/demo-failures.json');
const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));
const BOSSES = ['op1-5', 'op2-5'];

function fingerprints(def: OperationDef): Record<string, FailureFingerprint> {
  const out: Record<string, FailureFingerprint> = { vitals: runVitalsLoss(def), timer: runTimerLoss(def) };
  if (BOSSES.includes(def.id)) out.litany = runLastSecondLitany(def);
  return out;
}

describe('demo failure paths match their golden seeded outcomes', () => {
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
    it('writes the golden file', () => {
      writeFileSync(FILE, JSON.stringify(Object.fromEntries(demoOps.map((d) => [d.id, fingerprints(d)])), null, 1) + '\n');
      expect(existsSync(FILE)).toBe(true);
    });
    return;
  }
  const golden = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Record<string, FailureFingerprint>>;

  it('covers every demo operation with a vitals loss and a timer loss, and both Malison fights with a Litany replay', () => {
    expect(Object.keys(golden).sort()).toEqual(demoOps.map((d) => d.id).sort());
    for (const id of Object.keys(golden)) {
      expect(golden[id].vitals.status, `${id} vitals`).toBe('lost');
      expect(golden[id].vitals.lostCause, `${id} vitals`).toBe('vitals');
      expect(golden[id].timer.status, `${id} timer`).toBe('lost');
      expect(golden[id].timer.lostCause, `${id} timer`).toBe('time');
    }
    for (const id of BOSSES) {
      expect(golden[id].litany.litanyUses, `${id} litany`).toBe(1);
      expect(golden[id].litany.status, `${id} litany`).toMatch(/^(won|lost)$/);
    }
  });

  for (const def of demoOps) {
    it(`${def.id}: loss by vitals`, () => expect(runVitalsLoss(def)).toEqual(golden[def.id].vitals));
    it(`${def.id}: loss by timer`, () => expect(runTimerLoss(def)).toEqual(golden[def.id].timer));
    if (BOSSES.includes(def.id)) it(`${def.id}: last-second Litany`, () => expect(runLastSecondLitany(def)).toEqual(golden[def.id].litany));
  }
});
