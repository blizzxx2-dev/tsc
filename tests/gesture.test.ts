import { describe, expect, it } from 'vitest';
import { isStar } from '../src/surgery/gesture';
import type { Vec } from '../src/core/math';

function densify(corners: Vec[], per = 12): Vec[] {
  const out: Vec[] = [];
  for (let i = 1; i < corners.length; i++)
    for (let s = 0; s < per; s++) {
      const t = s / per;
      out.push({ x: corners[i - 1].x + (corners[i].x - corners[i - 1].x) * t, y: corners[i - 1].y + (corners[i].y - corners[i - 1].y) * t });
    }
  out.push(corners[corners.length - 1]);
  return out;
}

const star = (cx: number, cy: number, r: number, jitter = 0): Vec[] => {
  const pts: Vec[] = [];
  for (let k = 0; k <= 5; k++) {
    const a = -Math.PI / 2 + ((k * 2) % 5) * ((Math.PI * 2) / 5);
    pts.push({ x: cx + Math.cos(a) * r + (k % 2 ? jitter : -jitter), y: cy + Math.sin(a) * r + (k % 3 ? jitter : 0) });
  }
  return densify(pts);
};

describe('isStar', () => {
  it('accepts a clean pentagram', () => expect(isStar(star(400, 300, 120))).toBe(true));
  it('accepts a sloppy pentagram', () => expect(isStar(star(400, 300, 100, 12))).toBe(true));
  it('rejects a circle', () => {
    const c: Vec[] = [];
    for (let i = 0; i <= 60; i++) c.push({ x: 300 + Math.cos(i / 9.5) * 100, y: 300 + Math.sin(i / 9.5) * 100 });
    expect(isStar(c)).toBe(false);
  });
  it('rejects a zig-zag', () => {
    expect(isStar(densify([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }, { x: 150, y: 100 }, { x: 200, y: 0 }]))).toBe(false);
  });
  it('rejects a tiny scribble', () => expect(isStar(star(100, 100, 20))).toBe(false));
  it('accepts a hurried, unclosed star', () => {
    const s = star(400, 300, 110, 18);
    expect(isStar(s.slice(0, Math.floor(s.length * 0.93)))).toBe(true);
  });
  it('rejects a triangle', () => {
    expect(isStar(densify([{ x: 300, y: 100 }, { x: 420, y: 300 }, { x: 180, y: 300 }, { x: 300, y: 100 }]))).toBe(false);
  });
});
