/**
 * State hashing and the desync detector (ENG-0254). Every 60 simulation ticks the operation's
 * canonical state is hashed (with a hash per live entity). Replaying a recording must reproduce the
 * same sequence; when two runs disagree, `firstDesync` names the first divergent checkpoint tick and
 * the entity (kind and id) whose state differs, or the global field when no entity does.
 */
import type { Entity } from '../surgery/entity';
import { Operation, type OperationDef } from '../surgery/operation';
import type { InputLog } from '../surgery/replay';
import { canonicalState, entityView, stateHash } from './state';

export const HASH_EVERY = 60;

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

export interface Checkpoint {
  /** Simulation ticks (`update` calls) run so far. */
  tick: number;
  hash: string;
  /** `kind#id` → hash of that entity's decisive state. */
  entities: Record<string, string>;
  /** Hash of the operation-level fields (status, vitals, score…), without entities. */
  global: string;
}

const entityKey = (e: Entity) => `${entityView(e).kind}#${e.id}`;

export function checkpoint(op: Operation, tick: number): Checkpoint {
  const entities: Record<string, string> = {};
  for (const e of op.entities) if (e.alive) entities[entityKey(e)] = fnv(JSON.stringify(entityView(e)));
  const full = JSON.parse(canonicalState(op)) as unknown[];
  return { tick, hash: stateHash(op), entities, global: fnv(JSON.stringify(full.slice(0, -1))) };
}

/** Collects a checkpoint every `every` ticks of a live operation: call `tick(op)` after each `op.update`. */
export class HashRecorder {
  readonly checkpoints: Checkpoint[] = [];
  private n = 0;
  constructor(readonly every = HASH_EVERY) {}
  tick(op: Operation): void {
    this.n++;
    if (this.n % this.every === 0) this.checkpoints.push(checkpoint(op, this.n));
  }
}

/** Replay a log headlessly, checkpointing every `every` ticks (exactly where a live `HashRecorder` would). */
export function replayHashes(def: OperationDef, log: InputLog, every = HASH_EVERY): Checkpoint[] {
  if (log.opId !== def.id) throw new Error(`log is for ${log.opId}, not ${def.id}`);
  const rec = new HashRecorder(every);
  const op = new Operation(def, log.opts);
  for (const o of log.ops) {
    replayInto(op, [o]);
    if (o[0] === 'u') rec.tick(op);
  }
  return rec.checkpoints;
}

/** Dispatch logged calls into an operation (the same mapping as surgery/replay.ts). */
function replayInto(op: Operation, ops: InputLog['ops']): Operation {
  for (const o of ops) {
    switch (o[0]) {
      case 'p':
        op.handlePointer({ pos: { x: o[1], y: o[2] }, prev: { x: o[3], y: o[4] }, down: o[5] === 1, pressed: o[6] === 1, released: o[7] === 1 }, o[8]);
        break;
      case 'u':
        op.update(o[1]);
        op.cues.length = 0;
        op.journal.length = 0;
        break;
      case 't':
        op.setTool(o[1]);
        break;
      case 'c':
        op.cycleTool(o[1]);
        break;
      case 'q':
        op.quickSwap();
        break;
      case 'l':
        op.invokeLitany();
        break;
      case 'h':
        op.ilseAssist();
        break;
      case 'w':
        op.wheel(o[1]);
        break;
      case 'k':
        op.cycleTincture();
        break;
      case 'r':
        op.toggleLeechReverse();
        break;
      case 'f':
        op.pinGrip();
        break;
    }
  }
  return op;
}

export interface Desync {
  tick: number;
  /** `kind#id` of the first entity whose state differs (or that exists in only one run), or null. */
  entity: string | null;
  /** What differs: an entity, the operation fields, or a missing checkpoint. */
  what: 'entity' | 'global' | 'length';
}

/** The first checkpoint where two runs disagree, or null when they match. */
export function firstDesync(a: readonly Checkpoint[], b: readonly Checkpoint[]): Desync | null {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i].hash === b[i].hash) continue;
    const keys = [...new Set([...Object.keys(a[i].entities), ...Object.keys(b[i].entities)])].sort((x, y) => Number(x.split('#')[1]) - Number(y.split('#')[1]));
    const ent = keys.find((k) => a[i].entities[k] !== b[i].entities[k]) ?? null;
    return { tick: a[i].tick, entity: ent, what: ent ? 'entity' : 'global' };
  }
  if (a.length !== b.length) return { tick: (a[n] ?? b[n]).tick, entity: null, what: 'length' };
  return null;
}

/** Human-readable report for the dev console / crash report. */
export const describeDesync = (d: Desync | null): string =>
  !d
    ? 'no desync: every checkpoint matches'
    : d.what === 'entity'
      ? `desync at tick ${d.tick}: ${d.entity} diverged first`
      : d.what === 'global'
        ? `desync at tick ${d.tick}: operation state (vitals/score/timers) diverged`
        : `desync at tick ${d.tick}: one run ended early`;
