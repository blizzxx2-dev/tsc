/** CON-0048: Stroh watches op1-4 from the field's edge — that op only. */
import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../../../src/content/campaign';
import { CAST, type CharacterId } from '../../../src/content/characters';
import { OP_1_4 } from '../../../src/content/ops/ch1';

describe('the observer at the field edge (CON-0048)', () => {
  it('Inquisitor Stroh watches the plague case at the Tanners’ Rows', () => {
    expect(OP_1_4.observer).toBe('stroh');
    expect(CAST[OP_1_4.observer as CharacterId].name).toBe('Inquisitor Stroh');
  });

  it('and no other operation', () => {
    const watched = allCampaignOperations().filter((d) => d.observer);
    expect(watched.map((d) => d.id)).toEqual(['op1-4']);
  });
});
