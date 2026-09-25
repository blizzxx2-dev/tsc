import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { playWithBot } from './bot';
import { describeRow, simReport, simRow } from './helpers/sim-report';

describe('every campaign operation is completable by the bot surgeon', () => {
  const report = simReport('operations');
  for (const def of allOperations()) {
    it(`${def.id} — ${def.title}`, () => {
      const { op } = playWithBot(def);
      const row = simRow(op);
      report.push(row);
      expect(op.status, describeRow(row)).toBe('won');
    });
  }
});
