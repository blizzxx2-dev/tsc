import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { BloodPool, Bubo, Embedded, Grub, Incision, Laceration, Rot } from '../src/surgery/entities';
import { tipFor } from '../src/surgery/hints';
import { Malison } from '../src/surgery/malison';
import { Operation, type OperationDef } from '../src/surgery/operation';
import { SCORING, scoringRule } from '../src/surgery/scoring';
import { playWithBot } from './bot';
import { Anchor, at, DT, Hand, running, testDef, wait, zig } from './harness';

const lastRated = (op: Operation) => [...op.events].reverse().find((e) => e.kind === 'rated') as { rating: string; label?: string; points: number } | undefined;
const byId = (id: string) => allOperations().find((d) => d.id === id)!;

describe('GAM-F rating rules', () => {
  it('GAM-0140: every label the simulation can emit is in the scoring spec', () => {
    const labels = new Set<string>();
    const dir = join(__dirname, '../src/surgery');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f));
    try {
      for (const f of readdirSync(join(dir, 'ailments'))) files.push(join(dir, 'ailments', f));
    } catch {
      // no Alpha ailments yet
    }
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\.rate\([^,]+, [^,]+, '([^']+)'/g)) labels.add(m[1]);
    const missing = [...labels].filter((l) => !scoringRule(l));
    expect(missing).toEqual([]);
    // And at runtime, across every demo op and profile.
    const seen = new Set<string>();
    for (const def of allOperations())
      for (const profile of ['steady', 'sloppy'] as const)
        playWithBot(def, { profile, collect: (e) => e.kind === 'rated' && e.label && seen.add(e.label) });
    expect([...seen].filter((l) => !scoringRule(l))).toEqual([]);
    expect(new Set(SCORING.map((r) => r.label)).size).toBe(SCORING.length);
  });

  it('GAM-0141: plain clicks on empty flesh never MISS; held tools on nothing do', () => {
    const op = running(() => [new Anchor()]);
    const h = new Hand(op);
    for (let i = 0; i < 5; i++) h.tap('lancet', at(50 * i - 100, 60));
    expect(op.counts.miss).toBe(0);
    h.hold('lancet', at(0, 100), 0.3);
    h.release();
    expect(op.counts.miss).toBe(1);
  });

  it('GAM-0142: the combo lapses after 6 s without a rated action; the Litany pauses the clock', () => {
    const op = running(() => [new Anchor()]);
    const h = new Hand(op);
    op.rate('good', at(0, 0), 'Sealed');
    expect(op.combo).toBe(1);
    h.idle(5.9);
    expect(op.combo).toBe(1);
    h.idle(0.2);
    expect(op.combo).toBe(0);
    expect(op.events.some((e) => e.kind === 'comboLapsed')).toBe(true);

    const lit = running(() => [new Anchor()], { litany: true });
    lit.rate('good', at(0, 0), 'Sealed');
    lit.invokeLitany();
    new Hand(lit).idle(7.5);
    expect(lit.combo).toBe(1);
  });

  it('GAM-0143: combo milestones at ×10 and ×20 publish an event and a callout, with no extra points', () => {
    const op = running(() => [...Array.from({ length: 10 }, (_, i) => new BloodPool(at(-200 + i * 45, 0), 22)), new Anchor()]);
    const h = new Hand(op);
    for (let i = 0; i < 10; i++) {
      h.hold('leech', at(-200 + i * 45, 0), 1.0);
      h.release();
    }
    expect(op.combo).toBe(10);
    expect(op.events.some((e) => e.kind === 'comboMilestone' && e.combo === 10)).toBe(true);
    expect(op.callouts.includes('Steady hands!')).toBe(true);
  });
});

describe('GAM-F slow-play farming fix', () => {
  const UNFIXED = { scoring: { addPointsFactor: 1, addComboCap: 99, addScoreCapFrac: 99, bossTimeBonus: 10 }, tincture: { paidDoses: 99 } };
  for (const id of ['op1-5', 'op2-5']) {
    it(`GAM-0145: without the fix, stalling ${id} for 120 s out-scores a fast kill (captured failing behaviour)`, () => {
      const def = { ...byId(id), tuning: UNFIXED };
      const farm = playWithBot(def, { profile: 'farm' }).op;
      const steady = playWithBot(def, { profile: 'steady' }).op;
      expect(farm.status).toBe('won');
      expect(farm.score).toBeGreaterThan(steady.score);
    });
    it(`GAM-0149: with the fix, the farm bot scores ≤ steady − 5 % on ${id}`, () => {
      const farm = playWithBot(byId(id), { profile: 'farm' }).op;
      const steady = playWithBot(byId(id), { profile: 'steady' }).op;
      expect(farm.status).toBe('won');
      expect(farm.score).toBeLessThanOrEqual(steady.score * 0.95);
    });
  }

  it('GAM-0146: boss-spawned adds are tagged, pay 25 % and never push the combo past ×5', () => {
    const op = running((o) => [new Malison(at(0, 0), o, 'matins', 100), new Anchor()]);
    const m = op.entities[0] as Malison;
    wait(op, 5);
    wait(op, 4);
    const rends = op.entities.filter((e) => e instanceof Laceration);
    expect(rends.length).toBeGreaterThan(0);
    expect(rends.every((e) => e.spawnedBy === 'boss')).toBe(true);
    m.kill();
    for (let i = 0; i < 5; i++) op.rate('good', at(0, 0), 'Sealed');
    expect(op.combo).toBe(5);
    const lac = rends[0] as Laceration;
    const before = op.score;
    new Hand(op).drag('thread', zig(lac.a, lac.b, lac.stitch.needed + 1), 300);
    const r = lastRated(op)!;
    expect(r.points).toBe(Math.round(Math.round((r.rating === 'cool' ? 100 : 60) * 1.25) * 0.25));
    expect(op.combo).toBe(5);
    expect(op.score - before).toBe(r.points);
  });

  it('GAM-0147: add points are capped at 15 % of the S threshold; overflow shows "—"', () => {
    const op = running((o) => [new Malison(at(0, 0), o, 'matins', 100), new Anchor()], { ranks: { S: 400, A: 300, B: 200 } });
    const m = op.entities[0] as Malison;
    // Forge adds from the Malison.
    const pools: BloodPool[] = [];
    op.actor = m;
    for (let i = 0; i < 6; i++) {
      const p = new BloodPool(at(-200 + i * 70, 100), 22);
      pools.push(p);
      op.spawn(p);
    }
    op.actor = null;
    const h = new Hand(op);
    for (const p of pools) {
      h.hold('leech', p.pos, 1.0);
      h.release();
    }
    expect(op.addPoints).toBe(60);
    expect(op.popups.some((p) => p.text === '—')).toBe(true);
  });

  it('GAM-0148: boss ops pay 8 per remaining second; under 10 s left pays nothing', () => {
    const boss = running((o) => [new Malison(at(0, 0), o, 'matins', 1)]);
    boss.entities[0].kill();
    wait(boss, 3);
    expect(boss.status).toBe('won');
    expect(boss.bonus.time).toBe(Math.round(boss.timeLeft) * 8);
    const plain = running(() => []);
    wait(plain, 3);
    expect(plain.bonus.time).toBe(Math.round(plain.timeLeft) * 10);
    const late = running(() => [new Anchor()], { timeLimit: 12 });
    wait(late, 4);
    late.entities[0].kill();
    wait(late, 3);
    expect(late.status).toBe('won');
    expect(late.bonus.time).toBe(0);
  });

  it('GAM-0150: self-inflicted entities (burst buboes, split grubs, hexstone rot, refilled pools) pay nothing', () => {
    const op = running(() => [new Bubo(at(0, 0), 22, 40), new Anchor()]);
    wait(op, 30.2);
    const spill = op.entities.filter((e) => e.spawnedBy === 'penalty');
    expect(spill.length).toBe(2);
    const hex = running(() => [new Embedded(at(0, 0), 'hexstone', 0, false), new Anchor()]);
    wait(hex, 11);
    const rots = hex.entities.filter((e) => e instanceof Rot);
    expect(rots.length).toBeGreaterThan(0);
    expect(rots.every((r) => r.spawnedBy === 'penalty')).toBe(true);
    // A bleeding wound's pools keep the combo but never pay.
    const wound = running(() => [new Laceration(at(0, 0), 0, 120, 3), new Anchor()]);
    const h = new Hand(wound);
    for (let i = 0; i < 3; i++) {
      wait(wound, 8);
      h.hold('leech', at(0, 0), 3);
      h.release();
    }
    expect(wound.counts.cool + wound.counts.good).toBeGreaterThan(0);
    expect(wound.score).toBe(0);
    // A tincture rescue counts for the combo but pays nothing.
    const low = running(() => [new Anchor()], { vitals: 30 });
    new Hand(low).hold('tincture', at(200, 100), 0.75);
    expect(low.counts.cool).toBe(1);
    expect(low.score).toBe(0);
    const g = running((o) => [new Grub(at(0, 0), o, 0), new Anchor()]);
    new Hand(g).hold('brand', at(0, 0), 0.25);
    new Hand(g).release('brand');
    const kids = g.entities.filter((e) => e instanceof Grub);
    expect(kids.every((k) => k.spawnedBy === 'penalty')).toBe(true);
  });
});

describe('GAM-F ranks', () => {
  it('GAM-0152: XS needs S×1.05, no BAD/MISS, vitals never < 50, Litany unused or used at the peak, no assists', () => {
    const def: OperationDef = { ...testDef(() => []), ranks: { S: 100, A: 80, B: 60 } };
    const op = new Operation(def);
    wait(op, 3);
    op.score = 200;
    expect(op.rank()).toBe('XS');
    op.minVitals = 45;
    expect(op.rank()).toBe('S');
    expect(op.xsBlockers()).toContain('vitals fell below 50');
    op.minVitals = 90;
    op.counts.bad = 1;
    expect(op.rank()).toBe('S');
    op.counts.bad = 0;
    op.litanyUsed = true;
    expect(op.rank()).toBe('S');
    op.flags.add('litany-peak');
    expect(op.rank()).toBe('XS');
    const assisted = new Operation(def, { assists: { autoLens: true } });
    wait(assisted, 3);
    assisted.score = 200;
    expect(assisted.rank()).toBe('S');
  });

  it('GAM-0154: results breakdown — histogram, bonuses, penalties and the delta to the next rank', () => {
    const op = playWithBot(byId('op1-2'), { profile: 'steady' }).op;
    const b = op.breakdown();
    expect(b.actionPoints + b.vitalsBonus + b.timeBonus + b.closureBonus).toBe(b.score);
    expect(b.counts.cool + b.counts.good).toBeGreaterThan(0);
    if (b.next) {
      const order = ['C', 'B', 'A', 'S', 'XS'];
      expect(order.indexOf(b.next.rank)).toBe(order.indexOf(b.rank) + 1);
      expect(b.next.delta).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('GAM-G vitals', () => {
  it('GAM-0158: drain is the sum of entity drains × the difficulty multiplier, floored at 0 → loss', () => {
    const mk = (difficulty: 'novice' | 'surgeon' | 'master') => running(() => [new Laceration(at(-100, 0), 0, 60, 1), new Laceration(at(100, 0), 0, 40, 1), new Anchor()], { vitals: 90 }, { difficulty });
    const lost = (op: Operation) => {
      const v = op.vitals;
      op.update(DT);
      return (v - op.vitals) / DT;
    };
    const s = mk('surgeon');
    const sum = (0.05 + 0.6) + (0.05 + 0.4);
    expect(lost(s)).toBeCloseTo(sum, 3);
    expect(lost(mk('novice'))).toBeCloseTo(sum * 0.6, 3);
    expect(lost(mk('master'))).toBeCloseTo(sum * 1.35, 3);
    const dying = running(() => [new Laceration(at(0, 0), 0, 200, 5), new Anchor()], { vitals: 5 });
    wait(dying, 3);
    expect(dying.vitals).toBe(0);
    expect(dying.status).toBe('lost');
  });

  it('GAM-0159: warnings at 30 and 15, once per crossing, with 5-point hysteresis', () => {
    const op = running(() => [new Anchor()], { vitals: 40 });
    const warns = () => op.events.filter((e) => e.kind === 'vitalsWarn').map((e) => (e as { level: string }).level);
    op.hurt(11);
    wait(op, DT);
    op.heal(2);
    wait(op, DT);
    op.hurt(2);
    wait(op, DT);
    expect(warns()).toEqual(['warn']);
    op.hurt(16);
    wait(op, DT);
    expect(warns()).toEqual(['warn', 'critical']);
    op.heal(30);
    wait(op, DT);
    op.hurt(20);
    wait(op, DT);
    expect(warns()).toEqual(['warn', 'critical', 'warn']);
  });

  it('GAM-0160: +0.15/s passive recovery when nothing drains', () => {
    const op = running(() => [new Anchor()], { vitals: 50 });
    wait(op, 10);
    expect(op.vitals).toBeCloseTo(51.5, 1);
  });

  it('GAM-0161: drain-rate arrow from the last second', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 200, 1), new Anchor()], { vitals: 90 });
    wait(op, 1.2);
    expect(op.drainArrow()).toBe(2);
    const slow = running(() => [new Laceration(at(0, 0), 0, 40, 1), new Anchor()], { vitals: 90 });
    wait(slow, 1.2);
    expect(slow.drainArrow()).toBe(1);
    const none = running(() => [new Anchor()], { vitals: 90 });
    wait(none, 1.2);
    expect(none.drainArrow()).toBe(0);
  });

  it('GAM-0162: the heartbeat is simulated deterministically and quickens as vitals fall', () => {
    const beats = (v: number) => {
      const op = running(() => [new Anchor()], { vitals: v });
      let n = 0;
      let last = op.beatPhase;
      for (let i = 0; i < 600; i++) {
        op.update(DT);
        op.vitals = v;
        if (op.beatPhase < last) n++;
        last = op.beatPhase;
      }
      return n;
    };
    expect(beats(20)).toBeGreaterThan(beats(90));
    expect(beats(50)).toBe(beats(50));
  });

  it('GAM-0164: Sext’s false vitals — the lens over the heart shows the truth', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 200, 3), new Anchor()], { vitals: 90, fakeVitals: true });
    wait(op, 8);
    expect(op.displayVitals()).toBeGreaterThan(op.vitals + 5);
    new Hand(op).frame('lens', { x: 660, y: 410 - 250 * 0.55 }, false);
    expect(op.displayVitals()).toBe(op.vitals);
  });

  it('GAM-0165: frail patients have 0.8× max vitals, hardy ones take 1/1.2 of the drain', () => {
    expect(running(() => [new Anchor()], { constitution: 'frail' }).maxVitals).toBe(79);
    const hardy = running(() => [new Laceration(at(0, 0), 0, 60, 1), new Anchor()], { constitution: 'hardy', vitals: 90 });
    const v = hardy.vitals;
    hardy.update(DT);
    expect((v - hardy.vitals) / DT).toBeCloseTo(0.65 / 1.2, 3);
  });
});

describe('GAM-H Litany', () => {
  it('GAM-0167: the Litany slows entities, never the surgeon (hold timers run in real time)', () => {
    const op = running((o) => [new Grub(at(0, 0), o, 0), new Anchor()], { litany: true });
    op.invokeLitany();
    expect(op.timeScale).toBeCloseTo(0.15);
    new Hand(op).hold('brand', at(0, 0), 0.85);
    expect(op.entities.filter((e) => e instanceof Grub).length).toBe(0);
    const t = op.timeLeft;
    wait(op, 2);
    expect(op.timeLeft).toBe(t);
  });

  it('GAM-0169: each COOL during the Litany adds 0.25 s, up to +3 s', () => {
    const op = running((o) => [...Array.from({ length: 3 }, (_, i) => new Grub(at(-300 + i * 40, 0), o, 0)), new Anchor()], { litany: true });
    op.invokeLitany();
    const h = new Hand(op);
    let held = 0;
    for (let i = 0; i < 3; i++) {
      h.hold('brand', at(-300 + i * 40, 0), 0.82);
      h.release();
      held += 0.82 + 2 * DT;
    }
    expect(op.litanyTime).toBeCloseTo(8 - held + 0.75, 1);
    const t = op.litanyTime;
    for (let i = 0; i < 20; i++) op.rate('cool', at(0, 0), 'Seared');
    expect(op.litanyTime).toBeCloseTo(t + 2.25, 5);
    // Only COOLs extend it.
    op.rate('good', at(0, 0), 'Sealed');
    expect(op.litanyTime).toBeCloseTo(t + 2.25, 5);
  });

  it('GAM-0172/0173: rite variants share the star — Vigil reveals, Mercy freezes drain, Wrath doubles the brand', () => {
    const hidden = () => {
      const e = new Embedded(at(0, 0), 'shard', 0, false);
      e.hidden = true;
      return e;
    };
    const vigil = running(() => [hidden(), new Anchor()], { litany: true }, { litanyVariant: 'vigil' });
    vigil.invokeLitany();
    expect(vigil.entities[0].hidden).toBe(false);
    expect(vigil.timeScale).toBe(1);

    const mercy = running(() => [new Laceration(at(0, 0), 0, 100, 1), new Anchor()], { litany: true, vitals: 80 }, { litanyVariant: 'mercy' });
    mercy.invokeLitany();
    const v = mercy.vitals;
    wait(mercy, 5);
    expect(mercy.vitals).toBe(v);
    wait(mercy, 2);
    expect(mercy.vitals).toBeLessThan(v);

    const wrath = running((o) => [new Grub(at(0, 0), o, 0), new Anchor()], { litany: true }, { litanyVariant: 'wrath' });
    wrath.invokeLitany();
    new Hand(wrath).hold('brand', at(0, 0), 0.45);
    expect(wrath.entities.filter((e) => e instanceof Grub).length).toBe(0);
  });

  it('GAM-0174: every use adds a Whisper (event only)', () => {
    const op = running(() => [new Anchor()], { litany: true, litanyUses: 2 });
    op.invokeLitany();
    wait(op, 9);
    op.invokeLitany();
    expect(op.whisper).toBe(2);
    expect(op.events.filter((e) => e.kind === 'whisper').length).toBe(2);
  });

  it('GAM-0175: a second use can be granted (Compline) — otherwise the Litany is once per op', () => {
    const op = running(() => [new Anchor()], { litany: true });
    expect(op.invokeLitany()).toBe(true);
    wait(op, 9);
    expect(op.invokeLitany()).toBe(false);
    op.grantLitany();
    expect(op.invokeLitany()).toBe(true);
  });
});

describe('GAM-I difficulty & assists', () => {
  it('GAM-0176: Novice (drain ×0.6, time ×1.4, guides), Surgeon, Master (×1.35, ×0.85, no guides)', () => {
    const def = byId('op1-1');
    const n = new Operation(def, { difficulty: 'novice' });
    const m = new Operation(def, { difficulty: 'master' });
    expect(n.timeLimit).toBe(Math.round(def.timeLimit * 1.4));
    expect(m.timeLimit).toBe(Math.round(def.timeLimit * 0.85));
    expect([n.drainMult, m.drainMult]).toEqual([0.6, 1.35]);
    expect([n.guides, m.guides]).toEqual([true, false]);
  });

  it('GAM-0178: boss checkpoint — restart at the boss phase with vitals 70, flagged, no XS', () => {
    const def = byId('op1-5');
    // Something in the boss phase kills him outright.
    const deadly = { ...def, phases: def.phases.map((p, i) => (i === 2 ? { ...p, spawn: (o: Operation) => [...p.spawn(o), new Laceration(at(0, 150), 0, 300, 10)] } : p)) };
    const lost = playWithBot(deadly, { profile: 'steady', maxSeconds: 400 }).op;
    expect(lost.status).toBe('lost');
    const cp = lost.checkpointPhase();
    expect(cp).toBe(2);
    const again = new Operation(def, { checkpoint: cp! });
    wait(again, 2.5);
    expect(again.phase).toBe(2);
    expect(again.vitals).toBeLessThanOrEqual(70);
    expect(again.entities.some((e) => e instanceof Malison)).toBe(true);
    expect(again.checkpointed).toBe(true);
    again.score = 999999;
    expect(again.rank()).toBe('S');
    const won = playWithBot(def, { profile: 'steady', checkpoint: 2 }).op;
    expect(won.status).toBe('won');
    expect(won.resultFlags()).toContain('checkpointed');
  });

  it('GAM-0179: assists — hitboxes, guides, auto-lens, slow tells, no-fail floor — each flagged on results', () => {
    const hidden = new Embedded(at(0, 0), 'shard', 0, false);
    hidden.hidden = true;
    const auto = running(() => [hidden, new Anchor()], {}, { assists: { autoLens: true } });
    wait(auto, 4.2);
    expect(auto.entities[0].hidden).toBe(false);
    const nf = running(() => [new Laceration(at(0, 0), 0, 200, 5), new Anchor()], { vitals: 5 }, { assists: { noFail: true } });
    wait(nf, 5);
    expect(nf.vitals).toBe(1);
    expect(nf.status).toBe('running');
    const slow = running((o) => [new Malison(at(0, 0), o)], {}, { assists: { slowTells: true } });
    const m = slow.entities[0] as Malison;
    wait(slow, 4.9);
    expect(m.open).toBe(false);
    wait(slow, 0.2);
    expect(m.open).toBe(true);
    expect(nf.resultFlags()).toContain('no-fail');
    expect(slow.resultFlags()).toContain('slow tells');
    expect(running(() => [], {}, { assists: { bigHitboxes: true, guides: true } }).resultFlags()).toEqual(expect.arrayContaining(['larger targets', 'guides']));
  });

  it('GAM-0180: a failure-specific tip for repeated losses', () => {
    const op = running((o) => [new Embedded(at(0, 0), 'arrow', 0), new Anchor(), new Grub(at(100, 0), o, 0)]);
    new Hand(op).drag('tongs', [(op.entities[0] as Embedded).handle, { x: 900, y: 100 }], 300);
    op.lose('The patient has died.', 'vitals');
    expect(tipFor(op)?.id).toBe('barbs');
    const t = running(() => [new Anchor()]);
    t.lose('Time has run out.', 'time');
    expect(tipFor(t)?.id).toBe('time');
  });
});

describe('GAM-P operation flow', () => {
  it('GAM-0249: a 1.5 s drain-free breather between phases; the next phase spawns only after it', () => {
    const def = testDef(() => [], {}, [{ spawn: () => [new Laceration(at(0, 0), 0, 44, 0.1)] }, { spawn: () => [new Rot(at(0, 0), 30, 0)] }, { spawn: () => [] }]);
    const op = new Operation(def);
    wait(op, 2.1);
    (op.entities[0] as Laceration).kill();
    const v = op.vitals;
    wait(op, 1.4);
    expect(op.phase).toBe(0);
    expect(op.vitals).toBeGreaterThanOrEqual(v);
    wait(op, 0.2);
    expect(op.phase).toBe(1);
    expect(op.entities.some((e) => e instanceof Rot)).toBe(true);
  });

  it('GAM-0250: pause freezes the simulation and the lens', () => {
    const hidden = new Embedded(at(0, 0), 'shard', 0, false);
    hidden.hidden = true;
    const op = running(() => [hidden, new Laceration(at(100, 0), 0, 100, 1)]);
    op.paused = true;
    const v = op.vitals;
    const h = new Hand(op);
    for (let i = 0; i < 60; i++) h.frame('lens', at(0, 0), false);
    expect(op.vitals).toBe(v);
    expect(hidden.hidden).toBe(true);
  });

  it('GAM-0251: callouts queue by priority (danger > instruction > praise), each shown ≥ 2.5 s', () => {
    const op = running(() => [new Anchor()]);
    op.callouts.length = 0;
    op.say('Now the lancet.');
    op.say('Well done.', 'praise');
    op.say('He’s bleeding out!', 'danger');
    op.say('Then the thread.');
    expect(op.callouts).toEqual(['Now the lancet.', 'He’s bleeding out!', 'Then the thread.', 'Well done.']);
    wait(op, 2.4);
    expect(op.callouts[0]).toBe('Now the lancet.');
    wait(op, 0.2);
    expect(op.callouts[0]).toBe('He’s bleeding out!');
    op.sayOnce('k', 'Once.');
    op.sayOnce('k', 'Once.');
    expect(op.callouts.filter((c) => c === 'Once.').length).toBe(1);
  });

  it('GAM-0253: time out loses; the last 30 s tick', () => {
    const op = running(() => [new Anchor()], { timeLimit: 35 });
    wait(op, 36);
    expect(op.status).toBe('lost');
    expect(op.lostCause).toBe('time');
  });

  it('GAM-0254: a 2 s "Begin" beat ignores input and drains nothing', () => {
    const op = new Operation(testDef(() => [new Laceration(at(0, 0), 0, 100, 1)]));
    const v = op.vitals;
    const h = new Hand(op);
    h.hold('lancet', at(0, 100), 1.9);
    expect(op.status).toBe('intro');
    expect(op.vitals).toBe(v);
    expect(op.counts.miss).toBe(0);
    wait(op, 0.2);
    expect(op.status).toBe('running');
  });

  it('GAM-0255: an op that opened the patient always ends with the closing suture', () => {
    for (const def of allOperations()) {
      const src = def.phases.map((p) => p.spawn.toString()).join('\n');
      const opens = /new Incision/.test(src);
      if (!opens) continue;
      const op = playWithBot(def, { profile: 'steady', collect: () => undefined }).op;
      expect(op.status, def.id).toBe('won');
      expect(op.scars.length, def.id).toBeGreaterThan(0);
    }
    // A def that forgets its closing phase gets one anyway.
    const forgot = testDef(() => [], { noClose: false }, [
      {
        spawn: () => {
          const inc = new Incision([at(-80, 0), at(80, 0)]);
          inc.state = 'open';
          inc.required = false;
          return [inc, new Laceration(at(0, 100), 0, 44, 0.1)];
        },
      },
    ]);
    const op = new Operation(forgot);
    wait(op, 2.1);
    const lac = op.entities.find((e) => e instanceof Laceration) as Laceration;
    new Hand(op).drag('thread', zig(lac.a, lac.b, 3), 300);
    wait(op, 1);
    expect(op.status).toBe('running');
    expect(op.callouts.some((c) => c.includes('Close the incision'))).toBe(true);
  });

  it('GAM-0256: scripted events fire at a phase time or when something is cleared', () => {
    const def = testDef(() => [], {
      events: [
        { at: { phase: 0, t: 1 }, say: ['One second in.'] },
        { when: { cleared: Laceration }, spawn: () => [new Rot(at(0, 0), 20, 0)] },
      ],
    }, [{ spawn: () => [new Laceration(at(0, 0), 0, 44, 0.1), new Anchor()] }]);
    const op = new Operation(def);
    wait(op, 3.1);
    expect(op.callouts).toContain('One second in.');
    const lac = op.entities[0] as Laceration;
    new Hand(op).drag('thread', zig(lac.a, lac.b, 3), 300);
    wait(op, DT * 2);
    expect(op.entities.some((e) => e instanceof Rot)).toBe(true);
  });

  it('GAM-0257: branching outcomes record story flags; score unaffected', () => {
    const def = testDef(() => [], { outcomes: (op) => (op.vitals > 50 ? ['spared'] : []) });
    const op = new Operation(def);
    wait(op, 5);
    expect(op.status).toBe('won');
    expect(op.storyFlags.has('spared')).toBe(true);
  });

  it('GAM-0258: a mid-op dialogue insert pauses the sim and resumes with a 1 s grace', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 100, 1), new Anchor()], { vitals: 90 });
    op.interrupt(['Doctor… is it bad?', 'Hold still.']);
    const v = op.vitals;
    wait(op, 3);
    expect(op.vitals).toBe(v);
    op.advanceDialogue();
    op.advanceDialogue();
    wait(op, 0.9);
    expect(op.vitals).toBe(v);
    wait(op, 0.5);
    expect(op.vitals).toBeLessThan(v);
  });

  it('GAM-0259: once per op, Sister Ilse drains the largest pool for −200', () => {
    const op = running(() => [new BloodPool(at(0, 0), 50), new BloodPool(at(100, 0), 20), new Anchor()]);
    op.score = 500;
    expect(op.ilseAssist()).toBe(true);
    expect(op.entities.filter((e) => e instanceof BloodPool && e.alive).length).toBe(1);
    expect(op.score).toBe(300);
    expect(op.ilseAssist()).toBe(false);
  });
});
