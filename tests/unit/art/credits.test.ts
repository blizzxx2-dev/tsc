/** ART-0352: docs/art/credits.md feeds the Art line of the in-game credits. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_CREDITS, CREDIT_SECTIONS, parseArtCredits } from '../../../src/scenes/creditsData';

describe('art credits (ART-0352)', () => {
  it('parses the first column of the table, skipping the header and rule', () => {
    const md = '| Credited as | Role |\n| --- | --- |\n| Ada Wren | Portraits |\n| Ada Wren | Key art |\n| Jon Ash | VFX |\n\nprose | not a row';
    expect(parseArtCredits(md)).toEqual(['Ada Wren', 'Jon Ash']);
  });

  it('every name in docs/art/credits.md appears under the Art role', () => {
    const md = readFileSync(join(__dirname, '../../../docs/art/credits.md'), 'utf8');
    const names = parseArtCredits(md);
    expect(names.length).toBeGreaterThan(0);
    expect(ART_CREDITS).toEqual(names);
    const art = CREDIT_SECTIONS.flatMap((s) => s.lines).find((l) => l.roleKey === 'ui.credits.role_art');
    expect(art?.names).toEqual(names);
  });
});
