import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../../../src/content/campaign';
import { opData } from '../../../src/content/schema';

describe('CON-0082: objectives map to phases', () => {
  it('every phase of every data operation names its objective', () => {
    const orphans: string[] = [];
    for (const def of allCampaignOperations()) {
      const data = opData(def);
      if (!data) continue;
      data.phases.forEach((p, i) => {
        if (!p.objective) orphans.push(`${def.id} phase ${i + 1}`);
      });
    }
    expect(orphans).toEqual([]);
  });
});
