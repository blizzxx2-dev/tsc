import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { FrostPatch } from '../src/surgery/ailments/frost';
import { GutWorm } from '../src/surgery/ailments/parasites';
import { Amputation } from '../src/surgery/ailments/gangrene';
import {
  ChoirMagus,
  DEAD_PULSE,
  DeadPulse,
  FROST_WIGHT,
  FrostWight,
  GHOUL,
  GhoulClaw,
  MATRIARCH,
  Sellsword,
  SELLSWORD,
  WormMatriarch,
} from '../src/surgery/bosses/alphaElites';
import { Laceration } from '../src/surgery/entities';
import { ENTITY_REGISTRY, makeEntities, validateSpec, type EntitySpec } from '../src/content/schema';
import { FIELD } from '../src/surgery/operation';
import { ALL, at, Hand, start, wait } from './harness';

// A far-off wound keeps each operation running while the elite is fought.
const keep = () => new Laceration(at(200, 150), 0, 40, 0);
const OFF_BODY = { x: FIELD.cx + FIELD.rx + 80, y: FIELD.cy };

describe('alpha elites', () => {
  it('BOS-0157 matriarch: a slow draw off the body kills it; a fast pull tears a segment into a new worm', () => {
    let m!: WormMatriarch;
    const op = start((o) => [(m = new WormMatriarch(at(0, 0), o, 4)), keep()]);
    const hand = new Hand(op);
    hand.drag('tongs', [m.head, { x: m.head.x + 160, y: m.head.y }], MATRIARCH.speed * 3);
    wait(op, 0.1);
    expect(m.torn).toBe(1);
    expect(m.segments).toBe(3);
    expect(op.entities.some((e) => e instanceof GutWorm && e.alive)).toBe(true);
    hand.drag('tongs', [m.head, { x: m.head.x, y: m.head.y - 60 }, OFF_BODY], MATRIARCH.speed * 0.5);
    wait(op, 0.1);
    expect(m.dying).toBe(true);
  });

  it('BOS-0153 sellsword: flesh seals over the shrapnel; the lancet reopens it; the acid spray burns out an instrument', () => {
    let s!: Sellsword;
    const op = start((o) => [...(s = new Sellsword(o, [at(-40, 0), at(40, 0)])).all, keep()]);
    wait(op, SELLSWORD.regrow + 0.2);
    expect(s.sealed(0)).toBe(true);
    expect(s.blocksTool(op, s.shards[0].origin, 'tongs')).toMatch(/lancet/);
    new Hand(op).tap('lancet', s.shards[0].origin);
    expect(s.sealed(0)).toBe(false);
    expect(s.callus[0]).toBeLessThan(0.2);
    for (let t = 0; t < SELLSWORD.sprayEvery && !s.burned.length; t += 0.05) wait(op, 0.05);
    expect(s.burned.length).toBeGreaterThan(0);
    expect(s.burned).not.toContain('tongs');
    expect(s.burned).not.toContain('lancet');
    expect(op.toolUsable(s.burned[0])).toBe(false);
  });

  it('BOS-0158 dead pulse: the lancet only bites during the beat window; the trance sigil hides from all but the lens', () => {
    let d!: DeadPulse;
    const op = start((o) => [...(d = new DeadPulse(o, [at(-80, 40), at(60, 40)], at(0, -80), 30)).all, keep()]);
    expect(d.sigil.hidden).toBe(true);
    expect(d.beating).toBe(false);
    expect(d.blocksTool(op, at(-80, 40), 'lancet')).toMatch(/beat/);
    wait(op, DEAD_PULSE.first + 0.1);
    expect(d.beating).toBe(true);
    expect(d.blocksTool(op, at(-80, 40), 'lancet')).toBeNull();
    wait(op, DEAD_PULSE.window);
    expect(d.beating).toBe(false);
    expect(d.untilBeat).toBeGreaterThan(20);
  });

  it('BOS-0159 frost-wight: frost spreads round the ring; thawed out of order it refreezes', () => {
    let w!: FrostWight;
    const op = start((o) => [(w = new FrostWight(at(0, 0), o, 3)), keep()]);
    wait(op, FROST_WIGHT.spreadEvery * 2 + 0.5);
    expect(w.patches.filter((p) => p?.alive).length).toBe(3);
    // Thaw II before I: it refreezes.
    const second = w.patches[1]!;
    second.thaw = 1;
    second.kill();
    wait(op, 0.1);
    expect(w.done[1]).toBe(false);
    wait(op, FROST_WIGHT.refreezeAfter);
    expect(w.refrozen).toBe(1);
    expect(w.patches[1]?.alive).toBe(true);
    // In order: I, II, III.
    for (let i = 0; i < 3; i++) {
      w.patches[i]!.kill();
      wait(op, 0.1);
      expect(w.done[i]).toBe(true);
    }
    expect(w.dying).toBe(true);
    expect(op.entities.filter((e) => e instanceof FrostPatch && e.alive)).toHaveLength(0);
  });

  it('BOS-0160 ghoul-claw: the brand held on a line front sears it; a line reaching the armpit forces an amputation', () => {
    let gc!: GhoulClaw;
    const op = start((o) => [(gc = new GhoulClaw(at(-150, 60), o, at(150, -100), 2)), keep()]);
    const hand = new Hand(op);
    hand.hold('brand', gc.front(0), GHOUL.burnHold + 0.2);
    expect(gc.lines[0].dead).toBe(true);
    wait(op, 1 / GHOUL.lineSpeed);
    expect(gc.amputation).toBeInstanceOf(Amputation);
    expect(gc.amputation!.alive).toBe(true);
  });

  it('BOS-0161 magus: the true anchor shows only under the lens; a false stone lashes; three anchors unmake the hex', () => {
    let m!: ChoirMagus;
    const op = start((o) => [(m = new ChoirMagus(at(0, 0), o)), keep()]);
    op.setTool('tongs');
    expect(m.scried(op)).toBe(false);
    op.setTool('lens');
    op.cursor = { ...m.pos };
    expect(m.scried(op)).toBe(true);
    const hand = new Hand(op);
    const falseStone = [0, 1, 2].find((s) => s !== m.truth)!;
    const v0 = op.vitals;
    hand.tap('tongs', m.stonePos(falseStone));
    expect(m.wrong).toBe(1);
    expect(op.vitals).toBeLessThan(v0);
    for (let k = 0; k < 3; k++) {
      // Wait out any swap in flight, then pull the anchor where the lens shows it.
      wait(op, 1);
      hand.tap('tongs', m.stonePos(m.truth));
    }
    expect(m.anchors).toBe(3);
    expect(m.dying).toBe(true);
    expect(dist(m.stonePos(0), m.pos)).toBeGreaterThan(40);
  });

  it('every alpha elite is a valid content spec and spawns its core first', () => {
    const specs: EntitySpec[] = [
      { e: 'elite-matriarch', at: [0, 0] },
      {
        e: 'elite-sellsword',
        path: [
          [-40, 0],
          [40, 0],
        ],
      },
      {
        e: 'elite-deadpulse',
        path: [
          [-80, 40],
          [60, 40],
        ],
        sigil: [0, -80],
      },
      { e: 'elite-frostwight', at: [0, 0] },
      { e: 'elite-ghoulclaw', at: [-150, 60], armpit: [150, -100] },
      { e: 'elite-magus', at: [0, 0] },
    ];
    for (const s of specs) {
      expect(s.e in ENTITY_REGISTRY).toBe(true);
      expect(validateSpec(s, ALL, s.e)).toEqual([]);
      const op = start(() => [keep()]);
      expect((makeEntities(s, op)[0] as WormMatriarch).elite).toBe(true);
    }
  });
});
