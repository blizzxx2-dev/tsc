import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN } from '../src/content/campaign';
import { Laceration } from '../src/surgery/entities';
import { Operation, type OperationDef } from '../src/surgery/operation';
import { at, start, wait } from './harness';
import { playWithBot } from './bot';

const regions = [
  { kind: 'flesh' as const, ...at(-200, 0), rx: 200, ry: 200 },
  { kind: 'flesh' as const, ...at(200, 0), rx: 200, ry: 200 },
];

describe('two-patient triage (GAM-0248)', () => {
  it('each cot drains its own patient', () => {
    const op = start(() => [new Laceration(at(200, 0), 0, 60, 2)], { second: { patient: 'B' }, regions });
    const v1 = op.vitals;
    const v2 = op.vitals2!;
    wait(op, 5);
    expect(op.vitals2!).toBeLessThan(v2 - 5);
    expect(op.vitals).toBeGreaterThanOrEqual(v1 - 1);
    expect(op.patientAt(at(190, 10))).toBe(2);
    expect(op.patientAt(at(-190, 10))).toBe(1);
  });

  it('the operation is lost when the second patient dies, even with the first well', () => {
    const op = start(() => [new Laceration(at(200, 0), 0, 60, 6), new Laceration(at(-200, 0), 0, 20, 0)], { second: { patient: 'B', vitals: 20 }, regions });
    wait(op, 30);
    expect(op.status).toBe('lost');
    expect(op.lostCause).toBe('vitals2');
    expect(op.vitals).toBeGreaterThan(50);
  });

  it('single-patient ops have no second vitals', () => {
    expect(start(() => [new Laceration(at(0, 0), 0, 60, 1)]).vitals2).toBeNull();
  });

  it('The Two Cots follows the Gorget raid in Chapter IV and a steady surgeon saves both', () => {
    const ch4 = FULL_CAMPAIGN[3];
    const ids = ch4.steps.flatMap((s) => (s.kind === 'op' ? [s.op.id] : []));
    expect(ids.indexOf('op4-10')).toBe(ids.indexOf('op4-1') + 1);
    const def = ch4.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])).find((d) => d.id === 'op4-10') as OperationDef;
    expect(new Operation(def).vitals2).toBe(80);
    const op = playWithBot(def, { profile: 'steady' }).op;
    expect(op.status).toBe('won');
    expect(op.vitals2!).toBeGreaterThan(0);
  });
});
