/** CON-0086: all 30 seed/op pairs of the demo finish (no softlock) and replay identically. */
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../../src/content/chapter1';
import { CHAPTER_2 } from '../../src/content/chapter2';
import { playWithBot } from '../bot';

const demo = [CHAPTER_1, CHAPTER_2].flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

describe('demo seed variants (CON-0086)', () => {
  for (const def of demo)
    it(`${def.id}: each of its three seeds is won by the steady hand, the same way twice`, { timeout: 120_000 }, () => {
      for (const seed of def.seeds ?? []) {
        const a = playWithBot(def, { profile: 'steady', seed, botSeed: 1 }).op;
        const b = playWithBot(def, { profile: 'steady', seed, botSeed: 1 }).op;
        expect(a.status, `${def.id} seed ${seed}`).toBe('won');
        expect([b.status, b.score, b.elapsed, b.vitals], `${def.id} seed ${seed} replay`).toEqual([a.status, a.score, a.elapsed, a.vitals]);
      }
    });
});
