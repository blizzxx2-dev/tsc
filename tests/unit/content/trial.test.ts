/** NAR-0147/0148: the trial reads the campaign, and the verdict routes stay consistent with the endings. */
import { describe, expect, it } from 'vitest';
import { STORY_5_2, STORY_5_3 } from '../../../src/content/chapter5';
import { lineShown } from '../../../src/content/conditions';
import { endingFor, endingInputs, strohTrust, trialEvidence, trialVerdict, ENDING_PARDON } from '../../../src/content/endings';
import { FlagStore } from '../../../src/content/flags';
import type { FlagValue } from '../../../src/core/save/schema';
import type { StoryDef } from '../../../src/content/story';

const store = (v: Record<string, FlagValue>) => {
  const f = new FlagStore();
  f.setAll(v);
  return f;
};
const shown = (st: StoryDef, f: FlagStore) => st.lines.filter((l) => lineShown(l, {}, f)).map((l) => l.text);

const ALLY = { cantorMercy: false, strohTooth: true, strohToothFine: true, hornchildCertificate: 'turned', trialAnswer: 'confess' } as const;

describe('the trial (NAR-0147)', () => {
  it('enters the evidence the campaign produced, and only that', () => {
    const lie = shown(STORY_5_2, store({ hornchildCertificate: 'natural', litanySeenCount: 4 })).join(' ');
    expect(lie).toContain('“A natural growth.”');
    expect(lie).toContain('three times and more');
    expect(lie).not.toContain('true in every word');
    const clean = shown(STORY_5_2, store({ hornchildCertificate: 'turned', litanySeenCount: 0 })).join(' ');
    expect(clean).toContain('true in every word');
    expect(clean).toContain('rumour');
  });

  it('calls the witnesses the campaign left standing', () => {
    const hale = shown(STORY_5_2, store({ mauerFate: 'hale', hallerFate: 'hands' })).join(' ');
    expect(hale).toContain('I witnessed the candles');
    expect(hale).toContain('These hands are proof');
    const hurt = shown(STORY_5_2, store({ mauerFate: 'maimed', hallerFate: 'lost' })).join(' ');
    expect(hurt).toContain('bedside');
    expect(hurt).toContain('the night before');
    expect(hurt).not.toContain('These hands are proof');
  });

  it('Stroh defends, objects or prosecutes by trust, and confessing earns his trust', () => {
    expect(strohTrust(store({ trialAnswer: 'confess' })) - strohTrust(store({ trialAnswer: 'deny' }))).toBe(1);
    expect(shown(STORY_5_2, store(ALLY)).join(' ')).toContain('for the defence');
    expect(shown(STORY_5_2, store({ litanySeenCount: 4 })).join(' ')).toContain('I enter my ledger');
  });

  it('a denial nobody can contradict weakens the case; one the witnesses contradict is perjury', () => {
    // Stroh's stance held fixed (an ally either way), so only the answer moves the tally.
    const ev = (trialAnswer: string, litanySeenCount: number) => trialEvidence(store({ ...ALLY, trialAnswer, litanySeenCount }));
    expect(ev('deny', 0)).toBe(ev('confess', 0) - 1);
    expect(ev('deny', 1)).toBe(ev('confess', 1) + 1);
  });
});

describe('the verdict (NAR-0148)', () => {
  it('each route shows its own way out, and exactly one', () => {
    const acquitted = store(ALLY);
    const rescued = store({ mauerFate: 'hale', litanySeenCount: 3 });
    const tunnelled = store({ mauerFate: 'maimed', litanySeenCount: 3 });
    expect([trialVerdict(acquitted), trialVerdict(rescued), trialVerdict(tunnelled)]).toEqual(['acquitted', 'rescued', 'tunnelled']);
    const a = shown(STORY_5_3, acquitted).join(' ');
    expect(a).toContain('not proven');
    expect(a).not.toContain('guilty');
    const r = shown(STORY_5_3, rescued).join(' ');
    expect(r).toContain('guardroom door');
    expect(r).toContain('a minute late');
    const t = shown(STORY_5_3, tunnelled).join(' ');
    expect(t).toContain('Kreuzer Tunnel');
    expect(t).not.toContain('guardroom door');
  });

  it('an acquittal always leads to the pardon, which then never mentions the sentence', () => {
    const vals = {
      cantorMercy: [true, false],
      hornchildCertificate: ['natural', 'turned'],
      strohTooth: [true, false],
      strohToothFine: [true, false],
      deadManVerdict: ['entranced', 'dead'],
      trialAnswer: ['confess', 'deny'],
      mauerFate: ['hale', 'maimed'],
      hallerFate: ['hands', 'scarred', 'lost'],
      litanySeenCount: [0, 1, 2, 4],
    } as Record<string, FlagValue[]>;
    const keys = Object.keys(vals);
    let acquittals = 0;
    const walk = (i: number, acc: Record<string, FlagValue>) => {
      if (i === keys.length) {
        const f = store(acc);
        if (trialVerdict(f) !== 'acquitted') return;
        acquittals++;
        expect(endingFor(endingInputs(f))).toBe('pardon');
        const p = shown(ENDING_PARDON, f).join(' ');
        expect(p).not.toContain('I was to burn');
        expect(p).toContain('writ');
        return;
      }
      for (const v of vals[keys[i]]) walk(i + 1, { ...acc, [keys[i]]: v });
    };
    walk(0, {});
    expect(acquittals).toBeGreaterThan(0);
  });
});
