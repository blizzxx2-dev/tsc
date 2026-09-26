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

describe('chelating tincture (CON-0108, CON-0109)', () => {
  it('lead answers only the green tincture; the wheel with the tincture held picks the colour', async () => {
    const { leadDeposit } = await import('../../../src/surgery/ailments/kilnrows');
    const op = running(() => [leadDeposit(at(0, 0))], { tinctures: ['green'] });
    const lead = op.entities[0];
    lead.hidden = false;
    const h = new Hand(op);
    h.hold('tincture', lead.pos, 1.3);
    expect(lead.alive).toBe(true);
    expect(op.tinctureColor).toBe('red');
    op.wheel(1);
    expect(op.tinctureColor).toBe('green');
    h.hold('tincture', lead.pos, 1.3);
    expect(lead.alive).toBe(false);
  });
});

describe('rotate gesture and pinned grip (INP-0106, INP-0107)', () => {
  it('rotationAround sums the signed sweep: 90°, 180°, −270° within 5°', async () => {
    const { rotationAround } = await import('../../../src/surgery/gesture');
    const arc = (from: number, to: number) =>
      Array.from({ length: 41 }, (_, i) => {
        const a = ((from + ((to - from) * i) / 40) * Math.PI) / 180;
        return { x: 100 + Math.cos(a) * 50, y: 100 + Math.sin(a) * 50 };
      });
    const deg = (r: number) => (r * 180) / Math.PI;
    expect(Math.abs(deg(rotationAround(arc(0, 90), { x: 100, y: 100 })) - 90)).toBeLessThan(5);
    expect(Math.abs(deg(rotationAround(arc(30, 210), { x: 100, y: 100 })) - 180)).toBeLessThan(5);
    expect(Math.abs(deg(rotationAround(arc(0, -270), { x: 100, y: 100 })) + 270)).toBeLessThan(5);
  });

  it('gripping a fragment by its end twists it about its middle', async () => {
    const { Fracture } = await import('../../../src/surgery/ailments/fracture');
    const op = running((o) => [new Fracture(at(0, 0), o, 0, 2)]);
    const fr = op.entities[0] as InstanceType<typeof Fracture>;
    const f = fr.fragments[1];
    const pos = { ...f.pos };
    const end = { x: f.pos.x + Math.cos(f.rot) * 22, y: f.pos.y + Math.sin(f.rot) * 22 };
    const rot0 = f.rot;
    const h = new Hand(op);
    const turned = { x: f.pos.x + Math.cos(f.rot + 0.3) * 22, y: f.pos.y + Math.sin(f.rot + 0.3) * 22 };
    h.drag('tongs', [end, turned], 100);
    expect(f.pos).toEqual(pos);
    expect(f.rot - rot0).toBeCloseTo(0.3, 1);
  });

  it('F pins the tongs’ grip: the fragment stays held while the hand is free, and lets go after 10 s', async () => {
    const { Fracture } = await import('../../../src/surgery/ailments/fracture');
    const { PIN_HOLD } = await import('../../../src/surgery/operation');
    const op = running((o) => [new Fracture(at(0, 0), o, 0, 2)]);
    const fr = op.entities[0] as InstanceType<typeof Fracture>;
    const f = fr.fragments[1];
    const h = new Hand(op);
    h.press('tongs', f.pos);
    h.drag('tongs', [f.pos, f.target], 300, false);
    expect(op.pinGrip()).toBe(true);
    expect(op.pinned?.e).toBe(fr);
    h.release();
    h.hold('lancet', at(200, 100), 0.2);
    h.release();
    expect(op.pinned?.e).toBe(fr);
    h.hold('lancet', at(200, 100), PIN_HOLD);
    expect(op.pinned).toBeNull();
  });
});
