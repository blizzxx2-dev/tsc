/** NAR-0034: content notes before Chapters IV and V, on by default and switchable. */
import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { DEFAULT_SETTINGS as DEFAULTS } from '../../../src/core/settings/schema';
import { t } from '../../../src/i18n';
import { Bindings } from '../../../src/input/bindings';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('chapter content notes (NAR-0034)', () => {
  it('are on by default, name Chapters IV and V, and the card renders', async () => {
    expect(DEFAULTS.contentNotes).toBe(true);
    installFakeDom();
    const { CHAPTER_NOTES, ChapterNoteScene } = await import('../../../src/scenes/chapterNote');
    expect(CHAPTER_NOTES).toEqual(['ch4', 'ch5']);
    for (const id of CHAPTER_NOTES) expect(t(`ui.content_notes.${id}`)).not.toMatch(/^ui\./);
    const { Gfx } = await import('../../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const game = { input: new Input(null, 1280, 720, new Bindings(null)), gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
    let went = false;
    const s = new ChapterNoteScene('ch4', 'IV', () => (went = true));
    for (let i = 0; i < 10; i++) s.update(1 / 60, game);
    s.render(g, game);
    expect(went).toBe(false);
  });
});
