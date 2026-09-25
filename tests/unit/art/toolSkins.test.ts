/** ART-0379: cosmetic instrument skins reach both the tray icon shader and the in-field sprite. */
import { describe, expect, it } from 'vitest';
import { TOOL_SKINS, toolArt } from '../../../src/art/kit';
import { UI_ART_FS } from '../../../src/art/uiShader';
import type { Gfx } from '../../../src/render/gfx';

describe('tool skins (ART-0379)', () => {
  it('offers steel, bone-handled, gilt and Pyre-blackened', () => expect(TOOL_SKINS).toEqual(['steel', 'bone', 'gilt', 'pyre']));

  it('passes the skin to the icon shader in a.w, which the tool mode reads', () => {
    const calls: number[][] = [];
    const g = { ornament: (_m: number, _x: number, _y: number, _w: number, _h: number, o: { a: number[] }) => calls.push(o.a) } as unknown as Gfx;
    TOOL_SKINS.forEach((s) => toolArt(g, 'lancet', 0, 0, 50, 'idle', 0, s));
    expect(calls.map((a) => a[3])).toEqual([0, 1, 2, 3]);
    expect(UI_ART_FS).toContain('float skin = u_a.w;');
  });
});
