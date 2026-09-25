/**
 * Campaign graph checks for the five chapters (QAT-0155): every chapter is reachable by walking the
 * step model with fresh flags, chapter clears and Litany rites unlock in a chain without cycles or
 * gaps, every challenge-mode entry (X-op ladder, Loom, custom challenges) names an existing
 * operation of the right chapter, and a finished demo carries over to the first step of Chapter III.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allCampaignOperations, FULL_CAMPAIGN, nextOpenStep, stepId, type Chapter } from '../../../src/content/campaign';
import { CHAPTER_3 } from '../../../src/content/chapter3';
import { decodeChallenge, encodeChallenge, LOOM_MODULES, loomOp, X_OPS, xOpDef, xUnlocked } from '../../../src/content/challenge';
import { FlagStore } from '../../../src/content/flags';
import { readProfile } from '../../../src/core/save/codec';
import { CONTENT_ID_TABLES, CURRENT_CONTENT_IDS, importDemoProfile, indexCampaign } from '../../../src/platform/carryover';
import { chapterOfId } from '../../../src/platform/gating';
import { BOSS_OPS } from '../../../src/surgery/bosses/codex';
import { LITANIES, LITANY_ORDER, unlockedLitanies } from '../../../src/surgery/litany';
import { freshProgress, recordChapter, type Progress } from '../../../src/surgery/progress';
import type { Rank } from '../../../src/surgery/types';

const opIds = new Set(allCampaignOperations().map((o) => o.id));
const chapterOf = (opId: string): number => FULL_CAMPAIGN.findIndex((c) => c.steps.some((s) => s.kind === 'op' && s.op.id === opId));
const bossOpOfHour = (hour: string): string | undefined => Object.entries(BOSS_OPS).find(([, h]) => h === hour)?.[0];

/**
 * The campaign step model as `playStep` walks it: from (chapter, step) the next open step is
 * played; past the last step the chapter is recorded as cleared and the next chapter starts.
 * Returns the ids visited and the progress at the end.
 */
function walkCampaign(
  chapters: readonly Chapter[],
  from = { chapter: 0, step: 0 },
  flags = new FlagStore(),
): { visited: string[]; progress: Progress; cleared: number[] } {
  const visited: string[] = [];
  const progress = freshProgress('full');
  const cleared: number[] = [];
  let { chapter, step } = from;
  for (let guard = 0; guard < 10_000; guard++) {
    const ch = chapters[chapter];
    if (!ch) break;
    const open = nextOpenStep(ch, step, flags);
    const s = ch.steps[open];
    if (!s) {
      if (recordChapter(progress, chapter + 1)) cleared.push(chapter + 1);
      chapter++;
      step = 0;
      continue;
    }
    visited.push(stepId(s));
    step = open + 1;
  }
  return { visited, progress, cleared };
}

describe('QAT-0155: campaign reachability', () => {
  it('has five chapters, numbered I–V, each with at least one operation and one story scene', () => {
    expect(FULL_CAMPAIGN).toHaveLength(5);
    expect(FULL_CAMPAIGN.map((c) => c.numeral)).toEqual(['I', 'II', 'III', 'IV', 'V']);
    for (const c of FULL_CAMPAIGN) {
      expect(c.steps.filter((s) => s.kind === 'op').length, c.id).toBeGreaterThan(0);
      expect(c.steps.filter((s) => s.kind === 'story').length, c.id).toBeGreaterThan(0);
    }
  });

  it('walking the step model from a fresh save visits every step of every chapter and clears them in order', () => {
    const { visited, progress, cleared } = walkCampaign(FULL_CAMPAIGN);
    // The endings branch (NAR-0158): a fresh save, with no choices made, takes the exile.
    const all = FULL_CAMPAIGN.flatMap((c) => c.steps.map(stepId)).filter((id) => id !== 's5-end' && id !== 's5-end-pyre');
    expect(visited).toEqual(all);
    expect(cleared).toEqual([1, 2, 3, 4, 5]);
    expect(progress.chaptersCleared).toBe(5);
    expect(progress.masterUnlocked).toBe(true);
  });

  it('every step of every chapter is open on the default path (no branch strands a fresh player)', () => {
    const flags = new FlagStore();
    // Only the endings branch (NAR-0158); on the default path the exile is the ending that opens.
    const branch = new Set(['s5-end', 's5-end-pyre']);
    for (const c of FULL_CAMPAIGN)
      for (let i = 0; i < c.steps.length; i++) if (!branch.has(stepId(c.steps[i]))) expect(nextOpenStep(c, i, flags), `${c.id} step ${i}`).toBe(i);
  });

  it('step ids are unique across the campaign, and the chapter-numbered ones sit in the chapter they name', () => {
    const ids = FULL_CAMPAIGN.flatMap((c) => c.steps.map(stepId));
    expect(new Set(ids).size).toBe(ids.length);
    FULL_CAMPAIGN.forEach((c, ci) => {
      for (const s of c.steps) {
        const id = stepId(s);
        // Only the prologue is unnumbered.
        if (chapterOfId(id) === null) expect(id).toBe('prologue');
        else expect(chapterOfId(id), `${c.id} ${id}`).toBe(ci);
      }
    });
  });

  it('every chapter can be entered directly from its first step and reaches the next chapter', () => {
    FULL_CAMPAIGN.forEach((_, ci) => {
      const { visited, cleared } = walkCampaign(FULL_CAMPAIGN, { chapter: ci, step: 0 });
      expect(visited[0]).toBe(stepId(FULL_CAMPAIGN[ci].steps[0]));
      expect(cleared[0]).toBe(ci + 1);
    });
  });
});

describe('QAT-0155: unlock chain', () => {
  it('chapter clears are monotone: clearing chapter n never goes backwards and Master unlocks at II', () => {
    const p = freshProgress('full');
    expect(recordChapter(p, 1)).toBeGreaterThan(0);
    expect(p.masterUnlocked).toBe(false);
    expect(recordChapter(p, 1)).toBe(0);
    expect(recordChapter(p, 2)).toBeGreaterThan(0);
    expect(p.masterUnlocked).toBe(true);
    expect(recordChapter(p, 1)).toBe(0);
    expect(p.chaptersCleared).toBe(2);
  });

  it('the Litany rites unlock in ladder order across the five chapters, each reachable and none skipped', () => {
    const chapters = LITANY_ORDER.map((v) => LITANIES[v].unlockChapter);
    for (let i = 1; i < chapters.length; i++) expect(chapters[i], `${LITANY_ORDER[i]} after ${LITANY_ORDER[i - 1]}`).toBeGreaterThanOrEqual(chapters[i - 1]);
    expect(chapters[0]).toBeLessThanOrEqual(1);
    for (const c of chapters) expect(c).toBeLessThanOrEqual(FULL_CAMPAIGN.length);
    expect(unlockedLitanies(0)).toEqual(['stillness']);
    // Every rite is unlocked once the full campaign is cleared, and the set only grows.
    let prev = 0;
    for (let n = 1; n <= FULL_CAMPAIGN.length; n++) {
      const now = unlockedLitanies(n).length;
      expect(now).toBeGreaterThanOrEqual(prev);
      prev = now;
    }
    expect(unlockedLitanies(FULL_CAMPAIGN.length)).toEqual([...LITANY_ORDER]);
  });

  it('X-op ladder: unlock chapters are in ladder order and never precede the chapter that holds the Hour', () => {
    let prev = 0;
    for (const x of X_OPS) {
      expect(x.unlock.chapter, x.id).toBeGreaterThanOrEqual(prev);
      expect(x.unlock.chapter, x.id).toBeLessThanOrEqual(FULL_CAMPAIGN.length);
      prev = x.unlock.chapter;
      const boss = bossOpOfHour(x.hour);
      expect(boss, `${x.id}: no boss op for the hour ${x.hour}`).toBeDefined();
      // The Hour's fight has been met by the time the remix unlocks (X1 waits for the demo's end).
      expect(chapterOf(boss!) + 1, `${x.id} unlocks after chapter ${x.unlock.chapter} but ${boss} is in chapter ${chapterOf(boss!) + 1}`).toBeLessThanOrEqual(
        x.unlock.chapter,
      );
      if (x.unlock.bossOp) {
        expect(opIds.has(x.unlock.bossOp), `${x.id} rank gate on ${x.unlock.bossOp}`).toBe(true);
        expect(chapterOf(x.unlock.bossOp) + 1, x.id).toBeLessThanOrEqual(x.unlock.chapter);
      }
      if (x.base) expect(x.base.id, x.id).toBe(boss);
    }
  });

  it('every built X-op is reachable: clearing its chapter (and ranking its boss) unlocks it, and never earlier', () => {
    for (const x of X_OPS.filter((x) => x.base)) {
      const p = freshProgress('full');
      expect(xUnlocked(p, x), `${x.id} fresh`).toBe(false);
      recordChapter(p, x.unlock.chapter - 1);
      expect(xUnlocked(p, x), `${x.id} one chapter short`).toBe(false);
      recordChapter(p, x.unlock.chapter);
      if (x.unlock.rank && x.unlock.bossOp) {
        expect(xUnlocked(p, x), `${x.id} without the rank`).toBe(false);
        const below: Rank = x.unlock.rank === 'A' ? 'B' : 'C';
        p.best[x.unlock.bossOp] = { surgeon: { rank: below, score: 1, flags: [] } };
        expect(xUnlocked(p, x), `${x.id} below the rank`).toBe(false);
        p.best[x.unlock.bossOp] = { surgeon: { rank: x.unlock.rank, score: 1, flags: [] } };
      }
      expect(xUnlocked(p, x), `${x.id} unlocked`).toBe(true);
      const def = xOpDef(x);
      expect(def.id).toBe(`${x.base!.id}-${x.id}`);
      expect(def.phases.length).toBe(x.base!.phases.length);
    }
  });

  it('the unlock graph is acyclic: nothing unlocked by chapter n is needed to reach chapter n', () => {
    // Chapters unlock only by playing the previous chapter to its end; X-ops, rites and Master
    // difficulty hang off chapter clears and never gate a campaign step. Walking the campaign with
    // a fresh progress (no X-op, rite or difficulty unlocked) therefore reaches every chapter.
    const { progress } = walkCampaign(FULL_CAMPAIGN);
    expect(progress.chaptersCleared).toBe(FULL_CAMPAIGN.length);
    for (const x of X_OPS.filter((x) => x.base)) expect(xUnlocked(progress, x) || !!x.unlock.rank).toBe(true);
  });
});

describe('QAT-0155: challenge-mode entries', () => {
  it('every X-op with a base names an existing campaign operation; unbuilt hours name a boss op that exists in Chapters III–V', () => {
    for (const x of X_OPS) {
      if (x.base) expect(opIds.has(x.base.id), x.id).toBe(true);
      const boss = bossOpOfHour(x.hour)!;
      expect(opIds.has(boss), `${x.id} → ${boss}`).toBe(true);
    }
    // Every Malison hour of the ladder has exactly one X-op.
    expect(X_OPS.map((x) => x.hour)).toEqual(['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline']);
    expect(new Set(X_OPS.map((x) => x.id)).size).toBe(X_OPS.length);
  });

  it('every boss op in the codex map exists in the campaign, in the chapter its id says', () => {
    for (const id of Object.keys(BOSS_OPS)) {
      expect(opIds.has(id), id).toBe(true);
      expect(chapterOf(id), id).toBe(chapterOfId(id));
    }
  });

  it('the Symptom Loom builds a playable three-verse op from every module window, and custom challenges only name real ops', () => {
    for (let i = 0; i < LOOM_MODULES.length; i++) {
      const def = loomOp(i * 7919 + 1);
      expect(def.phases.length).toBe(3);
      expect(def.timeLimit).toBeGreaterThan(0);
      expect(def.tools.length).toBeGreaterThan(0);
    }
    for (const opId of opIds) {
      const code = encodeChallenge({ opId, mods: { drain: 1, time: 1, hp: 1, tellSpeed: 1, addCadence: 1 }, mutators: [] });
      expect(decodeChallenge(code)?.opId).toBe(opId);
    }
  });
});

describe('QAT-0155: demo carry-over lands on Chapter III', () => {
  const liveSteps = () => FULL_CAMPAIGN.map((c) => c.steps.map(stepId));

  it('the frozen demo content-id table matches Chapters I–II of the full campaign', () => {
    expect(CONTENT_ID_TABLES[CURRENT_CONTENT_IDS].steps).toEqual(liveSteps().slice(0, 2));
  });

  it('a completed demo profile imports to the first step of Chapter III, which is open and playable', () => {
    const demo = readProfile(readFileSync('tests/fixtures/saves/v2-demo-0.9.0-complete.json', 'utf8'), 'demo', 'full-test')!.profile;
    const { profile, report } = importDemoProfile(demo, indexCampaign(liveSteps()), 'full-test');
    expect(report.demoCompleted).toBe(true);
    expect(profile.progress).toEqual({ chapter: 2, step: 0 });
    expect(FULL_CAMPAIGN[2]).toBe(CHAPTER_3);
    expect(nextOpenStep(CHAPTER_3, 0, new FlagStore())).toBe(0);
    // And from there the rest of the campaign is reachable.
    const { cleared } = walkCampaign(FULL_CAMPAIGN, profile.progress);
    expect(cleared).toEqual([3, 4, 5]);
  });

  it('a mid-demo profile resumes inside Chapter II, never in a later chapter', () => {
    const demo = readProfile(readFileSync('tests/fixtures/saves/v2-demo-0.9.0-mid-ch2.json', 'utf8'), 'demo', 'full-test')!.profile;
    const { profile, report } = importDemoProfile(demo, indexCampaign(liveSteps()), 'full-test');
    expect(report.demoCompleted).toBe(false);
    expect(profile.progress.chapter).toBe(1);
    expect(profile.progress.step).toBeLessThan(FULL_CAMPAIGN[1].steps.length);
  });
});
