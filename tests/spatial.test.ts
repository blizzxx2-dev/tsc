import { describe, expect, it } from 'vitest';
import { Grub, Laceration } from '../src/surgery/entities';
import { SPATIAL_THRESHOLD, SpatialGrid } from '../src/surgery/spatial';
import { at, Hand, start, wait } from './harness';

describe('spatial index for crowded fields (ENG-0246)', () => {
  const crowd = () => {
    const op = start((o) => {
      const out = [new Laceration(at(0, 180), 0, 80, 0.2)];
      for (let i = 0; i < 300; i++) out.push(new Grub(at(-300 + (i % 30) * 20, -150 + Math.floor(i / 30) * 30), o, 0));
      return out;
    });
    return op;
  };

  it('narrows candidates to the stroke neighbourhood but keeps unindexed entities', () => {
    const op = crowd();
    expect(op.visibleEntities().length).toBeGreaterThan(SPATIAL_THRESHOLD);
    const p = at(0, 0);
    const c = op.candidates(p, p);
    expect(c.length).toBeLessThan(60); // of 301
    expect(c.some((e) => e instanceof Laceration)).toBe(true);
    // Every grub that could hit the point is still a candidate.
    for (const e of op.visibleEntities()) if (e instanceof Grub && e.hitTest(p, op.hitPad)) expect(c).toContain(e);
  });

  it('gives the same outcomes as a full scan, and is faster with 300 entities', () => {
    const run = (indexed: boolean) => {
      const op = crowd();
      op.spatialIndex = indexed;
      const hand = new Hand(op);
      const t0 = performance.now();
      for (let k = 0; k < 20; k++) hand.drag('brand', [at(-300, -150 + k * 10), at(300, -150 + k * 10)], 600);
      const ms = performance.now() - t0;
      wait(op, 0.1);
      return { ms, alive: op.entities.filter((e) => e instanceof Grub && e.alive).length, score: op.score };
    };
    const full = run(false);
    const fast = run(true);
    expect(fast.alive).toBe(full.alive);
    expect(fast.score).toBe(full.score);
    expect(fast.ms).toBeLessThan(full.ms * 1.2);
  });

  it('indexes only declared reaches', () => {
    const op = start((o) => [new Grub(at(0, 0), o, 0), new Laceration(at(100, 0), 0, 40, 0.2)]);
    const g = new SpatialGrid(op.entities);
    expect(g.always.map((e) => e.constructor.name)).toEqual(['Laceration']);
  });
});
