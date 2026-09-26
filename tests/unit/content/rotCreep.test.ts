/** CON-0044: salved rot creeps back from its edge, and the edge shows the regrowth coming due. */
import { describe, expect, it } from 'vitest';
import { Rot } from '../../../src/surgery/entities';
import { at, Hand, running } from '../../harness-gameplay';

describe('rot creeping edge (CON-0044)', () => {
  it('regrowth takes a salved cell beside live rot, never an island in the middle of clean flesh', () => {
    const op = running(() => [new Rot(at(0, 0), 60, 0.6)]);
    const rot = op.entities[0] as Rot;
    // Salve the left half only.
    for (const c of rot.cov.cells) if (c.x < 0) c.done = true;
    const front = new Set(rot.frontier());
    expect(front.size).toBeGreaterThan(0);
    const before = new Set(rot.cov.cells.filter((c) => c.done));
    new Hand(op).idle(0.5);
    const regrown = [...before].filter((c) => !c.done);
    expect(regrown.length).toBeGreaterThan(0);
    // Each regrown cell was on the frontier when it went (or touches rot that regrew before it).
    for (const c of regrown)
      expect(rot.cov.cells.some((r) => !r.done && r !== c && (r.x - c.x) ** 2 + (r.y - c.y) ** 2 <= (rot.cov.step * 1.5) ** 2)).toBe(true);
    // The far-left edge of the salved half is still clean.
    expect(rot.cov.cells.filter((c) => c.x <= -48).every((c) => c.done)).toBe(true);
  });

  it('the creep clock rises toward 1 between regrowths', () => {
    const op = running(() => [new Rot(at(0, 0), 60, 0.6)]);
    const rot = op.entities[0] as Rot;
    for (const c of rot.cov.cells) if (c.x < 0) c.done = true;
    expect(rot.creep).toBe(0);
    new Hand(op).idle(1 / 60);
    expect(rot.creep).toBeGreaterThan(0);
    expect(rot.creep).toBeLessThanOrEqual(1);
  });
});
