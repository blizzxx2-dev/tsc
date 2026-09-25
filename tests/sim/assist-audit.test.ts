/**
 * GAM-0243: accessibility audit of all five chapters — every operation is completable with every
 * assist on, by the bot using the simplified gestures (click-per-stitch, one-touch lancing,
 * tap-and-hold excision, the Litany on a key).
 */
import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN } from '../../src/content/campaign';
import type { Assists } from '../../src/surgery/difficulty';
import type { OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

const ALL_ON: Assists = {
  bigHitboxes: true,
  guides: true,
  autoLens: true,
  slowTells: true,
  noFail: true,
  suggest: true,
  holdToggle: true,
  simpleGestures: true,
  gameSpeed: 0.7,
  noRhythm: true,
};

describe('GAM-0243: every op completable with all assists and simplified gestures', () => {
  for (const ch of FULL_CAMPAIGN) {
    it(`chapter ${ch.numeral}`, { timeout: 300_000 }, () => {
      for (const s of ch.steps) {
        if (s.kind !== 'op') continue;
        const def = s.op as OperationDef;
        const labels: string[] = [];
        const op = playWithBot(def, { profile: 'steady', assists: ALL_ON, collect: (e) => e.kind === 'rated' && e.label && labels.push(e.label) }).op;
        expect(
          op.status,
          `${def.id}: ${op.lostReason} t=${Math.round(op.elapsed)} left ${op.entities
            .filter((e) => e.alive && e.required)
            .map((e) => e.constructor.name)
            .join(',')} ${labels.slice(-6).join(',')}`,
        ).toBe('won');
        expect(op.assists.simpleGestures).toBe(true);
      }
    });
  }
});
