import { describe, expect, it } from 'vitest';
import { allCampaignOperations as allOperations } from '../src/content/campaign';
import { playWithBot } from './bot';

/**
 * Boss robustness across seeds: the novice bot (1.5 s per gesture) must save
 * the patient on (nearly) every seed. None — whose heart contact is instant
 * loss — needs the widest margin: at least 19 of 20.
 */
const BOSSES: Record<string, { seeds: number; need: number }> = {
  'op3-10': { seeds: 10, need: 9 },
  'op3-11': { seeds: 10, need: 9 },
  'op4-7': { seeds: 10, need: 9 },
  'op4-9': { seeds: 20, need: 19 },
  'op5-6': { seeds: 10, need: 9 },
  'op5-7': { seeds: 10, need: 9 },
  'op5-8': { seeds: 10, need: 9 },
  'op5-9': { seeds: 10, need: 9 },
};

describe('Hours of the Malison across seeds (novice pace)', () => {
  for (const [id, { seeds, need }] of Object.entries(BOSSES)) {
    it(`${id}: ≥ ${need}/${seeds}`, () => {
      const def = allOperations().find((d) => d.id === id)!;
      const lost: string[] = [];
      for (let s = 1; s <= seeds; s++) {
        const op = playWithBot({ ...def, seed: 1000 + s }, { think: 1.5 }).op;
        if (op.status !== 'won') lost.push(`seed ${1000 + s}: ${op.lostReason}`);
      }
      expect(seeds - lost.length, lost.join('; ')).toBeGreaterThanOrEqual(need);
    });
  }
});
