import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../src/content/campaign';
import { Operation } from '../src/surgery/operation';
import { restoreState, saveState, summarise } from '../src/surgery/snapshot';
import { botStepper } from './bot';
import { DT } from './helpers/sim';

describe('operation state snapshots (ENG-0249)', () => {
  it('round-trips mid-operation: the restored run matches and carries on identically', () => {
    const def = allCampaignOperations().find((d) => d.id === 'op1-5')!;
    const run = botStepper(def, { profile: 'steady', record: true });
    for (let i = 0; i < 60 * 40 && run.step(); i++);
    const op = run.op;
    expect(op.status).toBe('running');
    const json = saveState(op);
    const snap = JSON.parse(json);
    expect(snap.state.entities.length).toBeGreaterThan(0);
    expect(typeof snap.state.rng).toBe('number');
    const back = restoreState(op.def, json);
    expect(summarise(back)).toEqual(summarise(op));
    // Both carry on the same way.
    for (let i = 0; i < 120; i++) {
      op.update(DT);
      back.update(DT);
    }
    expect(summarise(back)).toEqual(summarise(op));
    // The restored run records, so it can be snapshotted again.
    expect(() => saveState(back)).not.toThrow();
  });

  it('refuses a snapshot for another case, or one that does not restore to its saved state', () => {
    const [a, b] = allCampaignOperations();
    const op = new Operation(a, { record: true });
    for (let i = 0; i < 300; i++) op.update(DT);
    const json = saveState(op);
    expect(() => restoreState(b, json)).toThrow(/not/);
    const bad = JSON.parse(json);
    bad.state.score += 1;
    expect(() => restoreState(a, JSON.stringify(bad))).toThrow(/does not restore/);
  });
});
