/**
 * The Trials of the Guild (CON-0201…0222, CON-0248): every operation trial is won by the bot on four
 * seeds under its rules, and its committed rank thresholds (a RANK_TABLE row) are that bot's
 * calibration (CON-0203): S = 96 % of its score (within 1.5 %), A = 80 % of S, B = 60 % of S. The Office Entire is
 * calibrated on the expert, the rest on the steady hand.
 */
import { describe, expect, it } from 'vitest';
import { TRIALS, trialRun } from '../../src/content/trials';
import { rankThresholds } from '../../src/surgery/ranks';
import { playWithBot } from '../bot';

const round = (n: number) => Math.round(n / 10) * 10;
const LOST = ['op1-1', 'op2-3', 'op3-6', 'op4-2'];

describe('Trials of the Guild', () => {
  for (const x of TRIALS) {
    const run = trialRun(x, {}, LOST, true);
    if (!run) continue;
    it(`${x.id} — ${x.title}`, { timeout: 300_000 }, () => {
      const profile = x.id === 't22' ? 'expert' : 'steady';
      for (let s = 1; s <= 4; s++) expect(playWithBot(run.def, { ...run.opts, profile, seed: 7000 + s, botSeed: s }).op.status, `seed ${s}`).toBe('won');
      const op = playWithBot(run.def, { ...run.opts, profile }).op;
      const S = round(op.score * 0.96);
      if (process.env.CALIBRATE) console.log(`  '${run.def.id}': { S: ${S}, A: ${round(S * 0.8)}, B: ${round(S * 0.6)} },`);
      else {
        // Boss-add points are capped at a fraction of S, so the score leans on S itself; the fixed point
        // can sit between two rounded rows. Within 1.5 % is calibrated.
        const th = rankThresholds(run.def);
        expect(Math.abs(th.S - S) / S, `${run.def.id}: S ${th.S} vs ${S}`).toBeLessThan(0.015);
        expect(th, run.def.id).toEqual({ S: th.S, A: round(th.S * 0.8), B: round(th.S * 0.6) });
      }
    });
  }
});
