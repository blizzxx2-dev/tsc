/** CON-0241…0246: forensic examinations by candle-light. */
import { describe, expect, it } from 'vitest';
import { CHAPTER_4 } from '../../../src/content/chapter4';
import { stepId, stepOpen } from '../../../src/content/campaign';
import { FlagStore } from '../../../src/content/flags';
import { FORENSIC_COACHMAN, FORENSIC_PREDECESSOR, FORENSIC_SALM } from '../../../src/content/forensics';
import { CANDLE_COST, InterviewSession, type InterviewDef } from '../../../src/surgery/interview';

function solve(def: InterviewDef): InterviewSession {
  const s = new InterviewSession(def);
  for (const r of def.regions ?? []) s.examine(r.id);
  for (let pass = 0; pass < 3; pass++) for (const t of s.topics()) if (!s.asked.includes(t.id)) s.ask(t.id);
  for (const c of def.contradictions ?? []) s.present(c.evidence, c.topic);
  s.conclude(def.conclusions.find((c) => c.correct)!.id);
  return s;
}

describe('forensic examinations', () => {
  it('burn a candle in real time and per action; a guttered candle forces the verdict', () => {
    const s = new InterviewSession(FORENSIC_SALM);
    expect(s.canConclude).toBe(false);
    s.examine('bite');
    expect(s.candle).toBe(FORENSIC_SALM.candle! - CANDLE_COST.examine);
    s.tick(1000);
    expect(s.guttered).toBe(true);
    expect(s.examine('livor')).toBeNull();
    expect(s.canConclude).toBe(true);
    expect(s.conclude('dead')!.flags).toEqual({ deadManVerdict: 'dead' });
  });

  it('every case can be solved in full inside its candle, with every contradiction found', () => {
    for (const def of [FORENSIC_PREDECESSOR, FORENSIC_SALM, FORENSIC_COACHMAN]) {
      const s = solve(def);
      expect(s.guttered, def.id).toBe(false);
      expect(s.exposed.length, def.id).toBe(def.contradictions!.length);
      expect(s.result!.correct, def.id).toBe(true);
      expect(['XS', 'S', 'A'], def.id).toContain(s.result!.rank);
    }
  });

  it('the dead man’s pulse, branch B: certified dead, examined — and a correct finding sends him to the table', () => {
    const at = (id: string) => CHAPTER_4.steps.find((s) => stepId(s) === id)!;
    const f = new FlagStore();
    f.set('deadManVerdict', 'dead');
    expect([stepOpen(at('fo4-salm'), f), stepOpen(at('s4-5b'), f), stepOpen(at('op4-5'), f)]).toEqual([true, true, false]);
    f.setAll(solve(FORENSIC_SALM).result!.flags);
    expect([stepOpen(at('s4-5b'), f), stepOpen(at('op4-5'), f)]).toEqual([false, true]);
  });
});

describe('interview authoring rules', () => {
  it('no statement carries two contradictions (only one could ever be exposed)', async () => {
    const { INTERVIEW_FOUNDERS, INTERVIEW_LIESL, trialInterview } = await import('../../../src/content/interviews');
    for (const def of [INTERVIEW_LIESL, INTERVIEW_FOUNDERS, trialInterview(new FlagStore()), FORENSIC_PREDECESSOR, FORENSIC_SALM, FORENSIC_COACHMAN]) {
      const topics = (def.contradictions ?? []).map((c) => c.topic);
      // The trial's witchcraft charge is answered by either Mauer or the ledger — whichever the campaign left.
      const unique = def.id === 'iv5-trial' ? new Set(topics).size >= topics.length - 1 : new Set(topics).size === topics.length;
      expect(unique, def.id).toBe(true);
    }
  });
});
