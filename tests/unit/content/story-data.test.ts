/** QAT-0053: story data checks across every chapter of the campaign. */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../../src/content/campaign';
import { CAST } from '../../../src/content/characters';
import type { StoryDef } from '../../../src/content/story';

const stories = CAMPAIGN.flatMap((ch) => ch.steps.flatMap((s) => (s.kind === 'story' ? [{ ch, story: s.story as StoryDef }] : [])));

describe('story data', () => {
  it('has stories to check', () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  it.each(stories.map(({ story }) => [story.id, story] as const))('%s: every speaker is in CAST and no line is empty', (_id, story) => {
    expect(story.lines.length, `${story.id} has no lines`).toBeGreaterThan(0);
    for (const [i, line] of story.lines.entries()) {
      expect(Object.keys(CAST), `${story.id}[${i}] speaker`).toContain(line.who);
      expect(line.text.trim().length, `${story.id}[${i}] is empty`).toBeGreaterThan(0);
      if (line.as !== undefined) expect(line.as.trim().length, `${story.id}[${i}] empty name override`).toBeGreaterThan(0);
    }
    expect(story.place.trim().length, `${story.id} place`).toBeGreaterThan(0);
  });

  it('story ids are unique across chapters', () => {
    const ids = stories.map(({ story }) => story.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it.each(CAMPAIGN.map((ch) => [ch.id, ch] as const))('%s ends with a story step carrying its END OF CHAPTER narration', (_id, ch) => {
    const last = ch.steps[ch.steps.length - 1];
    expect(last.kind).toBe('story');
    if (last.kind !== 'story') return;
    const final = last.story.lines[last.story.lines.length - 1];
    expect(final.who).toBe('narrator');
    expect(final.text).toMatch(new RegExp(`^END OF CHAPTER ${ch.numeral}\\b`));
    expect(final.text.toUpperCase()).toContain(ch.title.toUpperCase());
  });

  it('operation ids are unique across chapters', () => {
    const ids = CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'op' ? [s.op.id] : [])));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
