import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import type { OperationDef } from '../src/surgery/operation';
import { playWithBot } from './bot';

/**
 * Golden outcomes for the demo operations (CON-0001): the serialisable op schema must reproduce the
 * closure-built operations exactly — same entities spawned at the same places, same score, vitals and
 * time for a seeded bot run. Regenerate deliberately with UPDATE_GOLDEN=1 after an intended change.
 */
const FILE = join(__dirname, 'golden/demo-ops.json');

function fingerprint(def: OperationDef): Record<string, unknown> {
  const spawns: string[] = [];
  const { op, frames } = playWithBot(def, {
    think: 1,
    onOp: (o) => o.events.on('spawn', ({ entity }) => spawns.push(`${entity.constructor.name}@${Math.round(entity.pos.x)},${Math.round(entity.pos.y)}`)),
  });
  return { status: op.status, score: op.score, vitals: Math.round(op.vitals * 1000), timeLeft: Math.round(op.timeLeft * 1000), frames, counts: op.counts, spawns };
}

const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));

describe('demo operations match their golden seeded outcomes', () => {
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
    it('writes the golden file', () => {
      writeFileSync(FILE, JSON.stringify(Object.fromEntries(demoOps.map((d) => [d.id, fingerprint(d)]))) + '\n');
    });
    return;
  }
  const golden = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, unknown>;
  for (const def of demoOps) it(def.id, () => expect(fingerprint(def)).toEqual(golden[def.id]));
});
