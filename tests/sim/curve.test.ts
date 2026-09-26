/**
 * The demo's difficulty curve (CON-0023, GAM-0199): the expert clears every op inside 55 % of its
 * time limit and the novice inside 85 %; within each chapter the steady hand's lowest vitals fall
 * from op to op (the chapter's boss the hardest), save op1-3, where he comes in already weak for the
 * tincture lesson (CON-0041), and op2-1, the breather after the Matins.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../src/content/campaign';
import type { OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ops = CAMPAIGN.flatMap((c) => c.steps)
  .flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []))
  .filter((d) => /^op[12]-/.test(d.id));
const runs = (def: OperationDef, profile: 'expert' | 'steady' | 'novice') =>
  [1, 2, 3, 4, 5].map((s) => playWithBot(def, { profile, seed: (def.seed ?? 1) * 1000 + s, botSeed: s }).op);

describe('the demo difficulty curve', () => {
  it('CON-0023: expert clears within 55 % of the limit, novice within 85 %', { timeout: 300_000 }, () => {
    for (const def of ops) {
      expect(med(runs(def, 'expert').map((o) => o.elapsed)) / def.timeLimit, `${def.id} expert`).toBeLessThanOrEqual(0.55);
      expect(med(runs(def, 'novice').map((o) => o.elapsed)) / def.timeLimit, `${def.id} novice`).toBeLessThanOrEqual(0.85);
    }
  });

  it('CON-0037: after the arrow comes out, the novice still keeps the militiaman above 40', { timeout: 120_000 }, () => {
    const def = ops.find((d) => d.id === 'op1-2')!;
    expect(med(runs(def, 'novice').map((o) => o.minVitals))).toBeGreaterThan(40);
  });

  it('GAM-0199: within each chapter the steady hand’s lowest vitals only fall (save the scripted dip and the breather)', { timeout: 300_000 }, () => {
    const skip = new Set(['op1-3', 'op2-1']);
    for (const ch of ['op1-', 'op2-']) {
      const curve = ops.filter((d) => d.id.startsWith(ch) && !skip.has(d.id)).map((d) => ({ id: d.id, v: med(runs(d, 'steady').map((o) => o.minVitals)) }));
      for (let i = 1; i < curve.length; i++) expect(curve[i].v, `${curve[i].id} after ${curve[i - 1].id}`).toBeLessThanOrEqual(curve[i - 1].v);
    }
  });
});
