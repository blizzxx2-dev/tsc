/** CON-0231…0235: interview mode — the session rules and the three campaign interviews. */
import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN, stepId } from '../../../src/content/campaign';
import { OP_3_3 } from '../../../src/content/chapter3';
import { trialEvidence } from '../../../src/content/endings';
import { flags, FlagStore } from '../../../src/content/flags';
import { INTERVIEW_FOUNDERS, INTERVIEW_LIESL, trialInterview } from '../../../src/content/interviews';
import { InterviewSession, type InterviewDef } from '../../../src/surgery/interview';

/** A thorough interviewer: examine everything, ask everything askable, present every contradiction. */
function solve(def: InterviewDef, pick?: string): InterviewSession {
  const s = new InterviewSession(def);
  for (const r of def.regions ?? []) s.examine(r.id);
  for (let pass = 0; pass < 3; pass++) for (const t of s.topics()) if (!s.asked.includes(t.id)) s.ask(t.id);
  for (const c of def.contradictions ?? []) s.present(c.evidence, c.topic);
  s.conclude(pick ?? def.conclusions.find((c) => c.correct)!.id);
  return s;
}

describe('interview sessions', () => {
  it('gate the conclusion on findings, reward contradictions, and mark a wrong conclusion C', () => {
    const s = new InterviewSession(INTERVIEW_LIESL);
    expect(s.canConclude).toBe(false);
    expect(s.conclude('turned')).toBeNull();
    expect(s.topics().some((t) => t.id === 'lady')).toBe(false);
    const good = solve(INTERVIEW_LIESL);
    expect(good.result!.correct).toBe(true);
    expect(['XS', 'S']).toContain(good.result!.rank);
    expect(good.result!.flags).toEqual({ hornchildFinding: 'turned' });
    const bad = solve(INTERVIEW_LIESL, 'natural');
    expect(bad.result!.rank).toBe('C');
    expect(bad.result!.flags).toEqual({ hornchildFinding: 'natural' });
  });

  it('presenting the wrong evidence exposes nothing and costs a little', () => {
    const s = new InterviewSession(INTERVIEW_FOUNDERS);
    s.examine('gums');
    s.ask('when');
    s.ask('blessing');
    expect(s.present('gums', 'when')).toBe(false);
    expect(s.present('gums', 'blessing')).toBe(true);
    expect(s.exposed).toEqual(['blessing']);
  });
});

describe('interview content QA (CON-0236)', () => {
  it('every topic is reachable and every contradiction can be exposed', () => {
    for (const def of [INTERVIEW_LIESL, INTERVIEW_FOUNDERS]) {
      const s = solve(def);
      expect(s.asked.sort(), def.id).toEqual(def.topics.map((t) => t.id).sort());
      expect(s.exposed.length, def.id).toBe(def.contradictions!.length);
      expect(
        def.conclusions.filter((c) => c.correct),
        def.id,
      ).toHaveLength(1);
    }
  });
});

describe('the campaign interviews', () => {
  it('sit where the story needs them: Liesl before the certificate, the founders before Ute’s op, the trial before the verdict', () => {
    const ids = FULL_CAMPAIGN.flatMap((c) => c.steps.map(stepId));
    expect(ids.indexOf('iv3-liesl')).toBe(ids.indexOf('s3-2') - 1);
    expect(ids.indexOf('iv3-founders')).toBe(ids.indexOf('op3-3') - 1);
    expect(ids.indexOf('iv5-trial')).toBe(ids.indexOf('s5-3') - 1);
  });

  it('a wrong founders’ verdict sends Ute Brandt in weaker', () => {
    flags.clear();
    expect(OP_3_3.vitals).toBeUndefined();
    flags.set('foundersVerdict', 'curse');
    expect(OP_3_3.vitals).toBe(75);
    flags.clear();
  });

  it('the trial’s evidence is whoever the campaign left able to speak; each rebuttal lightens the case', () => {
    const bare = trialInterview(new FlagStore());
    expect(bare.evidence!.map((e) => e.id)).toEqual(['charter-roll', 'orsa']);
    const f = new FlagStore();
    f.setAll({ mauerFate: 'hale', hallerFate: 'hands', hornchildCertificate: 'turned', cantorMercy: false, strohTooth: true, strohToothFine: true });
    const full = trialInterview(f);
    expect(full.evidence!.map((e) => e.id)).toEqual(['charter-roll', 'mauer', 'haller', 'ledger', 'orsa']);
    // The kind lie brings the mother to the stand — and costs Stroh's ledger.
    const lie = new FlagStore();
    lie.set('hornchildCertificate', 'natural');
    expect(trialInterview(lie).evidence!.map((e) => e.id)).toContain('mother');
    const s = solve(full, 'mercy');
    // Witchcraft (twice over: Mauer and the ledger count once), the hymn, and the charter.
    expect(s.exposed.length).toBe(3);
    const before = trialEvidence(f);
    f.set('trialRebuttals', s.exposed.length);
    expect(trialEvidence(f)).toBe(before - 3);
  });
});

describe('the interview scene', () => {
  it('renders every stage: fresh, mid-examination, and concluded', async () => {
    const { installFakeDom, fakeCanvas, fakeGl } = await import('../../fakegl');
    installFakeDom();
    const { Input } = await import('../../../src/core/input');
    const { Bindings } = await import('../../../src/input/bindings');
    const { Gfx } = await import('../../../src/render/gfx');
    const { InterviewScene } = await import('../../../src/scenes/interview');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const game = {
      input: new Input(null, 1280, 720, new Bindings(null)),
      gfx: g,
      audio: { play: () => undefined },
      go: () => undefined,
      push: () => undefined,
    } as never;
    let done = false;
    const scene = new InterviewScene(INTERVIEW_LIESL, 'hospice', () => (done = true));
    scene.update(1 / 60, game);
    scene.render(g, game);
    scene.session.examine('bone-age');
    scene.session.ask('born');
    scene.render(g, game);
    for (const r of INTERVIEW_LIESL.regions!) scene.session.examine(r.id);
    scene.session.conclude('turned');
    scene.render(g, game);
    expect(scene.session.result?.correct).toBe(true);
    expect(done).toBe(false);
  });
});
