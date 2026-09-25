import { describe, expect, it } from 'vitest';
import { allCampaignOperations, FULL_CAMPAIGN } from '../src/content/campaign';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import {
  CODEX,
  CODEX_CATEGORIES,
  codexUnlocked,
  KNOWN_STORY_FLAGS,
  unlocked,
  unlockRefs,
  wordCount,
  type CodexProgress,
  type CodexUnlock,
} from '../src/content/codex';
import type { Rank } from '../src/surgery/types';

const opIds = new Set(allCampaignOperations().map((d) => d.id));
const storyIds = new Set(FULL_CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'story' ? [s.story.id] : []))));
const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op.id] : []));
const unlocks = (): { where: string; u: CodexUnlock }[] =>
  CODEX.flatMap((e) => [{ where: e.id, u: e.unlock }, ...(e.more ? [{ where: `${e.id}.more`, u: e.more.unlock }] : [])]);

/** Play the demo campaign in order at the given rank and return progress after each step. */
function walk(rank: Rank): CodexProgress[] {
  const p: { won: Record<string, Rank>; stories: string[]; chapters: number[]; flags: string[] } = { won: {}, stories: [], chapters: [], flags: [] };
  const out: CodexProgress[] = [];
  [CHAPTER_1, CHAPTER_2].forEach((ch, i) => {
    for (const s of ch.steps) {
      if (s.kind === 'story') p.stories.push(s.story.id);
      else p.won[s.op.id] = rank;
      out.push(structuredClone(p));
    }
    p.chapters.push(i + 1);
    out.push(structuredClone(p));
  });
  return out;
}

describe('codex schema (NAR-0079)', () => {
  it('ids, titles and woodcut ids are unique; every category is one of the six', () => {
    const ids = CODEX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const images = CODEX.map((e) => e.image);
    expect(new Set(images).size).toBe(images.length);
    for (const e of CODEX) {
      expect(CODEX_CATEGORIES, e.id).toContain(e.category);
      expect(e.title.length, e.id).toBeGreaterThan(0);
      expect(e.image, e.id).toMatch(/^wc-[a-z-]+$/);
    }
  });

  it('bodies are ≤ 180 words, second paragraphs too', () => {
    for (const e of CODEX) {
      expect(wordCount(e.body), e.id).toBeLessThanOrEqual(180);
      if (e.more) expect(wordCount(e.more.body), `${e.id}.more`).toBeLessThanOrEqual(180);
      if (e.remedy) expect(wordCount(e.remedy), `${e.id}.remedy`).toBeLessThanOrEqual(60);
    }
  });

  it('no exotic glyphs (the body font has no arrow or star)', () => {
    for (const e of CODEX) expect(`${e.body}${e.more?.body ?? ''}${e.remedy ?? ''}`, e.id).not.toMatch(/[→★]/);
  });
});

describe('codex content (NAR-0080…0085, NAR-0016, NAR-0048)', () => {
  const byCat = (c: string) => CODEX.filter((e) => e.category === c && !e.silhouette);

  it('NAR-0080: the six people of Chapters I–II, each with a second paragraph unlocked by an S rank or a chapter', () => {
    const people = byCat('People').map((e) => e.id);
    for (const id of ['kreuzer', 'ilse', 'haller', 'stroh', 'mauer', 'orsa']) {
      expect(people).toContain(id);
      const e = CODEX.find((x) => x.id === id)!;
      expect(e.more, id).toBeDefined();
      const u = e.more!.unlock;
      expect(u.kind === 'chapter' || (u.kind === 'op' && u.rank === 'S'), `${id}.more`).toBe(true);
    }
  });

  it('NAR-0081: the eight instruments and the Litany', () => {
    expect(
      byCat('Instruments')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['brand', 'lancet', 'leech', 'lens', 'litany', 'salve', 'thread', 'tincture', 'tongs']);
  });

  it('NAR-0082: ten afflictions of Chapters I–II', () => {
    expect(byCat('Afflictions')).toHaveLength(10);
    expect(CODEX.find((e) => e.id === 'hexstone')!.body).toMatch(/never green/);
  });

  it('NAR-0083: seven places and orders', () => {
    expect(byCat('Places').length + byCat('Orders').length).toBe(9); // 7 + the carriage (NAR-0048) + the Choir
    expect(
      byCat('Orders')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['ash-tribunal', 'hollow-choir', 'merciful-order', 'watch']);
  });

  it('NAR-0084: Matins and Lauds in full, six locked silhouettes titled with the hour names only', () => {
    const hours = CODEX.filter((e) => e.category === 'The Hours');
    expect(
      hours
        .filter((e) => !e.silhouette)
        .map((e) => e.id)
        .sort(),
    ).toEqual(['hours', 'lauds', 'matins']);
    const locked = hours.filter((e) => e.silhouette);
    expect(locked.map((e) => e.title)).toEqual(['Prime', 'Terce', 'Sext', 'None', 'Vespers', 'Compline']);
    for (const e of locked) expect(wordCount(e.body)).toBeLessThan(12);
  });

  it('NAR-0085: five folk-remedy sidebars on affliction entries', () => {
    const remedies = CODEX.filter((e) => e.remedy);
    expect(remedies).toHaveLength(5);
    for (const e of remedies) expect(e.category).toBe('Afflictions');
    expect(remedies.map((e) => e.remedy!).join(' ')).toMatch(/flagpole/);
    expect(remedies.map((e) => e.remedy!).join(' ')).toMatch(/penitent’s whip/);
  });

  it('NAR-0016: the horned folk entry carries the antler-tallies and never the old words', () => {
    const e = CODEX.find((x) => x.id === 'horned-folk')!;
    expect(e.body).toMatch(/antler-tallies/);
    expect(`${e.body} ${e.more?.body}`).not.toMatch(/beast-?men|gor\b|herdstone/i);
  });

  it('NAR-0048: “The Carriage Without a Crest” unlocks from the scene that plants it', () => {
    const e = CODEX.find((x) => x.id === 'carriage')!;
    expect(e.title).toBe('The Carriage Without a Crest');
    expect(e.unlock).toEqual({ kind: 'story', story: 's1-5' });
    expect(e.body).toMatch(/planed/);
  });
});

describe('codex unlock audit (NAR-0086)', () => {
  it('every unlock references a real operation, story scene, chapter or known flag', () => {
    for (const { where, u } of unlocks()) {
      const r = unlockRefs(u);
      for (const id of r.ops) expect(opIds.has(id), `${where}: op ${id}`).toBe(true);
      for (const id of r.stories) expect(storyIds.has(id), `${where}: story ${id}`).toBe(true);
      for (const n of r.chapters) expect(n >= 1 && n <= FULL_CAMPAIGN.length, `${where}: chapter ${n}`).toBe(true);
      for (const f of r.flags) expect(KNOWN_STORY_FLAGS, `${where}: flag ${f}`).toContain(f);
    }
  });

  it('every demo operation unlocks at least one entry or paragraph', () => {
    for (const id of demoOps)
      expect(
        unlocks().some(({ u }) => u.kind === 'op' && u.op === id),
        id,
      ).toBe(true);
  });

  it('a normal demo playthrough (A ranks) reaches every non-silhouette entry; S ranks reach every second paragraph', () => {
    const steps = walk('A');
    const end = steps[steps.length - 1];
    for (const e of CODEX) if (!e.silhouette) expect(unlocked(e.unlock, end), e.id).toBe(true);
    const endS = walk('S').slice(-1)[0];
    for (const e of CODEX) if (e.more) expect(unlocked(e.more.unlock, endS), `${e.id}.more`).toBe(true);
    // Silhouettes stay locked through the demo.
    for (const e of CODEX) if (e.silhouette) expect(unlocked(e.unlock, endS), e.id).toBe(false);
  });

  it('entries unlock in campaign order and never re-lock', () => {
    let prev = 0;
    for (const p of walk('S')) {
      const n = codexUnlocked(p).length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(codexUnlocked({ won: {}, stories: [], chapters: [], flags: [] }).map((e) => e.id)).toContain('kreuzer');
  });
});
