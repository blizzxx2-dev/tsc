/**
 * Time attack (GAM-0217): any cleared operation replayed against the clock. The clock runs only
 * while the operation is live (not in the intro, not paused); the fastest clear per op is kept with
 * its vitals trace, which the HUD overlays as a ghost graph on the next attempt.
 */
import type { Operation } from './operation';

/** Seconds between vitals samples of a run (the ghost graph's resolution). */
export const GHOST_STEP = 0.5;
const KEY = 'suture-and-steel.timeattack.v1';

export interface TimeAttackRun {
  /** Clear time in seconds. */
  time: number;
  /** Vitals as a fraction of the maximum, one sample every GHOST_STEP seconds. */
  vitals: number[];
}

type Store = Record<string, TimeAttackRun>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as unknown) : null;
    return s && typeof s === 'object' ? (s as Store) : {};
  } catch {
    return {};
  }
}

function save(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // no storage: the record lasts for this session only
  }
}

let cache: Store | null = null;
const store = (): Store => (cache ??= load());

/** The personal best for an op, if it has been cleared against the clock. */
export function timeAttackBest(opId: string): TimeAttackRun | null {
  const r = store()[opId];
  return r && Number.isFinite(r.time) && Array.isArray(r.vitals) ? r : null;
}

/** Record a finished clear; true when it beats the previous best (or is the first). */
export function recordTimeAttack(opId: string, run: TimeAttackRun): boolean {
  const s = store();
  const prev = s[opId];
  if (prev && prev.time <= run.time) return false;
  s[opId] = { time: Math.round(run.time * 100) / 100, vitals: run.vitals.map((v) => Math.round(v * 1000) / 1000) };
  save(s);
  return true;
}

/** Forget every record (tests, and a future "clear records" option). */
export function resetTimeAttack(): void {
  cache = {};
  save(cache);
}

/** The ghost's vitals fraction `t` seconds into its run (held at its last value after it finished). */
export function ghostAt(run: TimeAttackRun, t: number): number {
  if (!run.vitals.length) return 1;
  const f = Math.max(0, t / GHOST_STEP);
  const i = Math.floor(f);
  if (i >= run.vitals.length - 1) return run.vitals[run.vitals.length - 1];
  return run.vitals[i] + (run.vitals[i + 1] - run.vitals[i]) * (f - i);
}

/** Times the live clear and samples its vitals; advanced by the operation scene each tick. */
export class TimeAttackClock {
  time = 0;
  readonly vitals: number[] = [];

  tick(op: Operation, dt: number): void {
    if (op.status !== 'running') return;
    this.time += dt;
    while (this.vitals.length * GHOST_STEP <= this.time) this.vitals.push(op.vitals / op.maxVitals);
  }

  /** The run as a record (with a final sample at the finish). */
  run(op: Operation): TimeAttackRun {
    return { time: this.time, vitals: [...this.vitals, op.vitals / op.maxVitals] };
  }
}

/** Seconds as m:ss.cc for the time-attack clock. */
export function formatSplit(s: number): string {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const sec = t - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
}
