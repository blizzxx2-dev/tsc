/** ART-0269/0270/0271/0273: tool-sprite hotspots, cursor fallback PNGs and pad glyph coverage. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spriteOrigin, tipAt, TOOL_SPRITE_SIZE, TOOL_TIPS } from '../../../src/art/toolSprites';
import { CURSOR_HOTSPOT, CURSOR_KINDS, CURSOR_SIZES, cursorCss, cursorFile } from '../../../src/art/cursors';
import { padIndexOf } from '../../../src/art/padGlyphs';
import { PAD_GLYPHS } from '../../../src/input/glyphs';
import { TOOL_INFO } from '../../../src/surgery/types';

describe('in-field tool sprites (ART-0269/0270)', () => {
  it('every instrument has a tip pixel inside its 64² frame', () => {
    for (const { id } of TOOL_INFO) {
      const tip = TOOL_TIPS[id];
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.y).toBeGreaterThanOrEqual(0);
      expect(tip.x).toBeLessThan(TOOL_SPRITE_SIZE);
      expect(tip.y).toBeLessThan(TOOL_SPRITE_SIZE);
    }
  });
  it('the tip lands exactly on the pointer, wherever it is', () => {
    for (const { id } of TOOL_INFO)
      for (const p of [
        { x: 0, y: 0 },
        { x: 660.5, y: 410.25 },
        { x: 1279, y: 719 },
      ]) {
        expect(tipAt(id, p)).toEqual(p);
        const o = spriteOrigin(id, p);
        expect(o.x + TOOL_TIPS[id].x).toBe(p.x);
      }
  });
});

describe('cursor fallback PNGs (ART-0271)', () => {
  const pngSize = (f: string): [number, number] => {
    const b = readFileSync(join(__dirname, '../../../public', f));
    expect(b.subarray(1, 4).toString()).toBe('PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  it('ships quill, busy and crosshair at 32² and 64²', () => {
    for (const k of CURSOR_KINDS) for (const s of CURSOR_SIZES) expect(pngSize(cursorFile(k, s))).toEqual([s, s]);
  });
  it('picks the 64 px file on HiDPI and scales the hotspot', () => {
    expect(cursorCss('quill', 1)).toContain('quill-32.png) 2 2');
    expect(cursorCss('quill', 2)).toContain('quill-64.png) 4 4');
    expect(CURSOR_HOTSPOT.busy).toEqual([16, 16]);
  });
});

describe('pad glyphs (ART-0273)', () => {
  it('every Xbox, PlayStation and Deck prompt label maps to a glyph', () => {
    for (const fam of ['xbox', 'playstation', 'deck'] as const) PAD_GLYPHS[fam].slice(0, 16).forEach((label, i) => expect(padIndexOf(label, fam)).toBe(i));
  });
});
