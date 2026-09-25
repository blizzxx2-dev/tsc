/**
 * QAT-0051: scoring invariants under random input (fast-check). Random tool/pointer streams are
 * played on every demo operation; after every frame the vitals stay in [0, 99], the score never
 * decreases, the combo never exceeds COOL + GOOD ratings, and the status only moves
 * intro → running → won | lost. (Crash/NaN fuzzing of the input layer stays with INP.)
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../src/content/campaign';
import { FIELD, MAX_VITALS, Operation, type Status } from '../../src/surgery/operation';
import { DT, pointerFrame } from '../helpers/sim';
import type { Vec } from '../../src/core/math';

const ORDER: Record<Status, number> = { intro: 0, running: 1, won: 2, lost: 2 };

interface Gesture {
  tool: number;
  from: Vec;
  to: Vec;
  frames: number;
  down: boolean;
  litany: boolean;
}

const point = fc.record({
  x: fc.double({ min: FIELD.cx - FIELD.rx - 60, max: FIELD.cx + FIELD.rx + 60, noNaN: true }),
  y: fc.double({ min: FIELD.cy - FIELD.ry - 60, max: FIELD.cy + FIELD.ry + 60, noNaN: true }),
});
const gesture: fc.Arbitrary<Gesture> = fc.record({
  tool: fc.nat({ max: 7 }),
  from: point,
  to: point,
  frames: fc.integer({ min: 1, max: 90 }),
  down: fc.boolean(),
  litany: fc.boolean(),
});

function play(def: ReturnType<typeof allOperations>[number], gestures: Gesture[]): void {
  const op = new Operation(def);
  let prev: Vec = { x: FIELD.cx, y: FIELD.cy };
  let wasDown = false;
  let lastScore = op.score;
  let lastStatus: Status = op.status;
  const check = (where: string) => {
    expect(op.vitals, where).toBeGreaterThanOrEqual(0);
    expect(op.vitals, where).toBeLessThanOrEqual(MAX_VITALS);
    expect(Number.isFinite(op.score), where).toBe(true);
    expect(op.score, where).toBeGreaterThanOrEqual(lastScore);
    expect(op.combo, where).toBeLessThanOrEqual(op.counts.cool + op.counts.good);
    expect(ORDER[op.status], where).toBeGreaterThanOrEqual(ORDER[lastStatus]);
    if (lastStatus === 'won' || lastStatus === 'lost') expect(op.status, where).toBe(lastStatus);
    if (op.status === 'running') expect(lastStatus === 'intro' || lastStatus === 'running', where).toBe(true);
    lastScore = op.score;
    lastStatus = op.status;
  };
  // Let the intro play so input lands on live entities.
  for (let i = 0; i < 80; i++) {
    op.update(DT);
    check('intro');
  }
  for (const [gi, g] of gestures.entries()) {
    op.setTool(def.tools[g.tool % def.tools.length]);
    if (g.litany) op.invokeLitany();
    for (let f = 0; f < g.frames; f++) {
      const t = f / Math.max(1, g.frames - 1);
      const pos = { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t };
      const down = g.down && f < g.frames - 1;
      op.handlePointer(pointerFrame(pos, prev, down, wasDown), DT);
      op.update(DT);
      prev = pos;
      wasDown = down;
      check(`${def.id} gesture ${gi} frame ${f}`);
    }
  }
}

describe('scoring invariants under random input', () => {
  for (const def of allOperations()) {
    it(`${def.id}`, () => {
      fc.assert(
        fc.property(fc.array(gesture, { minLength: 5, maxLength: 40 }), (gs) => play(def, gs)),
        { numRuns: Number(process.env.FC_RUNS ?? 25), seed: Number(process.env.FC_SEED ?? 20260925) },
      );
    });
  }
});
