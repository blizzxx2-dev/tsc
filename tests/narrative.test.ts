import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FULL_CAMPAIGN } from '../src/content/campaign';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import { AFTERMATH, FAILURE } from '../src/content/aftermath';
import { LATER_AFTERMATH } from '../src/content/aftermath-later';
import { conditionOf, lineShown, rankBand, resolveStory, type StoryContext } from '../src/content/conditions';
import type { StoryDef } from '../src/content/story';
import { lint, literals, SCRIPT_FILES, STRING_TABLES } from '../scripts/narrative-lint.mjs';
import { resolvePrompt, TUTORIALS } from '../src/content/tutorials';
import { TOOL_INFO } from '../src/surgery/types';
import { dragGlyphFor, glyphFor } from '../src/input/glyphs';
import type { ActionId } from '../src/input/actions';

const storiesOf = (steps: readonly { kind: string; story?: StoryDef }[]) => steps.flatMap((s) => (s.kind === 'story' && s.story ? [s.story] : []));
const campaignStories = FULL_CAMPAIGN.flatMap((c) => storiesOf(c.steps));
const extraStories = [...Object.values(AFTERMATH), ...Object.values(FAILURE), ...Object.values(LATER_AFTERMATH)];
const allStories = [...campaignStories, ...extraStories];
const en = JSON.parse(readFileSync('src/i18n/strings/en.json', 'utf8')) as Record<string, string>;

/** Every way a scene can resolve: Litany spoken or not × each rank band. */
const CONTEXTS: StoryContext[] = [true, false].flatMap((litanyUsed) => (['XS', 'A', 'C'] as const).map((rank) => ({ litanyUsed, rank })));

describe('narrative style rules', () => {
  it('NAR-0004: VN lines ≤ 140 chars, callout labels ≤ 28 chars', () => {
    for (const s of allStories) {
      expect(s.place.length, s.place).toBeLessThanOrEqual(140);
      for (const l of s.lines) expect(l.text.length, `${s.id}: ${l.text}`).toBeLessThanOrEqual(140);
    }
    for (const [k, v] of Object.entries(en)) if (/^(label|popup)\./.test(k) && !v.includes('{')) expect(v.length, k).toBeLessThanOrEqual(28);
  });

  it('NAR-0036: demo scene budgets — chapter openers and ends ≤ 14 lines, mid-chapter scenes ≤ 10, in every variant', () => {
    for (const ch of [CHAPTER_1, CHAPTER_2]) {
      const stories = storiesOf(ch.steps);
      stories.forEach((s, i) => {
        const budget = i === 0 || i === stories.length - 1 ? 14 : 10;
        for (const ctx of CONTEXTS) expect(resolveStory(s, ctx).lines.length, `${s.id} ${JSON.stringify(ctx)}`).toBeLessThanOrEqual(budget);
      });
    }
  });

  it('NAR-0038/0056: aftermath scenes after op1-1…op1-4 and op2-1…op2-4 are 2–4 lines in every variant; failures 1–2', () => {
    for (const id of ['op1-1', 'op1-2', 'op1-3', 'op1-4', 'op2-1', 'op2-2', 'op2-3', 'op2-4', ...Object.keys(LATER_AFTERMATH)]) {
      const a = AFTERMATH[id] ?? LATER_AFTERMATH[id];
      expect(a, id).toBeDefined();
      for (const ctx of CONTEXTS) {
        const n = resolveStory(a, ctx).lines.length;
        expect(n, `${id} ${JSON.stringify(ctx)}`).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
    for (const c of [CHAPTER_1, CHAPTER_2]) for (const s of c.steps) if (s.kind === 'op') expect(FAILURE[s.op.id]?.lines.length, s.op.id).toBeGreaterThanOrEqual(1);
    for (const f of Object.values(FAILURE)) expect(f.lines.length).toBeLessThanOrEqual(2);
  });

  it('NAR-0003: no banned modern words or mock-archaic pronouns; NAR-0015/0021: no avoid-list or Trauma Center names', () => {
    expect(lint()).toEqual([]);
  });

  it('NAR-0013: no "warp" coinage anywhere in the script or string tables', () => {
    for (const f of SCRIPT_FILES()) for (const l of literals(f)) expect(l.text, f).not.toMatch(/warp/i);
    for (const f of STRING_TABLES()) expect(readFileSync(f, 'utf8'), f).not.toMatch(/warp/i);
  });

  it('NAR-0012: hexstone is black and pulsing, never green', () => {
    const text = allStories.flatMap((s) => s.lines.map((l) => l.text)).join('\n');
    expect(text).toContain('Black as a wet eye, and it had a pulse');
    expect(text).not.toMatch(/\bgreen\b/i);
  });

  it('NAR-0011: the witch-hunters are the Ash Tribunal everywhere', () => {
    const text = allStories.flatMap((s) => s.lines.map((l) => l.text)).join('\n');
    expect(text).toContain('The Tribunal does not distinguish between a prayer and a spell.');
    expect(text).not.toMatch(/order of the pyre/i);
  });
});

describe('narrative conditions', () => {
  it('rank bands: XS/S high, A/B mid, C low', () => {
    expect(['XS', 'S', 'A', 'B', 'C'].map((r) => rankBand(r as never))).toEqual(['high', 'high', 'mid', 'mid', 'low']);
  });

  it('NAR-0047: s1-end shows the "time obliging you" beat only after a Litany in op1-5, the alternate otherwise', () => {
    const end = storiesOf(CHAPTER_1.steps).find((s) => s.id === 's1-end')!;
    const said = (ctx: StoryContext) => resolveStory(end, ctx).lines.map((l) => l.text).join(' ');
    expect(said({ litanyUsed: true })).toMatch(/time itself were… obliging you/);
    expect(said({ litanyUsed: true })).not.toMatch(/almost disappointing/);
    expect(said({ litanyUsed: false })).not.toMatch(/obliging you/);
    expect(said({ litanyUsed: false })).toMatch(/almost disappointing/);
    // Resumed from a save (outcome unknown): the canonical Litany variant.
    expect(said({})).toMatch(/obliging you/);
  });

  it('NAR-0065: s2-end candle beat after a Litany in op2-5; "shook, for once" otherwise; both end on "After Prime"', () => {
    const end = storiesOf(CHAPTER_2.steps).find((s) => s.id === 's2-end')!;
    const said = (ctx: StoryContext) => resolveStory(end, ctx).lines.map((l) => l.text).join(' ');
    expect(said({ litanyUsed: true })).toMatch(/eight heartbeats/);
    expect(said({ litanyUsed: false })).toMatch(/They shook, Doctor\. For once\./);
    expect(said({ litanyUsed: false })).not.toMatch(/eight heartbeats/);
    for (const litanyUsed of [true, false]) expect(resolveStory(end, { litanyUsed }).lines.at(-2)!.text).toMatch(/After Prime\.$/);
  });

  it('NAR-0039: Haller’s comment after op1-1 varies between XS/S, A/B and C', () => {
    const a = AFTERMATH['op1-1'];
    const haller = (rank: 'XS' | 'S' | 'A' | 'C') => resolveStory(a, { rank }).lines.filter((l) => l.who === 'haller').map((l) => l.text);
    expect(haller('XS')).toEqual(haller('S'));
    expect(haller('XS')[0]).toMatch(/simple work/);
    expect(haller('C')[0]).toMatch(/simple work/);
    expect(new Set([haller('XS')[0], haller('A')[0], haller('C')[0]]).size).toBe(3);
  });

  it('every conditional line is reachable by some context', () => {
    for (const s of allStories) for (const l of s.lines) if (conditionOf(l)) expect(CONTEXTS.some((c) => lineShown(l, c)), `${s.id}: ${l.text}`).toBe(true);
  });
});

describe('tutorial prompts (NAR-0051, NAR-0052)', () => {
  it('every instrument and the Litany has a prompt, first taught in a demo op', () => {
    for (const t of [...TOOL_INFO.map((x) => x.id), 'litany']) expect(TUTORIALS.some((u) => u.id === t), t).toBe(true);
    for (const u of TUTORIALS) expect(u.firstOp).toMatch(/^op[12]-[1-5]$/);
  });

  it('prompts are control-agnostic: tokens resolve on keyboard and pad, no hard-coded keys or mouse words', () => {
    for (const u of TUTORIALS) {
      expect(u.prompt, u.id).not.toMatch(/\b(click|right[- ]mouse|left[- ]mouse|mouse|key [0-9]|press [0-9]|wheel)\b/i);
      expect(u.prompt.length, u.id).toBeLessThanOrEqual(110);
      for (const device of ['kbm', 'pad'] as const) {
        const out = resolvePrompt(
          u.prompt,
          (a) => glyphFor(a, device),
          (a) => dragGlyphFor(a, device),
          (s) => glyphFor(`tool.select.${s}` as ActionId, device),
        );
        expect(out, `${u.id} ${device}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('story lines keep flavour: Ch1 scenes no longer carry step-by-step tool instructions', () => {
    const text = storiesOf(CHAPTER_1.steps).flatMap((s) => s.lines.map((l) => l.text)).join('\n');
    expect(text).not.toMatch(/Stitch him, drain him, salve him|hold it to the flesh and let it take|Hold it on them until they stop wriggling|twice — to free the barbs/);
  });
});
