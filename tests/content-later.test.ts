import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN as CAMPAIGN } from '../src/content/campaign';
import { LATER_CHAPTERS } from '../src/content/later';
import { MALISON_VOICES } from '../src/surgery/bosses/voices';
import { Operation } from '../src/surgery/operation';
import { playWithBot } from './bot';

/** Proper nouns and coinages from other fantasy IP that must never appear in our text. */
const AVOID =
  /\b(sigmar|shallya|morrslieb|skaven|nurgle|khorne|slaanesh|tzeentch|reikland|altdorf|warpstone|warp|beastmen|turnskin|chaos god|guilt|healing touch|caduceus|delphi)\b/i;

describe('Chapters III–V script', () => {
  const stories = LATER_CHAPTERS.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'story' ? [s.story] : [])));
  const ops = LATER_CHAPTERS.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));

  it('every VN line fits the 140-character budget', () => {
    for (const s of stories) for (const l of s.lines) expect(l.text.length, `${s.id}: ${l.text}`).toBeLessThanOrEqual(140);
  });

  it('scene and operation ids are unique across the whole campaign', () => {
    const scenes = CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'story' ? [s.story.id] : [])));
    const opIds = CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op.id] : [])));
    expect(new Set(scenes).size).toBe(scenes.length);
    expect(new Set(opIds).size).toBe(opIds.length);
  });

  it('the campaign runs to five chapters, 12 + 12 + 16 scenes (three alternative endings) and 11 + 10 + 9 operations after the demo', () => {
    expect(CAMPAIGN.length).toBe(5);
    expect(LATER_CHAPTERS.map((c) => c.steps.filter((s) => s.kind === 'story').length)).toEqual([12, 12, 16]);
    expect(LATER_CHAPTERS.map((c) => c.steps.filter((s) => s.kind === 'op').length)).toEqual([11, 10, 9]);
  });

  it('no avoid-list names or franchise terms in any line, briefing, callout or boss voice', () => {
    const text = [
      ...stories.flatMap((s) => [s.place, ...s.lines.map((l) => `${l.as ?? ''} ${l.text}`)]),
      ...ops.flatMap((o) => [o.title, o.patient, o.diagnosis, ...o.phases.flatMap((p) => p.callout ?? [])]),
      ...Object.values(MALISON_VOICES).flat(),
    ];
    for (const t of text) expect(t, t).not.toMatch(AVOID);
  });

  it('every operation has a briefing and callouts for each phase that spawns work', () => {
    for (const o of ops) {
      expect(o.diagnosis.length).toBeGreaterThan(20);
      expect(o.phases.filter((p) => p.callout?.length).length).toBeGreaterThanOrEqual(o.phases.length - 1);
    }
  });

  // The op checklist (CON-0027): no softlock, and seeded determinism.
  for (const def of LATER_CHAPTERS.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])))) {
    it(`${def.id}: an idle surgeon loses before time + 5 s; two runs on one seed are identical`, () => {
      const idle = new Operation(def);
      for (let t = 0; t < def.timeLimit + 5 && (idle.status === 'intro' || idle.status === 'running'); t += 1 / 60) idle.update(1 / 60);
      expect(idle.status).toBe('lost');
      const a = playWithBot(def, { think: 1 }).op;
      const b = playWithBot(def, { think: 1 }).op;
      expect([a.score, Math.round(a.vitals * 1000), a.timeLeft]).toEqual([b.score, Math.round(b.vitals * 1000), b.timeLeft]);
    });
  }
});
