import { describe, expect, it } from 'vitest';
import { allCampaignOperations as allOperations } from '../src/content/campaign';
import { playWithBot } from './bot';
import { simReport, simRow } from './helpers/sim-report';
import { X_OPS, xOpDef, xOpOptions } from '../src/content/challenge';

/**
 * Balance guard-rails, using the bot surgeon at two paces:
 * - "steady" (1.0 s to read/aim before each gesture) must win with time to spare and rank B–S (never a free XS);
 * - "novice" (1.5 s per gesture) must still be able to save the patient.
 */
describe('demo balance', () => {
  const report = simReport('balance');
  for (const def of allOperations()) {
    it(`${def.id} — ${def.title}`, () => {
      const steady = playWithBot(def, { think: 1.0 }).op;
      const novice = playWithBot(def, { think: 1.5 }).op;
      const used = def.timeLimit - steady.timeLeft;
      const info = `${def.id}: steady ${steady.status} ${steady.score} ${steady.rank()} used=${Math.round(used)}s; novice ${novice.status} v=${Math.round(novice.vitals)}`;
      report.push(simRow(steady, { pace: 'steady', usedSeconds: Math.round(used), novice: { status: novice.status, score: novice.score, rank: novice.rank(), vitals: Math.round(novice.vitals) } }));
      expect(steady.status, info).toBe('won');
      expect(used, info).toBeLessThan(def.timeLimit * 0.75);
      expect(['S', 'A', 'B'], info).toContain(steady.rank());
      expect(novice.status, info).toBe('won');
    });
  }
});

/**
 * Prints rank thresholds for src/surgery/ranks.ts. Run with CALIBRATE=1 npx vitest run tests/balance.test.ts
 * S = 96 % of the steady bot (so steady ranks S but never a free XS: XS needs 1.05 × S ≈ 1.008 × steady),
 * A = 80 % of S, B = 60 % of S.
 */
// eslint-disable-next-line vitest/expect-expect -- a calibration printout, not a check
it.runIf(process.env.CALIBRATE)('calibrate rank thresholds', () => {
  const round = (n: number) => Math.round(n / 10) * 10;
  for (const def of allOperations()) {
    const steady = playWithBot(def, { profile: 'steady' }).op;
    const S = round(steady.score * 0.96);
    console.log(`  '${def.id}': { S: ${S}, A: ${round(S * 0.8)}, B: ${round(S * 0.6)} }, // steady ${steady.status} ${steady.score}`);
  }
  for (const x of X_OPS.filter((xx) => xx.base)) {
    const def = xOpDef(x);
    const steady = playWithBot(def, { profile: 'steady', ...xOpOptions(x) }).op;
    const S = round(steady.score * 0.96);
    console.log(`  '${def.id}': { S: ${S}, A: ${round(S * 0.8)}, B: ${round(S * 0.6)} }, // steady ${steady.status} ${steady.score}`);
  }
});
