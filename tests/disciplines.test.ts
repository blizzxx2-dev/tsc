import { describe, expect, it } from 'vitest';
import { ClosedReduction, DiagnosisCase, ForensicCase, TRACTION, TriageSession } from '../src/surgery/disciplines';
import { FRACTURE } from '../src/surgery/ailments/fracture';
import { at, Hand, running } from './harness-gameplay';

describe('GAM-Q disciplines', () => {
  it('GAM-0260: diagnosis — lens and palpation collect findings; four options; a wrong answer costs time next op', () => {
    const d = new DiagnosisCase(
      [
        { id: 'swelling', pos: at(-100, 0), via: 'palpate', text: 'Hard swelling under the arm.' },
        { id: 'veins', pos: at(80, 40), via: 'lens', text: 'Blackened veins beneath the skin.' },
      ],
      [
        { id: 'plague', name: 'Plague' },
        { id: 'venom', name: 'Venom' },
        { id: 'curse', name: 'Curse' },
        { id: 'rot', name: 'Rot' },
      ],
      'plague',
    );
    expect(d.examine(at(-100, 0), 'lens', 1)).toBeNull();
    expect(d.examine(at(-100, 0), 'palpate')?.id).toBe('swelling');
    expect(d.examine(at(80, 40), 'lens', 0.2)).toBeNull();
    expect(d.examine(at(80, 40), 'lens', 0.25)?.id).toBe('veins');
    expect(d.found.size).toBe(2);
    expect(d.choose('venom')).toBe(20);
    expect(d.correct).toBe(false);
    expect(() => new DiagnosisCase([], [{ id: 'a', name: 'A' }], 'a')).toThrow();
  });

  it('GAM-0261: forensic — tag evidence against the clock, present a verdict; no vitals', () => {
    const f = new ForensicCase(
      [
        { id: 'sigil', pos: at(0, 0), tag: 'witchcraft' },
        { id: 'wound', pos: at(100, 0), tag: 'blade' },
      ],
      'choir',
      60,
    );
    expect(f.tag(at(0, 0), 'witchcraft')).toBe(true);
    expect(f.tag(at(100, 0), 'claw')).toBe(false);
    expect(f.tag(at(300, 0), 'blade')).toBeNull();
    f.tick(20);
    const v = f.present('choir');
    expect(v.correct).toBe(true);
    expect(v.score).toBe(150 - 75 + 600 + 40 * 5);
    f.tick(100);
    expect(f.expired).toBe(true);
    expect(f.tag(at(0, 0), 'witchcraft')).toBeNull();
  });

  it('GAM-0262: field triage — tag 3–5 patients, treat in tag order on a shared clock', () => {
    const t = new TriageSession(
      [
        { id: 'a', truth: 'delayed', microOp: 30 },
        { id: 'b', truth: 'immediate', microOp: 30 },
        { id: 'c', truth: 'urgent', microOp: 30 },
      ],
      70,
    );
    t.tagPatient('a', 'delayed');
    t.tagPatient('b', 'immediate');
    expect(t.allTagged).toBe(false);
    t.tagPatient('c', 'urgent');
    expect(t.order().map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(t.accuracy()).toBe(3);
    expect(t.nextBudget()).toBe(30);
    t.finish('b', 25);
    t.finish('c', 30);
    expect(t.nextBudget()).toBe(15);
    const bad = new TriageSession([
      { id: 'a', truth: 'immediate', microOp: 30 },
      { id: 'b', truth: 'urgent', microOp: 30 },
      { id: 'c', truth: 'delayed', microOp: 30 },
    ]);
    bad.tagPatient('a', 'delayed');
    expect(bad.accuracy()).toBe(-1);
    expect(() => new TriageSession([{ id: 'x', truth: 'urgent', microOp: 30 }])).toThrow();
  });

  it('GAM-0263: closed bone-setting — fragments move only under traction', () => {
    const tp = at(-160, 0);
    const op = running((o) => [new ClosedReduction(at(0, 0), o, tp, 0, 2)]);
    const r = op.entities[0] as ClosedReduction;
    const frag = r.fragments[1];
    const h = new Hand(op);
    h.press('tongs', frag.pos);
    h.release();
    expect(op.flags.has('traction')).toBe(true);
    h.hold('tongs', tp, 0.8);
    h.release();
    expect(r.traction).toBeGreaterThanOrEqual(TRACTION.needed);
    h.press('tongs', frag.pos);
    h.drag('tongs', [frag.pos, frag.target], 400, false);
    const need = Math.round(((frag.targetRot - frag.rot) * 180) / Math.PI / FRACTURE.wheelDeg);
    for (let i = 0; i < Math.abs(need); i++) op.wheel(Math.sign(need));
    h.release();
    expect(frag.set).toBe(true);
  });
});
