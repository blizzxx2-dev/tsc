import { describe, expect, it } from 'vitest';
import { ClosedReduction, TRACTION } from '../../../src/surgery/disciplines';
import { Splint, SplintWrap } from '../../../src/surgery/ailments/fracture';
import { OP_3_12, OP_3_13, OP_4_11, OP_5_10 } from '../../../src/content/ops/bones';
import { allCampaignOperations } from '../../../src/content/campaign';
import { CASE_NOTES_LATER } from '../../../src/content/casenotesLater';
import { at, Hand, running } from '../../harness-gameplay';

describe('bone-setting (CON-0237…0240)', () => {
  it('CON-0237: hauling at full traction past 1.5 s tears — BAD, harm, −100, and the pull halves', () => {
    const tp = at(-160, 0);
    const op = running((o) => [new ClosedReduction(at(0, 0), o, tp, 0, 2)]);
    const r = op.entities[0] as ClosedReduction;
    const h = new Hand(op);
    const before = op.vitals;
    h.hold('tongs', tp, 1.0 + TRACTION.overHold + 0.2);
    h.release();
    expect(r.overTractions).toBe(1);
    expect(op.endPenalty).toBe(TRACTION.overPenalty);
    expect(op.vitals).toBeLessThan(before);
    expect(r.traction).toBeLessThan(1);
  });

  it('CON-0237: a pull that stops short of 1.5 s at full is safe', () => {
    const tp = at(-160, 0);
    const op = running((o) => [new ClosedReduction(at(0, 0), o, tp, 0, 2)]);
    const r = op.entities[0] as ClosedReduction;
    new Hand(op).hold('tongs', tp, 1.8);
    expect(r.overTractions).toBe(0);
  });

  it('CON-0238: the splint is bound a band at a thread-turn; bound, it becomes the finished splint', () => {
    const op = running(() => [new SplintWrap(at(-80, 0), at(80, 0), 3)]);
    const w = op.entities[0] as SplintWrap;
    const h = new Hand(op);
    for (let i = 0; i < 3; i++) {
      const c = w.bandAt(i);
      h.drag(
        'thread',
        [
          { x: c.x, y: c.y - 30 },
          { x: c.x, y: c.y + 30 },
        ],
        250,
      );
      expect(w.bound.filter(Boolean).length).toBe(i + 1);
    }
    expect(w.alive).toBe(false);
    expect(op.entities.some((e) => e instanceof Splint && e.alive)).toBe(true);
  });

  it('CON-0240: a closed break is hidden until the lens finds it', () => {
    const op = running((o) => [new ClosedReduction(at(0, 0), o, at(-160, 0), 0, 2, { hidden: true })]);
    const r = op.entities[0] as ClosedReduction;
    expect(r.hidden).toBe(true);
    new Hand(op).hold('lens', r.pos, 1.0);
    expect(r.hidden).toBe(false);
  });

  it('CON-0239: four cases in the campaign, each with a case note and a bound splint', () => {
    const ids = allCampaignOperations().map((d) => d.id);
    for (const def of [OP_3_12, OP_3_13, OP_4_11, OP_5_10]) {
      expect(ids).toContain(def.id);
      expect(CASE_NOTES_LATER.some((n) => n.op === def.id)).toBe(true);
      expect(JSON.stringify(def.phases.map((p) => ('data' in p ? p.data : null)))).toMatch(/"wrap":\d/);
    }
  });
});
