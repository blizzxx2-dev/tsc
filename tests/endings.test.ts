import { describe, expect, it } from 'vitest';
import { CHAPTER_5 } from '../src/content/chapter5';
import { ENDING_STORIES, endingFor, ENDINGS, strohTrust, type EndingInputs } from '../src/content/endings';
import { applyOpFlags, evalCondition, FlagStore } from '../src/content/flags';
import { WHISPER_BANDS } from '../src/content/whisper';

const reader = (vals: Record<string, unknown>) => ({ get: (k: string) => vals[k] }) as never;

describe('Stroh’s trust (NAR-0104)', () => {
  it('moves by the documented deltas', () => {
    expect(strohTrust(reader({}))).toBe(0);
    expect(strohTrust(reader({ cantorMercy: false, hornchildCertificate: 'turned', strohTooth: true, strohToothFine: true }))).toBe(4);
    expect(strohTrust(reader({ hornchildCertificate: 'natural' }))).toBe(-2);
    expect(strohTrust(reader({ strohTooth: true, litanySeenCount: 5 }))).toBe(-1);
  });

  it('the tooth and Sext write the flags the finale reads', () => {
    const f = new FlagStore();
    applyOpFlags('op3-9', 'S', f);
    expect([f.get('strohTooth'), f.get('strohToothFine')]).toEqual([true, true]);
    applyOpFlags('op3-9', 'A', f);
    expect(f.get('strohToothFine')).toBe(false);
    applyOpFlags('op4-7', 'B', f);
    expect(f.get('mauerFate')).toBe('hale');
    applyOpFlags('op4-7', 'C', f);
    expect(f.get('mauerFate')).toBe('maimed');
  });
});

describe('ending matrix (NAR-0158)', () => {
  it('every combination of inputs maps to an ending, and every won ending is reachable', () => {
    const seen = new Set<string>();
    for (let trust = -4; trust <= 4; trust++)
      for (const whisper of WHISPER_BANDS)
        for (const certificate of ['natural', 'turned', undefined] as const)
          for (const mauerFate of ['hale', 'maimed', undefined] as const)
            for (const hallerFate of ['hands', 'scarred', 'lost', undefined] as const) {
              const i: EndingInputs = { trust, whisper, certificate, mauerFate, hallerFate };
              const e = endingFor(i);
              expect(['pardon', 'pyre', 'exile']).toContain(e);
              seen.add(e);
            }
    expect([...seen].sort()).toEqual(['exile', 'pardon', 'pyre']);
  });

  it('exactly one ending scene closes Chapter V for any flags', () => {
    const endSteps = CHAPTER_5.steps.filter((s) => s.kind === 'story' && Object.values(ENDING_STORIES).includes(s.story));
    expect(endSteps).toHaveLength(3);
    for (const vals of [
      {},
      { hornchildCertificate: 'natural', litanySeenCount: 6 },
      { cantorMercy: false, hornchildCertificate: 'turned', strohTooth: true },
      { litanySeenCount: 2, mauerFate: 'hale' },
    ]) {
      const f = new FlagStore();
      for (const [k, v] of Object.entries(vals)) f.set(k, v as never);
      expect(
        endSteps.filter((s) => !s.if || evalCondition(s.if, f)),
        JSON.stringify(vals),
      ).toHaveLength(1);
    }
  });
});

describe('endings (NAR-0157)', () => {
  it('four endings of 20–40 lines (the Perfect End at least 18, before its retry prompt)', () => {
    expect(ENDINGS).toHaveLength(4);
    for (const e of ENDINGS) {
      const n = ENDING_STORIES[e].lines.length;
      expect(n, e).toBeGreaterThanOrEqual(e === 'perfect' ? 18 : 20);
      expect(n, e).toBeLessThanOrEqual(40);
    }
  });
});

describe('epilogue cards (NAR-0159)', () => {
  it('twelve people, three variants each, none over fifty words; exactly one card each after any ending', async () => {
    const { EPILOGUE, EPILOGUE_STORY, epilogueFor } = await import('../src/content/epilogue');
    expect(Object.keys(EPILOGUE)).toHaveLength(12);
    for (const [id, c] of Object.entries(EPILOGUE))
      for (const v of ['survives', 'dies', 'absent'] as const) expect(c[v].split(/\s+/).length, `${id} ${v}`).toBeLessThanOrEqual(50);
    for (const vals of [
      {},
      { hornchildCertificate: 'turned', cantorMercy: false, strohTooth: true, mauerFate: 'hale', hallerFate: 'lost' },
      { litanySeenCount: 6 },
    ]) {
      const f = new FlagStore();
      for (const [k, v] of Object.entries(vals)) f.set(k, v as never);
      const shown = EPILOGUE_STORY.lines.filter((l) => !l.if || evalCondition(l.if, f));
      expect(shown, JSON.stringify(vals)).toHaveLength(12);
    }
    expect(epilogueFor('exile', reader({})).find((c) => c.id === 'ilse')?.fate).toBe('absent');
    expect(epilogueFor('pardon', reader({ hallerFate: 'lost' })).find((c) => c.id === 'haller')?.fate).toBe('dies');
  });
});

describe('Kreuzer’s journal (NAR-0094)', () => {
  it('one page per ending in his voice; exactly one won page shows, and the Perfect End carries its own', async () => {
    const { JOURNAL, JOURNAL_STORY } = await import('../src/content/journal');
    for (const e of ENDINGS) expect(JOURNAL[e].length, e).toBeGreaterThanOrEqual(4);
    for (const vals of [{}, { cantorMercy: false, hornchildCertificate: 'turned', strohTooth: true }, { litanySeenCount: 2, mauerFate: 'hale' }]) {
      const f = new FlagStore();
      for (const [k, v] of Object.entries(vals)) f.set(k, v as never);
      const shown = JOURNAL_STORY.lines.filter((l) => !l.if || evalCondition(l.if, f));
      expect(shown.every((l) => l.who === 'kreuzer')).toBe(true);
      expect(Object.values(JOURNAL).filter((p) => p[0] === shown[0].text)).toHaveLength(1);
    }
    for (const l of JOURNAL.perfect) expect(ENDING_STORIES.perfect.lines.some((x) => x.text === l)).toBe(true);
  });
});
