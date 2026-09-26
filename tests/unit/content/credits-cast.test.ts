/** UIX-0198 / NAR-0160: the ending credits carry the cast, and the post-credits sting opens the Unsung Hour. */
import { describe, expect, it } from 'vitest';
import { POST_CREDITS } from '../../../src/content/endings';
import { ENGINE_FLAG_WRITES } from '../../../src/content/flags';
import { creditRows } from '../../../src/scenes/credits';

describe('ending credits', () => {
  it('list the cast by name and title before the crew', () => {
    const rows = creditRows();
    const cast = rows.findIndex((r) => r.kind === 'heading' && r.text === 'Dramatis Personae');
    expect(cast).toBeGreaterThan(0);
    const names = rows
      .slice(cast + 1)
      .filter((r) => r.kind === 'name')
      .map((r) => r.text);
    expect(names.some((n) => n.startsWith('Sister Ilse — '))).toBe(true);
    expect(names.some((n) => n.startsWith('Inquisitor Stroh — '))).toBe(true);
  });

  it('the post-credits sting is short, and hearing it is an engine-written flag', () => {
    expect(POST_CREDITS.lines.length).toBeLessThanOrEqual(8);
    for (const l of POST_CREDITS.lines) expect(l.text.length).toBeLessThanOrEqual(140);
    expect(ENGINE_FLAG_WRITES).toContain('unsungHeard');
  });
});
