import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import { FIELD, Operation, type OperationDef } from '../src/surgery/operation';
import type { Pointer } from '../src/surgery/types';
import { applyBotEvents, BotDriver, DT } from './bot';

/**
 * Failure-path goldens (QAT-0054): for every demo operation a seeded loss by vitals and a seeded
 * loss by the timer, plus a last-second Litany replay for the two Malison fights (op1-5 Matins,
 * op2-5 Lauds). Each replay is a deterministic driver, so the decisive end state (cause, score,
 * vitals, time, ratings, phase reached) is regression-tested the same way the win goldens are.
 * Regenerate deliberately with UPDATE_GOLDEN=1 after an intended change.
 *
 * Replays:
 *  - `idle`      — no input at all: the patient drains (or, where nothing drains, the clock runs out);
 *  - `butcher`   — where an idle patient never drains, a surgeon who sears healthy flesh with the
 *                  brand (or slashes it with the lancet) until the patient dies;
 *  - `stall`     — a surgeon who only keeps the patient alive (red tincture whenever it is off
 *                  cooldown and vitals fall below 50) and never works: the clock runs out;
 *  - `short`     — where stalling cannot outlast the drain, the steady bot on a shortened clock
 *                  (`timeLimit × factor`, halved until the time runs out first);
 *  - `litany-1s` — the steady bot on that shortened clock, invoking the Litany when one second is
 *                  left, so the frozen-timer path at the last second is covered.
 */
const FILE = join(__dirname, 'golden/demo-failures.json');
const SIDE = { x: FIELD.cx + 330, y: FIELD.cy + 20 };
const OFF = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 60 };
const MAX_FRAMES = 900 * 60;

export interface FailureFingerprint {
  via: string;
  status: string;
  lostCause: string;
  score: number;
  vitals: number;
  timeLeft: number;
  elapsed: number;
  frames: number;
  phase: number;
  counts: Operation['counts'];
  litanyUses: number;
  maxCombo: number;
}

const live = (op: Operation) => op.status === 'intro' || op.status === 'running';

function summarise(op: Operation, via: string, frames: number): FailureFingerprint {
  return {
    via,
    status: op.status,
    lostCause: op.lostCause,
    score: op.score,
    vitals: Math.round(op.vitals * 1000),
    timeLeft: Math.round(op.timeLeft * 1000),
    elapsed: Math.round(op.elapsed * 1000),
    frames,
    phase: op.phase,
    counts: { ...op.counts },
    litanyUses: op.litanyUses,
    maxCombo: op.maxCombo,
  };
}

/** No input at all until the operation ends (or its clock plus a margin has passed). */
export function runIdle(def: OperationDef): FailureFingerprint {
  const op = new Operation(def);
  let frames = 0;
  while (live(op) && frames < (def.timeLimit + 10) * 60) {
    if (op.dialogue.length) op.advanceDialogue();
    op.update(DT);
    frames++;
  }
  return summarise(op, 'idle', frames);
}

/** Harm the patient on purpose: hold the brand on healthy flesh, or slash it with the lancet. */
export function runButcher(def: OperationDef): FailureFingerprint {
  const op = new Operation(def);
  const brand = def.tools.includes('brand');
  const a = { x: FIELD.cx - 90, y: FIELD.cy + 10 };
  const b = { x: FIELD.cx + 90, y: FIELD.cy + 10 };
  let frames = 0;
  let prev = a;
  let down = false;
  let k = 0;
  while (live(op) && frames < MAX_FRAMES) {
    if (op.dialogue.length) op.advanceDialogue();
    if (op.status === 'running' && !op.paused) {
      if (brand) {
        op.setTool('brand');
        op.handlePointer(ptr(a, a, true, !down, false), DT);
        down = true;
      } else {
        // One 60-frame lancet stroke a → b, then a release, then again.
        op.setTool('lancet');
        const i = k % 70;
        if (i < 60) {
          const pos = { x: a.x + ((b.x - a.x) * i) / 59, y: a.y };
          op.handlePointer(ptr(pos, prev, true, i === 0, false), DT);
          prev = pos;
          down = true;
        } else if (down) {
          op.handlePointer(ptr(prev, prev, false, false, true), DT);
          down = false;
        }
        k++;
      }
    }
    op.update(DT);
    frames++;
  }
  return summarise(op, 'butcher', frames);
}

const ptr = (pos: { x: number; y: number }, prev: { x: number; y: number }, down: boolean, pressed: boolean, released: boolean): Pointer => ({
  pos,
  prev,
  down,
  pressed,
  released,
});

/** Keep the patient alive with the tincture and do nothing else: the timer should run out. */
export function runStall(def: OperationDef): FailureFingerprint {
  const op = new Operation(def);
  const hasTincture = def.tools.includes('tincture');
  let frames = 0;
  let holding = 0;
  let prev = OFF;
  let down = false;
  while (live(op) && frames < MAX_FRAMES) {
    if (op.dialogue.length) op.advanceDialogue();
    if (op.status === 'running' && !op.paused) {
      if (holding <= 0 && hasTincture && op.vitals < 50 && op.injectCooldown === 0) {
        op.setTool('tincture');
        holding = Math.round(0.8 / DT);
      }
      if (holding > 0) {
        op.handlePointer(ptr(SIDE, prev, true, !down, false), DT);
        prev = SIDE;
        down = true;
        holding--;
      } else if (down) {
        op.handlePointer(ptr(SIDE, prev, false, false, true), DT);
        down = false;
      }
    }
    op.update(DT);
    frames++;
  }
  return summarise(op, 'stall', frames);
}

/** The steady bot on a shortened clock; `litanyAt` (seconds left) invokes the Litany once at that mark. */
function runShortClock(def: OperationDef, factor: number, litanyAt: number | null): FailureFingerprint {
  const short: OperationDef = { ...def, timeLimit: Math.max(8, Math.floor(def.timeLimit * factor)) };
  const op = new Operation(short);
  const bot = new BotDriver(op, { profile: 'steady', botSeed: 11 });
  let frames = 0;
  let invoked = false;
  while (live(op) && frames < MAX_FRAMES) {
    if (litanyAt !== null && !invoked && op.status === 'running' && op.timeLeft <= litanyAt) {
      invoked = op.invokeLitany();
    }
    applyBotEvents(op, bot.tick());
    op.update(DT);
    frames++;
  }
  return summarise(op, `${litanyAt === null ? 'short' : 'litany-1s'}×${factor}`, frames);
}

/** The clock factor at which the steady bot runs out of time (halving from 0.5; never below 1/128). */
function timerFactor(def: OperationDef): number {
  for (let f = 0.5; f >= 1 / 128; f /= 2) if (runShortClock(def, f, null).lostCause === 'time') return f;
  throw new Error(`${def.id}: the steady bot cannot be made to run out of time`);
}

export function runVitalsLoss(def: OperationDef): FailureFingerprint {
  const idle = runIdle(def);
  if (idle.lostCause === 'vitals') return idle;
  return runButcher(def);
}

export function runTimerLoss(def: OperationDef): FailureFingerprint {
  const stall = runStall(def);
  if (stall.lostCause === 'time') return stall;
  return runShortClock(def, timerFactor(def), null);
}

export function runLastSecondLitany(def: OperationDef): FailureFingerprint {
  return runShortClock(def, timerFactor(def), 1);
}

const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op as OperationDef] : []));
const BOSSES = ['op1-5', 'op2-5'];

function fingerprints(def: OperationDef): Record<string, FailureFingerprint> {
  const out: Record<string, FailureFingerprint> = { vitals: runVitalsLoss(def), timer: runTimerLoss(def) };
  if (BOSSES.includes(def.id)) out.litany = runLastSecondLitany(def);
  return out;
}

describe('demo failure paths match their golden seeded outcomes', () => {
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
    it('writes the golden file', () => {
      writeFileSync(FILE, JSON.stringify(Object.fromEntries(demoOps.map((d) => [d.id, fingerprints(d)])), null, 1) + '\n');
      expect(existsSync(FILE)).toBe(true);
    });
    return;
  }
  const golden = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Record<string, FailureFingerprint>>;

  it('covers every demo operation with a vitals loss and a timer loss, and both Malison fights with a Litany replay', () => {
    expect(Object.keys(golden).sort()).toEqual(demoOps.map((d) => d.id).sort());
    for (const id of Object.keys(golden)) {
      expect(golden[id].vitals.status, `${id} vitals`).toBe('lost');
      expect(golden[id].vitals.lostCause, `${id} vitals`).toBe('vitals');
      expect(golden[id].timer.status, `${id} timer`).toBe('lost');
      expect(golden[id].timer.lostCause, `${id} timer`).toBe('time');
    }
    for (const id of BOSSES) {
      expect(golden[id].litany.litanyUses, `${id} litany`).toBe(1);
      expect(golden[id].litany.status, `${id} litany`).toMatch(/^(won|lost)$/);
    }
  });

  for (const def of demoOps) {
    it(`${def.id}: loss by vitals`, () => expect(runVitalsLoss(def)).toEqual(golden[def.id].vitals));
    it(`${def.id}: loss by timer`, () => expect(runTimerLoss(def)).toEqual(golden[def.id].timer));
    if (BOSSES.includes(def.id)) it(`${def.id}: last-second Litany`, () => expect(runLastSecondLitany(def)).toEqual(golden[def.id].litany));
  }
});
