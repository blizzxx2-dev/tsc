import { describe, expect, it } from 'vitest';
import { Input } from '../src/core/input';
import { Bindings } from '../src/input/bindings';
import { CURSOR_MAX_SPEED, GamepadAdapter, radialDeadzone, VirtualCursor } from '../src/input/gamepad';
import type { InputEvent } from '../src/input/types';
import { fakePad } from './inputHarness';

const DZ = { inner: 0.15, outer: 0.95 };

describe('gamepad adapter (INP-0076)', () => {
  it('reports hot-plug, button transitions and analogue triggers as pad codes', () => {
    const evs: InputEvent[] = [];
    const g = new GamepadAdapter((e) => evs.push(e));
    g.poll([null], 0);
    expect(evs).toEqual([]);
    g.poll([fakePad()], 10);
    expect(evs[0]).toMatchObject({ type: 'pad', state: 'connected' });
    g.poll([fakePad({ buttons: { 0: 1, 7: 0.6 } })], 20);
    expect(evs.filter((e) => e.type === 'down').map((e) => (e.type === 'down' ? e.code : ''))).toEqual(['pad:0', 'pad:7']);
    g.poll([fakePad({ buttons: { 7: 0.3 } })], 30);
    expect(evs.filter((e) => e.type === 'up').map((e) => (e.type === 'up' ? e.code : ''))).toEqual(['pad:0', 'pad:7']);
    g.poll([fakePad({ buttons: { 3: 1 } })], 40);
    g.poll([], 50);
    expect(evs.slice(-2)).toMatchObject([{ type: 'up', code: 'pad:3', cancel: true }, { type: 'pad', state: 'disconnected' }]);
    expect(g.connected).toBe(false);
  });

  it('prefers a standard-mapping pad', () => {
    const g = new GamepadAdapter(() => undefined);
    g.poll([{ ...fakePad({ index: 0, id: 'odd' }), mapping: '' }, fakePad({ index: 1, id: 'good' })], 0);
    expect(g.activeId).toBe('good');
  });
});

describe('stick deadzones (INP-0078)', () => {
  it('radial inner 0.15 / outer 0.95, rescaled without a jump', () => {
    expect(radialDeadzone(0.1, 0, DZ)).toEqual({ x: 0, y: 0 });
    expect(radialDeadzone(0.07, 0.07, DZ)).toEqual({ x: 0, y: 0 });
    expect(radialDeadzone(0.16, 0, DZ).x).toBeCloseTo(0.0125, 4);
    expect(radialDeadzone(0.96, 0, DZ).x).toBe(1);
    const d = radialDeadzone(0.4, 0.3, DZ); // magnitude 0.5
    expect(Math.hypot(d.x, d.y)).toBeCloseTo((0.5 - 0.15) / 0.8, 5);
    expect(d.y / d.x).toBeCloseTo(0.75, 5);
  });

  it('0.1 stick drift produces no cursor motion', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    input.setGamepadSource(() => [fakePad({ axes: [0.1, -0.08, 0.05, 0.1] })]);
    input.warp({ x: 400, y: 300 });
    let t = 0;
    for (let i = 0; i < 120; i++) input.beginFrame((t += 16.7), 1 / 60);
    expect(input.pos).toEqual({ x: 400, y: 300 });
  });

  it('per-stick deadzone settings apply', () => {
    const b = new Bindings(null);
    b.prefs.deadzones.left = { inner: 0.3, outer: 0.9 };
    const input = new Input(null, 1280, 720, b);
    input.setGamepadSource(() => [fakePad({ axes: [0.25, 0, 0, 0] })]);
    input.warp({ x: 400, y: 300 });
    input.beginFrame(16.7, 1 / 60);
    input.beginFrame(33.4, 1 / 60);
    expect(input.pos.x).toBe(400);
  });
});

describe('virtual cursor (INP-0083, INP-0084)', () => {
  const run = (sticks: { lx: number; ly: number; rx: number; ry: number }, seconds: number, speed = 1, nudge = true) => {
    const c = new VirtualCursor(100000, 100000);
    let p = { x: 50000, y: 50000 };
    for (let t = 0; t < seconds - 1e-9; t += 0.01) p = c.step(p, sticks, 0.01, { speed, slow: 1, nudge });
    return p.x - 50000;
  };
  it('full deflection reaches 900 px/s after an 80 ms ramp', () => {
    const one = run({ lx: 1, ly: 0, rx: 0, ry: 0 }, 1);
    expect(one).toBeGreaterThan(CURSOR_MAX_SPEED - 40);
    expect(one).toBeLessThanOrEqual(CURSOR_MAX_SPEED);
  });
  it('response curve exponent 2: half deflection is a quarter speed', () => {
    expect(run({ lx: 0.5, ly: 0, rx: 0, ry: 0 }, 2) / run({ lx: 1, ly: 0, rx: 0, ry: 0 }, 2)).toBeCloseTo(0.25, 1);
  });
  it('cursor speed setting scales 0.5–2×', () => {
    expect(run({ lx: 1, ly: 0, rx: 0, ry: 0 }, 1, 2) / run({ lx: 1, ly: 0, rx: 0, ry: 0 }, 1, 1)).toBeCloseTo(2, 5);
  });
  it('the right stick nudges at 25 % speed, and not at all while the radial uses it', () => {
    expect(run({ lx: 0, ly: 0, rx: 1, ry: 0 }, 1) / run({ lx: 1, ly: 0, rx: 0, ry: 0 }, 1)).toBeCloseTo(0.25, 2);
    expect(run({ lx: 0, ly: 0, rx: 1, ry: 0 }, 1, 1, false)).toBe(0);
  });
  it('is clamped to the view', () => {
    const c = new VirtualCursor(1280, 720);
    let p = { x: 1270, y: 5 };
    for (let i = 0; i < 60; i++) p = c.step(p, { lx: 1, ly: -1, rx: 0, ry: 0 }, 1 / 60, { speed: 1, slow: 1, nudge: true });
    expect(p).toEqual({ x: 1280, y: 0 });
  });
});
