import { describe, expect, it } from 'vitest';
import { TRIAGE, TriageField, type TriageScenario, type TriageTag } from '../../../src/surgery/triage';
import { TRIAGE_SCENARIOS } from '../../../src/content/triage';
import { FULL_CAMPAIGN } from '../../../src/content/campaign';
import { Rng } from '../../../src/core/math';

const DT = 1 / 30;

/**
 * An average field surgeon: reads a tag right `skill` of the time, works the tagged-immediate by
 * least life left, and loses `think` seconds choosing each time the hands come free.
 */
function playField(sc: TriageScenario, seed: number, skill = 0.8, think = 1.5): TriageField {
  const f = new TriageField(sc);
  const rng = new Rng(seed);
  const tags: TriageTag[] = ['immediate', 'delayed', 'walking', 'beyond'];
  let wait = think;
  while (!f.finished) {
    for (const p of f.present())
      if (p.tag === null && p.state === 'waiting') f.tag(p.card.id, rng.next() < skill ? p.card.truth : tags[Math.floor(rng.next() * 4)]);
    if (!f.busy && (wait -= DT) <= 0) {
      const next = f
        .present()
        .filter((p) => p.state === 'waiting' && p.tag === 'immediate')
        .sort((a, b) => a.life - b.life)[0];
      if (next) {
        const proc = (next.card.needs ?? []).find((n) => !next.done.includes(n)) ?? 'pack';
        f.treat(next.card.id, proc);
        wait = think;
      }
    }
    if (f.settled) f.end();
    f.tick(DT);
  }
  return f;
}

describe('field triage (CON-0226…0230)', () => {
  it('CON-0228: three scenarios, thirty cards, each with a truth and the work it needs', () => {
    expect(TRIAGE_SCENARIOS).toHaveLength(3);
    expect(TRIAGE_SCENARIOS.flatMap((s) => s.cards)).toHaveLength(30);
    for (const s of TRIAGE_SCENARIOS) {
      expect(new Set(s.cards.map((c) => c.id)).size).toBe(s.cards.length);
      for (const c of s.cards) {
        if (c.truth === 'immediate') expect(c.needs?.length, c.id).toBeGreaterThan(0);
        if (c.truth === 'beyond') expect(c.rites, c.id).toHaveLength(2);
        expect(c.arrives ?? 0).toBeLessThan(s.clock - 60);
        // The work fits the life: an immediate patient can be stabilised in time from arrival.
        if (c.needs) expect(c.needs.reduce((a, n) => a + TRIAGE.cost[n], 0)).toBeLessThan(c.life / 2);
      }
      const n = s.cards.length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(s.cards.filter((c) => (c.arrives ?? 0) <= 0).length).toBeLessThanOrEqual(8);
    }
  });

  it('CON-0227: life runs down, holds under the hands, and a stabilised patient lasts the wagon', () => {
    const sc = TRIAGE_SCENARIOS[0];
    const f = new TriageField(sc);
    const k1 = f.get('k1')!;
    f.tick(5);
    expect(k1.life).toBeCloseTo(k1.card.life - 5, 3);
    expect(f.treat('k1', 'tourniquet')).toBe(true);
    expect(f.treat('k2', 'pack')).toBe(false); // one pair of hands
    const before = k1.life;
    f.tick(TRIAGE.cost.tourniquet + 0.01);
    expect(k1.life).toBe(before);
    expect(k1.state).toBe('stable');
    const o = f.end();
    expect(o.lost).not.toContain(k1.card.name);
  });

  it('CON-0227: a wrong procedure fumbles; the beyond-help cannot be held', () => {
    const f = new TriageField(TRIAGE_SCENARIOS[0]);
    f.treat('k1', 'splint');
    f.tick(TRIAGE.fumble + 0.01);
    expect(f.get('k1')!.state).toBe('waiting');
    f.treat('k4', 'pack');
    f.tick(TRIAGE.fumble + 0.01);
    expect(f.get('k4')!.state).toBe('waiting');
    f.tick(60);
    expect(f.get('k4')!.state).toBe('dead');
  });

  it('CON-0229: Beyond Help says the last rites; a wrong one is shown in results and costs', () => {
    const f = new TriageField(TRIAGE_SCENARIOS[0]);
    expect(f.tag('k4', 'beyond')).toEqual(TRIAGE_SCENARIOS[0].cards.find((c) => c.id === 'k4')!.rites);
    expect(f.tag('k1', 'beyond')).toHaveLength(2);
    expect(f.treat('k1', 'tourniquet')).toBe(false);
    const o = f.end();
    expect(o.wrongTags.some((w) => w.id === 'k1' && w.given === 'beyond' && w.truth === 'immediate')).toBe(true);
    expect(o.lost).toContain('Grete, mill-hand');
  });

  it('CON-0230: the average bot saves ≥ 60 % in every scenario; a perfect one saves all', () => {
    for (const sc of TRIAGE_SCENARIOS) {
      let saved = 0;
      let savable = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const o = playField(sc, seed).outcome!;
        saved += o.saved;
        savable += o.savable;
      }
      expect(saved / savable, sc.id).toBeGreaterThanOrEqual(0.6);
      const best = playField(sc, 1, 1, 0.5).outcome!;
      expect(best.saved, sc.id).toBe(best.savable);
      expect(best.rank, sc.id).toBe('XS');
    }
  });

  it('CON-0247: each scenario is a triage step in the campaign, writing its saved count', () => {
    const steps = FULL_CAMPAIGN.flatMap((c) => c.steps).filter((s) => s.kind === 'discipline' && s.discipline.mode === 'triage');
    expect(steps.map((s) => (s.kind === 'discipline' ? s.discipline.id : ''))).toEqual(TRIAGE_SCENARIOS.map((s) => s.id));
    for (const s of steps) if (s.kind === 'discipline') expect(s.discipline.savedFlag).toMatch(/Saved$/);
  });
});
