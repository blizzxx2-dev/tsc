import { describe, expect, it } from 'vitest';
import { prognosis, woundSites } from '../../../src/art/woundMan';
import { allCampaignOperations } from '../../../src/content/campaign';

describe('ART-0056 briefing Wound Man', () => {
  it('pins every named site, patient-left on the viewer-right', () => {
    const pins = woundSites({ diagnosis: 'Barbed arrow lodged in the left flank; crossbow bolt in the thigh.', organ: 'flesh' });
    expect(pins.map((p) => p.site)).toEqual(['flank', 'thigh']);
    expect(pins[0].at.x).toBeGreaterThan(0);
    expect(pins[1].at.x).toBeLessThan(0);
  });

  it('falls back to the operated organ', () => {
    expect(woundSites({ diagnosis: 'Unknown. Delirium.', organ: 'brain' }).map((p) => p.site)).toEqual(['head']);
  });

  it('every campaign operation gets at least one pin and a prognosis', () => {
    for (const op of allCampaignOperations()) {
      expect(woundSites(op).length, op.id).toBeGreaterThan(0);
      expect(['fair', 'guarded', 'grave']).toContain(prognosis(op));
    }
  });
});
