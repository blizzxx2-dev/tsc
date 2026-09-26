import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../src/content/campaign';
import { CONTENT_ID_TABLES, CURRENT_CONTENT_IDS, importDemoProfile, indexCampaign, readDemoProfile, IMPORT_DIALOG } from '../src/platform/carryover';
import { readProfile } from '../src/core/save/codec';
import { gatingViolations } from '../src/platform/gating';
import { EDITIONS } from '../src/platform/editions';
import { stepId } from '../src/content/campaign';

const fx = (n: string) => readFileSync(`tests/fixtures/saves/${n}`, 'utf8');
const liveSteps = () => CAMPAIGN.map((c) => c.steps.map(stepId));
const BUILD = 'full-test';

describe('demo → full carry-over contract', () => {
  it('content-id table v1 is frozen to the demo campaign it shipped with', () => {
    const t = CONTENT_ID_TABLES[1];
    expect(t.steps).toEqual(liveSteps().slice(0, 2));
    // Stable ids are unique and namespaced.
    const ids = Object.values(t.stable);
    expect(new Set(ids).size).toBe(ids.length);
    expect(t.stable['op1-3']).toBe('ch1.op3');
    expect(t.stable['op2-5']).toBe('ch2.op5');
    expect(t.stable['s2-end']).toBe('ch2.s6');
    expect(CURRENT_CONTENT_IDS).toBe(1);
  });

  it('imports a mid-Chapter-II demo save: ranks keep, position maps by step id', () => {
    const demo = readProfile(fx('v2-demo-0.9.0-mid-ch2.json'), 'demo', BUILD)!.profile;
    const { profile, report } = importDemoProfile(demo, indexCampaign(liveSteps()), BUILD, '2026-10-01T00:00:00.000Z');
    expect(profile.edition).toBe('full');
    expect(profile.best['op2-2']).toEqual({ rank: 'XS', score: 9900 });
    expect(Object.keys(profile.best)).toHaveLength(7);
    expect(report.dropped).toEqual([]);
    expect(profile.progress).toEqual({ chapter: 1, step: 4 });
    expect(profile.playtime).toBe(5400.5);
    expect(profile.importedFrom).toEqual({ edition: 'demo', build: '0.9.0+48d12fc3.20260925', at: '2026-10-01T00:00:00.000Z' });
  });

  it('a finished demo starts the full game at Chapter III', () => {
    const demo = readProfile(fx('v2-demo-0.9.0-complete.json'), 'demo', BUILD)!.profile;
    const { profile, report } = importDemoProfile(demo, indexCampaign(liveSteps()), BUILD);
    expect(report.demoCompleted).toBe(true);
    expect(profile.progress).toEqual({ chapter: 2, step: 0 });
    expect(Object.keys(profile.best)).toHaveLength(10);
    expect(profile.unlocks).toEqual(['extras.gallery']);
  });

  it('maps through stable ids when the full game renames or reorders operations', () => {
    const demo = readProfile(fx('v2-demo-0.9.0-mid-ch2.json'), 'demo', BUILD)!.profile;
    // Hypothetical full build: a new story beat inserted at the start of Chapter II.
    const steps = liveSteps();
    const full = [steps[0], ['s2-0-new', ...steps[1]], ['s3-1', 'op3-1']];
    const { profile } = importDemoProfile(demo, indexCampaign(full), BUILD);
    expect(profile.progress).toEqual({ chapter: 1, step: 5 });
    // Unknown ids (e.g. from a hand-edited save) are dropped, not fatal.
    demo.best['op9-9'] = { rank: 'S', score: 1 };
    expect(importDemoProfile(demo, indexCampaign(full), BUILD).report.dropped).toEqual(['op9-9']);
  });

  it('reads the demo folder snapshot, preferring the backup when the main file is damaged', () => {
    expect(readDemoProfile(null, BUILD)).toBeNull();
    expect(readDemoProfile({ 'profile.json': fx('v2-demo-0.9.0-complete.json') }, BUILD)?.progress).toEqual({ chapter: 2, step: 0 });
    expect(readDemoProfile({ 'profile.json': 'x', 'profile.json.bak': fx('v2-demo-0.9.0-mid-ch2.json') }, BUILD)?.progress).toEqual({ chapter: 1, step: 4 });
  });

  it('the import dialog states the same-machine limitation', () => {
    expect(IMPORT_DIALOG.detail).toMatch(/only be imported on the computer where the demo was played/);
  });

  it('demo fixture saves reference only demo content', () => {
    for (const f of ['v2-demo-0.9.0-mid-ch2.json', 'v2-demo-0.9.0-complete.json', 'v1-suture-and-steel.json']) {
      const p = readProfile(fx(f), 'demo', BUILD)!.profile;
      expect(gatingViolations(p, EDITIONS.demo), f).toEqual([]);
    }
  });
});
