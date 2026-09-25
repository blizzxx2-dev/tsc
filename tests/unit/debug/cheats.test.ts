/** GAM-0019: dev cheats — freeze the drain, spawn any entity at the cursor (skip phase / set vitals are covered by DebugApi). */
import { describe, expect, it } from 'vitest';
import { freezeDrain, SPAWN_IDS, spawnAt } from '../../../src/debug/cheats';
import { Laceration } from '../../../src/surgery/entities';
import { at, start, wait } from '../../harness';

describe('GAM-0019 debug cheats', () => {
  it('freeze drain holds the vitals still until released', () => {
    const op = start(() => [new Laceration(at(0, 0), 0, 160, 1.5), new Laceration(at(0, 80), 0, 160, 1.5)]);
    op.vitals = 80;
    freezeDrain(op, true);
    wait(op, 5);
    expect(op.vitals).toBe(80);
    freezeDrain(op, false);
    wait(op, 2);
    expect(op.vitals).toBeLessThan(80);
  });

  it('spawns every content entity at the cursor', () => {
    for (const id of SPAWN_IDS) {
      const op = start(() => [new Laceration(at(250, 150), 0, 30, 0.2)]);
      op.cursor = at(-60, 20);
      const made = spawnAt(op, id);
      expect(made.length, id).toBeGreaterThan(0);
      for (const e of made) expect(op.entities, id).toContain(e);
      if (id !== 'incision' && id !== 'elite-fangnest' && id !== 'malison-lauds')
        expect(Math.hypot(made[0].pos.x - op.cursor.x, made[0].pos.y - op.cursor.y), id).toBeLessThan(80);
      wait(op, 0.5);
    }
    expect(() => spawnAt(start(), 'dragon')).toThrow(/unknown entity/);
  });
});
