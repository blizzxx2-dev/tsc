import { describe, expect, it } from 'vitest';
import { narrativeEntries } from '../src/content/export';
import { TEASER_3 } from '../src/content/teaser';

describe('Chapter III teaser (NAR-0068)', () => {
  it('six lines: foundry smoke, raised bridges, the licence vote and Stroh after Prime', () => {
    const text = TEASER_3.lines.map((l) => l.text).join(' ');
    expect(TEASER_3.lines).toHaveLength(6);
    expect(text).toMatch(/smoke/i);
    expect(text).toMatch(/bridges are raised/i);
    expect(TEASER_3.lines.some((l) => l.who === 'haller' && /licence/.test(l.text))).toBe(true);
    expect(TEASER_3.lines[5]).toMatchObject({ who: 'stroh' });
    expect(TEASER_3.lines[5].text).toMatch(/after Prime/);
    expect(narrativeEntries().some((e) => e.id.startsWith('teaser-3.'))).toBe(true);
  });
});
