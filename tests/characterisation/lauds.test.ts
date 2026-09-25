/** QAT-0047: the Malison of Lauds — the Antiphon (BOS-0028..0031, reworked onto MalisonBase). */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Embedded } from '../../src/surgery/entities';
import { ChoirVoice, LaudsBody, LaudsMalison, LAUDS_DEFAULT, LightThread, VOICE_SIGIL } from '../../src/surgery/lauds';
import type { Operation, OperationDef } from '../../src/surgery/operation';
import { DT, holdOn, live, step } from '../helpers/sim';
import { scenario } from '../helpers/trace';
import { Hand } from '../harness';

const lauds = (def: Partial<OperationDef> = {}) => scenario((o) => [new LaudsMalison(at(0, 30), o)], def);

function silenceAll(op: Operation, core: LaudsMalison) {
  const h = new Hand(op);
  for (let guard = 0; guard < 12 && core.livingVoices.length; guard++) {
    const v = core.livingVoices[0];
    h.traceMoving('brand', () => v.pos, VOICE_SIGIL, 2.2);
  }
}

describe('Malison of Lauds', () => {
  it('Call: four Voices; branding the core while they live says lauds-shielded and does no damage', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    expect(live(op, ChoirVoice)).toHaveLength(4);
    holdOn(op, 'brand', () => core.pos, 1);
    trace.note('branded the shielded core', { hp: core.hp });
    expect(core.hp).toBe(100);
    expect(op.flags.has('lauds-shielded')).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a Voice is silenced by tracing its sigil with the brand (COOL "Silenced"); a plain hold does nothing', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    const v = core.livingVoices[0];
    holdOn(op, 'brand', () => v.pos, 1);
    trace.note('held', { traced: v.traced });
    expect(v.alive).toBe(true);
    new Hand(op).traceMoving('brand', () => v.pos, VOICE_SIGIL, 2.2);
    trace.note('traced', { alive: v.alive });
    expect(v.alive).toBe(false);
    expect(op.counts.cool).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('sings a Hymn 9 s after the last one passes, after an inhaled tell: each verse opens a boss wound and costs 1 vital', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    // The next verse's count starts once the ring has passed (~1.4 s).
    step(op, LAUDS_DEFAULT.hymnEvery * 2 + 3);
    trace.note('two verses', { verses: core.verseLog });
    expect(op.flags.has('lauds-hymn')).toBe(true);
    expect(core.verseLog).toHaveLength(2);
    expect(trace.lines.filter((l) => l.includes('hurt 1'))).toHaveLength(2);
    expect(trace.text()).toMatchSnapshot();
  });

  it('left bare for more than 5 s, it calls two Voices back, half-traced', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    silenceAll(op, core);
    expect(core.livingVoices).toHaveLength(0);
    let frames = 0;
    while (core.livingVoices.length === 0 && frames++ < 60 * 8) op.update(DT);
    trace.note('rekindled', { voices: core.livingVoices.length });
    expect(core.livingVoices).toHaveLength(2);
    expect(core.livingVoices.every((v) => v.traced >= 0.45)).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });

  it('Call → Response: the bare heart "Wounded" past 65 % splits into two bodies joined by a light-thread', () => {
    const { op, ents, trace } = lauds();
    const core = ents[0];
    silenceAll(op, core);
    core.hp = 66;
    holdOn(op, 'brand', () => (core.alive ? core.pos : null), 1);
    trace.note('split', { phase: core.phase.key, hp: core.hp });
    expect(core.phase.key).toBe('response');
    expect(live(op, LaudsBody)).toHaveLength(1);
    expect(live(op, LightThread)).toHaveLength(1);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('Dawn: submerged, found with the Lens, unmade into three hexstone shards', () => {
    const { op, ents, trace } = lauds({ bossCheckpoint: 2, skipCinematics: true } as Partial<OperationDef>);
    const core = ents[0];
    expect(core.phase.key).toBe('dawn');
    expect(core.submerged).toBe(true);
    const h = new Hand(op);
    h.hold('lens', core.pos, 0.8);
    trace.note('found', { submerged: core.submerged });
    expect(core.submerged).toBe(false);
    core.hp = 1;
    holdOn(op, 'brand', () => (core.alive && !core.submerged ? core.pos : null), 1.5);
    trace.note('unmade', { alive: core.alive });
    expect(core.alive).toBe(false);
    const stones = live(op, Embedded);
    expect(stones).toHaveLength(3);
    expect(stones.every((s) => s.kind === 'hexstone' && !s.barbed)).toBe(true);
    expect(trace.lines.some((l) => l.includes('rate COOL "Malison unmade"'))).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});
