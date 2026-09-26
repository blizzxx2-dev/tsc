/** CON-0060: the lens tutorial in op2-2 — the first shard shows itself; four to six in all, by seed. */
import { describe, expect, it } from 'vitest';
import { OP_2_2 } from '../../../src/content/ops/ch2';
import { spawnAll } from '../../../src/content/schema';
import { Embedded } from '../../../src/surgery/entities';
import { LENS_GUIDE } from '../../../src/surgery/entity';
import { Operation } from '../../../src/surgery/operation';
import { at, Hand, running } from '../../harness-gameplay';

describe('lens tutorial (CON-0060)', () => {
  it('the guide shard shows at once from further off, and Ilse names the shimmer', () => {
    const op = running((o) =>
      spawnAll(
        [
          { e: 'embedded', at: [0, 0], kind: 'hexstone', hidden: true, guide: true },
          { e: 'embedded', at: [0, 200], kind: 'hexstone', hidden: true },
        ],
        o,
      ),
    );
    const [guide, other] = op.entities as Embedded[];
    const off = op.tuning.lens.radius * (1 + (LENS_GUIDE.reach - 1) / 2);
    new Hand(op).hold('lens', at(off, 0), 0.05);
    expect(guide.hidden).toBe(false);
    expect(other.hidden).toBe(true);
    expect(op.callouts.some((c) => c.includes('see it glint'))).toBe(true);
  });

  it('an ordinary hidden shard at the same distance stays hidden', () => {
    const op = running((o) => spawnAll([{ e: 'embedded', at: [0, 0], kind: 'hexstone', hidden: true }], o));
    new Hand(op).hold('lens', at(op.tuning.lens.radius * 1.4, 0), 1);
    expect(op.entities[0].hidden).toBe(true);
  });

  it('op2-2 hides four to six shards, one of them the guide, and the count varies by seed', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const op = new Operation(OP_2_2, { seed });
      const shards = (OP_2_2.phases[1].spawn?.(op) ?? []).filter((e) => e instanceof Embedded && e.hidden);
      expect(shards.length).toBeGreaterThanOrEqual(4);
      expect(shards.length).toBeLessThanOrEqual(6);
      expect(shards.filter((e) => e.lensGuide)).toHaveLength(1);
      counts.add(shards.length);
    }
    expect(counts.size).toBeGreaterThan(1);
  });
});
