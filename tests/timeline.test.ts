import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FULL_CAMPAIGN } from '../src/content/campaign';

/** Rows of docs/narrative/timeline.md: | scene | date | hour | `place` | */
const rows = readFileSync('docs/narrative/timeline.md', 'utf8')
  .split('\n')
  .map((l) => /^\| ([a-z0-9-]+) \| (.+?) \| (.+?) \| `(.+)` \|$/.exec(l))
  .filter((m): m is RegExpExecArray => !!m)
  .map((m) => ({ id: m[1], date: m[2], hour: m[3], place: m[4] }));

describe('campaign timeline (NAR-0007)', () => {
  const scenes = FULL_CAMPAIGN.flatMap((c) => c.steps.flatMap((s) => (s.kind === 'story' ? [s.story] : [])));

  it('lists every campaign scene once, in campaign order', () => {
    expect(rows.map((r) => r.id)).toEqual(scenes.map((s) => s.id));
  });

  it('every scene caption matches the timeline verbatim', () => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const s of scenes) expect(s.place, s.id).toBe(byId.get(s.id)?.place);
  });

  it('every row has a date', () => {
    for (const r of rows) expect(r.date, r.id).toMatch(/Hartung|Lenzing|Saatmond|Wonnemond|Hollow Night/);
  });
});
