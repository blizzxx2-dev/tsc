import { describe, expect, it } from 'vitest';
import {
  dailyBoardId,
  dailySeed,
  decodeChallenge,
  encodeChallenge,
  LOOM_MODULES,
  loomCode,
  loomOp,
  loomVerses,
  MUTATORS,
  parseLoomCode,
  withMutators,
  X_OPS,
  xOp,
  xOpDef,
  xOpOptions,
  xUnlocked,
} from '../src/content/challenge';
import { RainDrips } from '../src/surgery/ailments/environment';
import { Malison } from '../src/surgery/malison';
import { Operation } from '../src/surgery/operation';
import { freshProgress, recordChapter, recordRun } from '../src/surgery/progress';
import { playWithBot } from './bot';
import { Anchor, running, wait } from './harness-gameplay';

const X1 = xOp('x1')!;

describe('GAM-L X-operations', () => {
  it('GAM-0213: X1 — Matins, Unveiled unlocks on Chapter II; 1.5× HP, 3 s veil / 2 s open, Master drain, no checkpoint', () => {
    const p = freshProgress();
    expect(xUnlocked(p, X1)).toBe(false);
    recordChapter(p, 1);
    expect(xUnlocked(p, X1)).toBe(false);
    recordChapter(p, 2);
    expect(xUnlocked(p, X1)).toBe(true);
    const op = new Operation(xOpDef(X1), xOpOptions(X1));
    expect(op.difficulty).toBe('master');
    expect(op.drainMult).toBeCloseTo(1.35);
    // Skip to the Malison phase.
    let m: Malison | undefined;
    for (let i = 0; i < 60 * 600 && !m; i++) {
      op.update(1 / 60);
      for (const e of op.entities) if (e instanceof Malison) m = e;
      if (op.phase < 2) for (const e of op.entities) if (e.required && !(e instanceof Malison)) e.kill();
    }
    expect(m).toBeDefined();
    expect(m!.maxHp).toBeCloseTo(150);
    expect([m!.veilTime, m!.openTime]).toEqual([3, 2]);
    op.lose('test', 'vitals');
    expect(op.checkpointPhase()).toBeNull();
  });

  it('GAM-0213: the bot can clear X1 (expert: the Eye is out from the start, BOS-0164) and X2 (steady)', () => {
    for (const [id, profile] of [
      ['x1', 'expert'],
      ['x2', 'steady'],
    ] as const) {
      const x = xOp(id)!;
      const op = playWithBot(xOpDef(x), { profile, ...xOpOptions(x) }).op;
      expect(op.status, id).toBe('won');
    }
  });

  it('GAM-0214: X-op rules — no assists, no upgrades, Litany once; results keep rank and best time', () => {
    const op = new Operation(xOpDef(X1), { ...xOpOptions(X1), assists: { noFail: true, bigHitboxes: true }, upgrades: ['deep-leech'] });
    expect(op.assists.noFail).toBe(false);
    expect(op.hitPad).toBe(0);
    expect(op.upgrades.size).toBe(0);
    expect(op.litanyAllowed).toBe(1);
    const p = freshProgress();
    recordRun(p, { opId: xOpDef(X1).id, won: true, rank: 'A', score: 5000, difficulty: 'master', flags: [], challenge: 'x1', time: 140 });
    expect(p.xBest.x1).toEqual({ rank: 'A', score: 5000, time: 140 });
    recordRun(p, { opId: xOpDef(X1).id, won: true, rank: 'A', score: 4000, difficulty: 'master', flags: [], challenge: 'x1', time: 120 });
    expect(p.xBest.x1.score).toBe(5000);
  });

  it('GAM-0216: every X-op declares drain×, time×, HP×, tell speed× and add cadence×', () => {
    expect(X_OPS.map((x) => x.id)).toEqual(['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']);
    for (const x of X_OPS) for (const k of ['drain', 'time', 'hp', 'tellSpeed', 'addCadence'] as const) expect(x.mods[k], `${x.id}.${k}`).toBeGreaterThan(0);
    // Tell speed runs the boss's own clock faster.
    const fast = running((o) => [new Malison({ x: 660, y: 410 }, o), new Anchor()], {}, { mods: { tellSpeed: 2 } });
    const m = fast.entities[0] as Malison;
    wait(fast, 2.1);
    expect(m.open).toBe(true);
  });
});

describe('GAM-L mutators', () => {
  it('GAM-0223: Candle-Only — vignette 45 %, lens radius ×0.7', () => {
    const op = running(() => [new Anchor()], {}, { mutators: ['candle'] });
    expect(op.vignette).toBe(0.45);
    expect(op.tuning.lens.radius).toBeCloseTo(63);
    expect(running(() => []).tuning.lens.radius).toBe(90);
  });

  it('GAM-0224: Moving Cart — the field sways 12 px at 0.3 Hz', () => {
    const op = running(() => [new Anchor()], {}, { mutators: ['cart'] });
    let max = 0;
    for (let i = 0; i < 240; i++) {
      op.update(1 / 60);
      max = Math.max(max, Math.abs(op.sway().x));
    }
    expect(max).toBeGreaterThan(11);
    expect(max).toBeLessThanOrEqual(12);
    expect(running(() => []).sway()).toEqual({ x: 0, y: 0 });
  });

  it('GAM-0225: Field Tent in Rain — drips make small pools every 5 s', () => {
    const base = xOpDef(X1);
    const { def, opts } = withMutators({ ...base, phases: [{ spawn: () => [new Anchor()] }] }, {}, ['rain']);
    const op = new Operation(def, opts);
    wait(op, 2.1);
    expect(op.entities.some((e) => e instanceof RainDrips)).toBe(true);
    wait(op, 5.1);
    expect(op.entities.filter((e) => e.constructor.name === 'BloodPool').length).toBe(1);
    wait(op, 5);
    expect(op.entities.filter((e) => e.constructor.name === 'BloodPool').length).toBe(2);
  });

  it('GAM-0226: Stroh Watches — invoking the Litany fails the operation', () => {
    const op = running(() => [new Anchor()], { litany: true }, { mutators: ['stroh'] });
    op.invokeLitany();
    expect(op.status).toBe('lost');
    expect(op.lostCause).toBe('stroh');
    expect(Object.keys(MUTATORS)).toEqual(['candle', 'cart', 'rain', 'stroh']);
  });
});

describe('GAM-L Symptom Loom', () => {
  it('GAM-0218: three adjacent verses from twelve modules; the seed is shown as a shareable code', () => {
    expect(LOOM_MODULES.length).toBe(12);
    const v = loomVerses(12345);
    const i = LOOM_MODULES.indexOf(v[0]);
    expect(v.map((m) => m.id)).toEqual([0, 1, 2].map((k) => LOOM_MODULES[(i + k) % 12].id));
    const code = loomCode(12345);
    expect(parseLoomCode(code)).toBe(12345);
    expect(parseLoomCode(code.toLowerCase())).toBe(12345);
    expect(parseLoomCode('nonsense')).toBeNull();
    expect(loomOp(12345).phases.length).toBe(3);
    expect(loomOp(12345).title).toContain(code);
  });

  it('GAM-0219: loom validator — every module combination is completable by the bot across seeds', () => {
    const seeds = Number(process.env.LOOM_SEEDS ?? 1000);
    const failures: string[] = [];
    for (let s = 1; s <= seeds; s++) {
      const def = loomOp(s * 7919);
      const op = playWithBot(def, { profile: 'steady', botSeed: s }).op;
      if (op.status !== 'won')
        failures.push(
          `${loomCode(s * 7919)} (${loomVerses(s * 7919)
            .map((m) => m.id)
            .join('+')}): ${op.lostReason}`,
        );
    }
    expect(failures).toEqual([]);
  }, 120_000);

  it('GAM-0220: the Daily Loom seed is the same for everyone on a day and changes daily', () => {
    expect(dailySeed('2026-10-01')).toBe(dailySeed(new Date('2026-10-01T18:00:00Z')));
    expect(dailySeed('2026-10-01')).not.toBe(dailySeed('2026-10-02'));
    expect(dailyBoardId('2026-10-01')).toBe('loom-2026-10-01');
  });

  it('GAM-0222: custom challenges round-trip through a share code', () => {
    const c = {
      opId: 'op2-3',
      mods: { drain: 1.25, time: 0.8, hp: 1, tellSpeed: 1.1, addCadence: 1.5 },
      mutators: ['candle', 'stroh'] as ('candle' | 'stroh')[],
    };
    const code = encodeChallenge(c);
    expect(decodeChallenge(code)).toEqual(c);
    expect(decodeChallenge('x.y')).toBeNull();
  });
});
