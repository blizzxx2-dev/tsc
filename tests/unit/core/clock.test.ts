/** ENG-0058: hitstop from sim impacts, capped, rate-limited for the Malison and off under Reduced Motion. */
import { describe, expect, it } from 'vitest';
import { bindHitstop, Clock, HITSTOP_CAP_MS, HITSTOP_MS, MALISON_HITSTOP_COOLDOWN } from '../../../src/core/clock';
import { EventBus } from '../../../src/core/events';
import type { SimEvents } from '../../../src/surgery/events';

const TICK = 1 / 120;

/** Ticks until world time advances again. */
function frozenTicks(clock: Clock): number {
  let n = 0;
  while (clock.inHitstop && n < 1000) {
    expect(clock.tick(TICK)).toBe(0);
    n++;
  }
  return n;
}

/** The freeze lasted `ms` (within one tick: the remainder lands on a float boundary). */
function expectFrozenMs(clock: Clock, ms: number): void {
  const n = frozenTicks(clock);
  const ticks = ms / 1000 / TICK;
  expect(n).toBeGreaterThanOrEqual(Math.floor(ticks));
  expect(n).toBeLessThanOrEqual(Math.ceil(ticks) + 1);
}

describe('clock hitstop', () => {
  it('freezes sim and world time for the requested ms, capped at 120', () => {
    const c = new Clock();
    c.hitstop(50);
    expect(c.inHitstop).toBe(true);
    expectFrozenMs(c, 50);
    expect(c.sim).toBe(0);
    expect(c.tick(TICK)).toBeCloseTo(TICK);
    c.hitstop(1000);
    expectFrozenMs(c, HITSTOP_CAP_MS);
  });

  it('is a no-op under Reduced Motion and never shortens a running hitstop', () => {
    const c = new Clock();
    c.reduceMotion = true;
    c.hitstop(60);
    expect(c.inHitstop).toBe(false);
    c.reduceMotion = false;
    c.hitstop(60);
    c.hitstop(10);
    expectFrozenMs(c, 60);
  });
});

describe('bindHitstop', () => {
  it('maps impacts, extractions and Malison lashes to 40–60 ms freezes', () => {
    const c = new Clock();
    const bus = new EventBus<SimEvents>();
    const off = bindHitstop(c, bus);
    bus.emit('impact', { kind: 'harm', amount: 8, pos: { x: 0, y: 0 } });
    expectFrozenMs(c, HITSTOP_MS.harm);
    bus.emit('extract', { cue: 'pluck' });
    expectFrozenMs(c, HITSTOP_MS.extract);
    bus.emit('malisonHit', { pos: { x: 0, y: 0 }, damage: 1 });
    expectFrozenMs(c, HITSTOP_MS.malison);
    for (const ms of Object.values(HITSTOP_MS)) {
      expect(ms).toBeGreaterThanOrEqual(40);
      expect(ms).toBeLessThanOrEqual(60);
    }
    off();
    bus.emit('impact', { kind: 'harm', amount: 8, pos: { x: 0, y: 0 } });
    expect(c.inHitstop).toBe(false);
    expect(bus.size).toBe(0);
  });

  it('rate-limits the Malison, which lashes every tick', () => {
    const c = new Clock();
    const bus = new EventBus<SimEvents>();
    bindHitstop(c, bus);
    const lash = () => bus.emit('malisonHit', { pos: { x: 0, y: 0 }, damage: 45 / 120 });
    lash();
    frozenTicks(c);
    // Still inside the cooldown: no second freeze even after many lashes.
    for (let i = 0; i < 20; i++) {
      c.frame(0.01);
      lash();
    }
    expect(c.inHitstop).toBe(false);
    c.frame(MALISON_HITSTOP_COOLDOWN);
    lash();
    expect(c.inHitstop).toBe(true);
  });

  it('honours Reduced Motion for every source', () => {
    const c = new Clock();
    c.reduceMotion = true;
    const bus = new EventBus<SimEvents>();
    bindHitstop(c, bus);
    bus.emit('impact', { kind: 'harm', amount: 8, pos: { x: 0, y: 0 } });
    bus.emit('malisonHit', { pos: { x: 0, y: 0 }, damage: 1 });
    bus.emit('extract', { cue: 'pluck' });
    expect(c.inHitstop).toBe(false);
  });
});
