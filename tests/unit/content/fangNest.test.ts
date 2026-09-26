/** CON-0057: the Gravehound's fangs — three or four by seed, one broken (the tongs go in twice). */
import { describe, expect, it } from 'vitest';
import { OP_2_1 } from '../../../src/content/ops/ch2';
import { FangNest } from '../../../src/surgery/bosses/elites';
import { Embedded } from '../../../src/surgery/entities';
import { Operation, TRAY_DISH } from '../../../src/surgery/operation';
import { strokePath } from '../../helpers/sim';
import { running } from '../../harness-gameplay';

const nestOf = (op: Operation) => (OP_2_1.phases[1].spawn?.(op) ?? []).find((e): e is FangNest => e instanceof FangNest)!;

function pull(op: Operation, e: Embedded): void {
  const grip = { x: e.origin.x + (e.handle.x - e.origin.x) * 0.7, y: e.origin.y + (e.handle.y - e.origin.y) * 0.7 };
  const d = { x: e.handle.x - e.origin.x, y: e.handle.y - e.origin.y };
  const l = Math.hypot(d.x, d.y) || 1;
  strokePath(op, 'tongs', [grip, { x: grip.x + (d.x / l) * 40, y: grip.y + (d.y / l) * 40 }, TRAY_DISH], { speed: 400 });
}

describe('the Gravehound’s fangs (CON-0057)', () => {
  it('three or four fangs, by seed', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) counts.add(nestOf(new Operation(OP_2_1, { seed })).fangs.length);
    expect([...counts].sort()).toEqual([3, 4]);
  });

  it('the second is broken: the first pull brings only the crown, the second the root', () => {
    const op = running((o) => nestOf(o).all);
    const nest = op.entities.find((e): e is FangNest => e instanceof FangNest)!;
    const [first, broken] = nest.fangs;
    expect(broken.crowns).toBe(1);
    pull(op, first);
    expect(first.alive).toBe(false);
    pull(op, broken);
    expect(broken.alive).toBe(true);
    expect(broken.rootOnly).toBe(true);
    expect(op.callouts.some((c) => c.includes('only the crown came'))).toBe(true);
    pull(op, broken);
    expect(broken.alive).toBe(false);
    expect(nest.spreads).toBe(0);
  });
});
