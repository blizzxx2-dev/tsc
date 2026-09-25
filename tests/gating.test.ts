import { describe, expect, it } from 'vitest';
import { CAMPAIGN, allOperations } from '../src/content/campaign';
import { EDITION, EDITION_INFO } from '../src/platform/build';
import { EDITIONS } from '../src/platform/editions';
import { chapterOfId, contentAllowed, gateChapters, gatingViolations } from '../src/platform/gating';
import { freshProfile } from '../src/core/save/codec';
import { ACHIEVEMENTS, achievementsFor } from '../src/platform/achievements';

describe('demo content gating', () => {
  it('this test build is the demo edition (the default build flavour)', () => {
    expect(EDITION).toBe('demo');
    expect(EDITION_INFO.chapters).toEqual([0, 1]);
  });

  it('the campaign exposes only Chapters I–II in the demo', () => {
    expect(CAMPAIGN.length).toBeLessThanOrEqual(2);
    expect(gateChapters(['I', 'II', 'III', 'IV', 'V'], EDITIONS.demo)).toEqual(['I', 'II']);
    expect(gateChapters(['I', 'II', 'III', 'IV', 'V'], EDITIONS.full)).toHaveLength(5);
  });

  it('every reachable operation and story id belongs to a demo chapter', () => {
    for (const op of allOperations()) expect(contentAllowed(op.id, EDITIONS.demo), op.id).toBe(true);
    for (const ch of CAMPAIGN) for (const s of ch.steps) if (s.kind === 'story') expect(contentAllowed(s.story.id, EDITIONS.demo), s.story.id).toBe(true);
  });

  it('parses chapter numbers from engine and stable ids', () => {
    expect(chapterOfId('op2-3')).toBe(1);
    expect(chapterOfId('s1-end')).toBe(0);
    expect(chapterOfId('ch3.op1')).toBe(2);
    expect(chapterOfId('prologue')).toBeNull();
    expect(contentAllowed('op3-1', EDITIONS.demo)).toBe(false);
    expect(contentAllowed('op3-1', EDITIONS.full)).toBe(true);
  });

  it('flags save fields that reference non-demo content', () => {
    const p = freshProfile('demo', 't');
    expect(gatingViolations(p, EDITIONS.demo)).toEqual([]);
    p.progress = { chapter: 2, step: 0 }; // "demo complete" is legal
    expect(gatingViolations(p, EDITIONS.demo)).toEqual([]);
    p.best['op4-1'] = { rank: 'S', score: 1 };
    p.progress = { chapter: 3, step: 0 };
    p.unlocks = ['ch5.gallery'];
    expect(gatingViolations(p, EDITIONS.demo)).toEqual(['op4-1', 'progress.chapter=3', 'unlock:ch5.gallery']);
  });

  it('demo achievements only reference demo operations', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    for (const a of achievementsFor('demo')) expect(a.id).toMatch(/^[A-Z0-9_]+$/);
  });
});
