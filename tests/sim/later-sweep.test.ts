/**
 * Chapter III–V op tuning (GAM-0200, GAM-0201, GAM-0202): every operation passes the 20-seed
 * steady/novice sweep (steady wins every seed, novice ≥ 95 %), and its committed rank thresholds
 * (the content's `ranks`, or a RANK_TABLE row) are the calibration of the steady bot:
 * S = 96 % of its score, A = 80 % of S, B = 60 % of S (tests/balance.test.ts CALIBRATE).
 */
import { describe, expect, it } from 'vitest';
import { LATER_CHAPTERS } from '../../src/content/later';
import type { OperationDef } from '../../src/surgery/operation';
import { rankThresholds } from '../../src/surgery/ranks';
import { playWithBot } from '../bot';

const SEEDS = 20;
const round = (n: number) => Math.round(n / 10) * 10;
const TASK: Record<string, string> = { ch3: 'GAM-0200', ch4: 'GAM-0201', ch5: 'GAM-0202' };

for (const ch of LATER_CHAPTERS) {
  const ops = ch.steps.flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));
  describe(`${TASK[ch.id]}: ${ch.id} op tuning`, () => {
    for (const def of ops) {
      it(`${def.id} — ${def.title}`, { timeout: 120_000 }, () => {
        let steady = 0;
        let novice = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const opts = { seed: (def.seed ?? 1) * 1000 + seed, botSeed: seed };
          if (playWithBot(def, { ...opts, profile: 'steady' }).op.status === 'won') steady++;
          if (playWithBot(def, { ...opts, profile: 'novice' }).op.status === 'won') novice++;
        }
        expect(steady, `${def.id} steady`).toBe(SEEDS);
        expect(novice / SEEDS, `${def.id} novice`).toBeGreaterThanOrEqual(0.95);
        const run = playWithBot(def, { profile: 'steady' }).op;
        const S = round(run.score * 0.96);
        expect(rankThresholds(def), `${def.id} thresholds`).toEqual({ S, A: round(S * 0.8), B: round(S * 0.6) });
      });
    }
  });
}
