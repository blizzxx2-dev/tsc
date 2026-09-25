/**
 * QAT-0064 input-path parity: the bot's gestures delivered as real Playwright mouse/keyboard events
 * (Input → Pointer conversion in the operation scene) and straight through `handlePointer` in Node
 * give the same rating counts (±1) and outcome on op1-1 and op1-2.
 * QAT-0056 runtime parity (Node ↔ Chromium part): a recorded per-frame input log re-simulated in
 * Chromium hashes identically to Node for every demo operation.
 */
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../src/content/campaign';
import { OP_1_1, OP_1_2 } from '../../src/content/chapter1';
import { stateHash } from '../../src/debug/state';
import { recordBot, replayNode } from '../helpers/replay';
import { playWithMouse, useGame } from './helpers';

describe('input-path parity', () => {
  const game = useGame();

  it.each([
    ['op1-1', OP_1_1],
    ['op1-2', OP_1_2],
  ] as const)('%s: real mouse events and direct handlePointer agree', async (id, def) => {
    const g = game();
    await g.boot();
    await g.api('operation', id);
    await g.step(1);
    const s = await g.key('Enter');
    expect(s.op?.id).toBe(id);
    const run = await playWithMouse(g, def, { think: 0.3 });
    const b = run.browser.op!;
    expect(b.status).toBe(run.mirror.status);
    for (const r of ['cool', 'good', 'bad', 'miss'] as const)
      expect(Math.abs(b.counts[r] - run.mirror.counts[r]), `${id} ${r}: browser ${b.counts[r]} vs direct ${run.mirror.counts[r]}`).toBeLessThanOrEqual(1);
    expect(g.errors).toEqual([]);
  });
});

describe('runtime parity (Node ↔ Chromium)', () => {
  const game = useGame();

  it('every demo operation re-simulates to the same state hash', async () => {
    const g = game();
    await g.boot();
    for (const def of allOperations()) {
      const rec = recordBot(def, { think: 0.5 });
      expect(stateHash(replayNode(def, rec.frames)), `${def.id} node replay`).toBe(rec.hash);
      const chromium = await g.api<{ hash: string; status: string }>('replay', def.id, rec.frames);
      expect(chromium.status, def.id).toBe(rec.op.status);
      expect(chromium.hash, `${def.id} Chromium hash`).toBe(rec.hash);
    }
  });
});
