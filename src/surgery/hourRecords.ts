/**
 * Replay-verified Hour speedruns (BOS-0176): the fastest clear of each Hour, kept only when the
 * run's own input log, re-simulated headlessly from scratch, reaches the same win in the same
 * time. A run that does not replay to the same result is not recorded.
 */
import type { Operation, OperationDef } from './operation';
import { replay, serialiseLog, takeLog } from './replay';

const STORAGE_NAME = 'suture-and-steel.hours.v1';

export interface HourRecord {
  opId: string;
  /** Seconds of the time limit used. */
  time: number;
  score: number;
  rank: string;
  /** The verified run's input log (serialised), so it can be watched or re-checked. */
  log: string;
}

type Store = Record<string, HourRecord>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_NAME);
    const s = raw ? (JSON.parse(raw) as unknown) : null;
    return s && typeof s === 'object' ? (s as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(STORAGE_NAME, JSON.stringify(s));
  } catch {
    // no storage: the record lasts for this session
  }
}

let cache: Store | null = null;
const store = (): Store => (cache ??= load());

/** Seconds of the limit a run used. */
export const clearTime = (op: Pick<Operation, 'timeLeft'> & { def: Pick<OperationDef, 'timeLimit'> }): number => Math.round((op.def.timeLimit - op.timeLeft) * 100) / 100;

/** Re-simulate the run from its log; the clear time when it wins the same way, else null. */
export function verifyClear(def: OperationDef, op: Operation): number | null {
  if (!op.log || op.status !== 'won') return null;
  const again = replay(def, takeLog(op));
  if (again.status !== 'won' || again.score !== op.score) return null;
  const t = clearTime(again);
  return t === clearTime(op) ? t : null;
}

export type Submit = { verified: false } | { verified: true; time: number; record: boolean };

/** Offer a won Hour for the record: verified by replay, kept when it is the fastest. */
export function submitHourClear(boss: string, op: Operation): Submit {
  const time = verifyClear(op.def, op);
  if (time === null) return { verified: false };
  const s = store();
  const prev = s[boss];
  if (prev && prev.time <= time) return { verified: true, time, record: false };
  s[boss] = { opId: op.def.id, time, score: op.score, rank: op.rank(), log: serialiseLog(takeLog(op)) };
  save(s);
  return { verified: true, time, record: true };
}

export const hourRecord = (boss: string): HourRecord | null => store()[boss] ?? null;

export function resetHourRecords(): void {
  cache = {};
  save(cache);
}
