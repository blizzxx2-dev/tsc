/** CON-0076: the Litany helps at Lauds (both halves in one window) but is never needed to win it. */
import { describe, expect, it } from 'vitest';
import { OP_2_5 } from '../../src/content/ops/ch2';
import type { OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

const noLitany: OperationDef = { ...OP_2_5, litany: false };
const runs = (profile: 'steady' | 'novice') =>
  [1, 2, 3, 4, 5].map((s) => playWithBot(noLitany, { profile, seed: (OP_2_5.seed ?? 1) * 1000 + s, botSeed: s }).op);

describe('Lauds without the Litany (CON-0076)', () => {
  it('the steady hand wins every seed with no Litany to call', { timeout: 300_000 }, () => {
    const ops = runs('steady');
    expect(ops.every((o) => o.litanyUses === 0)).toBe(true);
    expect(ops.map((o) => o.status)).toEqual(['won', 'won', 'won', 'won', 'won']);
  });

  it('and the novice wins most of them', { timeout: 300_000 }, () => {
    expect(runs('novice').filter((o) => o.status === 'won').length).toBeGreaterThanOrEqual(4);
  });
});
