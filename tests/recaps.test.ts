import { describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN } from '../src/content/campaign';
import { narrativeEntries } from '../src/content/export';
import { RECAPS, recapStory } from '../src/content/recaps';

describe('chapter-select recaps (NAR-0161)', () => {
  it('every chapter after the first has a three-sentence "previously"; the first has none', () => {
    expect(recapStory(FULL_CAMPAIGN[0].id, FULL_CAMPAIGN[0].numeral)).toBeNull();
    for (const ch of FULL_CAMPAIGN.slice(1)) {
      const s = recapStory(ch.id, ch.numeral);
      expect(s, ch.id).not.toBeNull();
      expect(s!.lines).toHaveLength(3);
      for (const l of s!.lines) expect(l.text).toMatch(/[.!?’]$/);
    }
  });

  it('recaps go out to translators', () => {
    const ids = narrativeEntries().map((e) => e.id);
    for (const ch of Object.keys(RECAPS)) expect(ids).toContain(`recap.${ch}.001`);
  });
});
