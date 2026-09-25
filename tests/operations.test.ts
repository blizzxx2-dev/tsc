import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { playWithBot } from './bot';

describe('every campaign operation is completable by the bot surgeon', () => {
  for (const def of allOperations()) {
    it(`${def.id} — ${def.title}`, () => {
      const { op } = playWithBot(def);
      const summary = `${def.id}: ${op.status} ${op.lostReason} score=${op.score} rank=${op.rank()} vitals=${Math.round(op.vitals)} time=${Math.round(op.timeLeft)}s counts=${JSON.stringify(op.counts)} phase=${op.phase}/${op.phaseCount} left=${op.entities.map((e) => e.constructor.name).join(',')}`;
      console.log(summary);
      expect(op.status, summary).toBe('won');
    });
  }
});
