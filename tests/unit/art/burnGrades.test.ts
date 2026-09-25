import { describe, expect, it } from 'vitest';
import { BURN_GRADES, burnSeverity, spawnGrade } from '../../../src/art/burnGrades';
import { burnCounts } from '../../../src/scenes/briefing';
import { allCampaignOperations } from '../../../src/content/campaign';
import { DEFAULT_TUNING } from '../../../src/surgery/tuning';

describe('burn grades (GAM-0074)', () => {
  it('one severity table: pink < blistered < charred, and blisters ease toward pink as flakes come off', () => {
    expect(BURN_GRADES[1].severity).toBeLessThan(BURN_GRADES[2].severity);
    expect(BURN_GRADES[2].severity).toBeLessThan(BURN_GRADES[3].severity);
    expect(burnSeverity(2, 1)).toBeCloseTo(BURN_GRADES[2].severity);
    expect(burnSeverity(2, 0)).toBeGreaterThan(BURN_GRADES[1].severity);
    expect(burnSeverity(2, 0)).toBeLessThan(BURN_GRADES[2].severity);
    expect(burnSeverity(3, 0)).toBe(1);
  });

  it('the briefing counts the grades the field will show', () => {
    const r3 = DEFAULT_TUNING.burn.grade3Radius;
    expect(spawnGrade(r3, r3)).toBe(3);
    expect(spawnGrade(r3 - 1, r3)).toBe(2);
    const op13 = allCampaignOperations().find((d) => d.id === 'op1-3')!;
    expect(burnCounts(op13)).toEqual([
      { grade: 3, n: 1 },
      { grade: 2, n: 1 },
    ]);
  });
});
