/** ENG-0058: the sim announces heavy mistakes as `impact` events; it never pauses itself. */
import { describe, expect, it } from 'vitest';
import { IMPACT_HARM } from '../../../src/surgery/operation';
import { C, start, wait } from '../../harness';

describe('impact events', () => {
  it('fires for mistakes costing at least 5 vitals and stays silent below', () => {
    const op = start();
    const impacts: { kind: string; amount: number }[] = [];
    op.events.on('impact', (e) => impacts.push({ kind: e.kind, amount: e.amount }));
    op.harm(IMPACT_HARM - 1, C);
    expect(impacts).toEqual([]);
    op.harm(IMPACT_HARM, C);
    expect(impacts).toHaveLength(1);
    expect(impacts[0].kind).toBe('harm');
    expect(impacts[0].amount).toBeGreaterThanOrEqual(IMPACT_HARM);
    // Plain vitals drain (bleeding) is not an impact.
    op.hurt(20, C);
    expect(impacts).toHaveLength(1);
  });

  it('does not change the simulation: vitals and time are the same with or without a listener', () => {
    const a = start();
    const b = start();
    b.events.on('impact', () => undefined);
    for (const op of [a, b]) {
      op.harm(8, C);
      wait(op, 2);
    }
    expect(b.vitals).toBe(a.vitals);
    expect(b.elapsed).toBe(a.elapsed);
    expect(b.timeLeft).toBe(a.timeLeft);
  });
});
