import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { allOperations } from '../src/content/campaign';
import { Operation } from '../src/surgery/operation';
import type { SimEvents } from '../src/surgery/events';
import { playWithBot } from './bot';

describe('per-operation entity ids (ENG-0242)', () => {
  it('ids are identical across two runs of the same seed, even after other operations ran', () => {
    const def = allOperations()[2];
    const ids = () => {
      const op = new Operation(def);
      const seen: number[] = [];
      op.events.on('spawn', ({ entity }) => seen.push(entity.id));
      for (let i = 0; i < 60 * 20; i++) op.update(1 / 60);
      return seen;
    };
    const a = ids();
    playWithBot(allOperations()[0], { maxSeconds: 20 });
    const b = ids();
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(a[0]).toBe(1);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('typed sim event bus (ENG-0243)', () => {
  it('a bot run publishes phase, rate, cue, popup, fx, spawn/death and win events', () => {
    const def = allOperations()[0];
    const seen = new Map<keyof SimEvents, number>();
    const res = playWithBot(def, {
      think: 1,
      onOp: (op) => op.events.onAny((type) => seen.set(type, (seen.get(type) ?? 0) + 1)),
    });
    expect(res.op.status).toBe('won');
    for (const k of ['phase', 'rate', 'cue', 'popup', 'spawn', 'death', 'win', 'say'] as const) expect(seen.get(k), k).toBeGreaterThan(0);
    // Semantic events derived from sound cues, e.g. the incision's cut.
    expect((seen.get('cut') ?? 0) + (seen.get('stitch') ?? 0)).toBeGreaterThan(0);
  });

  it('rate events carry the points actually added to the score', () => {
    const op = new Operation(allOperations()[0]);
    let total = 0;
    op.events.on('rate', (e) => (total += e.points));
    op.rate('cool', { x: 0, y: 0 });
    op.rate('good', { x: 0, y: 0 });
    op.rate('miss', { x: 0, y: 0 });
    expect(total).toBe(op.score);
  });

  it('the bus is typed, supports unsubscribe and counts listeners', () => {
    const bus = new EventBus<{ a: number; b: string }>();
    const got: number[] = [];
    const off = bus.on('a', (n) => got.push(n));
    bus.emit('a', 3);
    off();
    bus.emit('a', 4);
    expect(got).toEqual([3]);
    expect(bus.size).toBe(0);
  });
});
