import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN } from '../src/content/campaign';
import { isTeaching, NoFailPhase, TEACH_FLOOR } from '../src/content/teach';
import { Amputation } from '../src/surgery/ailments/kilnrows';
import { PetrifyFront } from '../src/surgery/ailments/vennmark';
import { Operation, type OperationDef } from '../src/surgery/operation';
import type { Entity } from '../src/surgery/entity';
import { DT } from './helpers/sim';

/** Every op of the full campaign in play order. */
const ops = (): OperationDef[] => FULL_CAMPAIGN.flatMap((ch) => ch.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

/** Which classes each phase of an op spawns. */
function spawned(def: OperationDef): Entity[][] {
  const op = new Operation(def);
  return def.phases.map((p) => p.spawn(op));
}

describe('GAM-0212 teaching phases for new mechanics', () => {
  const MECHANICS = [
    ['amputation', Amputation],
    ['stone', PetrifyFront],
  ] as const;

  for (const [name, cls] of MECHANICS)
    it(`the first op with ${name} opens with a no-fail phase that teaches it`, () => {
      const first = ops().find((d) => spawned(d).some((ph) => ph.some((e) => e instanceof cls)))!;
      expect(first, name).toBeDefined();
      expect(isTeaching(first.phases[0]), first.id).toBe(true);
      expect(
        spawned(first)[0].some((e) => e instanceof cls),
        first.id,
      ).toBe(true);
    });

  it('the patient cannot fall below the floor while the teaching phase lasts', () => {
    const def = ops().find((d) => d.id === 'op3-5')!;
    const op = new Operation({ ...def, baseDrain: 30 });
    while (op.status === 'intro') op.update(DT);
    for (let t = 0; t < 10; t += DT) op.update(DT);
    expect(op.phase).toBe(0);
    expect(op.status).toBe('running');
    expect(op.vitals).toBeGreaterThanOrEqual(TEACH_FLOOR - 1);
    const floor = op.entities.find((e): e is NoFailPhase => e instanceof NoFailPhase)!;
    expect(floor.floor).toBe(TEACH_FLOOR);
  });
});
