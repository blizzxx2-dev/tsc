import { describe, expect, it } from 'vitest';
import { mirrorOp, nextMedal, tierOpen, TRIALS, trialRun, unsungHour, TIER_UNLOCK, MEDAL_OF } from '../../../src/content/trials';
import { loadProgress, type Progress } from '../../../src/surgery/progress';
import { opData } from '../../../src/content/schema';
import { Laceration } from '../../../src/surgery/entities';
import { at, running } from '../../harness-gameplay';

const fresh = (): Progress => ({ ...loadProgress(), xBest: {}, chaptersCleared: 0 });

describe('Trials of the Guild (CON-0201, CON-0202, CON-0248)', () => {
  it('24 X-ops in four tiers of six, and two trials for each of the other four disciplines', () => {
    for (const tier of ['journeyman', 'master', 'grandmaster', 'unsung'] as const)
      expect(
        TRIALS.filter((x) => x.tier === tier),
        tier,
      ).toHaveLength(6);
    const d = TRIALS.filter((x) => x.tier === 'disciplines');
    expect(d.filter((x) => x.triage)).toHaveLength(2);
    expect(d.filter((x) => x.interview && !x.interview.candle)).toHaveLength(2);
    expect(d.filter((x) => x.interview?.candle)).toHaveLength(2);
    expect(d.filter((x) => x.op)).toHaveLength(2);
    expect(new Set(TRIALS.map((x) => x.id)).size).toBe(TRIALS.length);
  });

  it('CON-0096/0201: the first tier opens with Chapter II; each next tier with three S-ranks below', () => {
    const p = fresh();
    expect(tierOpen(p, 'journeyman')).toBe(false);
    p.chaptersCleared = 2;
    expect(tierOpen(p, 'journeyman')).toBe(true);
    expect(tierOpen(p, 'master')).toBe(false);
    for (const x of TRIALS.filter((y) => y.tier === 'journeyman').slice(0, TIER_UNLOCK)) p.xBest[x.id] = { rank: 'S', score: 1, time: 0 };
    expect(tierOpen(p, 'master')).toBe(true);
    expect(tierOpen(p, 'grandmaster')).toBe(false);
  });

  it('CON-0202: the rules layer — time, drain, no Litany, one life, silence, the field modifiers', () => {
    const run = (id: string) =>
      trialRun(
        TRIALS.find((x) => x.id === id)!,
        {},
        [],
        true,
      )!;
    expect(run('t04').def.timeLimit).toBe(Math.round(260 * 0.9));
    expect(run('t06').opts.mods?.drain).toBe(1.1);
    expect(run('t07').def.litany).toBe(false);
    expect(run('t11').def.env).toEqual(expect.arrayContaining(['rain', 'cart']));
    expect(run('t17').opts.muted).toBe(true);
    expect(run('t20').opts.silentAssistant).toBe(true);
    expect(run('d8').opts.oneLife).toBe(true);
    expect(run('t01').opts.challenge).toBe('t01');
  });

  it('a mirrored field lays every point left for right and turns every angle about the vertical', () => {
    const base = trialRun(
      TRIALS.find((x) => x.id === 't03')!,
      {},
      [],
      true,
    )!;
    const plain = opData(TRIALS.find((x) => x.id === 't03')!.op!(true)!)!;
    const mirrored = opData(mirrorOp(TRIALS.find((x) => x.id === 't03')!.op!(true)!))!;
    const a = plain.phases[0].spawn![2] as unknown as { at: [number, number]; angle: number };
    const b = mirrored.phases[0].spawn![2] as unknown as { at: [number, number]; angle: number };
    expect(b.at).toEqual([-a.at[0], a.at[1]]);
    expect(b.angle).toBeCloseTo(Math.PI - a.angle);
    expect(base.def.id).toBe('trial-goose-t03');
  });

  it('one life: a single MISS ends the run', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 80, 0.4)], {}, { oneLife: true });
    op.rate('miss', at(0, 0), 'test');
    op.update(1 / 60);
    expect(op.status).toBe('lost');
    expect(op.lostCause).toBe('one-life');
  });

  it('CON-0222: the Unsung Hour stitches one verse per lost operation, or a curated night', () => {
    expect(unsungHour([]).phases).toHaveLength(5);
    expect(unsungHour(['op1-1', 'op2-3', 'op3-6']).phases.length).toBeGreaterThanOrEqual(1);
    expect(TRIALS.find((x) => x.id === 't24')!.secret).toBe('unsungHeard');
  });

  it('UIX-0189: medals by rank, and the next one’s target', () => {
    expect(MEDAL_OF.XS).toBe('saint');
    expect(MEDAL_OF.C).toBeNull();
    expect(nextMedal('A', { S: 1000, A: 800, B: 600 })).toEqual({ medal: 'gold', need: 1000 });
    expect(nextMedal('XS', { S: 1000, A: 800, B: 600 })).toBeNull();
  });
});
