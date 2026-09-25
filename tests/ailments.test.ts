import { describe, expect, it } from 'vitest';
import { BloodPool, Embedded, Laceration, Sigil } from '../src/surgery/entities';
import { Agitation, Amputation, ClothFragment, HornBud, Jaw, Molar, TinctureSite, Vessel, Worm, WoundFever, woundFeverPhase } from '../src/surgery/ailments/kilnrows';
import { Artery, BiteChannel, Contamination, Lockbox, NoCutZone, Nodule, PetrifyFront, Retractor, StilledHeart, Tick } from '../src/surgery/ailments/vennmark';
import { Bud, Cyst, HexBall, Infant, LEAD_DISH, Remnant, VocalFold, whisperCount } from '../src/surgery/ailments/hollownight';
import { TallowClot } from '../src/surgery/bosses/vespers';
import { all, at, DT, Hand, start, wait } from './harness';

describe('Chapter III ailments', () => {
  it('horn-bud: drill 1.5 s, lift the disc, excise — and a sigil lies beneath', () => {
    let b!: HornBud;
    const op = start(() => [(b = new HornBud(at(0, 0)))]);
    const h = new Hand(op);
    h.hold('lancet', b.pos, 1.0);
    expect(b.state).toBe('drill');
    h.hold('lancet', b.pos, 0.7);
    expect(b.state).toBe('disc');
    h.drag('tongs', [b.pos, at(0, -100)]);
    expect(b.state).toBe('bud');
    h.tap('lancet', b.pos);
    expect(b.alive).toBe(false);
    expect(all(op, Sigil).length).toBe(1);
  });

  it('horn-bud: drilling past 3 s overheats the bone (BAD) and the sigil splits the scalp', () => {
    let b!: HornBud;
    const op = start(() => [(b = new HornBud(at(0, 0)))]);
    new Hand(op).hold('lancet', b.pos, 3.3);
    expect(op.counts.bad).toBe(1);
    expect(all(op, Laceration).length).toBe(1);
    expect(b.state).toBe('disc');
  });

  it('wadding left in the wound becomes a fever after closing', () => {
    const op = start(() => [new ClothFragment(at(0, 0)), new Embedded(at(100, 0), 'shot', 0, false)]);
    const phase = woundFeverPhase();
    const fever = phase.spawn(op);
    expect(fever.length).toBe(1);
    expect(fever[0]).toBeInstanceOf(WoundFever);
    expect(fever[0].drain(op)).toBeGreaterThanOrEqual(0.8);
    const clean = start(() => [new Embedded(at(100, 0), 'shot', 0, false)]);
    expect(woundFeverPhase().spawn(clean)).toEqual([]);
  });

  it('wound-fever breaks after two draughts', () => {
    let f!: WoundFever;
    const op = start(() => [(f = new WoundFever(at(0, 0)))]);
    new Hand(op).hold('tincture', f.pos, 1.1);
    expect(f.alive).toBe(true);
    new Hand(op).hold('tincture', f.pos, 1.1);
    expect(f.alive).toBe(false);
  });

  it('amputation: six saw strokes, then vessels — ligature is COOL, the brand is quick but costs 5', () => {
    let a!: Amputation;
    const op = start(() => [(a = new Amputation(at(0, -100), at(0, 100)))]);
    new Hand(op).drag('lancet', [a.a, a.b, a.a, a.b, a.a, a.b, a.a], 500);
    expect(a.alive).toBe(false);
    const vs = all(op, Vessel);
    expect(vs.length).toBe(3);
    const cool = op.counts.cool;
    const [p0, p1] = vs[0].stitch.points;
    const c = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    new Hand(op).drag('thread', [{ x: c.x - 6, y: c.y - 20 }, { x: c.x - 6, y: c.y + 17 }, { x: c.x + 6, y: c.y + 17 }, { x: c.x + 6, y: c.y - 20 }], 200);
    expect(vs[0].alive).toBe(false);
    expect(op.counts.cool).toBe(cool + 1);
    const v = op.vitals;
    new Hand(op).hold('brand', vs[1].pos, 0.6);
    expect(vs[1].alive).toBe(false);
    expect(v - op.vitals).toBeGreaterThanOrEqual(5);
  });

  it('gut-worm: a slow pull draws it whole; a fast one tears it and it regrows for 8 s', () => {
    let w!: Worm;
    const op = start(() => [(w = new Worm(at(0, 0), 0))]);
    new Hand(op).drag('tongs', [w.pos, at(170, 0)], 600);
    expect(w.alive).toBe(true);
    expect(w.torn).toBe(true);
    expect(w.regrowT).toBeGreaterThan(7.5);
    wait(op, 8.1);
    expect(w.torn).toBe(false);
    new Hand(op).drag('tongs', [w.pos, at(175, 0)], 150);
    expect(w.alive).toBe(false);
  });

  it('agitation climbs with each extraction; past 70 % he thrashes; the tincture calms him', () => {
    let a!: Agitation;
    const e1 = new Embedded(at(-100, 0), 'shard', 0, false);
    const op = start(() => [(a = new Agitation(at(0, -190))), e1, new Embedded(at(100, 0), 'shard', 0, false)]);
    wait(op, DT * 2);
    const l0 = a.level;
    e1.kill();
    wait(op, DT * 2);
    expect(a.level).toBeGreaterThan(l0 + 0.2);
    a.level = 0.9;
    wait(op, 3.2);
    expect(op.shake).toBeGreaterThan(0);
    expect(all(op, Laceration).length).toBeGreaterThanOrEqual(1);
    new Hand(op).hold('tincture', a.pos, 0.7);
    expect(a.level).toBeLessThan(0.1);
  });

  it('molar: three rocks then pull draws it clean; pulled early the root snaps', () => {
    let m!: Molar;
    const op = start(() => [(m = new Molar(at(0, 0)))]);
    const p = m.pos;
    new Hand(op).drag('tongs', [p, at(20, 0), at(-20, 0), at(20, 0), at(-20, 0), p, at(0, -80)], 200);
    expect(m.alive).toBe(false);
    expect(all(op, Embedded).length).toBe(0);
    let m2!: Molar;
    const op2 = start(() => [(m2 = new Molar(at(0, 0)))]);
    new Hand(op2).drag('tongs', [m2.pos, at(0, -80)], 200);
    expect(op2.counts.bad).toBe(1);
    expect(all(op2, Embedded).length).toBe(1);
  });

  it('the jaw bites a lancet left idling in the mouth', () => {
    const op = start(() => [new Jaw(at(0, 0)), new Molar(at(100, 0))]);
    op.setTool('lancet');
    const bad = op.counts.bad;
    new Hand(op).hold('lancet', at(-60, 40), 1.3);
    expect(op.counts.bad).toBeGreaterThan(bad);
  });

  it('tincture sites need the full hold', () => {
    let s!: TinctureSite;
    const op = start(() => [(s = new TinctureSite(at(0, 0), 'Lead lifted', 1.0, 0.3, '#888', 'blackbile'))]);
    new Hand(op).hold('tincture', s.pos, 0.6);
    expect(s.alive).toBe(true);
    new Hand(op).hold('tincture', s.pos, 1.1);
    expect(s.alive).toBe(false);
    expect(all(op, BloodPool)[0].ichor).toBe('blackbile');
  });
});

describe('Chapter IV ailments', () => {
  it('artery: pulled without a clamp it sprays (1/s) until ligated; clamped it does not', () => {
    const bolt = new Embedded(at(40, 0), 'bolt', 0, false);
    let art!: Artery;
    const op = start(() => [bolt, (art = new Artery(at(-30, 40), 0, bolt))]);
    bolt.kill();
    wait(op, DT * 2);
    expect(art.spraying).toBe(true);
    expect(art.drain()).toBeCloseTo(1.0);
    const bolt2 = new Embedded(at(40, 0), 'bolt', 0, false);
    let art2!: Artery;
    const op2 = start(() => [bolt2, (art2 = new Artery(at(-30, 40), 0, bolt2))]);
    new Hand(op2).tap('tongs', art2.pos);
    expect(art2.clamped).toBe(true);
    bolt2.kill();
    wait(op2, DT * 2);
    expect(art2.spraying).toBe(false);
  });

  it('ticks burrow after 6 s and must be found with the lens', () => {
    let t!: Tick;
    const op = start((o) => [(t = new Tick(at(0, 0), o))]);
    wait(op, 6.1);
    expect(t.hidden).toBe(true);
    expect(op.counts.miss).toBe(1);
  });

  it('contamination is irrigated by 1.5 s of the leech-pipe', () => {
    let c!: Contamination;
    const op = start(() => [(c = new Contamination(at(0, 0)))]);
    new Hand(op).hold('leech', c.pos, 1.0);
    expect(c.alive).toBe(true);
    new Hand(op).hold('leech', c.pos, 0.6);
    expect(c.alive).toBe(false);
  });

  it('nodules grow through three stages; the third needs the brand before the blade', () => {
    let n!: Nodule;
    const op = start(() => [(n = new Nodule(at(0, 0), 12))]);
    wait(op, 24.1);
    expect(n.stage).toBe(3);
    new Hand(op).tap('lancet', n.pos);
    expect(n.alive).toBe(true);
    new Hand(op).hold('brand', n.pos, 0.7);
    expect(n.cracked).toBe(true);
    new Hand(op).tap('lancet', n.pos);
    expect(n.alive).toBe(false);
  });

  it('delver’s lung: the false recovery raises the vitals while nodules grow', () => {
    const op = start(() => [new Nodule(at(0, 0), 1)], { vitals: 50 });
    wait(op, 1.1);
    const v = op.vitals;
    wait(op, 5);
    expect(op.vitals).toBeGreaterThan(v - 5 * 0.4);
  });

  it('a cut in the no-cut zone costs score and is rated BAD', () => {
    let z!: NoCutZone;
    const op = start(() => [(z = new NoCutZone(at(0, -150), 100, 50)), new Nodule(at(0, 100))]);
    op.score = 500;
    new Hand(op).tap('lancet', z.pos);
    expect(op.score).toBeLessThan(500);
    expect(op.counts.bad).toBe(1);
  });

  it('lockbox: a pin sets only with its notch at the top; a slip costs 3 s', () => {
    let b!: Lockbox;
    const op = start((o) => [(b = new Lockbox(at(0, 0), o))]);
    b.pins[0].angle = Math.PI / 2; // notch at the bottom
    b.pins[0].speed = 0;
    const t = op.timeLeft;
    new Hand(op).tap('tongs', b.pinPos(0));
    expect(b.pins[0].set).toBe(false);
    expect(t - op.timeLeft).toBeGreaterThan(2.9);
    b.pins[0].angle = -Math.PI / 2;
    new Hand(op).tap('tongs', b.pinPos(0));
    expect(b.pins[0].set).toBe(true);
  });

  it('retractor: dragged aside it holds open 15 s and reveals what lies beneath', () => {
    const under = new Contamination(at(0, 40));
    let r!: Retractor;
    const op = start(() => [(r = new Retractor(at(0, 40), [under])), under]);
    wait(op, DT * 2);
    expect(under.hidden).toBe(true);
    new Hand(op).drag('tongs', [r.pos, at(-120, 40)]);
    wait(op, DT * 2);
    expect(under.hidden).toBe(false);
    wait(op, 15.2);
    expect(under.hidden).toBe(true);
  });

  it('stilled heart: the tincture takes only inside a beat', () => {
    let h!: StilledHeart;
    const op = start(() => [(h = new StilledHeart(at(0, 0), 6, 0.9, 2))]);
    wait(op, 2);
    new Hand(op).hold('tincture', h.pos, 0.9);
    expect(h.restarts).toBe(0);
    wait(op, h.nextBeatIn);
    new Hand(op).hold('tincture', h.pos, 0.85);
    expect(h.restarts).toBe(1);
  });

  it('bite-channel: her choice is written to the operation flags', () => {
    let b!: BiteChannel;
    const op = start(() => [(b = new BiteChannel(at(0, 0)))]);
    new Hand(op).hold('brand', b.pos, 0.7);
    expect(op.flags.has('thirst:brand')).toBe(true);
    expect(b.alive).toBe(false);
  });

  it('petrification: plates in order; a wrong plate surges the front; the heart is fatal', () => {
    let f!: PetrifyFront;
    const op = start(() => [(f = new PetrifyFront([at(-300, 0), at(0, 0)], 3, 4))]);
    const s = f.s;
    new Hand(op).tap('lancet', f.plates[1].pos);
    expect(f.s).toBeGreaterThan(s + 25);
    new Hand(op).tap('lancet', f.plates[0].pos);
    expect(f.next).toBe(1);
    op.invokeLitany();
    const s2 = f.s;
    wait(op, 2);
    expect(f.s).toBe(s2);
    wait(op, 90);
    expect(op.status).toBe('lost');
  });
});

describe('Chapter V ailments', () => {
  it('vocal folds cut cleanly only in the rest between verses; the verse mutes every cue', () => {
    let v!: VocalFold;
    const op = start(() => [(v = new VocalFold(at(0, 0), 3, 2, 0))]);
    op.cues.push('bell');
    op.update(DT);
    expect(op.cues.length).toBe(0);
    new Hand(op).tap('lancet', v.pos);
    expect(v.alive).toBe(true);
    expect(op.counts.bad).toBe(1);
    wait(op, v.restIn + 0.05);
    new Hand(op).tap('lancet', v.pos);
    expect(v.alive).toBe(false);
  });

  it('cyst: encircled and lifted whole; a blade into it ruptures it and a remnant crawls out', () => {
    let c!: Cyst;
    const op = start(() => [(c = new Cyst(at(0, 0), 30))]);
    const loop = Array.from({ length: 41 }, (_, i) => ({ x: c.pos.x + Math.cos((i / 36) * Math.PI * 2) * 52, y: c.pos.y + Math.sin((i / 36) * Math.PI * 2) * 52 }));
    new Hand(op).drag('lancet', loop, 400);
    expect(c.freed).toBe(true);
    let c2!: Cyst;
    const op2 = start(() => [(c2 = new Cyst(at(0, 0), 30))]);
    new Hand(op2).tap('lancet', c2.pos);
    expect(c2.alive).toBe(false);
    const rem = all(op2, Remnant);
    expect(rem.length).toBe(1);
    expect(rem[0].hp).toBe(40);
  });

  it('infant: settle the grip before moving, carry it slowly off the table', () => {
    let i!: Infant;
    const op = start(() => [(i = new Infant(at(0, 0)))]);
    const h = new Hand(op);
    h.hold('tongs', i.pos, 0.8, false);
    h.drag('tongs', [i.pos, at(0, -400)], 200);
    expect(i.alive).toBe(false);
    expect(op.counts.bad).toBe(0);
    let j!: Infant;
    const op2 = start(() => [(j = new Infant(at(0, 0)))]);
    new Hand(op2).drag('tongs', [j.pos, at(0, -400)], 600);
    expect(op2.counts.bad).toBe(1);
  });

  it('infant: the child has its own vigour, and it ebbs', () => {
    let i!: Infant;
    const op = start(() => [(i = new Infant(at(0, 0), 10))]);
    wait(op, 10.1);
    expect(op.status).toBe('lost');
    expect(i.vigour).toBe(0);
  });

  it('hexstone: any instrument but the tongs makes it whisper; it goes only into the lead dish', () => {
    let b!: HexBall;
    const op = start(() => [(b = new HexBall(at(0, 0)))]);
    new Hand(op).tap('lancet', b.pos);
    expect(whisperCount(op)).toBe(1);
    new Hand(op).drag('tongs', [b.pos, at(0, -150)]);
    expect(b.alive).toBe(true);
    new Hand(op).drag('tongs', [b.pos, LEAD_DISH], 400);
    expect(b.alive).toBe(false);
  });

  it('buds: cut before they root; rooted ones need the brand', () => {
    let b!: Bud;
    const op = start(() => [(b = new Bud(at(0, 0), 0))]);
    wait(op, 8.1);
    expect(b.rooted).toBe(true);
    new Hand(op).tap('lancet', b.pos);
    expect(b.alive).toBe(true);
    new Hand(op).hold('brand', b.pos, 0.9);
    expect(b.alive).toBe(false);
  });

  it('tallow clots: soften with a brief brand, draw off; hold the brand too long and it scorches', () => {
    let c!: TallowClot;
    const op = start(() => [(c = new TallowClot(at(0, 0)))]);
    new Hand(op).tap('leech', c.pos);
    expect(c.softened).toBe(false);
    new Hand(op).hold('brand', c.pos, 1.4);
    expect(c.scorched).toBe(true);
    new Hand(op).hold('leech', c.pos, 1.0);
    expect(c.alive).toBe(false);
  });
});
