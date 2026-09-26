/**
 * CON-0252: every codex page and case note unlocks from something the campaign can actually reach —
 * across every branch of the full graph, not only the default path.
 */
import { describe, expect, it } from 'vitest';
import { CODEX, type CodexUnlock } from '../../../src/content/codex';
import { FULL_CAMPAIGN, stepId } from '../../../src/content/campaign';
import { CASE_NOTES } from '../../../src/content/casenotes';

const steps = FULL_CAMPAIGN.flatMap((c) => c.steps);
const ids = new Set(steps.map(stepId));
// Stories embedded in endings, epilogues and such are reached through the steps' story ids too.
const storyIds = new Set(steps.filter((s) => s.kind === 'story').map((s) => (s.kind === 'story' ? s.story.id : '')));

describe('CON-0252: codex and case-note unlocks are all reachable', () => {
  it('every codex unlock names a real operation, story or chapter', () => {
    const bad: string[] = [];
    const check = (id: string, u: CodexUnlock) => {
      if (u.kind === 'op' && !ids.has(u.op)) bad.push(`${id}: op ${u.op}`);
      if (u.kind === 'story' && !storyIds.has(u.story)) bad.push(`${id}: story ${u.story}`);
      if (u.kind === 'chapter' && (u.chapter < 1 || u.chapter > FULL_CAMPAIGN.length)) bad.push(`${id}: chapter ${u.chapter}`);
    };
    for (const e of CODEX) {
      check(e.id, e.unlock);
      if (e.more) check(`${e.id} (more)`, e.more.unlock);
    }
    expect(bad).toEqual([]);
  });

  it('every case note belongs to a campaign operation, and every campaign operation has one', () => {
    const ops = steps.filter((s) => s.kind === 'op').map((s) => (s.kind === 'op' ? s.op.id : ''));
    const notes = CASE_NOTES.map((n) => n.op);
    expect(notes.filter((n) => !ops.includes(n))).toEqual([]);
    expect(ops.filter((o) => !notes.includes(o))).toEqual([]);
  });
});
