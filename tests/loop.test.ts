import { describe, expect, it } from 'vitest';
import { Clock, HITSTOP_CAP_MS } from '../src/core/clock';
import { Input } from '../src/core/input';
import { FIXED_DT, FixedStep, FrameLimiter, MAX_STEPS, RefreshEstimator, stepEndTimes } from '../src/core/loop';
import { allOperations } from '../src/content/campaign';
import { Operation } from '../src/surgery/operation';

describe('FixedStep (ENG-0053)', () => {
  it('runs exactly 120 ticks per second at 30, 60 and 144 fps', () => {
    for (const fps of [30, 60, 144]) {
      const f = new FixedStep();
      let ticks = 0;
      for (let i = 0; i < fps * 10; i++) ticks += f.advance(1 / fps);
      expect(Math.abs(ticks - 1200)).toBeLessThanOrEqual(1);
    }
  });

  it('caps a slow frame at MAX_STEPS and drops the excess (no spiral of death)', () => {
    const f = new FixedStep();
    expect(f.advance(0.2)).toBe(MAX_STEPS);
    expect(f.dropped).toBeGreaterThan(0);
    expect(f.pending).toBe(0);
    expect(f.advance(1 / 60)).toBe(2);
  });

  it('exposes the interpolation alpha of the unsimulated remainder', () => {
    const f = new FixedStep();
    f.advance(FIXED_DT * 1.5);
    expect(f.alpha).toBeCloseTo(0.5, 5);
  });

  it('stepEndTimes spaces tick ends one tick apart ending at now − remainder', () => {
    const e = stepEndTimes(1000, 3, FIXED_DT, 0.002);
    expect(e[2]).toBeCloseTo(998, 6);
    expect(e[1]).toBeCloseTo(998 - FIXED_DT * 1000, 6);
  });
});

describe('Clock (ENG-0056/0057/0058)', () => {
  it('pause stops sim and world time but not real time', () => {
    const c = new Clock();
    c.paused = true;
    for (let i = 0; i < 1200; i++) {
      c.frame(FIXED_DT);
      c.tick(FIXED_DT);
    }
    expect(c.real).toBeCloseTo(10, 6);
    expect(c.sim).toBe(0);
    expect(c.world).toBe(0);
  });

  it('world time follows the Litany scale', () => {
    const c = new Clock();
    c.worldScale = 0.15;
    for (let i = 0; i < 120; i++) c.tick(FIXED_DT);
    expect(c.sim).toBeCloseTo(1, 6);
    expect(c.world).toBeCloseTo(0.15, 6);
  });

  it('hitstop freezes world time, capped at 120 ms, and is disabled by reduce-motion', () => {
    const c = new Clock();
    c.hitstop(500);
    let frozen = 0;
    for (let i = 0; i < 60; i++) if (c.tick(FIXED_DT) === 0) frozen++;
    expect(frozen * FIXED_DT * 1000).toBeLessThanOrEqual(HITSTOP_CAP_MS + FIXED_DT * 1000);
    expect(frozen).toBeGreaterThan(10);
    const r = new Clock();
    r.reduceMotion = true;
    r.hitstop(100);
    expect(r.tick(FIXED_DT)).toBeGreaterThan(0);
  });

  it('a paused operation keeps its vitals and timer across a 10 s pause (ENG-0057)', () => {
    const op = new Operation(allOperations()[0]);
    for (let i = 0; i < 600; i++) op.update(FIXED_DT);
    const c = new Clock();
    c.paused = true;
    const before = { v: op.vitals, t: op.timeLeft };
    for (let i = 0; i < 1200; i++) {
      const w = c.tick(FIXED_DT);
      if (w > 0) op.update(w);
    }
    expect(op.vitals).toBe(before.v);
    expect(op.timeLeft).toBe(before.t);
  });
});

describe('refresh estimator and frame limiter (ENG-0060/0061)', () => {
  it('estimates common refresh rates', () => {
    for (const hz of [59.94, 75, 120, 144, 165]) {
      const r = new RefreshEstimator();
      // 59.94 vs 60 differ by 0.1%, so only the others get timing noise.
      const noise = hz === 59.94 ? 0 : 0.004;
      for (let i = 0; i < 60; i++) r.sample((1 / hz) * (1 + (i % 2 ? noise : -noise)));
      expect(r.hz).toBe(hz);
    }
  });

  it('a 60 fps cap on a 144 Hz display renders evenly (≤1 vsync jitter)', () => {
    const lim = new FrameLimiter();
    lim.cap = 60;
    const shown: number[] = [];
    for (let i = 0; i < 1440; i++) {
      const now = (i * 1000) / 144;
      if (lim.shouldRender(now, 144)) shown.push(now);
    }
    expect(shown.length).toBeGreaterThan(590);
    expect(shown.length).toBeLessThan(610);
    const gaps = shown.slice(1).map((t, i) => t - shown[i]);
    for (const g of gaps) expect(g).toBeGreaterThan(1000 / 144 - 0.01);
    for (const g of gaps) expect(g).toBeLessThan((3 * 1000) / 144 + 0.01);
  });
});

// ---- Frame-rate independence: DOM-level pointer + key stream → Input → FixedStep → sim.

type Handler = (e: Record<string, unknown>) => void;
function fakeTargets() {
  const handlers = new Map<string, Handler[]>();
  const add = (t: string, fn: Handler) => handlers.set(t, [...(handlers.get(t) ?? []), fn]);
  const el = {
    addEventListener: (t: string, fn: Handler) => add(`el:${t}`, fn),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    setPointerCapture: () => undefined,
  };
  const g = globalThis as unknown as { window?: unknown };
  g.window = { addEventListener: (t: string, fn: Handler) => add(`win:${t}`, fn) };
  const fire = (t: string, e: Record<string, unknown>) => {
    for (const h of handlers.get(t) ?? []) h({ preventDefault: () => undefined, ...e });
  };
  return { el: el as unknown as HTMLCanvasElement, fire };
}

/** A scripted hardware stream: 1 kHz pointer samples with presses, a drag, and key presses. */
function script(ms: number): { t: number; fire: (f: ReturnType<typeof fakeTargets>['fire']) => void }[] {
  const out: { t: number; fire: (f: ReturnType<typeof fakeTargets>['fire']) => void }[] = [];
  for (let t = 1.3; t < ms; t += 1) {
    const x = 640 + Math.sin(t / 97) * 300;
    const y = 400 + Math.cos(t / 61) * 150;
    out.push({ t, fire: (f) => f('el:pointermove', { clientX: x, clientY: y, timeStamp: t }) });
    if (Math.floor(t) % 700 === 100) out.push({ t: t + 0.2, fire: (f) => f('el:pointerdown', { clientX: x, clientY: y, button: 0, timeStamp: t + 0.2, pointerId: 1 }) });
    if (Math.floor(t) % 700 === 450) out.push({ t: t + 0.2, fire: (f) => f('el:pointerup', { clientX: x, clientY: y, button: 0, timeStamp: t + 0.2, pointerId: 1 }) });
    if (Math.floor(t) % 1100 === 300) out.push({ t: t + 0.4, fire: (f) => f('win:keydown', { code: 'Digit2', repeat: false, timeStamp: t + 0.4 }) });
  }
  return out;
}

const TICKS = 700;

function run(fps: number): { trace: string[]; op: Operation } {
  const t = fakeTargets();
  const input = new Input(t.el, 1280, 720);
  const step = new FixedStep();
  const def = allOperations()[0];
  const op = new Operation(def);
  const events = script(6000);
  const trace: string[] = [];
  let k = 0;
  const frameMs = 1000 / fps;
  for (let now = frameMs; now <= 6000; now += frameMs) {
    while (k < events.length && events[k].t <= now) events[k++].fire(t.fire);
    const n = step.advance(frameMs / 1000);
    const ends = stepEndTimes(now, n, FIXED_DT, step.pending);
    for (let i = 0; i < n && trace.length < TICKS; i++) {
      input.beginStep(ends[i]);
      if (input.keyPressed('Digit2')) op.setTool('tongs');
      let prev = { ...input.prev };
      input.path.forEach((p, j) => {
        op.handlePointer({ pos: p, prev, down: input.down, pressed: input.pressed && j === 0, released: input.released && j === input.path.length - 1 }, FIXED_DT / input.path.length);
        prev = { ...p };
      });
      op.update(FIXED_DT);
      trace.push(`${input.pos.x.toFixed(3)},${input.pos.y.toFixed(3)} ${+input.down}${+input.pressed}${+input.released} ${input.path.length} ${[...'' + op.tool]}`);
    }
    input.beginRender();
    input.endFrame();
  }
  return { trace, op };
}

describe('frame-rate independent input and simulation (ENG-0053/0055)', () => {
  it('every tick sees identical input and the operation ends identically at 30/60/144 fps', () => {
    const a = run(30);
    const b = run(60);
    const c = run(144);
    expect(a.trace.length).toBe(TICKS);
    expect(b.trace).toEqual(a.trace);
    expect(c.trace).toEqual(a.trace);
    for (const r of [b, c]) {
      expect(r.op.score).toBe(a.op.score);
      expect(r.op.vitals).toBe(a.op.vitals);
      expect(r.op.counts).toEqual(a.op.counts);
    }
  });
});
