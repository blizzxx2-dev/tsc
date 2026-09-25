/** ENG-0172: a full glyph atlas evicts its least recently used page, not every glyph. */
import { describe, expect, it } from 'vitest';
import { fakeGl, installFakeDom } from '../../fakegl';

describe('paged glyph atlas (ENG-0172)', () => {
  it('evicts the coldest page and keeps glyphs that are still in use', async () => {
    installFakeDom();
    const { GlyphAtlas, GLYPH_PAGES } = await import('../../../src/render/text');
    const atlas = new GlyphAtlas(fakeGl().gl);
    const hot = atlas.glyph('A', 'body');
    let n = 0x4e00;
    const gen0 = atlas.generation;
    // Rasterise new characters until the atlas has had to evict, touching the hot glyph as text would.
    while (atlas.evictions === 0 && n < 0x4e00 + 20000) {
      atlas.glyph(String.fromCodePoint(n++), 'body');
      expect(atlas.glyph('A', 'body')).toBe(hot);
    }
    expect(atlas.evictions).toBe(1);
    expect(atlas.generation).toBe(gen0 + 1);
    // The hot glyph survived: its page was not the one evicted.
    expect(atlas.glyph('A', 'body')).toBe(hot);
    expect(hot.page).toBeGreaterThanOrEqual(0);
    expect(hot.page).toBeLessThan(GLYPH_PAGES);
    // Glyphs on every other page stay within their bands.
    const g = atlas.glyph(String.fromCodePoint(n - 1), 'body');
    expect(g.v0).toBeGreaterThanOrEqual((g.page ?? 0) / GLYPH_PAGES);
    expect(g.v1).toBeLessThanOrEqual(((g.page ?? 0) + 1) / GLYPH_PAGES);
  });
});
