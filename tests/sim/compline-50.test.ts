/**
 * BOS-0142: Compline cleared by the steady bot on 50 seeds at every difficulty, inside its time limit.
 */
import { describe, expect, it } from 'vitest';
import { OP_5_8 } from '../../src/content/ops/hours';
import type { Difficulty } from '../../src/surgery/difficulty';
import { playWithBot } from '../bot';

describe('BOS-0142: Compline on 50 seeds', () => {
  for (const difficulty of ['novice', 'surgeon', 'master'] as Difficulty[]) {
    it(`steady clears every seed on ${difficulty}`, { timeout: 300_000 }, () => {
      let won = 0;
      let worst = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const op = playWithBot(OP_5_8, { seed: 5800 + seed, botSeed: seed, profile: 'steady', difficulty }).op;
        if (op.status === 'won') won++;
        worst = Math.max(worst, op.elapsed);
      }
      expect(won).toBe(50);
      expect(worst).toBeLessThan(OP_5_8.timeLimit);
    });
  }
});
