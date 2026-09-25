/** Per-frame input logs for runtime-parity checks: record a bot run, replay it anywhere. */
import type { ReplayFrame } from '../../src/debug/api';
import { stateHash } from '../../src/debug/state';
import { Operation, type OperationDef } from '../../src/surgery/operation';
import { applyBotEvents, BotDriver, type BotOptions } from '../bot';
import { DT } from './sim';

export interface Recording {
  frames: ReplayFrame[];
  op: Operation;
  hash: string;
}

/** Play `def` with the bot, logging every frame's input (empty frames included). */
export function recordBot(def: OperationDef, opts: BotOptions = {}): Recording {
  const op = new Operation(def);
  const bot = new BotDriver(op, opts);
  const frames: ReplayFrame[] = [];
  const max = (opts.maxSeconds ?? 900) * 60;
  while ((op.status === 'intro' || op.status === 'running') && frames.length < max) {
    const events = op.status === 'running' ? bot.tick() : [];
    applyBotEvents(op, events);
    frames.push(
      events.flatMap((e): ReplayFrame =>
        e.kind === 'pointer'
          ? [{ kind: 'pointer', tool: e.tool, select: e.select, ptr: { ...e.ptr, pos: { ...e.ptr.pos }, prev: { ...e.ptr.prev } } }]
          : e.kind === 'litany'
            ? [e]
            : [],
      ),
    );
    op.update(DT);
  }
  return { frames, op, hash: stateHash(op) };
}

/** Re-simulate a log in Node (mirrors DebugApi.replay in the browser). */
export function replayNode(def: OperationDef, frames: ReplayFrame[]): Operation {
  const op = new Operation(def);
  for (const events of frames) {
    for (const ev of events) {
      if (ev.kind === 'litany') op.invokeLitany();
      else {
        if (ev.select) op.setTool(ev.tool);
        op.handlePointer(ev.ptr, DT);
      }
    }
    op.update(DT);
  }
  return op;
}
