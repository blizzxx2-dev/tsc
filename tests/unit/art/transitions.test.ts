/** ART-0306: page turn (8 frames) between menu pages and a wax-seal break on New Game. */
import { describe, expect, it } from 'vitest';
import { isMenuPage, nextTransitionStyle, STYLE_DURATION, Transition } from '../../../src/ui/transition';

describe('menu transitions (ART-0306)', () => {
  it('the page turn steps through 8 woodcut frames and swaps at the midpoint', () => {
    const tr = new Transition();
    let swapped = false;
    tr.request(() => (swapped = true), 'page');
    expect(tr.duration).toBeCloseTo(STYLE_DURATION.page);
    const seen = new Set<number>();
    for (let i = 0; i < 200 && tr.busy; i++) {
      seen.add(tr.pageFrame());
      tr.update(1 / 120);
    }
    expect(swapped).toBe(true);
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('New Game queues the seal, used once', () => {
    const tr = new Transition();
    nextTransitionStyle('seal');
    tr.request(() => undefined);
    expect(tr.style).toBe('seal');
    tr.settle();
    tr.request(() => undefined);
    expect(tr.style).toBe('ink');
  });

  it('menu scenes are flagged as pages', () => {
    expect(isMenuPage({ menuPage: true })).toBe(true);
    expect(isMenuPage({})).toBe(false);
    expect(isMenuPage(null)).toBe(false);
  });
});
