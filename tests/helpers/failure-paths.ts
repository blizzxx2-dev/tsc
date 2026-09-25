/**
 * Deterministic failure-path drivers shared by the failure goldens (QAT-0054) and the Ch3–5
 * functional passes (QAT-0152..0154): an idle patient, a butcher, a stalling surgeon and the
 * steady bot on a shortened clock (with an optional last-second Litany).
 */
import { FIELD, Operation, type OperationDef } from '../../src/surgery/operation';
import type { Pointer } from '../../src/surgery/types';
import { applyBotEvents, BotDriver, DT } from '../bot';

const SIDE = { x: FIELD.cx + 330, y: FIELD.cy + 20 };
const OFF = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 60 };
const MAX_FRAMES = 900 * 60;

export interface FailureFingerprint {
  via: string;
  status: string;
  lostCause: string;
  lostReason: string;
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
    lostReason: op.lostReason,
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
export function runShortClock(def: OperationDef, factor: number, litanyAt: number | null): FailureFingerprint {
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
export function timerFactor(def: OperationDef): number {
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
