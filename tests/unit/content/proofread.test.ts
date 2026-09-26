/**
 * NAR-0174: the demo's typography — curly quotes and apostrophes, em dashes rather than spaced
 * hyphens, a single ellipsis character, no doubled spaces — across every line the demo shows:
 * the story, the briefings and callouts, and the case notes.
 */
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../../../src/content/chapter1';
import { CHAPTER_2 } from '../../../src/content/chapter2';
import { CASE_NOTES } from '../../../src/content/casenotes';

function demoText(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const ch of [CHAPTER_1, CHAPTER_2])
    for (const s of ch.steps) {
      if (s.kind === 'story') s.story.lines.forEach((l, i) => out.push({ where: `${s.story.id}#${i}`, text: l.text }));
      if (s.kind === 'op') {
        out.push({ where: `${s.op.id} diagnosis`, text: s.op.diagnosis });
        s.op.phases.forEach((p, i) => (p.callout ?? []).forEach((c) => out.push({ where: `${s.op.id} phase ${i + 1}`, text: typeof c === 'string' ? c : '' })));
      }
    }
  for (const n of CASE_NOTES.filter((x) => /^op[12]-/.test(x.op)))
    for (const t of [n.patient, n.presenting, n.procedure, n.observation, n.outcome.high, n.outcome.mid, n.outcome.low])
      out.push({ where: `note ${n.op}`, text: t });
  return out;
}

describe('NAR-0174: demo typography', () => {
  it('no straight quotes, spaced hyphens, three-dot ellipses or doubled spaces', () => {
    const bad = demoText()
      .filter(({ text }) => /['"]| - |\.\.\.| {2}/.test(text))
      .map(({ where, text }) => `${where}: ${text}`);
    expect(bad).toEqual([]);
  });
});
