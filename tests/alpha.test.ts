import { tape } from './helpers/sim';
import { describe, expect, it } from 'vitest';
import { AlchemicalAcid, CompoundPoison, GasPocket } from '../src/surgery/ailments/alchemy';
import { BoneSplinter, Fracture, FRACTURE, fractureSite } from '../src/surgery/ailments/fracture';
import { FrostPatch, IceCrystal } from '../src/surgery/ailments/frost';
import { Amputation, Gangrene, GANGRENE } from '../src/surgery/ailments/gangrene';
import { Growth, MutationBud } from '../src/surgery/ailments/growth';
import { DungZone, InfectionLine, SporeCrust } from '../src/surgery/ailments/infection';
import { Arrhythmia, Artery, betweenBeats, CollapsedLung, humming, LarynxFold, StomachLock, Trepanation, WaxClot } from '../src/surgery/ailments/organs';
import { GutWorm, Larvae, Tick } from '../src/surgery/ailments/parasites';
import { Petrification } from '../src/surgery/ailments/petrification';
import { RegenWound, trollWound } from '../src/surgery/ailments/regen';
import { GlassCluster, WoodSplinter } from '../src/surgery/ailments/splinters';
import { Spill, Ulcer } from '../src/surgery/ailments/ulcer';
import { BiteChannel, biteSite, DonorBowl } from '../src/surgery/ailments/vampire';
import { BloodPool, Embedded, Incision, Laceration, Venom } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { circlePath } from '../src/surgery/gesture';
import { Operation, TRAY_DISH } from '../src/surgery/operation';
import { playWithBot } from './bot';
import { Anchor, at, DT, Hand, running, testDef, wait, zig } from './harness-gameplay';

const lastRated = (op: Operation) => [...op.journal].reverse().find((e) => e.kind === 'rated') as { rating: string; label?: string } | undefined;
const botWins = (spawn: (op: Operation) => Entity[], extra: Parameters<typeof testDef>[1] = {}, profile: 'steady' | 'novice' = 'steady') => {
  const op = playWithBot(testDef(spawn, { timeLimit: 400, ...extra }), { profile }).op;
  return op;
};

describe('GAM-E fractures & bone-setting', () => {
  it('GAM-0089/0090: fragments are dragged and wheel-rotated; ≤ 4 px & 3° snaps COOL, ≤ 8 px & 6° GOOD', () => {
    const op = running((o) => [new Fracture(at(0, 0), o, 0, 3)]);
    const f = op.entities[0] as Fracture;
    expect(f.fragments.length).toBe(3);
    expect(f.fragments[0].set).toBe(true);
    const frag = f.fragments[1];
    const h = new Hand(op);
    h.press('tongs', frag.pos);
    h.drag('tongs', [frag.pos, { x: frag.target.x + 6, y: frag.target.y }], 300, false);
    const need = Math.round(((frag.targetRot - frag.rot) * 180) / Math.PI / FRACTURE.wheelDeg);
    for (let i = 0; i < Math.abs(need); i++) op.wheel(Math.sign(need));
    h.release();
    expect(frag.set).toBe(true);
    expect(lastRated(op)).toMatchObject({ rating: 'good', label: 'Set' });
    const f2 = f.fragments[2];
    h.press('tongs', f2.pos);
    h.drag('tongs', [f2.pos, f2.target], 300, false);
    const n2 = Math.round(((f2.targetRot - f2.rot) * 180) / Math.PI / FRACTURE.wheelDeg);
    for (let i = 0; i < Math.abs(n2); i++) op.wheel(Math.sign(n2));
    h.release();
    expect(lastRated(op)).toMatchObject({ rating: 'cool', label: 'Set' });
    // Wheel with nothing held steps the tool instead.
    const before = op.tool;
    wait(op, 0.1);
    op.wheel(1);
    expect(op.tool).not.toBe(before);
  });

  it('GAM-0091: pins tapped in order with the lancet; out of order is BAD; a loose fragment at pin time costs end bonus', () => {
    const op = running((o) => [new Fracture(at(0, 0), o, 0, 2), new Anchor()]);
    const f = op.entities[0] as Fracture;
    const fr = f.fragments[1];
    fr.pos = { x: fr.target.x + 10, y: fr.target.y };
    fr.rot = fr.targetRot;
    expect(f.roughlyAligned).toBe(true);
    new Hand(op).tap('lancet', f.pins[0]);
    expect(f.alive).toBe(false);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Misaligned' });
    expect(op.endPenalty).toBe(FRACTURE.misalignPenalty);
    const three = running((o) => [new Fracture(at(0, 0), o, 0, 4), new Anchor()]);
    const g = three.entities[0] as Fracture;
    for (const x of g.fragments) {
      x.pos = { ...x.target };
      x.rot = x.targetRot;
      x.set = true;
    }
    const h = new Hand(three);
    h.tap('lancet', g.pins[1]);
    expect(lastRated(three)).toMatchObject({ rating: 'bad', label: 'Pin order' });
    h.tap('lancet', g.pins[0]);
    h.tap('lancet', g.pins[1]);
    expect(g.alive).toBe(false);
    expect(lastRated(three)).toMatchObject({ rating: 'good', label: 'Pinned' });
  });

  it('GAM-0092: bone splinters hide near fractures; each left in at closing drains 0.2/s through a fever', () => {
    const def = testDef(() => [], {}, [{ spawn: () => [new BoneSplinter(at(80, 0)), new BoneSplinter(at(-80, 0)), new Anchor()] }]);
    const op = new Operation(def);
    wait(op, 2.2);
    expect(op.entities.filter((e) => e instanceof BoneSplinter && e.hidden).length).toBe(2);
    op.entities.find((e) => e instanceof Anchor)!.kill();
    wait(op, 1.2);
    const fever = op.entities.find((e) => e.constructor.name === 'WoundFever')!;
    expect(fever.drain(op)).toBeCloseTo(0.4);
  });

  it('GAM-0093: a compound fracture blocks stitching nearby until set', () => {
    const op = running((o) => [new Fracture(at(0, 0), o, 0, 2, true), new Laceration(at(30, 60), 0, 44, 0.1)]);
    const f = op.entities[0] as Fracture;
    const lac = op.entities[1] as Laceration;
    new Hand(op).drag('thread', zig(lac.a, lac.b, 3), 300);
    expect(lac.alive).toBe(true);
    expect(op.flags.has('compound')).toBe(true);
    for (const x of f.fragments) x.set = true;
    wait(op, DT);
    new Hand(op).drag('thread', zig(lac.a, lac.b, 3), 300);
    expect(lac.alive).toBe(false);
  });

  it('GAM-0094: bone dust is a pale pool the leech-pipe draws off', () => {
    const op = running((o) => [...fractureSite(o, at(0, 0))]);
    const dust = op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.ichor === 'bonedust')!;
    expect(dust).toBeDefined();
    new Hand(op).hold('leech', dust.pos, 1.2);
    expect(dust.alive).toBe(false);
  });

  it('GAM-0095: the bot aligns and pins three procedural fractures in under 25 s', () => {
    for (const seed of [3, 4, 5]) {
      const op = playWithBot(
        testDef((o) => [new Fracture(at(0, 0), o, 0.3, 3 + (seed % 3))], { seed }),
        { profile: 'steady' },
      ).op;
      expect(op.status, `seed ${seed}`).toBe('won');
      expect(op.elapsed - 2, `seed ${seed}`).toBeLessThan(25);
    }
  });
});

describe('GAM-E petrification', () => {
  it('GAM-0096/0098: chip crack nodes in order (off-node BAD spreads the stone); salve the margin within 5 s or it re-stones', () => {
    const op = running((o) => [new Petrification(at(0, 0), o, at(0, -200), 1)]);
    const p = op.entities[0] as Petrification;
    const plate = p.plates[0];
    const h = new Hand(op);
    const front = p.front;
    h.tap('lancet', { x: plate.center.x + (plate.center.x - plate.nodes[0].x) * 0.1, y: plate.center.y + 20 });
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Off the crack' });
    expect(front - p.front).toBeGreaterThan(9);
    for (const n of plate.nodes) h.tap('lancet', n);
    expect(plate.lifted).toBe(true);
    wait(op, 5.2);
    expect(plate.lifted).toBe(false);
    for (const n of plate.nodes) h.tap('lancet', n);
    const rows = [];
    for (let y = -30; y <= 30; y += 12) rows.push({ x: plate.center.x - 34, y: plate.center.y + y }, { x: plate.center.x + 34, y: plate.center.y + y });
    h.drag('salve', rows, 900);
    expect(plate.healed).toBe(true);
    wait(op, DT * 2);
    expect(p.alive).toBe(false);
  });

  it('GAM-0097: the front creeps 3 px/s to the organ (−30); the Litany stills it', () => {
    const op = running((o) => [new Petrification(at(0, 0), o, at(0, -120), 1), new Anchor()], { vitals: 90, litany: true });
    const p = op.entities[0] as Petrification;
    const f0 = p.front;
    wait(op, 2);
    expect(f0 - p.front).toBeCloseTo(6, 0);
    op.invokeLitany();
    const f1 = p.front;
    wait(op, 4);
    expect(p.front).toBe(f1);
    wait(op, 60);
    expect(p.struck).toBe(true);
    expect(op.vitals).toBeLessThan(62);
  });
});

describe('GAM-E frost', () => {
  it('GAM-0100: brand taps thaw; holding > 0.4 s scalds', () => {
    const op = running(() => [new FrostPatch(at(0, 0), 40)]);
    const f = op.entities[0] as FrostPatch;
    const h = new Hand(op);
    h.tap('brand', at(0, 0));
    expect(f.thaw).toBeCloseTo(0.2);
    h.hold('brand', at(0, 0), 0.5);
    h.release();
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Scalded' });
    for (let i = 0; i < 4; i++) h.tap('brand', at(0, 0));
    expect(f.alive).toBe(false);
  });

  it('GAM-0101/0102: frozen flesh rejects lancet and thread; ice crystals come out only once thawed', () => {
    const op = running(() => [new FrostPatch(at(0, 0), 60), new Laceration(at(0, 0), 0, 44, 0.1), new IceCrystal(at(10, 10))]);
    const lac = op.entities[1] as Laceration;
    const ice = op.entities[2] as IceCrystal;
    const h = new Hand(op);
    h.drag('thread', zig(lac.a, lac.b, 3), 300);
    expect(lac.alive).toBe(true);
    expect(tape(op).popups.some((p) => p.text.includes('Frozen'))).toBe(true);
    h.hold('leech', ice.pos, 1.2);
    h.release();
    expect(ice.alive).toBe(true);
    for (let i = 0; i < 5; i++) h.tap('brand', at(-40, 0));
    h.hold('leech', ice.pos, 1.1);
    expect(ice.alive).toBe(false);
    h.drag('thread', zig(lac.a, lac.b, 3), 300);
    expect(lac.alive).toBe(false);
  });
});

describe('GAM-E tumours & growths', () => {
  it('GAM-0104: a closed loop excises (rated by loop quality); lifting before the loop rips it', () => {
    const op = running((o) => [new Growth(at(0, 0), o, 28), new Anchor()]);
    const g = op.entities[0] as Growth;
    const h = new Hand(op);
    h.tap('tongs', g.pos);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Ripped' });
    h.drag('lancet', circlePath(g.pos, 40, 40), 400);
    expect(g.excised).toBe(true);
    expect(lastRated(op)).toMatchObject({ rating: 'cool', label: 'Excised' });
    h.drag('tongs', [g.pos, TRAY_DISH], 400);
    expect(g.alive).toBe(false);
  });

  it('GAM-0105: feeder vessels must be tied first or excision bleeds −15 each', () => {
    const op = running((o) => [new Growth(at(0, 0), o, 28, 2), new Anchor()], { vitals: 90 });
    const g = op.entities[0] as Growth;
    const v = op.vitals;
    new Hand(op).drag('lancet', circlePath(g.pos, 40, 40), 400);
    expect(v - op.vitals).toBeGreaterThanOrEqual(29);
    const tidy = running((o) => [new Growth(at(0, 0), o, 28, 2), new Anchor()], { vitals: 90 });
    const g2 = tidy.entities[0] as Growth;
    const h = new Hand(tidy);
    for (const ve of g2.vessels) {
      const mid = { x: (ve.a.x + ve.b.x) / 2, y: (ve.a.y + ve.b.y) / 2 };
      const a = Math.atan2(ve.b.y - ve.a.y, ve.b.x - ve.a.x) + Math.PI / 2;
      h.drag(
        'thread',
        [
          { x: mid.x - Math.cos(a) * 20, y: mid.y - Math.sin(a) * 20 },
          { x: mid.x + Math.cos(a) * 20, y: mid.y + Math.sin(a) * 20 },
        ],
        250,
      );
    }
    expect(g2.vessels.every((x) => x.tied)).toBe(true);
    const v2 = tidy.vitals;
    h.drag('lancet', circlePath(g2.pos, 40, 40), 400);
    expect(v2 - tidy.vitals).toBeLessThan(3);
  });

  it('GAM-0106: buds root after 8 s; unrooted go with one loop, rooted need the loop and the brand', () => {
    const op = running(() => [new MutationBud(at(0, 0)), new MutationBud(at(150, 0)), new Anchor()]);
    const [a, b] = op.entities as MutationBud[];
    const h = new Hand(op);
    h.drag('lancet', circlePath(a.pos, 24, 32), 350);
    expect(a.alive).toBe(false);
    wait(op, 8.1);
    expect(b.rooted).toBe(true);
    h.drag('lancet', circlePath(b.pos, 24, 32), 350);
    expect(b.alive).toBe(true);
    expect(b.looped).toBe(true);
    h.hold('brand', b.pos, 0.65);
    expect(b.alive).toBe(false);
  });

  it('GAM-0107: growth variants (tooth, finger, eye) are distinct', () => {
    const op = running(() => []);
    for (const v of ['tooth', 'finger', 'eye'] as const) expect(new Growth(at(0, 0), op, 20, 0, v).variant).toBe(v);
  });
});

describe('GAM-E glass & splinters', () => {
  it('GAM-0108: glass shows only under the lens; tongs gather up to three per grab', () => {
    const op = running((o) => [new GlassCluster(at(0, 0), o, 7)]);
    const gc = op.entities[0] as GlassCluster;
    expect(gc.slivers.length).toBe(7);
    const h = new Hand(op);
    h.drag('tongs', [...gc.slivers.map((s) => s.pos), TRAY_DISH], 200);
    expect(gc.left.length).toBe(7);
    h.drag('lens', circlePath(gc.pos, 26, 24), 120);
    const seen = gc.left.filter((s) => s.seen);
    expect(seen.length).toBeGreaterThan(3);
    h.drag('tongs', [...seen.map((s) => s.pos), TRAY_DISH], 200);
    expect(7 - gc.left.length).toBe(3);
  });

  it('GAM-0109: a splinter pulled against the grain breaks, leaving a shorter one', () => {
    const op = running(() => [new WoodSplinter(at(0, 0), 0), new Anchor()]);
    const w = op.entities[0] as WoodSplinter;
    new Hand(op).drag('tongs', [w.pos, at(-40, 0)], 200);
    expect(w.alive).toBe(false);
    const rest = op.entities.find((e): e is WoodSplinter => e instanceof WoodSplinter && e.alive)!;
    expect(rest.len).toBeLessThan(w.len);
    expect(rest.spawnedBy).toBe('penalty');
    new Hand(op).drag('tongs', [rest.pos, at(30, 0), TRAY_DISH], 300);
    expect(rest.alive).toBe(false);
  });
});

describe('GAM-E ulcers, troll wounds, bites', () => {
  it('GAM-0110/0111: drain the bile, then salve outer ring first; inner-first perforates and the spill rots after 6 s', () => {
    const op = running(() => [new Ulcer(at(0, 0)), new Anchor()]);
    const u = op.entities[0] as Ulcer;
    wait(op, 5.1);
    const bile = op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.ichor === 'blackbile')!;
    expect(bile).toBeDefined();
    const h = new Hand(op);
    h.drag('salve', circlePath(u.pos, u.radius - 6, 30), 300);
    expect(u.healed).toBe(0);
    expect(op.flags.has('ulcer-bile')).toBe(true);
    h.hold('leech', bile.pos, 1.5);
    h.release();
    expect(bile.alive).toBe(false);
    h.drag('salve', circlePath(u.pos, 6, 20), 300);
    expect(op.journal.some((e) => e.kind === 'rated' && e.rating === 'bad' && e.label === 'Perforated')).toBe(true);
    const spill = op.entities.find((e) => e instanceof Spill)!;
    wait(op, 6.1);
    expect(spill.alive).toBe(false);
    expect(op.entities.some((e) => e.constructor.name === 'Rot')).toBe(true);
    const ok = running(() => [new Ulcer(at(0, 0)), new Anchor()]);
    const u2 = ok.entities[0] as Ulcer;
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 4 && u2.healed === r && u2.alive; k++) new Hand(ok).drag('salve', circlePath(u2.pos, u2.radius - r * 14 - 7, 40), 300);
    expect(u2.alive).toBe(false);
    expect(ok.counts.bad).toBe(0);
  });

  it('GAM-0112/0113/0115: the wound knits over its shard in ~4 s (faster when healthy) unless the rim is seared; reopen a lump with the lancet', () => {
    const op = running(() => [...trollWound(at(0, 0))], { vitals: 99 });
    const w = op.entities[0] as RegenWound;
    expect(w.closeTime(op)).toBeCloseTo(4);
    wait(op, 3.5);
    expect(w.open).toBe(true);
    wait(op, 1.2);
    expect(w.open).toBe(false);
    expect(w.shard.hidden).toBe(true);
    const h = new Hand(op);
    h.drag('lancet', [at(-25, 0), at(25, 0)], 300);
    expect(w.open).toBe(true);
    h.drag('brand', circlePath(w.pos, 30, 36), 700);
    expect(w.sealed).toBe(true);
    wait(op, 6);
    expect(w.open).toBe(true);
    const weak = running(() => [...trollWound(at(0, 0))], { vitals: 40 });
    expect((weak.entities[0] as RegenWound).closeTime(weak)).toBeGreaterThan(8);
  });

  it('GAM-0114: opening troll gut sprays acid that disables a random instrument for 10 s', () => {
    const op = running(() => [...trollWound(at(0, 0), 'shard', true)]);
    const w = op.entities[0] as RegenWound;
    wait(op, 5);
    new Hand(op).drag('lancet', [at(-25, 0), at(25, 0)], 300);
    expect(w.open).toBe(true);
    expect(op.disabled.size).toBe(1);
    const [tool, s] = [...op.disabled.entries()][0];
    expect(tool).not.toBe('lancet');
    expect(s).toBeGreaterThan(9.5);
    expect(op.toolUsable(tool)).toBe(false);
  });

  it('GAM-0116/0117/0118: a bite caps vitals at 70 and drains blood until seared; transfusion restores volume; leaving it sets thrallKept', () => {
    const op = running(() => [...biteSite(at(0, 0)), new DonorBowl(), new Anchor()], { vitals: 99, secondary: { bloodVolume: true } });
    wait(op, 0.1);
    expect(op.vitals).toBeLessThanOrEqual(70);
    expect(op.entities.filter((e) => e instanceof Embedded && e.hidden).length).toBe(2);
    wait(op, 10);
    expect(op.bloodVolume).toBeLessThan(90);
    const vol = op.bloodVolume;
    const bowl = op.entities.find((e): e is DonorBowl => e instanceof DonorBowl)!;
    const h = new Hand(op);
    h.hold('leech', bowl.pos, 1);
    expect(op.bloodVolume).toBeLessThan(vol);
    op.toggleLeechReverse();
    h.hold('leech', bowl.pos, 2);
    expect(op.bloodVolume).toBeGreaterThan(vol);
    const b = op.entities.find((e): e is BiteChannel => e instanceof BiteChannel)!;
    h.hold('brand', b.punctures[0], 0.85);
    h.hold('brand', b.punctures[1], 0.85);
    expect(b.alive).toBe(false);
    expect(lastRated(op)?.label).toBe('Channel seared');

    const kept = new Operation(testDef(() => [new BiteChannel(at(0, 0))]));
    wait(kept, 4);
    expect(kept.status).toBe('won');
    expect(kept.storyFlags.has('thrallKept')).toBe(true);
    // Scoring ignores the choice: the same op without the bite scores alike (bar the vitals it cost).
    expect(kept.counts).toEqual({ cool: 0, good: 0, bad: 0, miss: 0 });
  });
});

describe('GAM-E acids, poisons, gangrene', () => {
  it('GAM-0120: acid corrodes a lingering instrument (6 s); amber tincture neutralises it for the leech-pipe', () => {
    const op = running(() => [new AlchemicalAcid(at(0, 0)), new Anchor()], { tinctures: ['amber'] });
    const a = op.entities[0] as AlchemicalAcid;
    const h = new Hand(op);
    h.hold('leech', a.pos, 1.1);
    expect(op.toolUsable('leech')).toBe(false);
    expect(lastRated(op)?.label).toBe('Corroded');
    op.setTool('tincture');
    op.cycleTincture();
    expect(op.tinctureColor).toBe('amber');
    h.hold('tincture', { x: a.pos.x + 60, y: a.pos.y }, 0.1);
    h.release();
    h.hold('tincture', { x: a.pos.x + 5, y: a.pos.y }, 0.75);
    expect(a.neutralised).toBe(true);
    h.release();
    h.idle(6);
    h.hold('leech', a.pos, 1.1);
    expect(a.alive).toBe(false);
  });

  it('GAM-0121: coloured motes want the matching tincture (COOL); the wrong colour is BAD and speeds the mote 30 %', () => {
    const op = running((o) => [new CompoundPoison(at(-100, 80), o, 2), new Anchor()], { tinctures: ['green', 'blue', 'amber'] });
    const p = op.entities[0] as CompoundPoison;
    wait(op, 3.1);
    const m = p.motes[0];
    const wrong = (['green', 'blue', 'amber'] as const).find((c) => c !== m.colour)!;
    op.setTool('tincture');
    while (op.tinctureColor !== wrong) op.cycleTincture();
    const h = new Hand(op);
    h.tap('tincture', p.motePos(m));
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Wrong antidote' });
    expect(m.speed).toBeCloseTo(30 * 1.3);
    while (op.tinctureColor !== m.colour) op.cycleTincture();
    h.tap('tincture', p.motePos(m));
    expect(lastRated(op)).toMatchObject({ rating: 'cool', label: 'Matched' });
  });

  it('GAM-0122: lance a gas pocket unvented and the field hazes for 4 s', () => {
    const op = running(() => [new GasPocket(at(0, 0)), new GasPocket(at(150, 0)), new Anchor()]);
    const [a, b] = op.entities as GasPocket[];
    const h = new Hand(op);
    h.tap('lancet', a.pos);
    expect(op.hazeT).toBeCloseTo(4, 1);
    h.hold('leech', b.pos, 1.1);
    h.release();
    wait(op, 4);
    h.tap('lancet', b.pos);
    expect(op.hazeT).toBe(0);
    expect(lastRated(op)?.label).toBe('Pocket opened');
  });

  it('GAM-0123: gangrene creeps 2 px/s; caught below the line it is debrided and salved; past it, amputation', () => {
    const op = running(() => [new Gangrene(at(-200, 0), at(200, 0), 40, 150), new Anchor()]);
    const g = op.entities[0] as Gangrene;
    wait(op, 5);
    expect(g.front).toBeCloseTo(50, 0);
    const h = new Hand(op);
    h.drag('lancet', [g.tip, g.frontPos, g.tip, g.frontPos], 400);
    expect(g.debrided).toBe(true);
    const cov = (g as unknown as { cov: { center: { x: number; y: number }; radius: number } }).cov;
    const rows = [];
    for (let y = -cov.radius; y <= cov.radius; y += 14)
      rows.push({ x: cov.center.x - cov.radius - 6, y: cov.center.y + y }, { x: cov.center.x + cov.radius + 6, y: cov.center.y + y });
    h.drag('salve', rows, 900);
    expect(g.alive).toBe(false);
    const late = running(() => [new Gangrene(at(-200, 0), at(200, 0), 140, 150), new Anchor()]);
    wait(late, 6);
    expect(late.entities.some((e) => e instanceof Amputation)).toBe(true);
  });

  it('GAM-0124/0125: amputation — 8 saw strokes in rhythm, then brand (−15) or three ligatures in 20 s (+400)', () => {
    const saw = (op: Operation, amp: Amputation, period: number) => {
      const pts = [];
      for (let i = 0; i <= 9; i++) pts.push(i % 2 ? amp.sawB : amp.sawA);
      new Hand(op).drag('lancet', pts, 100 / period);
    };
    const op = running(() => [new Amputation(at(0, 0), 0), new Anchor()], { vitals: 90 });
    const amp = op.entities[0] as Amputation;
    saw(op, amp, 0.1);
    expect(amp.sawn).toBe(false);
    saw(op, amp, 0.45);
    expect(amp.sawn).toBe(true);
    const before = op.score;
    new Hand(op).drag('thread', zig(amp.sawA, amp.sawB, 3, 22), 250);
    expect(amp.alive).toBe(false);
    expect(op.score - before).toBeGreaterThanOrEqual(GANGRENE.ligatureBonus);
    const burn = running(() => [new Amputation(at(0, 0), 0), new Anchor()], { vitals: 90 });
    const amp2 = burn.entities[0] as Amputation;
    saw(burn, amp2, 0.45);
    const v = burn.vitals;
    new Hand(burn).hold('brand', amp2.pos, 1.05);
    expect(amp2.alive).toBe(false);
    expect(v - burn.vitals).toBeGreaterThanOrEqual(15);
  });

  it('GAM-0242: the no-rhythm assist widens rhythm windows ×2', () => {
    const op = running(() => [new Amputation(at(0, 0), 0), new Anchor()], {}, { assists: { noRhythm: true } });
    const amp = op.entities[0] as Amputation;
    const pts = [];
    for (let i = 0; i <= 9; i++) pts.push(i % 2 ? amp.sawB : amp.sawA);
    new Hand(op).drag('lancet', pts, 100 / 0.2);
    expect(amp.sawn).toBe(true);
  });
});

describe('GAM-E parasites & infection', () => {
  it('GAM-0127: a worm drawn slowly comes out whole; yanked, it tears and regrows its head in 6 s', () => {
    const op = running(() => [new GutWorm(at(0, 0)), new Anchor()]);
    const w = op.entities[0] as GutWorm;
    const h = new Hand(op);
    h.drag('tongs', [w.pos, at(0, -200)], 600);
    expect(w.headless).toBe(true);
    wait(op, 6.1);
    expect(w.headless).toBe(false);
    h.drag('tongs', [w.pos, at(0, -160), TRAY_DISH], 180);
    expect(w.alive).toBe(false);
  });

  it('GAM-0128: ticks burrow after 4 s (hidden, slow drain) unless plucked', () => {
    const op = running((o) => [new Tick(at(0, 0), o), new Tick(at(100, 0), o), new Anchor()]);
    const [a, b] = op.entities as Tick[];
    new Hand(op).tap('tongs', a.pos);
    expect(a.alive).toBe(false);
    wait(op, 4.1);
    expect(b.hidden).toBe(true);
    expect(b.drain()).toBeCloseTo(0.1);
  });

  it('GAM-0129: green tincture at the end clears unseen larvae; skipping costs 10 % of the end bonus', () => {
    const plain = new Operation(testDef(() => [new Larvae(at(0, 0))]));
    wait(plain, 4);
    const clean = new Operation(testDef(() => []));
    wait(clean, 4);
    expect(plain.bonus.vitals).toBe(Math.round(clean.bonus.vitals * 0.9));
    const treated = running(() => [new Larvae(at(0, 0)), new Anchor()], { tinctures: ['green'] });
    treated.setTool('tincture');
    treated.cycleTincture();
    new Hand(treated).hold('tincture', at(200, 100), 0.75);
    expect(treated.entities.some((e) => e instanceof Larvae && e.alive)).toBe(false);
  });

  it('GAM-0130: an infection line is stopped at a node by leech + tincture; reaching the armpit forces amputation', () => {
    const path = [at(-200, 100), at(-100, 50), at(0, 0), at(100, -50), at(200, -100)];
    const op = running(() => [new InfectionLine(path, 3), new Anchor()]);
    const line = op.entities[0] as InfectionLine;
    const n = line.nextNode!;
    const h = new Hand(op);
    h.hold('tincture', line.nodePos(n), 0.8);
    expect(n.treated).toBe(false);
    h.release();
    h.hold('leech', line.nodePos(n), 0.7);
    h.release();
    h.hold('tincture', line.nodePos(n), 0.8);
    expect(n.treated).toBe(true);
    wait(op, 20);
    expect(line.alive).toBe(false);
    expect(op.entities.some((e) => e instanceof Amputation)).toBe(false);
    const lost = running(() => [new InfectionLine(path, 3), new Anchor()]);
    wait(lost, 60);
    expect(lost.entities.some((e) => e instanceof Amputation)).toBe(true);
  });

  it('GAM-0131: dragging through spore crust seeds more; only an encircling cut removes it', () => {
    const op = running(() => [new SporeCrust(at(0, 0)), new Anchor()]);
    const c = op.entities[0] as SporeCrust;
    const h = new Hand(op);
    h.drag('lancet', [at(-40, 0), at(40, 0)], 300);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Spores scattered' });
    expect(op.entities.filter((e) => e instanceof SporeCrust).length).toBe(2);
    h.drag('lancet', circlePath(c.pos, 34, 36), 350);
    expect(c.alive).toBe(false);
  });

  it('GAM-0132: a dung zone drains until irrigated with the reversed leech-pipe', () => {
    const op = running(() => [new DungZone(at(0, 0)), new Anchor()]);
    const d = op.entities[0] as DungZone;
    const h = new Hand(op);
    h.hold('leech', d.pos, 2);
    expect(d.alive).toBe(true);
    h.release();
    op.toggleLeechReverse();
    h.hold('leech', d.pos, 1.6);
    expect(d.alive).toBe(false);
  });
});

describe('GAM-E organ hazards', () => {
  it('GAM-0133: organ regions scale the harm of mistakes (heart ×2)', () => {
    const op = running(() => [new Anchor()], { regions: [{ kind: 'heart', x: 660, y: 300, rx: 60, ry: 60 }], vitals: 90 });
    expect(op.organAt({ x: 660, y: 300 })).toBe('heart');
    expect(op.organAt(at(200, 100))).toBe('flesh');
    const v = op.vitals;
    op.harm(3, { x: 660, y: 300 });
    expect(v - op.vitals).toBeCloseTo(6);
  });

  it('GAM-0134: during arrhythmia the lancet near the heart only cuts between beats', () => {
    const heart = at(0, 0);
    const op = running(() => [new Arrhythmia(heart, 60), new Incision([at(-80, 0), at(80, 0)]), new Anchor()]);
    const inc = op.entities[1] as Incision;
    let blocked = 0;
    const h = new Hand(op);
    h.press('lancet', at(-80, 0));
    for (let x = -80; x <= 80; x += 0.5) {
      const before = inc.progress;
      h.frame('lancet', at(x, 0), true);
      // The blade holds still while the heart beats.
      if (inc.progress === before && inc.state === 'mark' && !betweenBeats(op)) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(inc.progress).toBeLessThan(inc.total);
  });

  it('GAM-0135: a collapsed lung caps vitals at 60 until air is drawn and the tear stitched', () => {
    const op = running(() => [new CollapsedLung(at(0, 0)), new Anchor()], { vitals: 90 });
    wait(op, DT);
    expect(op.vitals).toBeLessThanOrEqual(60);
    const l = op.entities[0] as CollapsedLung;
    const h = new Hand(op);
    h.hold('leech', l.pos, 1.6);
    h.release();
    h.drag('thread', zig(l.a, l.b, 4, 20), 300);
    expect(l.alive).toBe(false);
    expect(op.vitalsCap).toBeGreaterThan(90);
  });

  it('GAM-0136: trepanation — three steady circles, too fast nicks the dura; then lift the disc', () => {
    const circles = (op: Operation, t: Trepanation, speed: number, segs = 32) => {
      const pts = [];
      for (let k = 0; k < 4; k++) pts.push(...circlePath(t.pos, 27, segs));
      new Hand(op).drag('lancet', pts, speed);
    };
    const op = running(() => [new Trepanation(at(0, 0)), new Anchor()]);
    const t = op.entities[0] as Trepanation;
    circles(op, t, 160);
    expect(t.loose).toBe(true);
    expect(lastRated(op)).toMatchObject({ rating: 'cool', label: 'Disc cut' });
    new Hand(op).drag('tongs', [t.pos, TRAY_DISH], 400);
    expect(t.alive).toBe(false);
    const fast = running(() => [new Trepanation(at(0, 0)), new Anchor()]);
    circles(fast, fast.entities[0] as Trepanation, 900, 8);
    expect(fast.journal.some((e) => e.kind === 'rated' && e.label === 'Dura nicked')).toBe(true);
  });

  it('GAM-0137: larynx folds are cut only in the silence between verses', () => {
    const op = running(() => [new LarynxFold(at(0, 0)), new LarynxFold(at(0, 100)), new Anchor()]);
    const [a, b] = op.entities as LarynxFold[];
    while (!humming(op)) wait(op, DT);
    const h = new Hand(op);
    h.drag('lancet', [a.a, a.b, a.a], 500);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Mid-verse' });
    while (humming(op)) wait(op, DT);
    h.drag('lancet', [b.a, b.b, b.a], 500);
    expect(b.alive).toBe(false);
  });

  it('GAM-0138: three tumblers turned to their marks free the swallowed object while acid rises', () => {
    const op = running((o) => [new StomachLock(at(0, 0), o), new Anchor()]);
    const lock = op.entities[0] as StomachLock;
    const d0 = lock.drain();
    const h = new Hand(op);
    for (const t of lock.tumblers) {
      h.press('tongs', t.pos);
      const off = ((t.target - t.angle + 540) % 360) - 180;
      for (let i = 0; i < Math.abs(Math.round(off / 15)); i++) op.wheel(Math.sign(off));
      h.release();
      expect(t.locked).toBe(true);
    }
    expect(lock.alive).toBe(false);
    expect(op.entities.some((e) => e instanceof Embedded)).toBe(true);
    expect(lock.drain()).toBeGreaterThan(d0);
  });

  it('GAM-0139: wax clots soften with three brand taps; unsoftened, they clog the pipe for 2 s', () => {
    const op = running(() => [new WaxClot(at(0, 0)), new Anchor()]);
    const w = op.entities[0] as WaxClot;
    const h = new Hand(op);
    h.hold('leech', w.pos, 0.1);
    h.release();
    expect(op.toolUsable('leech')).toBe(false);
    expect(lastRated(op)?.label).toBe('Clogged');
    for (let i = 0; i < 3; i++) h.tap('brand', w.pos);
    expect(w.soft).toBe(true);
    h.idle(2);
    h.hold('leech', w.pos, 1.1);
    expect(w.alive).toBe(false);
  });

  it('GAM-0246: an unclamped artery pools every second; pulling a shard beside it tears it', () => {
    const op = running(() => [new Artery(at(0, 0)), new Embedded(at(30, 20), 'shard', 0, false), new Anchor()], { vitals: 90 });
    wait(op, 2.1);
    expect(op.entities.some((e) => e instanceof BloodPool)).toBe(true);
    const e = op.entities.find((x): x is Embedded => x instanceof Embedded)!;
    const h = new Hand(op);
    h.drag('tongs', [e.handle, { x: e.handle.x + Math.cos(e.axis) * 40, y: e.handle.y + Math.sin(e.axis) * 40 }, TRAY_DISH], 400, false);
    h.hold('tongs', TRAY_DISH, 0.1);
    h.release();
    wait(op, DT * 2);
    expect(op.journal.some((x) => x.kind === 'rated' && x.label === 'Artery torn')).toBe(true);
    const safe = running(() => [new Artery(at(0, 0)), new Anchor()]);
    new Hand(safe).hold('tongs', at(0, 0), 0.6);
    expect((safe.entities[0] as Artery).clamped).toBe(true);
  });
});

describe('GAM-J bot extensions for Alpha mechanics', () => {
  const ops: [string, (op: Operation) => Entity[], Parameters<typeof testDef>[1]][] = [
    ['fracture', (o) => fractureSite(o, at(0, 0), { fragments: 3, splinters: 1, compound: true }).concat(new Laceration(at(60, 90), 0.2, 60, 0.4)), {}],
    ['stone', (o) => [new Petrification(at(0, 20), o, at(0, -200), 3)], {}],
    ['frost', () => [new FrostPatch(at(-100, 0), 50), new FrostPatch(at(100, 0), 40), new IceCrystal(at(-90, 10))], { secondary: { temperature: true } }],
    ['growth', (o) => [new Growth(at(0, 0), o, 26, 3, 'eye'), new MutationBud(at(200, 60))], {}],
    ['glass', (o) => [new GlassCluster(at(-100, 0), o, 9), new WoodSplinter(at(150, 30), -0.6)], {}],
    ['ulcer', () => [new Ulcer(at(0, 0))], {}],
    ['troll', () => [...trollWound(at(-80, 0)), ...trollWound(at(120, 40), 'bolt', true)], {}],
    ['bite', () => [...biteSite(at(0, 0)), new DonorBowl()], { secondary: { bloodVolume: true } }],
    [
      'alchemy',
      (o) => [new AlchemicalAcid(at(-150, 0)), new CompoundPoison(at(100, 100), o, 4), new GasPocket(at(0, -60))],
      { tinctures: ['green', 'blue', 'amber'] },
    ],
    ['gangrene', () => [new Gangrene(at(-250, 50), at(150, 50), 40, 150)], {}],
    ['amputation', () => [new Amputation(at(0, 0), 0.3)], {}],
    ['parasites', (o) => [new GutWorm(at(0, 0)), new Tick(at(100, 0), o), new Larvae(at(0, 0))], { tinctures: ['green'] }],
    [
      'infection',
      () => [
        new InfectionLine([at(-200, 100), at(-100, 50), at(0, 0), at(100, -50), at(200, -100)], 3),
        new SporeCrust(at(-150, -80)),
        new DungZone(at(150, 100)),
      ],
      {},
    ],
    [
      'organs',
      (o) => [
        new CollapsedLung(at(-150, 0)),
        new Trepanation(at(150, 0)),
        new LarynxFold(at(0, 100)),
        new StomachLock(at(0, -80), o),
        new WaxClot(at(-250, 80)),
        new Artery(at(250, 80)),
      ],
      {},
    ],
    ['venom-mix', (o) => [new Venom(at(-100, 60), o, 5, 'green'), new Incision([at(-150, 120), at(150, 120)])], { noClose: false }],
  ];
  for (const [name, spawn, extra] of ops) {
    it(`GAM-0190: the bot completes a ${name} operation`, () => {
      const op = botWins(spawn, extra);
      expect(op.status, `${name}: ${op.lostReason} left=${op.entities.map((e) => e.constructor.name).join(',')}`).toBe('won');
    });
  }
});

describe('GAM-G secondary vitals', () => {
  it('GAM-0163: blood volume caps vitals when declared; temperature drifts with frost and costs vitals', () => {
    const op = running(() => [new BiteChannel(at(0, 0)), new Anchor()], { secondary: { bloodVolume: true }, vitals: 60 });
    wait(op, 30);
    expect(op.bloodVolume).toBeLessThan(60);
    expect(op.vitalsCap).toBeLessThanOrEqual(Math.round(30 + op.bloodVolume * 0.7));
    const cold = running(() => [new FrostPatch(at(0, 0), 50), new Anchor()], { secondary: { temperature: true }, vitals: 90 });
    wait(cold, 10);
    expect(cold.temperature).toBeLessThan(37);
    const plain = running(() => [new FrostPatch(at(0, 0), 50), new Anchor()], { vitals: 90 });
    wait(plain, 10);
    expect(plain.temperature).toBe(37);
  });
});

describe('GAM-O patient modifiers', () => {
  it('GAM-0244: a thrashing patient sways the hand until a tincture calms him for 10 s', () => {
    class Probe extends Anchor {
      seen: { x: number; y: number }[] = [];
      override onSweep(_op: Operation, ptr: { pos: { x: number; y: number } }): void {
        this.seen.push({ ...ptr.pos });
      }
    }
    const op = running(() => [new Probe()], { thrashing: true, vitals: 50 });
    const probe = op.entities[0] as Probe;
    const h = new Hand(op);
    h.hold('lens', at(0, 0), 0.5);
    h.release();
    expect(probe.seen.some((p) => Math.hypot(p.x - at(0, 0).x, p.y - at(0, 0).y) > 3)).toBe(true);
    h.hold('tincture', at(200, 100), 0.75);
    h.release();
    expect(op.thrashT).toBeGreaterThan(9);
    probe.seen = [];
    h.hold('lens', at(0, 0), 0.5);
    expect(probe.seen.every((p) => p.x === at(0, 0).x && p.y === at(0, 0).y)).toBe(true);
    wait(op, 10.1);
    expect(op.thrashT).toBe(0);
  });
});
