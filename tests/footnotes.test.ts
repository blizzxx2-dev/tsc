import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN } from '../src/content/campaign';
import { FOOTNOTES, footnoteStory } from '../src/content/footnotes';

describe('where are they now (NAR-0089)', () => {
  it('every demo patient has one follow-up line, read in chapter order after the chapter', () => {
    for (const ch of FULL_CAMPAIGN.slice(0, 2)) {
      const ops = ch.steps.flatMap((s) => (s.kind === 'op' ? [s.op.id] : []));
      for (const id of ops) expect(FOOTNOTES[id], id).toBeTruthy();
      const s = footnoteStory(ch.id, ch.numeral, ops)!;
      expect(s.lines.map((l) => l.text)).toEqual(ops.map((id) => FOOTNOTES[id]));
      expect(s.lines.every((l) => l.who === 'narrator')).toBe(true);
    }
    expect(footnoteStory('chX', 'X', ['nope'])).toBeNull();
  });
});
