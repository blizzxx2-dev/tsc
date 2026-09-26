/**
 * GAM-0012: the draw-call trace of every campaign operation, pinned. Moving the drawing out of the
 * simulation must not change a single call: every 15th frame of a steady bot's run, every live
 * entity draws (body, surface and fluid layers) into a recording Gfx, and the trace is hashed.
 * Re-record with UPDATE_GOLDEN=1 only for an intended change in drawing.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { allCampaignOperations } from '../../src/content/campaign';
import type { Entity } from '../../src/surgery/entity';
import type { Operation } from '../../src/surgery/operation';
import type { Gfx } from '../../src/render/gfx';
import { playWithBot } from '../bot';
import { recorder } from '../helpers/drawTrace';

const GOLDEN = 'tests/golden/draw-trace.json';

/** The three layers an entity draws into (one place to change when the drawing moves). */
function drawLayers(g: Gfx, e: Entity, op: Operation): void {
  e.drawSurface(g, op);
  e.drawFluid(g, op);
  e.draw(g, op);
}

it('every campaign operation draws exactly as recorded', { timeout: 600_000 }, () => {
  const out: Record<string, string> = {};
  for (const def of allCampaignOperations()) {
    const { g, log } = recorder();
    let frame = 0;
    playWithBot(def, {
      profile: 'steady',
      seed: def.seed ?? 1,
      botSeed: 1,
      onFrame: (op) => {
        if (frame++ % 15) return;
        for (const e of op.entities) {
          if (!e.alive) continue;
          log.push(`# ${e.constructor.name}`);
          drawLayers(g, e, op);
        }
      },
    });
    out[def.id] = `${log.length}:${createHash('sha1').update(log.join('\n')).digest('hex').slice(0, 16)}`;
  }
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(out, null, 1) + '\n');
  expect(out).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
});
