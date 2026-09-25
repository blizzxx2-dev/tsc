import { describe, expect, it } from 'vitest';
import { analyzeStar, isStar, STAR_FAILURE_HINT } from '../src/surgery/gesture';
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

/** A pentagram from any start vertex, either winding, rotated and squashed. */
function starVariant(opts: { start?: number; dir?: 1 | -1; rot?: number; sx?: number; sy?: number; r?: number }): Vec[] {
  const { start = 0, dir = 1, rot = 0, sx = 1, sy = 1, r = 120 } = opts;
  const corners: Vec[] = [];
  for (let k = 0; k <= 5; k++) {
    const idx = (((start + dir * k * 2) % 5) + 5) % 5;
    const a = -Math.PI / 2 + idx * ((Math.PI * 2) / 5);
    const x = Math.cos(a) * r * sx;
    const y = Math.sin(a) * r * sy;
    corners.push({ x: 400 + x * Math.cos(rot) - y * Math.sin(rot), y: 300 + x * Math.sin(rot) + y * Math.cos(rot) });
  }
  return densify(corners);
}

describe('star recogniser tuning (INP-0057)', () => {
  for (let s = 0; s < 5; s++) it(`accepts starting at vertex ${s}`, () => expect(isStar(starVariant({ start: s }))).toBe(true));
  it('accepts either winding direction', () => expect(isStar(starVariant({ dir: -1, start: 2 }))).toBe(true));
  for (const deg of [-45, -30, 30, 45]) it(`accepts rotation ${deg}°`, () => expect(isStar(starVariant({ rot: (deg * Math.PI) / 180 }))).toBe(true));
  it('accepts aspect 0.6 (squashed or stretched)', () => {
    expect(isStar(starVariant({ sx: 0.6 }))).toBe(true);
    expect(isStar(starVariant({ sy: 0.6 }))).toBe(true);
  });
  it('minimum size scales with the UI scale', () => {
    const s = starVariant({ r: 45 }); // ~86 px across
    expect(isStar(s)).toBe(true);
    expect(isStar(s, { minSize: 60 * 1.5 })).toBe(false);
  });
  it('the gamepad profile accepts rounder, less closed stick strokes', () => {
    const s = starVariant({});
    const open = s.slice(0, s.length - 6); // the last stroke stops halfway home
    expect(analyzeStar(open).reason).toBe('notClosed');
    expect(analyzeStar(open, { profile: 'gamepad' }).ok).toBe(true);
  });
});

describe('star failure reasons (INP-0059)', () => {
  it('names why a sign failed', () => {
    expect(analyzeStar([{ x: 0, y: 0 }, { x: 5, y: 5 }]).reason).toBe('tooFewPoints');
    expect(analyzeStar(star(100, 100, 20)).reason).toBe('tooSmall');
    expect(analyzeStar(densify([{ x: 0, y: 0 }, { x: 200, y: 200 }, { x: 400, y: 0 }])).reason).toBe('notClosed');
    const c: Vec[] = [];
    for (let i = 0; i <= 60; i++) c.push({ x: 300 + Math.cos(i / 9.5) * 100, y: 300 + Math.sin(i / 9.5) * 100 });
    expect(analyzeStar(c).reason).toBe('tooFewCrossings');
    // A tight coil that loops back over itself many times.
    const coil: Vec[] = [];
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * Math.PI * 2 * 7;
      coil.push({ x: 400 + Math.cos(t) * 80 + Math.cos((i / 400) * Math.PI * 2) * 40, y: 300 + Math.sin(t) * 80 + Math.sin((i / 400) * Math.PI * 2) * 40 });
    }
    expect(analyzeStar(coil).reason).toBe('tooManyCrossings');
    expect(STAR_FAILURE_HINT.notClosed).toBe('Close the sign, Doctor');
    expect(analyzeStar(star(400, 300, 120))).toMatchObject({ ok: true });
  });
});
