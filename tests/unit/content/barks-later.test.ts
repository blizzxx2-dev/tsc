/** NAR-0162 / NAR-0165: the late chapters' speaker and patient barks. */
import { describe, expect, it } from 'vitest';
import { BARK_TRIGGERS, BARKS, HALLER_LETTER, PATIENT_BARKS, speakerFor } from '../../../src/content/barks';
import { attachBarkDirector } from '../../../src/content/barkDirector';
import { allCampaignOperations } from '../../../src/content/campaign';
import { Operation } from '../../../src/surgery/operation';

const late = () => allCampaignOperations().filter((d) => /^op[3-5]-/.test(d.id));

describe('late-chapter barks', () => {
  it('every Chapter III–V patient has 4–6 lines', () => {
    for (const def of late()) {
      const set = PATIENT_BARKS[def.id];
      expect(set, def.id).toBeDefined();
      const n = Object.values(set).reduce((a, l) => a + (l?.length ?? 0), 0);
      expect(n, def.id).toBeGreaterThanOrEqual(4);
      expect(n, def.id).toBeLessThanOrEqual(6);
    }
  });

  it('Orsa speaks for her delvers and while Ilse is down, with at least three lines per trigger', () => {
    for (const t of BARK_TRIGGERS) expect(BARKS.orsa[t]?.length ?? 0, t).toBeGreaterThanOrEqual(3);
    expect(['op4-3', 'op5-6', 'op5-7', 'op5-8'].map(speakerFor)).toEqual(['orsa', 'orsa', 'orsa', 'orsa']);
    expect(speakerFor('op3-1')).toBe('ilse');
  });

  it('a Chapter IV field operation opens with a line of Haller’s letter; others do not', () => {
    const lines = (id: string) => {
      const def = allCampaignOperations().find((d) => d.id === id)!;
      const d = attachBarkDirector(new Operation(def), { rng: () => 0, cooldown: 0 });
      return d.spoken.map((s) => s.line);
    };
    expect(lines('op4-1').some((l) => HALLER_LETTER.includes(l))).toBe(true);
    expect(lines('op3-1').some((l) => HALLER_LETTER.includes(l))).toBe(false);
  });
});
