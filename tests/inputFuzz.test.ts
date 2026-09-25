import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { Rng } from '../src/core/math';
import { Harness } from './inputHarness';

/**
 * Input fuzz (INP-0100): random press/move/release/key/wheel/cancel/focus streams
 * for 10 000 frames per operation, through Input → OperationInput → Operation.
 * Never throws, never leaves an entity captured once the stroke has been released,
 * never produces NaN positions.
 */
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'KeyQ', 'KeyE', 'Tab', 'Space', 'ShiftLeft'];
const BUTTONS = ['mouse:0', 'mouse:0', 'mouse:0', 'mouse:1', 'mouse:2', 'mouse:3'];

const finite = (v: { x: number; y: number }) => Number.isFinite(v.x) && Number.isFinite(v.y);

describe('input fuzz: 10 000 random frames per operation', () => {
  for (const def of allOperations()) {
    it(def.id, () => {
      const rng = new Rng(def.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
      const make = () => {
        const h = new Harness(def);
        h.b.prefs.holdMode = rng.next() < 0.5 ? 'toggle' : 'hold';
        h.b.prefs.hitScale = rng.pick([1, 1.25, 1.5] as const);
        h.b.prefs.assistedStitch = rng.pick(['off', 'on'] as const);
        h.hud = (p) => (p.x < 110 && p.y > 100 && p.y < 600 ? rng.pick([def.tools[0], 'consume'] as const) : null);
        return h;
      };
      let h = make();
      let held = new Set<string>();
      let pos = { x: 660, y: 410 };
      for (let f = 0; f < 10_000; f++) {
        const n = rng.int(0, 4);
        for (let i = 0; i < n; i++) {
          const ms = rng.range(0, 16);
          const r = rng.next();
          if (r < 0.45) {
            const jump = rng.next() < 0.03 ? 400 : 40;
            pos = { x: Math.min(1280, Math.max(0, pos.x + rng.range(-jump, jump))), y: Math.min(720, Math.max(0, pos.y + rng.range(-jump, jump))) };
            h.move(pos, ms);
          } else if (r < 0.65) {
            const b = rng.pick(BUTTONS);
            if (held.has(b)) {
              held.delete(b);
              h.up(b, ms);
            } else {
              held.add(b);
              h.down(b, ms);
            }
          } else if (r < 0.8) h.key(rng.pick(KEYS), ms);
          else if (r < 0.9) h.at(ms, { type: 'wheel', code: rng.next() < 0.5 ? 'wheel:up' : 'wheel:down' });
          else if (r < 0.95) {
            h.input.mouse.held.clear();
            for (const b of held) if (b.startsWith('mouse:')) h.up(b, ms, true);
            held.clear();
          } else if (r < 0.97) {
            h.input.focusChange(true, h.t + ms);
            held.clear();
            h.ctl.suspend(h.op);
          }
        }
        h.tick(rng.pick([1 / 30, 1 / 60, 1 / 144, 0.05]));
        if (h.op.status === 'won' || h.op.status === 'lost') {
          // Keep fuzzing a fresh operation until 10 000 frames have been played.
          h = make();
          held = new Set();
          continue;
        }
        if (h.op.status === 'running' && !(h.ctl as unknown as { opDown: boolean }).opDown) expect(h.captured()).toBeNull();
        expect(finite(h.input.pos)).toBe(true);
        expect(Number.isFinite(h.op.vitals)).toBe(true);
        for (const e of h.op.entities) expect(finite(e.pos), e.constructor.name).toBe(true);
      }
    });
  }
});
