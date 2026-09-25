/** ENG-0064: fade, iris and ink-bleed transitions with per-call length, drawn over everything, input blocked. */
import { describe, expect, it } from 'vitest';
import { Transition, type TransitionKind } from '../../../src/ui/transition';
import type { Gfx } from '../../../src/render/gfx';

/** A Gfx stand-in that records draw calls. */
function recorder() {
  const calls: string[] = [];
  const g = {
    viewRect: () => ({ x: 0, y: 0, w: 1280, h: 720 }),
    rect: () => calls.push('rect'),
    rectGrad: () => calls.push('rectGrad'),
    circle: () => calls.push('circle'),
    arc: () => calls.push('arc'),
  } as unknown as Gfx;
  return { g, calls };
}

describe('transition kinds (ENG-0064)', () => {
  it('honours the requested length: go(scene, { transition: "ink", ms: 600 }) swaps at 300 ms', () => {
    const tr = new Transition(0.3);
    let swaps = 0;
    tr.request(() => swaps++, { transition: 'ink', ms: 600 });
    expect(tr.kind).toBe('ink');
    for (let i = 0; i < 17; i++) tr.update(1 / 60);
    expect(swaps).toBe(0);
    expect(tr.busy).toBe(true);
    for (let i = 0; i < 2; i++) tr.update(1 / 60);
    expect(swaps).toBe(1);
    for (let i = 0; i < 18; i++) tr.update(1 / 60);
    expect(tr.busy).toBe(false);
  });

  it('draws each look differently while covering the screen at the midpoint', () => {
    const drawn = (kind: TransitionKind) => {
      const tr = new Transition(0.4);
      tr.request(() => undefined, { transition: kind });
      for (let i = 0; i < 11; i++) tr.update(1 / 60);
      const { g, calls } = recorder();
      tr.draw(g);
      return calls;
    };
    expect(drawn('fade')).toEqual(['rect']);
    expect(drawn('iris').every((c) => c === 'arc' || c === 'rect')).toBe(true);
    expect(drawn('iris')).toContain('arc');
    expect(drawn('ink').filter((c) => c === 'circle').length).toBeGreaterThan(4);
  });

  it('"none" swaps at once without blocking', () => {
    const tr = new Transition(0.4);
    let swaps = 0;
    tr.request(() => swaps++, { transition: 'none' });
    expect(swaps).toBe(1);
    expect(tr.busy).toBe(false);
  });
});
