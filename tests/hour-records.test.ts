import { beforeEach, describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../src/content/campaign';
import { hourRecord, resetHourRecords, submitHourClear } from '../src/surgery/hourRecords';
import { playWithBot } from './bot';

const matins = () => allCampaignOperations().find((d) => d.id === 'op1-5')!;

describe('replay-verified Hour speedruns (BOS-0176)', () => {
  beforeEach(() => resetHourRecords());

  it('a won Hour replays to the same clear and becomes the record; a slower one does not replace it', () => {
    const fast = playWithBot(matins(), { profile: 'expert', record: true }).op;
    expect(fast.status).toBe('won');
    const r = submitHourClear('matins', fast);
    expect(r).toMatchObject({ verified: true, record: true });
    const rec = hourRecord('matins')!;
    expect(rec.opId).toBe('op1-5');
    expect(rec.time).toBeGreaterThan(0);
    expect(JSON.parse(rec.log).ops.length).toBeGreaterThan(100);
    const slow = playWithBot(matins(), { profile: 'novice', record: true }).op;
    if (slow.status === 'won') expect(submitHourClear('matins', slow)).toMatchObject({ verified: true, record: slow.def.timeLimit - slow.timeLeft < rec.time });
    expect(hourRecord('matins')!.time).toBeLessThanOrEqual(rec.time);
  });

  it('a run that does not replay to the same result is refused', () => {
    const op = playWithBot(matins(), { profile: 'expert', record: true }).op;
    // Tamper: drop the last third of the inputs, as a doctored log would.
    op.log!.splice(Math.floor(op.log!.length * 0.66));
    expect(submitHourClear('matins', op)).toEqual({ verified: false });
    expect(hourRecord('matins')).toBeNull();
  });
});
