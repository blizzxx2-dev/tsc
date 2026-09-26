/** QAT-0036 barbed arrows, QAT-0037 clean extractions, QAT-0038 hexstone and hidden objects. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { OP_2_2 } from '../../src/content/chapter2';
import { Embedded, Laceration, Rot, type EmbeddedKind } from '../../src/surgery/entities';
import { LEAD_DISH, TRAY_DISH, type Operation } from '../../src/surgery/operation';
import { DT, hoverAt, live, press, step, strokePath, tap } from '../helpers/sim';
import { scenario } from '../helpers/trace';

/**
 * Where a player grips the object with the tongs, the pull out along its axis, and the carry off the
 * body into the dish (anything released on the body sinks back in; hexstone only goes in the lead dish).
 */
function pullPath(e: Embedded, distance = 40, toDish = true) {
  const grip = e.spec.len > 0 ? { x: e.origin.x + (e.handle.x - e.origin.x) * 0.7, y: e.origin.y + (e.handle.y - e.origin.y) * 0.7 } : { ...e.pos };
  const dir = e.spec.len > 0 ? { x: e.handle.x - e.origin.x, y: e.handle.y - e.origin.y } : { x: 0, y: -1 };
  const l = Math.hypot(dir.x, dir.y) || 1;
  const out = { x: grip.x + (dir.x / l) * distance, y: grip.y + (dir.y / l) * distance };
  return toDish ? [grip, out, e.kind === 'hexstone' ? LEAD_DISH : TRAY_DISH] : [grip, out];
}

const pull = (op: Operation, e: Embedded, opts: { speed?: number; dwell?: number; distance?: number; toDish?: boolean } = {}) =>
  strokePath(op, 'tongs', pullPath(e, opts.distance, opts.toDish), { speed: opts.speed ?? 400, dwell: opts.dwell });

describe('barbed arrow', () => {
  it('two lancet nicks rate "Nick" then "Barbs freed"; the freed arrow pulls clean', () => {
    const { op, ents, trace } = scenario(() => [new Embedded(at(-60, 0), 'arrow', -0.5)]);
    const arrow = ents[0];
    expect(arrow.barbed).toBe(true);
    tap(op, 'lancet', { x: arrow.origin.x + 4, y: arrow.origin.y + 4 });
    tap(op, 'lancet', { x: arrow.origin.x + 4, y: arrow.origin.y + 4 });
    trace.note('after nicks', { nicks: arrow.nicks });
    // A third nick is not captured by the arrow (it is an empty lancet press).
    tap(op, 'lancet', { x: arrow.origin.x + 4, y: arrow.origin.y + 4 });
    pull(op, arrow);
    trace.note('after pull');
    expect(arrow.alive).toBe(false);
    expect(op.counts.good).toBe(2);
    expect(op.counts.cool).toBe(1);
    const wound = live(op, Laceration)[0];
    expect(wound.length).toBe(arrow.spec.wound);
    expect(wound.bleed).toBe(0.8);
    expect(trace.text()).toMatchSnapshot();
  });

  it('pulling more than 18 px with fewer than two nicks tears: BAD "Torn", 8 vitals, a wound + 30 px laceration bleeding at 1.6, "barbs" said once', () => {
    const { op, ents, trace } = scenario(() => [new Embedded(at(-60, 0), 'arrow', -0.5), new Embedded(at(120, 40), 'arrow', 0.5)]);
    const [first, second] = ents;
    tap(op, 'lancet', { x: first.origin.x + 4, y: first.origin.y + 4 });
    const v = op.vitals;
    pull(op, first);
    trace.note('after tearing the first');
    expect(op.counts.bad).toBe(1);
    expect(v - op.vitals).toBeGreaterThanOrEqual(8);
    const torn = live(op, Laceration).find((l) => Math.hypot(l.pos.x - first.origin.x, l.pos.y - first.origin.y) < 1)!;
    expect(torn.length).toBe(first.spec.wound + 30);
    expect(torn.bleed).toBe(1.6);
    // A torn arrow leaves no second wound when it comes out.
    expect(live(op, Laceration)).toHaveLength(1);
    pull(op, second);
    trace.note('after tearing the second');
    expect(op.callouts.filter((l) => l.startsWith('Barbed!'))).toHaveLength(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('an object released while still on the body sinks back to its origin', () => {
    const { op, ents, trace } = scenario(() => [new Embedded(at(0, 0), 'bolt', 0.4, false)]);
    pull(op, ents[0], { distance: 50, toDish: false });
    trace.note('after a short pull', { back: ents[0].pos.x === ents[0].origin.x && ents[0].pos.y === ents[0].origin.y });
    expect(ents[0].alive).toBe(true);
    expect(ents[0].pos).toEqual(ents[0].origin);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('clean extractions', () => {
  // Bolts need the pull-pause-draw staging and glass a slow hand: see GAM-0184 (tests/demo-ops.test.ts).
  const KINDS: [EmbeddedKind, string][] = [
    ['shot', 'Lead shot'],
    ['tooth', 'Fang'],
    ['shard', 'Shard'],
  ];

  it.each(KINDS)('%s drawn out along its axis and into the tray rates COOL "%s" and leaves its entry wound', (kind, label) => {
    const { op, ents, trace } = scenario(() => [new Embedded(at(-100, 0), kind, 0.4, false)]);
    const [e] = ents;
    expect(e.spec.label).toBe(label);
    pull(op, e);
    trace.note('pulled');
    expect(e.alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(live(op, Laceration).map((l) => l.length)).toEqual([e.spec.wound]);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('hexstone and hidden objects', () => {
  it('lodged hexstone drains, spawns rot every 10 s (max 4) and says "hexstone" once', () => {
    const { op, ents, trace } = scenario(() => [new Embedded(at(0, 0), 'hexstone', 0.3, false)]);
    expect(ents[0].drain()).toBe(0.45);
    step(op, 55);
    trace.note('after 55 s lodged', { rot: live(op, Rot).length });
    expect(live(op, Rot).length).toBeGreaterThan(0);
    expect(live(op, Rot).length).toBeLessThanOrEqual(4);
    expect(trace.lines.filter((l) => l.endsWith(' flag hexstone'))).toHaveLength(1);
    expect(trace.lines.filter((l) => l.includes('say "The hexstone is corrupting'))).toHaveLength(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('op2-2 hidden shards ignore the tongs until the Scrying Lens reveals them', () => {
    const { op, ents, trace } = scenario((o) => OP_2_2.phases[1].spawn(o).filter((e): e is Embedded => e instanceof Embedded));
    // CON-0060: the guide hexstone first (the lens shows it at once), then two more and a seeded pick of glass.
    expect(ents.length).toBeGreaterThanOrEqual(4);
    expect(ents.every((e) => e.hidden)).toBe(true);
    expect(ents[0].lensGuide).toBe(true);
    const target = ents[1];
    op.setTool('tongs');
    op.handlePointer(press(target.pos), DT);
    op.update(DT);
    expect(target.grabbed).toBe(false);
    strokePath(op, 'tongs', pullPath(target));
    expect(target.alive).toBe(true);
    trace.note('tongs on hidden shard');
    hoverAt(op, 'lens', target.pos, 0.3);
    expect(target.hidden).toBe(true);
    hoverAt(op, 'lens', target.pos, 0.2);
    trace.note('after lens', { hidden: target.hidden });
    expect(target.hidden).toBe(false);
    pull(op, target);
    trace.note('after pull');
    expect(target.alive).toBe(false);
    // The lens shows the guide from further off; every other shard out of the lens's reach stays hidden.
    const far = ents.filter(
      (e) => e !== target && !e.lensGuide && Math.hypot(e.pos.x - target.origin.x, e.pos.y - target.origin.y) > op.tuning.lens.radius * 1.2,
    );
    expect(far.length).toBeGreaterThan(0);
    expect(far.every((e) => e.hidden)).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});
