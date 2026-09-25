/** ENG-0020: indexed quads — rects, glyphs and sprites cost 4 vertices, not 6; the results screen drops ≥30 %. */
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../../src/content/campaign';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { Bindings } from '../../../src/input/bindings';
import { Operation } from '../../../src/surgery/operation';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('indexed quads (ENG-0020)', () => {
  it('draws a rect, a glyph and a sprite as 4 vertices + 6 indices each', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const f = fakeGl();
    const g = new Gfx(fakeCanvas(f), 1280, 720);
    g.beginScreen();
    g.rect(0, 0, 10, 10, 0xffffffff);
    g.text('A', 20, 20, { shadow: false });
    g.endFrame();
    expect(g.stats.vertices).toBe(8);
    expect(g.stats.indices).toBe(12);
    const draw = f.calls.filter((c) => c.fn === 'drawElements').pop()!;
    expect(draw.args[1]).toBe(12);
  });

  it('cuts the results screen’s vertex count by at least 30 %', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const { ResultsScene } = await import('../../../src/scenes/results');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const def = allOperations()[0];
    const op = new Operation(def);
    op.status = 'won';
    op.score = def.ranks.S;
    op.counts = { cool: 9, good: 6, bad: 2, miss: 1 };
    op.maxCombo = 8;
    op.vitals = 72;
    op.timeLeft = def.timeLimit / 3;
    op.bonus = { vitals: 1440, time: 400, closure: 0 };
    const game = { input: new Input(null, 1280, 720, new Bindings(null)), gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
    const scene = new ResultsScene(op, true, false, { retry: () => undefined, quit: () => undefined });
    for (let i = 0; i < 180; i++) scene.update(1 / 60, game);
    g.resetStats();
    scene.render(g, game);
    g.endFrame();
    const st = g.resetStats();
    // Before indexing every index was its own vertex: vertices == indices.
    expect(st.indices).toBeGreaterThan(1000);
    expect(st.vertices).toBeLessThanOrEqual(st.indices * 0.7);
  });
});
