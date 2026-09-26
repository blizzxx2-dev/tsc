/** CON-0044: the rot's regrowth is tuned so the steady hand clears a patch in two passes or fewer, on average. */
import { expect, it } from 'vitest';
import { CAMPAIGN } from '../../src/content/campaign';
import { Rot } from '../../src/surgery/entities';
import type { OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

it('steady bot: mean salve passes per rot purged ≤ 2 across the demo', { timeout: 300_000 }, () => {
  const ops = CAMPAIGN.flatMap((c) => c.steps)
    .flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []))
    .filter((d) => /^op[12]-/.test(d.id));
  const passes: number[] = [];
  for (const def of ops)
    for (let s = 1; s <= 3; s++) {
      const live = new Set<Rot>();
      playWithBot(def, {
        profile: 'steady',
        seed: (def.seed ?? 1) * 1000 + s,
        botSeed: s,
        onFrame: (o) => {
          for (const e of o.entities) if (e instanceof Rot) live.add(e);
          for (const r of [...live])
            if (!r.alive) {
              live.delete(r);
              passes.push(r.passes);
            }
        },
      });
    }
  expect(passes.length).toBeGreaterThan(20);
  expect(passes.reduce((a, b) => a + b, 0) / passes.length).toBeLessThanOrEqual(2);
});
