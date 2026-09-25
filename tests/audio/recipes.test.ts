import { describe, expect, it } from 'vitest';
import { ALL_EVENTS, eventDef, type EventId } from '../../src/audio/events';
import { LOOPS, RECIPES } from '../../src/audio/sfx';
import { render, stats } from './offline';

describe('designed sound recipes', () => {
  it('every one-shot event has a recipe and every loop event a loop recipe', () => {
    for (const id of ALL_EVENTS) {
      const d = eventDef(id);
      if (d.alias) continue;
      if (d.loop) expect(LOOPS[id], id).toBeTypeOf('function');
      else expect(RECIPES[id], id).toBeTypeOf('function');
    }
  });

  const oneShots = ALL_EVENTS.filter((id) => !eventDef(id).loop && !eventDef(id).alias);
  for (const id of oneShots) {
    it(`${id} renders audibly, finite and below the ceiling`, async () => {
      const chs = await render((e) => e.play(id as EventId, { at: 0.05, params: { tier: 2, amount: 12, strength: 0.8, rank: 0, step: 3 } }), 4);
      const s = stats(chs);
      expect(s.finite).toBe(true);
      expect(s.peak).toBeGreaterThan(0.003);
      expect(s.peak).toBeLessThan(0.95);
    });
  }

  const loops = ALL_EVENTS.filter((id) => eventDef(id).loop);
  for (const id of loops) {
    it(`${id} loops audibly, finite and below the ceiling`, async () => {
      const chs = await render((e) => {
        const h = e.startLoop(id, { speed: 0.8, dist: 0.8, intensity: 0.8, gate: 1, progress: 0.5, prox: 1, severity: 1, spread: 1, level: 1, urgency: 1, open: 1 });
        expect(h).not.toBeNull();
        // Offline contexts do not advance currentTime before rendering, so grains are scheduled up front.
        for (let t = 0; t < 1; t += 0.1) (h as unknown as { voice: { tick?: (n: number) => void } }).voice.tick?.(t);
      }, 1.2);
      const s = stats(chs, 0, 1);
      expect(s.finite).toBe(true);
      expect(s.peak).toBeGreaterThan(0.001);
      expect(s.peak).toBeLessThan(0.95);
    });
  }
});
