/**
 * Operation state snapshots (ENG-0249). A snapshot is JSON: the run's input log plus a summary of
 * its state (phase, status, score, vitals, timers, RNG state and every live entity). Restoring
 * re-simulates the log from scratch, which rebuilds every entity with its references intact, then
 * checks the summary matches exactly — a snapshot that does not restore to the same state is
 * refused rather than loaded wrong. Used by the debug "save state / restore state" commands.
 */
import { Operation, type OperationDef } from './operation';
import { replay, takeLog, type InputLog } from './replay';

export interface StateSummary {
  phase: number;
  status: string;
  score: number;
  vitals: number;
  vitals2: number | null;
  timeLeft: number;
  elapsed: number;
  combo: number;
  rng: number;
  /** Live entities in order: class name and position (rounded to 1/100 px). */
  entities: string[];
}

export interface OpSnapshot {
  version: 1;
  opId: string;
  log: InputLog;
  state: StateSummary;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function summarise(op: Operation): StateSummary {
  return {
    phase: op.phase,
    status: op.status,
    score: op.score,
    vitals: r2(op.vitals),
    vitals2: op.vitals2 === null ? null : r2(op.vitals2),
    timeLeft: r2(op.timeLeft),
    elapsed: r2(op.elapsed),
    combo: op.combo,
    rng: op.rng.state,
    entities: op.entities.filter((e) => e.alive).map((e) => `${e.constructor.name}@${r2(e.pos.x)},${r2(e.pos.y)}`),
  };
}

/** Snapshot a recording operation to JSON. */
export function saveState(op: Operation): string {
  const snap: OpSnapshot = { version: 1, opId: op.def.id, log: takeLog(op), state: summarise(op) };
  return JSON.stringify(snap);
}

/** Restore a snapshot onto `def`: re-simulated and verified against the saved summary. */
export function restoreState(def: OperationDef, json: string): Operation {
  const snap = JSON.parse(json) as OpSnapshot;
  if (snap.version !== 1) throw new Error(`unknown snapshot version ${String(snap.version)}`);
  if (snap.opId !== def.id) throw new Error(`snapshot is for ${snap.opId}, not ${def.id}`);
  // The restored run keeps recording, so it can be snapshotted again.
  const op = replay(def, { ...snap.log, opts: { ...snap.log.opts, record: true } });
  const now = summarise(op);
  if (JSON.stringify(now) !== JSON.stringify(snap.state)) throw new Error('snapshot does not restore to the saved state');
  return op;
}

/** Whether an operation can be snapshotted (it must be recording its inputs). */
export const canSnapshot = (op: Operation): boolean => !!op.log && op instanceof Operation;
