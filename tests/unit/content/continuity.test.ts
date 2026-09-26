/** NAR-0175: demo continuity — briefings, case notes, scenes and the codex tell the same story. */
import { describe, expect, it } from 'vitest';
import { CASE_NOTES } from '../../../src/content/casenotes';
import { CHAPTER_1 } from '../../../src/content/chapter1';
import { CHAPTER_2, STORY_2_2, STORY_2_3 } from '../../../src/content/chapter2';
import { CODEX } from '../../../src/content/codex';
import { OP_2_1, OP_2_2, OP_2_3, OP_2_4 } from '../../../src/content/ops/ch2';
import { FULL_CAMPAIGN } from '../../../src/content/campaign';
import { lineShown } from '../../../src/content/conditions';
import type { FlagReader } from '../../../src/content/flags';

const ops = [CHAPTER_1, CHAPTER_2].flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op] : [])));
const note = (id: string) => CASE_NOTES.find((n) => n.op === id)!;
const lines = (s: { lines: readonly unknown[] }) => JSON.stringify(s.lines);

describe('demo continuity (NAR-0175)', () => {
  it('every demo patient is named the same in the briefing and the case note', () => {
    for (const d of ops) expect(note(d.id).patient.startsWith(d.patient.split(',')[0]), d.id).toBe(true);
  });

  it('the Gravehound: grave-dirt and a broken fang, in the briefing and the ledger', () => {
    expect(OP_2_1.diagnosis).toMatch(/grave-dirt/i);
    expect(OP_2_1.diagnosis).toMatch(/broken/);
    expect(note('op2-1').procedure).toMatch(/crown, then root/);
  });

  it('the Black Seam: her lamp burst, so there is glass as well as stone', () => {
    expect(OP_2_2.diagnosis).toMatch(/lamp/);
    expect(lines(STORY_2_2)).toMatch(/lamp/);
    expect(note('op2-2').presenting).toMatch(/glass/);
  });

  it('Ilvaren: two bites, a day old — briefing, callout, ledger and the scene agree', () => {
    expect(OP_2_3.diagnosis).toMatch(/^Two web-spinner bites, a day old/);
    expect(OP_2_3.phases[1].data.callout?.join(' ')).toMatch(/two bites/);
    expect(note('op2-3').presenting).toMatch(/Two web-spinner bites at the neck, a day old/);
    expect(lines(STORY_2_3)).toMatch(/yesterday/);
  });

  it('the cantor’s hymn-token: in the briefing, the ledger and the codex, at the muster camp', () => {
    expect(OP_2_4.diagnosis).toMatch(/swallowed/);
    expect(note('op2-4').procedure).toMatch(/hymn-token/);
    expect(CODEX.find((e) => e.id === 'choir-token')!.body).toMatch(/muster camp/);
  });

  it('Mauer’s count never goes up, whichever way the ford went (NAR-0179)', () => {
    const WORDS: Record<string, number> = { 'forty-one': 41, forty: 40 };
    ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'].forEach((w, i) => (WORDS[`thirty-${w}`] = 31 + i));
    WORDS.thirty = 30;
    const stories = FULL_CAMPAIGN.slice(3).flatMap((c) => c.steps.flatMap((s) => (s.kind === 'story' && s.story ? [s.story] : [])));
    for (const fordSaved of [10, 4]) {
      const f: FlagReader = { get: (k) => (k === 'fordSaved' ? fordSaved : undefined), has: (k) => k === 'fordSaved', truthy: (k) => k === 'fordSaved' };
      const counts: number[] = [];
      for (const st of stories)
        for (const l of st.lines) {
          if (l.who !== 'mauer' || !lineShown(l, {}, f)) continue;
          const m = l.text.toLowerCase().match(/^(?:all… all in order, doctor\. )?(forty-one|forty|thirty(?:-[a-z]+)?)\b/);
          if (m && WORDS[m[1]]) counts.push(WORDS[m[1]]);
        }
      expect(counts.length, `fordSaved ${fordSaved}`).toBeGreaterThan(6);
      for (let i = 1; i < counts.length; i++) expect(counts[i], `fordSaved ${fordSaved}: ${counts.join(' ')}`).toBeLessThanOrEqual(counts[i - 1]);
      expect(counts[counts.length - 1]).toBe(fordSaved >= 7 ? 35 : 32);
    }
  });
});
