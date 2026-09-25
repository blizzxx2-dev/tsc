/** QAT-0047: the Malison of Lauds. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Embedded, Laceration } from '../../src/surgery/entities';
import { ChoirVoice, LaudsMalison } from '../../src/surgery/lauds';
import type { Operation } from '../../src/surgery/operation';
import { DT, holdOn, hoverOn, live, step } from '../helpers/sim';
import { scenario } from '../helpers/trace';

const lauds = () => scenario((o) => [new LaudsMalison(at(0, 30), o)]);

function silenceAll(op: Operation, core: LaudsMalison) {
  for (let guard = 0; guard < 12 && core.livingVoices.length; guard++) {
    const v = core.livingVoices[0];
    holdOn(op, 'brand', () => (v.alive ? v.pos : null), 1);
  }
}

describe('Malison of Lauds', () => {
  it('spawns four Voices; branding the core while they live says lauds-shielded and does no damage', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    expect(live(op, ChoirVoice)).toHaveLength(4);
    holdOn(op, 'brand', () => core.pos, 1);
    trace.note('branded the shielded core', { hp: core.hp });
    expect(core.hp).toBe(100);
    expect(op.flags.has('lauds-shielded')).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('each Voice is silenced by a 0.6 s brand hold (COOL "Silenced"); released, silence decays at 0.35/s', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    const v = core.livingVoices[0];
    holdOn(op, 'brand', () => v.pos, 0.3);
    const held = v.silence;
    step(op, 0.5);
    trace.note('partial silence', { held, after: v.silence });
    expect(held).toBeGreaterThan(0.25);
    expect(held - v.silence).toBeCloseTo(0.35 * 0.5, 1);
    holdOn(op, 'brand', () => (v.alive ? v.pos : null), 1);
    expect(v.alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('sings a Hymn every 6.5 s that opens a laceration and costs 2 vitals', () => {
    const { op, trace } = lauds();
    step(op, 14);
    trace.note('two hymns');
    expect(op.flags.has('lauds-hymn')).toBe(true);
    expect(trace.lines.filter((l) => l.includes('hurt 2'))).toHaveLength(2);
    expect(live(op, Laceration).length).toBeGreaterThanOrEqual(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('full fight: silence the choir, wound it to half ("Wounded" → submerges), hunt it with the Lens, unmake it into three hexstone shards', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    silenceAll(op, core);
    trace.note('choir silenced', { voices: core.livingVoices.length });
    expect(core.livingVoices).toHaveLength(0);
    holdOn(op, 'brand', () => (core.alive && !core.submerged ? core.pos : null), 2);
    trace.note('wounded', { hp: core.hp, submerged: core.submerged });
    expect(core.submerged).toBe(true);
    expect(core.hidden).toBe(true);
    expect(core.hp).toBeLessThanOrEqual(50);
    step(op, 2);
    hoverOn(op, 'lens', () => (core.submerged ? core.pos : null), 2);
    trace.note('found', { submerged: core.submerged });
    expect(core.submerged).toBe(false);
    holdOn(op, 'brand', () => (core.alive ? core.pos : null), 2);
    trace.note('unmade');
    expect(core.alive).toBe(false);
    const stones = live(op, Embedded);
    expect(stones).toHaveLength(3);
    expect(stones.every((s) => s.kind === 'hexstone' && !s.barbed)).toBe(true);
    expect(trace.lines.some((l) => l.includes('rate COOL "Malison unmade"'))).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('left exposed for more than 5 s, it calls two Voices back', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    silenceAll(op, core);
    let frames = 0;
    while (core.livingVoices.length === 0 && frames++ < 60 * 8) op.update(DT);
    trace.note('rekindled', { voices: core.livingVoices.length });
    expect(core.livingVoices).toHaveLength(2);
    expect(trace.text()).toMatchSnapshot();
  });
});
