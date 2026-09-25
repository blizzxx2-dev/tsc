import { DEFAULT_TUNING } from '../../src/surgery/tuning';
/** QAT-0046: the Malison of Matins. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Grub, Laceration } from '../../src/surgery/entities';
import { Malison, MalisonShard } from '../../src/surgery/malison';
import { DT, FIELD_OFF, holdOn, live, strokePath } from '../helpers/sim';
import type { Operation } from '../../src/surgery/operation';
import { scenario } from '../helpers/trace';

const matins = () => scenario((o) => [new Malison(at(0, 40), o, 'matins', 100)]);

function untilOpen(op: Operation, m: Malison) {
  let frames = 0;
  while (!m.open && frames++ < 60 * 10) op.update(DT);
}

describe('Malison of Matins', () => {
  it('shroud rhythm: 4 s veiled, 2.5 s open; rends lacerations every 4.5 s of veiled time', () => {
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
    expect(times[0]).toBeCloseTo(4, 1);
    expect(times[1] - times[0]).toBeCloseTo(2.5, 1);
    expect(times[2] - times[1]).toBeCloseTo(4, 1);
    expect(live(op, Laceration).length).toBeGreaterThanOrEqual(2);
    expect(op.flags.has('malison-rend')).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('branding it while veiled says malison-veiled and does no damage (and no brand-flesh penalty)', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    holdOn(op, 'brand', () => m.pos, 1);
    trace.note('branded while veiled', { hp: m.hp });
    expect(m.hp).toBe(100);
    expect(op.flags.has('malison-veiled')).toBe(true);
    expect(op.flags.has('brand-flesh')).toBe(false);
    expect(trace.text()).toMatchSnapshot();
  });

  it('branding it open: "Wounded" at 75/50/25 % sheds two hexlings each; at 0 "Malison unmade" splits into three shards', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    untilOpen(op, m);
    holdOn(op, 'brand', () => (m.alive ? m.pos : null), 2.5);
    trace.note('after one open window', { hp: m.hp });
    expect(m.alive).toBe(false);
    expect(op.counts.good).toBe(3);
    expect(op.counts.cool).toBe(1);
    expect(live(op, Grub).filter((g) => g.required)).toHaveLength(6);
    expect(live(op, MalisonShard)).toHaveLength(3);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a shard dragged off the body is cast out (COOL); the rest rejoin after 9 s: MISS "It rejoined", 10 vitals, a weakened Malison', () => {
    const { op, ents, trace } = matins();
    const m = ents[0];
    untilOpen(op, m);
    holdOn(op, 'brand', () => (m.alive ? m.pos : null), 2.5);
    const shards = live(op, MalisonShard);
    strokePath(op, 'tongs', [{ ...shards[0].pos }, FIELD_OFF], { speed: 600 });
    trace.note('one cast out');
    expect(shards[0].alive).toBe(false);
    expect(op.counts.cool).toBe(2);
    let frames = 0;
    while (live(op, MalisonShard).length && frames++ < 60 * 12) op.update(DT);
    trace.note('rejoined');
    const reborn = live(op, Malison);
    expect(reborn).toHaveLength(1);
    expect(reborn[0].hp).toBe(20 + 15 * 2);
    expect(op.counts.miss).toBe(1);
    expect(trace.lines.some((l) => l.includes('hurt 10'))).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});
