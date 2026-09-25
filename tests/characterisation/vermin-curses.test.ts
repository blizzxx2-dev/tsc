/** QAT-0043 grubs & spiderlings, QAT-0044 sigils, QAT-0045 egg sacs. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { OP_2_4 } from '../../src/content/chapter2';
import { Grub, Laceration, Sigil, SIGILS } from '../../src/surgery/entities';
import { EggSac, SpiderlingGrub } from '../../src/surgery/lauds';
import { DT, FIELD_OFF, holdAt, holdOn, live, step, strokePath, tap } from '../helpers/sim';
import { onBody, type Operation } from '../../src/surgery/operation';
import { scenario } from '../helpers/trace';

describe('Grub & SpiderlingGrub', () => {
  it('a brand hold sears a grub: COOL "Seared"', () => {
    const { op, ents, trace } = scenario((o) => [new Grub(at(0, 0), o, 40)]);
    holdOn(op, 'brand', () => (ents[0].alive ? ents[0].pos : null), 1);
    trace.note('after brand');
    expect(ents[0].alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('the tongs pluck a grub off the body: GOOD "Plucked"; released on the body it stays', () => {
    const { op, ents, trace } = scenario((o) => [new Grub(at(0, 0), o, 40)]);
    const g = ents[0];
    strokePath(op, 'tongs', [{ ...g.pos }, { x: g.pos.x + 60, y: g.pos.y }], { speed: 600 });
    expect(g.alive).toBe(true);
    strokePath(op, 'tongs', [{ ...g.pos }, FIELD_OFF], { speed: 600 });
    trace.note('after pluck');
    expect(g.alive).toBe(false);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a spiderling sears faster (0.25 s): COOL "Seared"', () => {
    const { op, ents, trace } = scenario((o) => [new SpiderlingGrub(at(0, 0), o)]);
    holdOn(op, 'brand', () => (ents[0].alive ? ents[0].pos : null), 1);
    expect(ents[0].alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('grubs and spiderlings never leave the FIELD ellipse in 60 s of wandering', () => {
    const { op, ents } = scenario((o) => [
      new Grub(at(0, 0), o, 45),
      new Grub(at(300, 150), o, 70),
      new SpiderlingGrub(at(-300, -100), o),
      new SpiderlingGrub(at(0, 200), o),
    ]);
    let escaped = 0;
    for (let i = 0; i < 60 * 60; i++) {
      op.update(DT);
      for (const e of ents) if (!onBody(e.pos)) escaped++;
    }
    expect(escaped).toBe(0);
  });
});

describe('Sigil', () => {
  /** Break a sigil stroke by stroke, in order: hold the brand on each stroke's node to ignite it, then trace its segments. */
  function sear(op: Operation, s: Sigil, speed: number) {
    for (let i = 0; i < s.strokeCount && s.alive; i++) {
      holdAt(op, 'brand', s.nodes[i], op.tuning.brand.sigilNode + 0.05);
      for (const seg of s.segs.filter((x) => x.stroke === i)) if (s.alive) strokePath(op, 'brand', [seg.a, seg.b], { speed });
    }
  }

  it.each(Object.keys(SIGILS) as (keyof typeof SIGILS)[])('%s: breaking it fast is COOL "Curse broken"', (glyph) => {
    const { op, ents, trace } = scenario(() => [new Sigil(at(0, 0), SIGILS[glyph], 60, 999)]);
    sear(op, ents[0], 500);
    trace.note('seared', { segs: ents[0].segs.length });
    expect(ents[0].alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('breaking it slower than par (strokes × (node hold + 3 s)) is GOOD', () => {
    const { op, ents, trace } = scenario(() => [new Sigil(at(0, 0), SIGILS.eye, 60, 999)]);
    const s = ents[0];
    holdAt(op, 'brand', s.nodes[0], op.tuning.brand.sigilNode + 0.05);
    step(op, s.strokeCount * (op.tuning.brand.sigilNode + 3));
    sear(op, s, 500);
    trace.note('seared late');
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('lashes for 4 vitals every lashEvery seconds (5 by default, 4.5 in op2-4) with a popup', () => {
    const { op, trace } = scenario(() => [new Sigil(at(0, 0), SIGILS.eye, 60)]);
    step(op, 10.05);
    const lashes = trace.lines.filter((l) => l.includes('hurt 4'));
    expect(lashes).toHaveLength(2);
    expect(trace.lines.filter((l) => l.includes('popup "The curse lashes out!"'))).toHaveLength(2);
    const op24 = OP_2_4.phases[1].spawn(op) as Sigil[];
    expect(op24.map((s) => s.lashEvery)).toEqual([4.5, 4.5, 4.5]);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('EggSac', () => {
  it('lancing with more than 8 s before hatching is COOL "Lanced"; spiderlings spill out with a 38 px laceration', () => {
    const { op, ents, trace } = scenario(() => [new EggSac(at(0, 0), 3, 18)]);
    tap(op, 'lancet', ents[0].pos);
    trace.note('lanced');
    expect(op.counts.cool).toBe(1);
    expect(live(op, SpiderlingGrub)).toHaveLength(3);
    expect(live(op, Laceration).map((l) => l.length)).toEqual([38]);
    expect(trace.text()).toMatchSnapshot();
  });

  it('lancing with 8 s or less left is GOOD "Lanced"', () => {
    const { op, ents, trace } = scenario(() => [new EggSac(at(0, 0), 3, 18)]);
    step(op, 10.5);
    tap(op, 'lancet', ents[0].pos);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('hatching rates MISS "Hatched", costs 6 vitals, releases brood + 2 spiderlings; the 5 s warning is said once per sac', () => {
    const { op, trace } = scenario(() => [new EggSac(at(-100, 0), 3, 12), new EggSac(at(100, 0), 2, 14)]);
    step(op, 15);
    trace.note('hatched');
    expect(op.counts.miss).toBe(2);
    expect(live(op, SpiderlingGrub)).toHaveLength(5 + 4);
    expect(trace.lines.filter((l) => l.includes('hurt 6'))).toHaveLength(2);
    expect(trace.lines.filter((l) => l.includes('say "That sac is moving'))).toHaveLength(2);
    expect(trace.text()).toMatchSnapshot();
  });
});
