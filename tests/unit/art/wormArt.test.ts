import { describe, expect, it } from 'vitest';
import type { Gfx } from '../../../src/render/gfx';
import { WORM_FRAMES, wormArt, wormEnvelope, wormFrame, wormSpine } from '../../../src/art/wormArt';

describe('parasite worm art (ART-0218)', () => {
  it('ripples through 12 woodcut frames, one second per cycle', () => {
    expect(WORM_FRAMES).toBe(12);
    const seen = new Set<number>();
    for (let i = 0; i < 24; i++) seen.add(wormFrame(i / 12));
    expect([...seen].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
    expect(wormFrame(0)).toBe(wormFrame(1));
  });

  it('pins the wave at the tail and the head, so the tongs hold the head exactly', () => {
    expect(wormEnvelope(0)).toBe(0);
    expect(wormEnvelope(1)).toBeCloseTo(0, 6);
    const tail = { x: 0, y: 0 };
    const head = { x: 200, y: 40 };
    for (let f = 0; f < WORM_FRAMES; f++) {
      const pts = wormSpine(tail, head, f, 9);
      expect(pts[0].x).toBeCloseTo(0, 6);
      expect(pts[pts.length - 1].x).toBeCloseTo(200, 6);
      expect(pts[pts.length - 1].y).toBeCloseTo(40, 6);
    }
    // Neighbouring frames differ: the wave travels.
    expect(wormSpine(tail, head, 0)[8].y).not.toBeCloseTo(wormSpine(tail, head, 3)[8].y, 2);
  });

  it('draws a whole worm and a torn stump without leaving the wound', () => {
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => () => void calls.push(String(k)) }) as unknown as Gfx;
    wormArt(g, { origin: { x: 100, y: 100 }, head: { x: 260, y: 90 }, t: 0.3, seed: 3 });
    expect(calls.filter((c) => c === 'circle').length).toBeGreaterThan(40);
    calls.length = 0;
    wormArt(g, { origin: { x: 100, y: 100 }, head: { x: 100, y: 100 }, t: 0.3, torn: true });
    expect(calls.length).toBeGreaterThan(10);
  });
});
