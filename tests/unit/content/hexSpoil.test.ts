/** CON-0061: flesh spoils around an unfound hexstone — a rot patch one radius out every 10 s, capped. */
import { describe, expect, it } from 'vitest';
import { Embedded, Rot } from '../../../src/surgery/entities';
import { DEFAULT_TUNING } from '../../../src/surgery/tuning';
import { at, Hand, running } from '../../harness-gameplay';

describe('spoiling around unfound shards (CON-0061)', () => {
  const T = DEFAULT_TUNING.tongs;

  it('a hidden hexstone seeds rot one radius out every 10 s', () => {
    const op = running(() => {
      const e = new Embedded(at(0, 0), 'hexstone', 0.5, false);
      e.hidden = true;
      return [e];
    });
    const stone = op.entities[0] as Embedded;
    const h = new Hand(op);
    h.idle(T.hexCorruptEvery - 0.5);
    expect(op.entities.filter((e) => e instanceof Rot)).toHaveLength(0);
    h.idle(1);
    const rots = op.entities.filter((e): e is Rot => e instanceof Rot);
    expect(rots).toHaveLength(1);
    const dx = rots[0].pos.x - stone.origin.x;
    const dy = (rots[0].pos.y - stone.origin.y) / T.hexCorruptAspect;
    expect(Math.hypot(dx, dy)).toBeCloseTo(T.hexCorruptDist, 0);
    expect(T.hexCorruptEvery).toBe(10);
  });

  it('never more than the cap at once, however long it is left', () => {
    const op = running(() => {
      const e = new Embedded(at(0, 0), 'hexstone', 0.5, false);
      e.hidden = true;
      return [e];
    });
    new Hand(op).idle(T.hexCorruptEvery * (T.hexCorruptMax + 3) + 1);
    expect(op.entities.filter((e) => e instanceof Rot && e.alive).length).toBeLessThanOrEqual(T.hexCorruptMax);
  });
});
