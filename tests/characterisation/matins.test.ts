/** QAT-0046: the Malison of Matins — the Night Vigil (BOS-0011..0013, reworked onto MalisonBase). */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Laceration } from '../../src/surgery/entities';
import { Malison, MalisonShard, MATINS_DEFAULT } from '../../src/surgery/malison';
import { DEFAULT_TUNING } from '../../src/surgery/tuning';
import type { Operation } from '../../src/surgery/operation';
import { DT, FIELD_OFF, holdOn, live, step, strokePath } from '../helpers/sim';
import { scenario } from '../helpers/trace';

const matins = () => scenario((o) => [new Malison(at(0, 40), o, 'matins', 100)]);

function until(op: Operation, cond: () => boolean, seconds = 20): void {
  for (let f = 0; !cond() && f < seconds * 60; f++) op.update(DT);
}

describe('Malison of Matins', () => {
  it('Vigil rhythm: 4 s veiled, 2.5 s open; rends a boss wound every 4.5 s of veiled time', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    const toggles: string[] = [];
    let was = m.open;
    for (let i = 0; i < 60 * 20; i++) {
      op.update(DT);
      if (m.open !== was) {
        toggles.push(`${m.open ? 'open' : 'veiled'}@${(op.elapsed - DEFAULT_TUNING.flow.intro).toFixed(2)}`);
        was = m.open;
      }
    }
    trace.note('20 s of rhythm', { toggles });
    expect(toggles.slice(0, 4).map((s) => s.split('@')[0])).toEqual(['open', 'veiled', 'open', 'veiled']);
    const times = toggles.map((s) => Number(s.split('@')[1]));
    expect(times[0]).toBeCloseTo(MATINS_DEFAULT.veil, 1);
    expect(times[1] - times[0]).toBeCloseTo(MATINS_DEFAULT.open1, 1);
    expect(times[2] - times[1]).toBeCloseTo(MATINS_DEFAULT.veil, 1);
    expect(live(op, Laceration).length).toBeGreaterThanOrEqual(2);
    expect(op.flags.has('malison-rend')).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('branding it while veiled: one MISS "Veiled", no damage, no brand-flesh penalty', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    holdOn(op, 'brand', () => m.pos, 1);
    trace.note('branded while veiled', { hp: m.hp });
    expect(m.hp).toBe(100);
    expect(op.counts.miss).toBe(1);
    expect(op.flags.has('brand-flesh')).toBe(false);
    expect(trace.text()).toMatchSnapshot();
  });

  it('three phases: "Wounded" into the Watchfire (Litany taught) and The Eye; unmade on the third beat into three shards', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    // Vigil → Watchfire.
    m.hp = 61;
    until(op, () => m.open);
    holdOn(op, 'brand', () => (m.alive && m.open ? m.pos : null), 1);
    trace.note('into the Watchfire', { hp: m.hp, phase: m.phase.key });
    expect(m.phase.key).toBe('watchfire');
    expect(op.flags.has('tutorial-litany')).toBe(true);
    // Watchfire → The Eye.
    m.hp = 26;
    step(op, 1.5);
    until(op, () => m.open);
    holdOn(op, 'brand', () => (m.alive && m.open ? m.pos : null), 1);
    trace.note('the Eye opens', { hp: m.hp, phase: m.phase.key });
    expect(m.phase.key).toBe('eye');
    expect(op.counts.good).toBe(2);
    // The Eye: only the third beat bites.
    m.hp = 1;
    step(op, 1.5);
    until(op, () => m.beat === 3);
    holdOn(op, 'brand', () => (m.alive ? m.pos : null), 0.6);
    trace.note('unmade', { alive: m.alive });
    expect(m.alive).toBe(false);
    expect(op.counts.cool).toBeGreaterThanOrEqual(1);
    expect(live(op, MalisonShard).filter((s) => s.mode === 'fragment')).toHaveLength(3);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a shard dragged off the body is cast out (COOL); the rest rejoin after 9 s: MISS "It rejoined", 10 vitals, a weakened single-phase Malison', () => {
    const { op, trace } = scenario((o) => [
      new MalisonShard(at(-60, 40), o),
      new MalisonShard(at(0, 60), o),
      new MalisonShard(at(60, 40), o),
      new Laceration(at(150, -80), 0, 40, 0), // keeps the operation running
    ]);
    const shards = live(op, MalisonShard);
    strokePath(op, 'tongs', [{ ...shards[0].pos }, FIELD_OFF], { speed: 600 });
    trace.note('one cast out');
    expect(shards[0].alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    until(op, () => live(op, MalisonShard).length === 0, 12);
    trace.note('rejoined');
    const reborn = live(op, Malison);
    expect(reborn).toHaveLength(1);
    expect(reborn[0].hp).toBe(20 + 15 * 2);
    expect(reborn[0].tune.phased).toBe(false);
    expect(op.counts.miss).toBe(1);
    expect(trace.lines.some((l) => l.includes('hurt 10'))).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});
