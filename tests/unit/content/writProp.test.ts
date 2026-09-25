/** NAR-0057: the Chapter I→II transition card shows the requisition writ. */
import { describe, expect, it } from 'vitest';
import { STORY_2_1 } from '../../../src/content/chapter2';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';

describe('chapter transition card (NAR-0057)', () => {
  it('s2-1 opens "a week later" with the writ held up, and the prop draws', async () => {
    const i = STORY_2_1.lines.findIndex((l) => l.prop === 'writ');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(STORY_2_1.lines[i].text).toMatch(/week later/i);
    expect(STORY_2_1.lines[i + 1].text).toMatch(/writ/);
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const { drawWrit } = await import('../../../src/art/props');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const before = g.stats.vertices;
    drawWrit(g, 640, 300, 1);
    g.flush();
    expect(g.stats.vertices).toBeGreaterThan(before);
  });
});
