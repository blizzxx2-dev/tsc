import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../../../src/content/chapter1';
import { CHAPTER_2 } from '../../../src/content/chapter2';
import { LOCALES } from '../../../src/i18n/locales';
import { Operation, type OperationDef } from '../../../src/surgery/operation';
import { DT, defWith } from '../../helpers/sim';

const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));

describe('LOC-0014 patient grammatical gender', () => {
  it('every demo operation declares the patient’s gender', () => {
    for (const d of demoOps) expect(['m', 'f', 'unknown'], d.id).toContain(d.patientGender);
  });
});

describe('LOC-0018 reading time per locale', () => {
  it('callouts stay up longer at a slower reading pace', () => {
    const shown = (pace: number) => {
      const op = new Operation(defWith(() => []));
      op.calloutPace = pace;
      op.callouts.length = 0;
      op.say('x'.repeat(100));
      let t = 0;
      while (op.callouts.length && t < 30) {
        op.update(DT);
        t += DT;
      }
      return t;
    };
    expect(shown(1.3)).toBeGreaterThan(shown(1) * 1.25);
  });

  it('every locale has a reading factor', () => {
    for (const l of LOCALES) expect(l.reading, l.code).toBeGreaterThan(0);
  });
});
