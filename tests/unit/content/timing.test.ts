import { describe, expect, it } from 'vitest';
import { judgeTiming, latencyFromTaps, TIMING } from '../../../src/surgery/timing';

describe('rhythm timing windows (INP-0111)', () => {
  it('±60 ms COOL, ±120 ms GOOD, measured after the latency is taken off', () => {
    expect(judgeTiming(0.05)).toBe('cool');
    expect(judgeTiming(-0.1)).toBe('good');
    expect(judgeTiming(0.15)).toBeNull();
    expect(judgeTiming(0.15, 120)).toBe('cool');
    expect(judgeTiming(TIMING.good + 0.2, 200)).toBe('good');
  });

  it('calibration takes the median lateness of the taps, to 10 ms', () => {
    const beats = [0, 0.8, 1.6, 2.4, 3.2];
    expect(latencyFromTaps([0.12, 0.91, 1.73, 2.52, 3.3], beats)).toBe(120);
    expect(latencyFromTaps([], beats)).toBe(0);
  });
});

describe('stone chipping (INP-0112)', () => {
  it('with simple gestures, resting the lancet on the next crack point chips it', async () => {
    const { Petrification } = await import('../../../src/surgery/ailments/petrification');
    const { at, Hand, running } = await import('../../harness-gameplay');
    const op = running((o) => [new Petrification(at(0, 0), o, at(150, 0), 1)], {}, { assists: { simpleGestures: true } });
    const st = op.entities[0] as InstanceType<typeof Petrification>;
    const plate = st.plates[0];
    const h = new Hand(op);
    h.press('lancet', plate.nodes[0]);
    expect(plate.chipped).toBe(1);
    h.hold('lancet', plate.nodes[1], 0.4);
    expect(plate.chipped).toBe(2);
  });
});
