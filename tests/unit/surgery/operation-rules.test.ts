/**
 * Operation rule tests (QAT-0017…0031): scoring, ranks, win/loss, the Litany, the tincture,
 * empty-tool penalties, phase flow, feedback, callouts, tool selection and input priority.
 * They pin down current behaviour; when the GAM scoring spec lands, the tables change with it.
 */
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../../src/content/campaign';
import { Embedded, Grub, Laceration, Sigil, SIGILS } from '../../../src/surgery/entities';
import { ChoirVoice, LaudsMalison } from '../../../src/surgery/lauds';
import { Malison, MalisonShard } from '../../../src/surgery/malison';
import {
  FIELD,
  LITANY_DURATION,
  LITANY_SCALE,
  MAX_VITALS,
  Operation,
  TINCTURE_COOLDOWN,
  TINCTURE_HEAL,
  TINCTURE_TIME,
  type OperationDef,
} from '../../../src/surgery/operation';
import { RANK_TABLE } from '../../fixtures/rank-table';
import { DT, defWith, tape, tapeOp, drag, holdAt, isolate, makeOp, press, release, start, step, tap } from '../../helpers/sim';
import { Probe } from '../../helpers/probe';

const C = { x: FIELD.cx, y: FIELD.cy };
const OFF = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 80 };
const at = (dx: number, dy: number) => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

/** A running op holding one required probe that never dies on its own (so the phase never ends). */
function runningOp(overrides: Partial<OperationDef> = {}): { op: Operation; probe: Probe } {
  const { op, ents } = isolate(() => [new Probe(at(300, 200))], overrides);
  return { op, probe: ents[0] };
}

describe('QAT-0017 combo multiplier', () => {
  it('first COOL is worth 105', () => {
    const { op } = runningOp();
    op.rate('cool', C);
    expect(op.score).toBe(105);
    expect(op.combo).toBe(1);
  });

  it('the 20th consecutive COOL is worth 200 and the multiplier caps there', () => {
    const { op } = runningOp();
    const gains: number[] = [];
    for (let i = 0; i < 25; i++) {
      const before = op.score;
      op.rate('cool', C);
      gains.push(op.score - before);
    }
    expect(gains[0]).toBe(105);
    expect(gains[19]).toBe(200);
    expect(gains[24]).toBe(200);
    for (let i = 0; i < 25; i++) expect(gains[i]).toBe(Math.round(100 * (1 + Math.min(i + 1, 20) * 0.05)));
  });

  it('GOOD at combo 1 is worth 63', () => {
    const { op } = runningOp();
    op.rate('good', C);
    expect(op.score).toBe(63);
  });
});

describe('QAT-0018 combo break', () => {
  it.each([
    ['bad', 15],
    ['miss', 0],
  ] as const)('%s resets the combo, keeps maxCombo and awards %i', (r, pts) => {
    const { op } = runningOp();
    for (let i = 0; i < 4; i++) op.rate('cool', C);
    tape(op).cues.length = 0;
    const before = op.score;
    op.rate(r, C);
    expect(op.combo).toBe(0);
    expect(op.maxCombo).toBe(4);
    expect(op.score - before).toBe(pts);
    expect(tape(op).cues).toEqual([r]);
  });

  it('tallies every rating exactly once', () => {
    const { op } = runningOp();
    const seq = ['cool', 'good', 'bad', 'cool', 'miss', 'miss', 'good'] as const;
    for (const r of seq) op.rate(r, C);
    expect(op.counts).toEqual({ cool: 2, good: 2, bad: 1, miss: 2 });
    expect(op.maxCombo).toBe(2);
  });
});

describe('QAT-0019 rank boundaries', () => {
  it.each(allOperations().map((d) => [d.id, d] as const))('%s follows the rank table', (_id, def) => {
    for (const c of RANK_TABLE) {
      const op = tapeOp(new Operation(def));
      op.score = c.score(op.ranks);
      op.counts = { cool: 10, good: 3, bad: c.bad, miss: c.miss };
      expect(op.rank(), `${def.id}: ${c.label}`).toBe(c.expected);
    }
  });
});

describe('QAT-0020 victory bonus', () => {
  it('adds round(average vitals) × vitalsBonus + round(timeLeft) × timeBonus exactly once', () => {
    const { op, ents } = isolate(() => [new Probe(at(0, 0))], { timeLimit: 120 });
    step(op, 10.3);
    op.vitals = 71.6;
    ents[0].kill();
    const score = op.score;
    let frames = 0;
    while (op.status === 'running' && frames++ < 600) op.update(DT);
    expect(op.status).toBe('won');
    // The vitals bonus pays for the average over the run, so a last-second tincture buys nothing.
    const T = op.tuning.scoring;
    const bonus = { vitals: Math.round(Math.round(op.averageVitals) * T.vitalsBonus), time: Math.round(op.timeLeft) * T.timeBonus, closure: 0 };
    expect(op.bonus).toEqual(bonus);
    expect(op.score).toBe(score + bonus.vitals + bonus.time);
    const frozen = { score: op.score, vitals: op.vitals, timeLeft: op.timeLeft };
    step(op, 5);
    op.handlePointer(press(C), DT);
    expect({ score: op.score, vitals: op.vitals, timeLeft: op.timeLeft }).toEqual(frozen);
    expect(tape(op).cues.filter((c) => c === 'bell')).toHaveLength(1);
  });
});

describe('QAT-0021 loss states', () => {
  it('vitals reaching 0 loses with "The patient has died."', () => {
    const { op } = runningOp();
    tape(op).cues.length = 0;
    op.hurt(200);
    expect(op.vitals).toBe(0);
    op.update(DT);
    expect(op.status).toBe('lost');
    expect(op.lostReason).toBe('The patient has died.');
    const snapshot = JSON.stringify({ v: op.vitals, t: op.timeLeft, s: op.score, e: op.elapsed });
    step(op, 3);
    op.hurt(5);
    op.rate('cool', C);
    expect(tape(op).cues.filter((c) => c === 'flatline')).toHaveLength(1);
    expect(JSON.stringify({ v: op.vitals, t: op.timeLeft, s: op.score - 105, e: op.elapsed })).toBe(snapshot);
  });

  it('the timer reaching 0 clamps timeLeft to 0 and loses with "Time has run out."', () => {
    const { op } = runningOp({ timeLimit: 2 });
    tape(op).cues.length = 0;
    step(op, 3);
    expect(op.status).toBe('lost');
    expect(op.timeLeft).toBe(0);
    expect(op.lostReason).toBe('Time has run out.');
    step(op, 2);
    expect(op.timeLeft).toBe(0);
    expect(tape(op).cues.filter((c) => c === 'flatline')).toHaveLength(1);
  });
});

describe('QAT-0022 Litany clock', () => {
  it('freezes the timer, keeps elapsed running and scales entity dt by LITANY_SCALE', () => {
    const { op, probe } = runningOp();
    expect(op.invokeLitany()).toBe(true);
    const t0 = op.timeLeft;
    const e0 = op.elapsed;
    probe.updates.length = 0;
    step(op, LITANY_DURATION - 0.5);
    expect(op.timeLeft).toBe(t0);
    expect(op.elapsed - e0).toBeCloseTo(LITANY_DURATION - 0.5, 6);
    expect(probe.updates.every((d) => Math.abs(d - DT * LITANY_SCALE) < 1e-12)).toBe(true);
    step(op, 1);
    expect(op.litanyTime).toBe(0);
    expect(op.timeLeft).toBeLessThan(t0);
    expect(probe.updates[probe.updates.length - 1]).toBeCloseTo(DT, 12);
  });
});

describe('QAT-0023 Litany gating', () => {
  it('succeeds once per operation with exactly one cue', () => {
    const { op } = runningOp();
    tape(op).cues.length = 0;
    expect(op.invokeLitany()).toBe(true);
    step(op, LITANY_DURATION + 1);
    expect(op.invokeLitany()).toBe(false);
    expect(tape(op).cues.filter((c) => c === 'litany')).toHaveLength(1);
  });

  it('fails when the op disables it', () => {
    const { op } = runningOp({ litany: false });
    expect(op.invokeLitany()).toBe(false);
    expect(tape(op).cues).not.toContain('litany');
  });

  it('fails unless the operation is running', () => {
    const intro = makeOp(defWith(() => [new Probe(C)]));
    expect(intro.status).toBe('intro');
    expect(intro.invokeLitany()).toBe(false);
    const { op } = runningOp();
    op.lose('test');
    expect(op.invokeLitany()).toBe(false);
    expect(op.litanyUsed).toBe(false);
  });
});

describe('QAT-0024 tincture', () => {
  it('a 0.7 s hold on the body heals 25 and starts a 6 s cooldown', () => {
    const { op } = runningOp();
    op.vitals = 50;
    op.setTool('tincture');
    op.handlePointer(press(C), DT);
    let held = DT;
    while (op.vitals === 50 && held < 2) {
      op.handlePointer(drag(C, C), DT);
      held += DT;
    }
    expect(held).toBeGreaterThanOrEqual(TINCTURE_TIME - 1e-9);
    expect(held).toBeLessThan(TINCTURE_TIME + 2 * DT);
    expect(op.vitals).toBe(50 + TINCTURE_HEAL);
    expect(op.injectCooldown).toBe(TINCTURE_COOLDOWN);
    expect(tape(op).cues).toContain('inject');
  });

  it('caps healing at 99', () => {
    const { op } = runningOp();
    op.vitals = 90;
    holdAt(op, 'tincture', C, 0.8, false);
    expect(op.vitals).toBe(MAX_VITALS);
  });

  it('releasing early resets progress', () => {
    const { op } = runningOp();
    op.vitals = 50;
    holdAt(op, 'tincture', C, 0.5, false);
    expect(op.injectT).toBe(0);
    holdAt(op, 'tincture', C, 0.5, false);
    expect(op.vitals).toBe(50);
  });

  it('heals nothing off the body or while cooling down', () => {
    const { op } = runningOp();
    op.vitals = 50;
    holdAt(op, 'tincture', OFF, 1.5, false);
    expect(op.vitals).toBe(50);
    holdAt(op, 'tincture', C, 0.8, false);
    expect(op.vitals).toBe(75);
    op.vitals = 50;
    holdAt(op, 'tincture', C, 2, false);
    expect(op.vitals).toBe(50);
  });
});

describe('QAT-0025 empty lancet press', () => {
  it('a plain click on bare body is never a miss', () => {
    const { op } = runningOp();
    tap(op, 'lancet', at(-200, -100), false);
    expect(op.counts.miss).toBe(0);
  });

  it('held on bare body with work on the table: MISS "Stray cut", strayCutHurt vitals, cut cue', () => {
    const { op } = runningOp();
    tape(op).cues.length = 0;
    const v = op.vitals;
    holdAt(op, 'lancet', at(-200, -100), op.tuning.miss.emptyHold + 0.05, false);
    expect(op.counts.miss).toBe(1);
    expect(op.vitals).toBeCloseTo(v - op.tuning.miss.strayCutHurt, 6);
    expect(tape(op).cues.filter((c) => c !== 'select')).toEqual(['miss', 'cut']);
  });

  it('outside the FIELD ellipse does nothing', () => {
    const { op } = runningOp();
    tape(op).cues.length = 0;
    const v = op.vitals;
    tap(op, 'lancet', OFF, false);
    expect(op.counts.miss).toBe(0);
    expect(op.vitals).toBe(v);
    expect(tape(op).cues.filter((c) => c !== 'select')).toEqual([]);
  });

  it('is not penalised once nothing required is left', () => {
    const { op } = isolate(() => [new Probe(C, { required: false })]);
    tap(op, 'lancet', at(-200, -100), false);
    expect(op.counts.miss).toBe(0);
  });
});

describe('QAT-0026 brand on healthy flesh', () => {
  it('drains 4 vitals/s and says brand-flesh once', () => {
    const { op } = runningOp();
    const v = op.vitals;
    holdAt(op, 'brand', at(-200, -100), 1, false);
    expect(v - op.vitals).toBeCloseTo(4, 1);
    holdAt(op, 'brand', at(-200, -100), 1, false);
    expect(op.callouts.filter((l) => l.includes('searing healthy flesh'))).toHaveLength(1);
    expect(op.flags.has('brand-flesh')).toBe(true);
  });

  /** Vitals lost while holding the brand on `pos` minus the loss while merely hovering there. */
  function brandCost(make: (op: Operation) => void, pos: (op: Operation) => { x: number; y: number }, seconds = 0.2): number {
    const run = (down: boolean) => {
      const op = start(makeOp(defWith(() => [new Probe(at(380, 150))])));
      make(op);
      op.setTool('brand');
      const v = op.vitals;
      let prev = pos(op);
      if (down) op.handlePointer(press(prev), DT);
      for (let t = 0; t < seconds; t += DT) {
        const p = pos(op);
        op.handlePointer(down ? drag(p, prev) : { pos: p, prev, down: false, pressed: false, released: false }, DT);
        op.update(DT);
        prev = p;
      }
      return { lost: v - op.vitals, flagged: op.flags.has('brand-flesh') };
    };
    const held = run(true);
    const idle = run(false);
    expect(held.flagged).toBe(false);
    return held.lost - idle.lost;
  }

  it('holding it on a grub, sigil, Choir Voice or open Malison drains nothing extra', () => {
    let g: Grub | undefined;
    const grub = brandCost(
      (op) => op.spawn((g = new Grub(at(0, 0), op))),
      () => g!.pos,
    );
    expect(g!.alive).toBe(true);
    expect(grub).toBeCloseTo(0, 9);
    const sigil = brandCost(
      (op) => op.spawn(new Sigil(at(0, 0), SIGILS.eye, 60, 999)),
      () => at(-60, 0),
    );
    expect(sigil).toBeCloseTo(0, 9);
    let voice: ChoirVoice | undefined;
    const choir = brandCost(
      (op) => {
        op.spawn(new LaudsMalison(at(0, 0), op));
        voice = op.entities.find((e): e is ChoirVoice => e instanceof ChoirVoice);
      },
      () => voice!.pos,
    );
    expect(choir).toBeCloseTo(0, 9);
    let mal: Malison | undefined;
    const malison = brandCost(
      (op) => {
        mal = new Malison(at(0, 0), op);
        mal.open = true;
        op.spawn(mal);
      },
      () => mal!.pos,
    );
    expect(malison).toBeCloseTo(0, 9);
  });
});

describe('QAT-0027 phase flow', () => {
  it('waits flow.intro seconds in the intro, then spawns phase 0', () => {
    const op = makeOp(defWith(() => [new Probe(C)]));
    step(op, op.tuning.flow.intro - 0.05);
    expect(op.status).toBe('intro');
    expect(op.phase).toBe(-1);
    step(op, 0.1);
    expect(op.status).toBe('running');
    expect(op.phase).toBe(0);
  });

  it('spawns the next phase a breather after the last required entity dies; non-required never block; clearing the last phase wins 0.8 s later', () => {
    const blocker = new Probe(at(-100, 0));
    const def = defWith(() => [blocker, new Probe(at(100, 0), { required: false })], {
      phases: [{ spawn: () => [blocker, new Probe(at(100, 0), { required: false })] }, { spawn: () => [new Probe(at(0, 100))] }],
    });
    const op = start(makeOp(def));
    step(op, 3);
    expect(op.phase).toBe(0);
    blocker.kill();
    step(op, op.tuning.flow.breather - 0.05);
    expect(op.phase).toBe(0);
    step(op, 0.1);
    expect(op.phase).toBe(1);
    for (const e of op.entities) e.kill();
    step(op, 0.9);
    expect(op.status).toBe('won');
    expect(op.phase).toBe(2);
  });
});

describe('QAT-0028 damage feedback', () => {
  it('hurt() is ignored unless running', () => {
    const op = makeOp(defWith(() => [new Probe(C)]));
    op.hurt(10, C);
    expect(op.vitals).toBe(MAX_VITALS);
    expect(op.shake).toBe(0);
    expect(tape(op).popups).toHaveLength(0);
  });

  it('caps shake at 12, decays it at 30/s and announces a red -N popup for hits ≥ 1', () => {
    const { op } = runningOp();
    tape(op).popups.length = 0;
    op.hurt(20, C);
    expect(op.shake).toBe(12);
    expect(tape(op).popups).toEqual([expect.objectContaining({ text: '-20', color: '#c0392b' })]);
    op.hurt(0.5, C);
    expect(tape(op).popups).toHaveLength(1);
    op.update(0.1);
    expect(op.shake).toBeCloseTo(12 - 3, 9);
  });
});

describe('QAT-0029 callout queue', () => {
  it('shows each line for max(2.5 s, 0.055 s × length)', () => {
    const { op } = runningOp();
    op.callouts.length = 0;
    const short = 'Short.';
    const long = 'x'.repeat(100);
    op.say(short, long);
    step(op, 2.45);
    expect(op.callouts[0]).toBe(short);
    step(op, 0.1);
    expect(op.callouts[0]).toBe(long);
    step(op, 5.4);
    expect(op.callouts[0]).toBe(long);
    step(op, 0.15);
    expect(op.callouts).toHaveLength(0);
  });

  it('sayOnce never repeats a flag', () => {
    const { op } = runningOp();
    op.callouts.length = 0;
    op.sayOnce('f', 'once');
    op.sayOnce('f', 'once');
    step(op, 10);
    op.sayOnce('f', 'once');
    expect(op.callouts).toHaveLength(0);
  });

  it('the low-vitals line fires once when vitals drop below the warning line', () => {
    const { op } = runningOp();
    op.callouts.length = 0;
    op.vitals = 30;
    op.update(DT);
    expect(op.journal.some((e) => e.kind === 'vitalsWarn')).toBe(false);
    op.vitals = 29.9;
    op.update(DT);
    op.vitals = 20;
    op.update(DT);
    expect(op.callouts.filter((l) => l.startsWith('Vitals are failing'))).toHaveLength(1);
  });
});

describe('QAT-0030 tool selection', () => {
  it('ignores tools the op does not offer', () => {
    const { op } = runningOp({ tools: ['thread', 'leech', 'salve'] });
    op.setTool('brand');
    expect(op.tool).toBe('thread');
  });

  it('cycleTool wraps both ways', () => {
    const { op } = runningOp({ tools: ['thread', 'leech', 'salve'] });
    // Steps closer together than tools.wheelDebounce count once (one wheel notch), so pace them.
    const cycle = (d: number) => {
      op.cycleTool(d);
      step(op, 0.1);
    };
    cycle(-1);
    expect(op.tool).toBe('salve');
    cycle(1);
    expect(op.tool).toBe('thread');
    cycle(1);
    cycle(1);
    cycle(1);
    expect(op.tool).toBe('thread');
  });

  it('switching tools releases the captured entity and cancels a tincture hold', () => {
    const { op, probe } = runningOp();
    const grab = new Probe(at(0, 0), { grabRadius: 20 });
    op.spawn(grab);
    op.setTool('tongs');
    op.handlePointer(press(at(0, 0)), DT);
    op.handlePointer(drag(at(5, 0), at(0, 0)), DT);
    const drags = grab.drags;
    expect(drags).toBeGreaterThan(0);
    op.setTool('lancet');
    op.handlePointer(drag(at(10, 0), at(5, 0)), DT);
    op.handlePointer(release(at(10, 0)), DT);
    expect(grab.drags).toBe(drags);
    expect(grab.releases).toBe(0);
    expect(probe.presses.length).toBeGreaterThan(0);

    op.vitals = 40;
    op.setTool('tincture');
    const spot = at(-150, 50);
    op.handlePointer(press(spot), DT);
    for (let i = 0; i < 30; i++) op.handlePointer(drag(spot, spot), DT);
    expect(op.injectT).toBeGreaterThan(0.4);
    op.setTool('salve');
    expect(op.injectT).toBe(0);
  });
});

describe('QAT-0031 input priority', () => {
  it('presses go to the highest layer first', () => {
    const { op } = runningOp();
    const low = new Probe(at(0, 0), { layer: 3, grabRadius: 30 });
    const high = new Probe(at(0, 0), { layer: 4, grabRadius: 30 });
    op.spawn(low, high);
    tap(op, 'tongs', at(0, 0), false);
    expect(high.presses).toEqual(['tongs']);
    expect(low.presses).toEqual([]);
    expect(high.releases).toBe(1);
  });

  it('a Malison shard (layer 7) is seized before the embedded shaft beneath it (layer 3)', () => {
    const { op } = runningOp();
    const shaft = new Embedded(at(0, 0), 'shot', 0, false);
    const shard = new MalisonShard(at(0, 0), op);
    op.spawn(shaft, shard);
    op.setTool('tongs');
    op.handlePointer(press(at(0, 0)), DT);
    expect(shaft.grabbed).toBe(false);
  });

  it('the Malison (layer 4) receives the brand over a laceration beneath it', () => {
    const { op } = runningOp();
    const lac = new Laceration(at(0, 0), 0, 80);
    const mal = new Malison(at(0, 0), op);
    mal.open = true;
    op.spawn(lac, mal);
    const ordered = op.visibleEntities().sort((a, b) => b.layer - a.layer);
    expect(ordered.indexOf(mal)).toBeLessThan(ordered.indexOf(lac));
    const hp = mal.hp;
    holdAt(op, 'brand', at(0, 0), 0.2, false);
    expect(mal.hp).toBeLessThan(hp);
  });

  it('hidden entities never receive presses or sweeps', () => {
    const { op } = runningOp();
    const hidden = new Probe(at(0, 0), { hidden: true, grabRadius: 50 });
    const buried = new Embedded(at(40, 0), 'hexstone', 0, false);
    buried.hidden = true;
    op.spawn(hidden, buried);
    holdAt(op, 'tongs', at(0, 0), 0.3, false);
    holdAt(op, 'tongs', at(40, 0), 0.3, false);
    holdAt(op, 'brand', at(0, 0), 0.3, false);
    expect(hidden.presses).toEqual([]);
    expect(hidden.sweeps).toEqual([]);
    expect(buried.grabbed).toBe(false);
    expect(buried.pos).toEqual(buried.origin);
  });
});

/** Gaps found by the StrykerJS baseline on operation.ts (QAT-0052, docs/qa/mutation-testing.md). */
describe('QAT-0052 mutation-testing gaps', () => {
  it('the tincture cooldown expires after 6 s of play', () => {
    const { op } = runningOp();
    op.vitals = 40;
    holdAt(op, 'tincture', C, 0.8, false);
    expect(op.vitals).toBe(65);
    step(op, TINCTURE_COOLDOWN - 0.2);
    op.vitals = 40;
    holdAt(op, 'tincture', C, 0.8, false);
    expect(op.vitals).toBe(40);
    step(op, 0.3);
    expect(op.injectCooldown).toBe(0);
    op.vitals = 40;
    holdAt(op, 'tincture', C, 0.8, false);
    expect(op.vitals).toBe(65);
  });

  it('pointer input is ignored unless the operation is running', () => {
    const intro = makeOp(defWith(() => [new Probe(C)]));
    tap(intro, 'lancet', at(-200, -100), false);
    expect(intro.counts.miss).toBe(0);
    expect(intro.pressId).toBe(0);
    const { op } = runningOp();
    op.lose('test');
    tap(op, 'lancet', at(-200, -100), false);
    expect(op.counts.miss).toBe(0);
  });

  it('rating popups carry the label and the rating word in the rating colour', () => {
    const { op } = runningOp();
    tape(op).popups.length = 0;
    op.rate('cool', C, 'Incision');
    op.rate('good', C);
    op.rate('bad', C, 'Torn');
    op.rate('miss', C);
    expect(tape(op).popups.map((p) => [p.text, p.color, p.rating])).toEqual([
      ['Incision COOL', '#f5d76e', 'cool'],
      ['GOOD', '#9fd3a8', 'good'],
      ['Torn BAD', '#d98a5f', 'bad'],
      ['MISS', '#c0392b', 'miss'],
    ]);
    expect(tape(op).fx.filter((f) => f.kind === 'gold')).toHaveLength(1);
  });

  it('the timer reaching exactly 0 ends the operation', () => {
    const { op } = runningOp();
    op.timeLeft = 0.5;
    op.update(0.5);
    expect(op.status).toBe('lost');
  });

  it('phase callouts are queued when a phase starts and the win is announced', () => {
    const def = defWith(() => [], { phases: [{ callout: ['First line.', 'Second line.'], spawn: () => [new Probe(C)] }] });
    const op = start(makeOp(def));
    expect(op.callouts.slice(0, 2)).toEqual(['First line.', 'Second line.']);
    for (const e of op.entities) e.kill();
    step(op, 1);
    expect(op.status).toBe('won');
    expect(op.callouts).toContain('The operation is complete.');
  });

  it('quick-swap returns to the previous tool; nothing happens before a switch', () => {
    const { op } = runningOp({ tools: ['thread', 'leech', 'salve'] });
    op.quickSwap();
    expect(op.tool).toBe('thread');
    op.setTool('salve');
    op.quickSwap();
    expect(op.tool).toBe('thread');
    op.quickSwap();
    expect(op.tool).toBe('salve');
  });

  it('hurt shakes by 1.5 × the damage; low vitals raise a warning', () => {
    const { op } = runningOp();
    op.hurt(2);
    expect(op.shake).toBe(3);
    op.vitals = 20;
    op.update(DT);
    expect(op.journal.some((e) => e.kind === 'vitalsWarn' && e.level === 'warn')).toBe(true);
  });

  it('keeps at most 160 lasting stains, dropping the oldest', () => {
    const { op } = runningOp();
    for (let i = 0; i < 170; i++) op.stain({ x: i, y: 0 }, 5);
    expect(op.stains).toHaveLength(160);
    expect(op.stains[0].x).toBe(10);
  });

  it('the Litany shows its banner above the field', () => {
    const { op } = runningOp();
    tape(op).popups.length = 0;
    op.invokeLitany();
    expect(tape(op).popups).toEqual([expect.objectContaining({ text: 'THE LITANY OF STILLNESS', color: '#f5d76e', pos: { x: FIELD.cx, y: FIELD.cy - 120 } })]);
  });
});
