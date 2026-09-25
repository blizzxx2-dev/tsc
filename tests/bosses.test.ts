import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { Grub, Laceration } from '../src/surgery/entities';
import { distortion, InputDistortion } from '../src/surgery/bosses/common';
import { ComplineMalison, COMPLINE_DEFAULT, SilenceNode } from '../src/surgery/bosses/compline';
import { burrowPath, BurrowSegment, NoneMalison, NONE_DEFAULT, NONE_HEART } from '../src/surgery/bosses/none';
import { HOUR_TOOL, HOURS, hourTrial, OfficeMalison, UNISON_PAIRS } from '../src/surgery/bosses/office';
import { InkBlot, NameSigil, PRIME_NAMES, PrimeMalison } from '../src/surgery/bosses/prime';
import { CrustPlate, HeartTruth, SextMalison } from '../src/surgery/bosses/sext';
import { FlameTongue, TerceMalison } from '../src/surgery/bosses/terce';
import { LampNode, quadrantOf, TallowClot, VespersMalison, WickFilament } from '../src/surgery/bosses/vespers';
import { MALISON_VOICES } from '../src/surgery/bosses/voices';
import { Operation, type OperationDef } from '../src/surgery/operation';
import type { Pointer } from '../src/surgery/types';
import { all, at, C, DT, Hand, start, wait } from './harness';

// ============================================================ Prime

describe('Prime', () => {
  it('erases only in reverse stroke order', () => {
    let n!: NameSigil;
    const op = start((o) => [(n = new NameSigil(at(0, 0), 'Aldo Brenck', o, 1.2))]);
    wait(op, 3.7); // three strokes written
    expect(n.written).toBe(3);
    const bad = op.counts.bad;
    new Hand(op).drag('lancet', n.strokes[0], 200);
    expect(op.counts.bad).toBe(bad + 1);
    expect(n.written).toBe(3);
    new Hand(op).drag('lancet', n.strokes[2], 200);
    expect(n.written).toBe(2);
  });

  it('a finished name costs 18 vitals and opens a cut per letter', () => {
    let n!: NameSigil;
    const op = start((o) => [(n = new NameSigil(at(0, 0), 'Grete Hollweg', o, 0.5)), new Grub(at(300, 0), o, 0)]);
    const v = op.vitals;
    wait(op, 2.6);
    expect(n.alive).toBe(false);
    expect(v - op.vitals).toBeGreaterThanOrEqual(18);
    expect(all(op, Laceration).length).toBe(5);
  });

  it('the Litany stills the quill entirely', () => {
    let n!: NameSigil;
    const op = start((o) => [(n = new NameSigil(at(0, 0), 'Utz Pfennig', o, 1.2))]);
    op.invokeLitany();
    const w = n.writeT;
    wait(op, 3);
    expect(n.writeT).toBe(w);
    expect(n.written).toBe(0);
  });

  it('one quill: names written in parallel take turns, red ink is 30 % faster', () => {
    let p!: PrimeMalison;
    const op = start((o) => [(p = new PrimeMalison(at(0, 0), o))]);
    p.hp = 50; // phase 2, the Ledger
    wait(op, 8);
    const live = p.living;
    expect(live.length).toBeGreaterThanOrEqual(2);
    expect(live.filter((n) => !n.paused).length).toBe(1);
    for (const n of live) expect(n.strokeTime).toBeCloseTo(p.tune.stroke2 * (n.red ? 0.7 : 1) * (n.strokeTime > p.tune.stroke2 * 1.2 ? 1.4 : 1));
  });

  it('ink left 8 s becomes a new name; ink fouls the instrument that touches it', () => {
    let p!: PrimeMalison;
    const op = start((o) => [(p = new PrimeMalison(at(0, 0), o))]);
    const blot = new InkBlot(at(-200, 60), p);
    op.spawn(blot);
    new Hand(op).hold('salve', blot.pos, 0.2);
    expect(distortion(op).isFouled('salve')).toBe(true);
    wait(op, 8.2);
    expect(blot.alive).toBe(false);
    expect(p.names.some((n) => n.count === 3 && n.pos.x === blot.pos.x)).toBe(true);
  });

  it('forty original names on the roll', () => {
    expect(new Set(PRIME_NAMES).size).toBe(40);
  });
});

// ============================================================ Terce

describe('Terce', () => {
  it('the brand heals Terce and feeds its flames; a warning first, then BAD', () => {
    let t!: TerceMalison;
    const op = start((o) => [(t = new TerceMalison(o))]);
    t.hp = 80;
    wait(op, 2);
    const tongue = all(op, FlameTongue)[0];
    const bad = op.counts.bad;
    new Hand(op).hold('brand', tongue.pos, 2.5);
    expect(t.hp).toBeGreaterThan(80);
    expect(op.counts.bad).toBeGreaterThan(bad);
  });

  it('Pentecost tongues rekindle unless doused within 2 s of each other', () => {
    let t!: TerceMalison;
    const op = start((o) => [(t = new TerceMalison(o))]);
    t.hit(op, 36); // into phase 2
    expect(t.phaseNo).toBe(2);
    const [a, b] = all(op, FlameTongue);
    const salve = (f: FlameTongue) => {
      const last = f.cov.cells[0];
      for (const c of f.cov.cells) c.done = c !== last;
      const p = { x: f.pos.x + last.x, y: f.pos.y + last.y };
      new Hand(op).drag('salve', [p, { x: p.x + 1, y: p.y }], 100);
    };
    salve(a);
    expect(a.state).toBe('root');
    wait(op, 2.5);
    salve(b);
    expect(a.state).toBe('flame');
  });

  it('heat-haze displaces the instrument, not the cursor', () => {
    const d = new InputDistortion();
    d.haze = 10;
    const p = { x: 500, y: 400 };
    const out = d.filter({ pos: p, prev: p, down: true, pressed: true, released: false } as Pointer, DT);
    const off = Math.hypot(out.pos.x - p.x, out.pos.y - p.y);
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThanOrEqual(10 * Math.SQRT2);
    expect(p).toEqual({ x: 500, y: 400 });
  });

  it('fire-spread cap: never more than 3 tongues and 2 hexfire burns (≤ 6 patches), within the drain budget', () => {
    const op = start((o) => [new TerceMalison(o)], { vitals: 99, baseDrain: -5 });
    for (let i = 0; i < 60; i++) {
      wait(op, 1);
      expect(all(op, FlameTongue).length).toBeLessThanOrEqual(3);
      expect(op.entities.filter((e) => e.constructor.name === 'Burn' && e.alive).length).toBeLessThanOrEqual(2);
      // Drain budget: the boss and everything it has spread stay under 2.2 vitals/s.
      expect(op.entities.filter((e) => e.alive && !e.hidden).reduce((d, e) => d + e.drain(op), 0)).toBeLessThanOrEqual(2.2);
    }
  });
});

// ============================================================ Sext

describe('Sext', () => {
  it('torpor lag is applied deterministically and never drops a press', () => {
    const run = () => {
      const d = new InputDistortion();
      d.lag = 0.25;
      const log: string[] = [];
      for (let i = 0; i < 60; i++) {
        const down = i >= 5 && i < 7;
        const out = d.filter({ pos: { x: i, y: 0 }, prev: { x: i - 1, y: 0 }, down, pressed: i === 5, released: i === 7 }, DT);
        log.push(`${out.pos.x}:${out.pressed ? 'P' : ''}${out.released ? 'R' : ''}`);
      }
      return log;
    };
    const a = run();
    expect(a).toEqual(run());
    const pressAt = a.findIndex((s) => s.endsWith('P'));
    expect(pressAt).toBe(5 + 15);
    expect(a.some((s) => s.endsWith('R'))).toBe(true);
  });

  it('a stimulant tincture lifts the torpor', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))]);
    wait(op, 20);
    expect(s.lag).toBeCloseTo(0.25, 2);
    new Hand(op).hold('tincture', at(330, 20), 1.2);
    expect(s.lag).toBeLessThan(0.05);
  });

  it('False Noon: the vitals read calm; only the lens on the heart shows the truth', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))]);
    for (const p of all(op, CrustPlate)) p.kill();
    s.hp = 61;
    new Hand(op).hold('brand', s.pos, 0.3);
    expect(s.stage).toBe(2);
    const start0 = s.trueVitals!;
    wait(op, 15);
    expect(s.trueVitals).not.toBeNull();
    expect(Math.abs(op.vitals - 70)).toBeLessThan(2);
    expect(s.trueVitals!).toBeLessThan(start0 - 15);
    const truth = all(op, HeartTruth)[0];
    new Hand(op).hold('lens', truth.pos, 0.3, false);
    expect(op.vitals).toBeCloseTo(s.trueVitals!, 0);
  });

  it('the Litany clashes with its Stillness: both end and Sext is stunned', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))]);
    for (const p of all(op, CrustPlate)) p.kill();
    s.hp = 31;
    s.stage = 2;
    s.trueVitals = op.vitals;
    (s as unknown as { cycleStart: number }).cycleStart = 31;
    new Hand(op).hold('brand', s.pos, 0.3);
    expect(s.stillborn).toBe(true);
    op.invokeLitany();
    wait(op, DT * 2);
    expect(s.stillborn).toBe(false);
    expect(op.litanyTime).toBe(0);
    expect(s.stunT).toBeGreaterThan(3.9);
  });
});

// ============================================================ None

describe('None', () => {
  it('fairness: no tunnel starts closer than 8 s of travel from the heart', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const op = new Operation({ id: 'x', title: 'x', patient: 'x', diagnosis: 'x', organ: 'flesh', timeLimit: 1, tools: ['lens'], ranks: { S: 1, A: 1, B: 1 }, phases: [], seed } as OperationDef);
      const from = { x: C.x + new Rng(seed).range(-300, 300), y: C.y + new Rng(seed + 99).range(-150, 150) };
      const path = burrowPath(op, from, 1, NONE_DEFAULT.speed, NONE_DEFAULT.minTravel);
      let l = 0;
      for (let i = 1; i < path.length; i++) l += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      expect(l / NONE_DEFAULT.speed).toBeGreaterThanOrEqual(NONE_DEFAULT.minTravel - 1e-6);
    }
  });

  it('reaching the heart in the Descent is instant loss; the Litany freezes it', () => {
    let n!: NoneMalison;
    const op = start((o) => [(n = new NoneMalison(o))], { baseDrain: -5 });
    op.invokeLitany();
    const s0 = n.s;
    wait(op, 3);
    expect(n.s).toBe(s0);
    wait(op, 60);
    expect(op.status).toBe('lost');
  });

  it('Division: three segments; one reaching the heart costs 40, not the patient', () => {
    let n!: NoneMalison;
    const op = start((o) => [(n = new NoneMalison(o))]);
    n.hidden = false;
    n.exposedT = 3;
    n.hp = 71;
    new Hand(op).hold('brand', n.pos, 0.4);
    expect(n.stage).toBe(2);
    const segs = all(op, BurrowSegment);
    expect(segs.length).toBe(3);
    const v = op.vitals;
    segs[0].s = segs[0].total - 1;
    wait(op, 0.2);
    expect(op.status).toBe('running');
    expect(v - op.vitals).toBeGreaterThanOrEqual(40);
  });

  it('Ninth Hour: cut down three times, then a 2 s window to pull — or it regrows', () => {
    let n!: NoneMalison;
    const op = start((o) => [(n = new NoneMalison(o))], { baseDrain: -5 });
    n.stage = 3;
    n.hidden = false;
    n.cutsDone = 0;
    const hand = new Hand(op);
    for (let i = 0; i < 3; i++) hand.tap('lancet', n.pos);
    expect(n.size).toBe(0);
    wait(op, 2.1);
    expect(n.size).toBe(1);
  });

  it('heart is where the burrower is headed', () => {
    const op = start();
    const path = burrowPath(op, at(250, 0), 2, 26, 8);
    expect(path[path.length - 1]).toEqual(NONE_HEART);
  });
});

// ============================================================ Vespers

describe('Vespers', () => {
  it('lamps burn down in 15 s and a 0.3 s touch of the brand relights them', () => {
    let v!: VespersMalison;
    const op = start((o) => [(v = new VespersMalison(at(0, 0), o))], { baseDrain: -5 });
    const lamp = v.lamps[0];
    wait(op, 15.1);
    expect(lamp.lit).toBe(false);
    new Hand(op).hold('brand', lamp.pos, 0.35);
    expect(lamp.light).toBeGreaterThan(0.95);
  });

  it('the dark hides the wicks from the instruments', () => {
    let v!: VespersMalison;
    const op = start((o) => [(v = new VespersMalison(at(0, 0), o))]);
    const f = all(op, WickFilament)[0];
    const lamp = v.lamps.find((l) => l.quadrant === quadrantOf(f.pos))!;
    lamp.light = 0;
    wait(op, DT * 2);
    expect(f.hidden).toBe(true);
    const n = { x: -(f.b.y - f.a.y), y: f.b.x - f.a.x };
    const l = Math.hypot(n.x, n.y);
    const cut = [
      { x: f.pos.x + (n.x / l) * 14, y: f.pos.y + (n.y / l) * 14 },
      { x: f.pos.x - (n.x / l) * 24, y: f.pos.y - (n.y / l) * 24 },
    ];
    new Hand(op).drag('lancet', cut, 300);
    expect(f.alive).toBe(true);
    lamp.light = 1;
    wait(op, DT * 2);
    new Hand(op).drag('lancet', cut, 300);
    expect(f.alive).toBe(false);
    expect(all(op, TallowClot).length).toBe(1);
  });

  it('Magnificat: the body takes the brand only where lamplight falls', () => {
    let v!: VespersMalison;
    const op = start((o) => [(v = new VespersMalison(at(0, 0), o))]);
    for (const f of v.filaments) f.kill();
    v.severed(op);
    v.hp = 60;
    (v as unknown as { stage: number }).stage = 2;
    for (const l of v.lamps) l.light = 0;
    const hp = v.hp;
    new Hand(op).hold('brand', v.pos, 0.5, false);
    expect(v.hp).toBe(hp);
    for (const l of v.lamps) l.light = 1;
    new Hand(op).hold('brand', v.pos, 0.5);
    expect(v.hp).toBeLessThan(hp);
  });

  it('three or more tallow clots halve the tincture', () => {
    const op = start((o) => [new VespersMalison(at(0, 0), o), new TallowClot(at(-100, 100)), new TallowClot(at(0, 120)), new TallowClot(at(100, 100))]);
    op.vitals = 50;
    new Hand(op).hold('tincture', at(330, 20), 0.8);
    expect(op.vitals).toBeLessThan(50 + 25 - 10);
    expect(op.vitals).toBeGreaterThan(50);
  });

  it('LampNode defaults', () => {
    const l = new LampNode(C, 0, 15, 0.3);
    expect(l.required).toBe(false);
  });
});

// ============================================================ Compline

describe('Compline', () => {
  it('steals the Litany in Nunc Dimittis and gives it back when the silence-nodes break — even if spent', () => {
    let c!: ComplineMalison;
    const op = start((o) => [(c = new ComplineMalison(at(0, 0), o))], { baseDrain: -5 });
    op.invokeLitany();
    wait(op, 9);
    expect(op.canInvokeLitany()).toBe(false);
    c.hp = 71;
    (c as unknown as { enterNunc(o: Operation): void }).enterNunc(op);
    expect(c.litanyStolen).toBe(true);
    wait(op, 13);
    expect(c.stolenT).toBeGreaterThan(0);
    expect(distortion(op).lag).toBeCloseTo(COMPLINE_DEFAULT.stolenLag);
    for (const n of all(op, SilenceNode)) new Hand(op).hold('brand', n.pos, 1.5);
    expect(c.stage).toBe(3);
    expect(op.canInvokeLitany()).toBe(true);
  });

  it('Great Silence: lancet then brand within 0.6 s wounds it; slower does not', () => {
    let c!: ComplineMalison;
    const op = start((o) => [(c = new ComplineMalison(at(0, 0), o))], { baseDrain: -5 });
    c.hp = 35;
    c.stage = 3;
    const h = new Hand(op);
    h.tap('lancet', c.pos).hold('brand', c.pos, 0.1);
    expect(c.hp).toBeCloseTo(27, 5);
    h.tap('lancet', c.pos);
    wait(op, 0.7);
    h.hold('brand', c.pos, 0.1);
    expect(c.hp).toBeCloseTo(27, 5);
  });

  it('silence windows are told a second ahead, then swallow every cue', () => {
    let c!: ComplineMalison;
    const op = start((o) => [(c = new ComplineMalison(at(0, 0), o))], { baseDrain: -5 });
    wait(op, COMPLINE_DEFAULT.muteEvery - 0.8);
    expect(op.popups.some((p) => p.text === '[silence]')).toBe(true);
    expect(c.muted).toBe(false);
    wait(op, 1);
    expect(c.muted).toBe(true);
    op.cues.push('bell');
    op.update(DT);
    expect(op.cues.length).toBe(0);
  });
});

// ============================================================ The Office

describe('The Office', () => {
  it('the dial visits every Hour exactly once, in a seeded order', () => {
    const a = start((o) => [new OfficeMalison(o)]).entities.find((e): e is OfficeMalison => e instanceof OfficeMalison)!;
    const b = start((o) => [new OfficeMalison(o)]).entities.find((e): e is OfficeMalison => e instanceof OfficeMalison)!;
    expect([...a.order].sort()).toEqual([...HOURS].sort());
    expect(a.order).toEqual(b.order);
  });

  it('pairing validator: unison pairs never share an instrument, cover every Hour, and drain ≤ 2.2/s', () => {
    const seen = new Set<string>();
    for (const [x, y] of UNISON_PAIRS) {
      expect(HOUR_TOOL[x]).not.toBe(HOUR_TOOL[y]);
      seen.add(x).add(y);
      const op = start();
      const trials = [hourTrial(op, x, at(-150, 0), C), hourTrial(op, y, at(150, 0), C)];
      const drain = op.entities.filter((e) => e.alive && !e.hidden).reduce((s, e) => s + e.drain(op), 0);
      expect(drain, `${x}+${y}`).toBeLessThanOrEqual(2.2);
      expect(trials.every((t) => !t.done)).toBe(true);
    }
    expect(seen.size).toBe(8);
  });

  it('every Hour has at least ten voice lines', () => {
    for (const lines of Object.values(MALISON_VOICES)) expect(lines.length).toBeGreaterThanOrEqual(10);
  });
});
