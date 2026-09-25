import { describe, expect, it } from 'vitest';
import { STORY_3_1 } from '../src/content/chapter3';
import { STORY_4_1 } from '../src/content/chapter4';
import { STORY_5_1 } from '../src/content/chapter5';
import { evalCondition } from '../src/content/flags';
import { WHISPER_BANDS, WHISPER_LINES, whisperBand, whisperScore } from '../src/content/whisper';

const reader = (vals: Record<string, unknown>) => ({ get: (k: string) => vals[k], has: (k: string) => k in vals, truthy: (k: string) => !!vals[k] }) as never;

describe('Whisper bands (NAR-0093)', () => {
  it('four bands from the star seen and the kind lie', () => {
    expect(whisperBand(whisperScore(reader({})))).toBe('unremarked');
    expect(whisperBand(whisperScore(reader({ litanySeenCount: 2 })))).toBe('noted');
    expect(whisperBand(whisperScore(reader({ litanySeenCount: 1, hornchildCertificate: 'natural' })))).toBe('suspected');
    expect(whisperBand(whisperScore(reader({ litanySeenCount: 3, hornchildCertificate: 'natural' })))).toBe('accused');
    expect(whisperBand(whisperScore(reader({ litanySeenCount: 2, hornchildCertificate: 'turned' })))).toBe('noted');
  });

  it('each band has three unique Kreuzer lines, and exactly one shows at each chapter opening', () => {
    const all = WHISPER_BANDS.flatMap((b) => WHISPER_LINES[b]);
    expect(new Set(all).size).toBe(12);
    for (const [i, story] of [STORY_3_1, STORY_4_1, STORY_5_1].entries()) {
      for (const [vals, band] of [
        [{}, 'unremarked'],
        [{ litanySeenCount: 5 }, 'accused'],
      ] as const) {
        const shown = story.lines.filter((l) => l.who === 'kreuzer' && all.includes(l.text) && (!l.if || evalCondition(l.if, reader(vals))));
        expect(shown.map((l) => l.text)).toEqual([WHISPER_LINES[band][i]]);
      }
    }
  });
});
