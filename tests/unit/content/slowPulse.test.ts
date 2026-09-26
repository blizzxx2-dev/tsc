/** CON-0154/0155: the dead man's pulse — vitals move only on a beat until the stilled heart restarts. */
import { describe, expect, it } from 'vitest';
import { OP_4_5 } from '../../../src/content/chapter4';
import { StilledHeart } from '../../../src/surgery/ailments/vennmark';
import { Operation } from '../../../src/surgery/operation';
import { DT, start, wait } from '../../harness';

describe('slow-pulse vitals', () => {
  it('holds the drain between beats and lands it on the beat', () => {
    // A stilled heart keeps the operation running (an empty field is won at once).
    const op = start(() => [new StilledHeart({ x: 640, y: 360 })], { slowPulse: 6, baseDrain: 1 });
    const steps: number[] = [];
    let last = op.vitals;
    for (let t = 0; t < 30; t += DT) {
      op.update(DT);
      if (op.vitals !== last) steps.push(op.elapsed);
      last = op.vitals;
    }
    // The vitals only ever move in a few single-frame steps, six seconds apart.
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < steps.length; i++) expect(steps[i] - steps[i - 1]).toBeCloseTo(6, 0);
    expect(op.vitals).toBeLessThan(op.maxVitals - 5);
  });

  it('ends when the stilled heart is restarted, and the held drain lands then', () => {
    const op = start(() => [new StilledHeart({ x: 640, y: 360 })], { slowPulse: 6, baseDrain: 1 });
    wait(op, 20);
    wait(op, 3);
    const v = op.vitals;
    op.endSlowPulse();
    expect(op.slowPulseEvery).toBe(0);
    expect(op.vitals).toBeLessThan(v - 1);
    const after = op.vitals;
    wait(op, 1);
    expect(op.vitals).toBeLessThan(after);
  });

  it('the stilled heart beats with the patient’s own pulse', () => {
    const op = start(() => [new StilledHeart({ x: 640, y: 360 })], { slowPulse: 6 });
    const heart = op.entities.find((e): e is StilledHeart => e instanceof StilledHeart)!;
    wait(op, 2.5);
    expect(heart.every).toBe(6);
    expect(Math.abs(heart.beatT - op.slowPulseClock)).toBeLessThanOrEqual(DT + 1e-9);
  });

  it('op4-5 opens with a six-second pulse', () => {
    const op = new Operation(OP_4_5);
    while (op.status === 'intro') op.update(DT);
    expect(op.slowPulseEvery).toBe(6);
  });
});
