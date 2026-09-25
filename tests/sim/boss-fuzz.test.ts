/**
 * BOS-0177: crash / soft-lock audit. Each Hour's operation is taken to its boss, then played by a
 * random-input fuzz bot (random instruments, strokes, holds, Litany) with the no-fail assist so the
 * fight runs its full length: no exceptions, no NaN positions, no frozen sim. Afterwards the wounds the
 * fuzz opened are cleared and the expert bot takes over the same Hour, in whatever phase and state the
 * fuzz left it, and must still finish it — so no random sequence can leave a phase that cannot be won.
 *
 * Defaults are CI-sized. The release audit runs `BOSS_FUZZ_MINUTES=10 BOSS_FUZZ_SEEDS=20`.
 */
import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../../src/content/campaign';
import { Rng, type Vec } from '../../src/core/math';
import { BOSS_OPS } from '../../src/surgery/bosses/codex';
import { bossPhaseIndex, isHour } from '../../src/surgery/bosses/sheet';
import type { Entity } from '../../src/surgery/entity';
import { FIELD, Operation, Reopened, SimpleBurn, type OperationDef } from '../../src/surgery/operation';
import { BloodPool, Laceration } from '../../src/surgery/entities';
import { TOOL_INFO, type Pointer } from '../../src/surgery/types';
import { applyBotEvents, BotDriver, DT } from '../bot';

const MINUTES = Number(process.env.BOSS_FUZZ_MINUTES ?? 0.5);
const SEEDS = Number(process.env.BOSS_FUZZ_SEEDS ?? 2);
const TOOLS = TOOL_INFO.map((t) => t.id);

/** The Hour on the table. */
const hourOf = (op: Operation): Entity | null => op.entities.find(isHour) ?? null;

function toBoss(def: OperationDef, seed: number): Operation {
  const op = new Operation({ ...def, timeLimit: 100_000 }, { seed, assists: { noFail: true } });
  for (let i = 0; i < 60 * 300 && !hourOf(op); i++) {
    op.update(DT);
    if (!hourOf(op)) for (const e of op.entities) if (e.required && e.alive) e.kill();
  }
  if (!hourOf(op)) throw new Error(`${def.id}: never reached its Hour`);
  return op;
}

const finite = (v: Vec) => Number.isFinite(v.x) && Number.isFinite(v.y);

describe(`boss fuzz: ${MINUTES} min of random input × ${SEEDS} seeds per Hour, then the expert finishes`, () => {
  const ops = allCampaignOperations();
  for (const id of Object.keys(BOSS_OPS)) {
    it(id, { timeout: Math.max(600_000, MINUTES * SEEDS * 30_000) }, () => {
      const def = ops.find((d) => d.id === id)!;
      for (let s = 1; s <= SEEDS; s++) {
        const op = toBoss(def, 9000 + s);
        const rng = new Rng(s * 7919 + id.length);
        let pos: Vec = { x: FIELD.cx, y: FIELD.cy };
        let prev = pos;
        let down = false;
        let frozenFor = 0;
        for (let f = 0; f < MINUTES * 60 * 60 && op.status === 'running'; f++) {
          if (rng.next() < 0.02) op.setTool(rng.pick(TOOLS));
          if (rng.next() < 0.0005) op.invokeLitany();
          if (rng.next() < 0.05) down = !down;
          const jump = rng.next() < 0.01 ? 300 : 12;
          pos = {
            x: Math.max(FIELD.cx - FIELD.rx - 80, Math.min(FIELD.cx + FIELD.rx + 80, pos.x + rng.range(-jump, jump))),
            y: Math.max(FIELD.cy - FIELD.ry - 80, Math.min(FIELD.cy + FIELD.ry + 80, pos.y + rng.range(-jump, jump))),
          };
          const ptr: Pointer = { pos, prev, down, pressed: down && prev === pos, released: false };
          op.handlePointer(ptr, DT);
          prev = pos;
          op.update(DT);
          frozenFor = op.freezeT > 0 ? frozenFor + DT : 0;
          expect(frozenFor, `${id} seed ${s}: frozen`).toBeLessThan(10);
          if (f % 600 === 0) for (const e of op.entities) expect(finite(e.pos), `${id} seed ${s}: ${e.constructor.name} position`).toBe(true);
        }
        expect(Number.isFinite(op.vitals)).toBe(true);
        // Tidy the table (the debug "clear wounds" a QA tester would use), then hand it to the expert:
        // whatever state the fuzz left the Hour in, it can still be finished.
        for (const e of op.entities)
          if (e.alive && (e instanceof Laceration || e instanceof Reopened || e instanceof SimpleBurn || e instanceof BloodPool)) e.kill();
        const bot = new BotDriver(op, { profile: 'expert', botSeed: s });
        for (let f = 0; f < 20 * 60 * 60 && op.status === 'running'; f++) {
          applyBotEvents(op, bot.tick());
          op.update(DT);
        }
        expect(
          op.status,
          `${id} seed ${s}: after the fuzz, phase ${op.phase}, ${hourOf(op) ? `Hour at phase ${bossPhaseIndex(hourOf(op)!)}` : 'Hour gone'}`,
        ).toBe('won');
      }
    });
  }
});
