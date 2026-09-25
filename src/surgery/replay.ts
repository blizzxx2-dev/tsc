import { Operation, type LogOp, type OperationDef, type OperationOptions } from './operation';

/** A recorded operation: the options it ran with and every call into the simulation. */
export interface InputLog {
  version: 1;
  opId: string;
  opts: OperationOptions;
  ops: LogOp[];
}

/** Take the log from an operation created with `{ record: true }`. */
export function takeLog(op: Operation): InputLog {
  if (!op.log) throw new Error('operation was not recording');
  const { record: _r, ...opts } = op.opts;
  return { version: 1, opId: op.def.id, opts, ops: op.log.slice() };
}

/** Re-run a recorded operation headlessly; the result matches the original exactly. */
export function replay(def: OperationDef, log: InputLog): Operation {
  if (log.opId !== def.id) throw new Error(`log is for ${log.opId}, not ${def.id}`);
  const op = new Operation(def, log.opts);
  for (const o of log.ops) {
    switch (o[0]) {
      case 'p':
        op.handlePointer({ pos: { x: o[1], y: o[2] }, prev: { x: o[3], y: o[4] }, down: o[5] === 1, pressed: o[6] === 1, released: o[7] === 1 }, o[8]);
        break;
      case 'u':
        op.update(o[1]);
        op.cues.length = 0;
        op.events.length = 0;
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
    }
  }
  return op;
}

/** Compact JSON for saving a replay (e.g. with a leaderboard submission). */
export const serialiseLog = (log: InputLog): string => JSON.stringify(log);
export const parseLog = (s: string): InputLog => JSON.parse(s) as InputLog;
