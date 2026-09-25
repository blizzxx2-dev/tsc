/** ENG-0229: idle menus and paused states drop to 30 fps and resume on the next frame after input. */
import { describe, expect, it } from 'vitest';
import { effectiveCap, IDLE_AFTER_S, IDLE_FPS, idleCap } from '../../../src/core/idle';
import { FrameLimiter } from '../../../src/core/loop';

const base = { now: 100, lastInput: 90, playing: false, transition: false, animating: false };

/** Frames rendered in one second of 120 Hz vsync under a limiter cap. */
const framesPerSecond = (l: FrameLimiter, cap: number) => {
  l.cap = cap;
  let n = 0;
  for (let i = 0; i < 120; i++) if (l.shouldRender(i * (1000 / 120), 120)) n++;
  return n;
};

describe('idle throttling (ENG-0229)', () => {
  it('throttles menus and pause screens after a moment without input', () => {
    expect(idleCap(base)).toBe(IDLE_FPS);
    expect(idleCap({ ...base, lastInput: base.now - IDLE_AFTER_S / 2 })).toBe(0);
  });

  it('never throttles play, transitions or scenes that say they animate', () => {
    expect(idleCap({ ...base, playing: true })).toBe(0);
    expect(idleCap({ ...base, transition: true })).toBe(0);
    expect(idleCap({ ...base, animating: true })).toBe(0);
  });

  it('combines with the player frame cap (the lower wins) and renders 30 fps when idle', () => {
    expect(effectiveCap(0, IDLE_FPS)).toBe(30);
    expect(effectiveCap(144, IDLE_FPS)).toBe(30);
    expect(effectiveCap(20, IDLE_FPS)).toBe(20);
    expect(effectiveCap(60, 0)).toBe(60);
    expect(framesPerSecond(new FrameLimiter(), 30)).toBeLessThanOrEqual(31);
    expect(framesPerSecond(new FrameLimiter(), 0)).toBe(120);
  });

  it('renders the very next frame after input (limiter reset)', () => {
    const l = new FrameLimiter();
    l.cap = 30;
    expect(l.shouldRender(0, 120)).toBe(true);
    expect(l.shouldRender(8.3, 120)).toBe(false);
    l.reset();
    expect(l.shouldRender(16.6, 120)).toBe(true);
  });
});
