/** Drive the operation audio director from a bot replay of an operation. */
import { AudioSystem } from '../../src/audio/system';
import type { EventId } from '../../src/audio/events';
import type { Operation, OperationDef } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

export interface Played {
  t: number;
  id: string;
  params?: Record<string, number>;
}

export interface Replay {
  op: Operation;
  sys: AudioSystem;
  played: Played[];
  cues: { t: number; cue: string; litanyTime: number }[];
}

/** Replay `def` with the bot, feeding every frame to a fresh AudioSystem's director. */
export function replay(def: OperationDef, sys = new AudioSystem(), onFrame?: (t: number, sys: AudioSystem) => void): Replay {
  const played: Played[] = [];
  const cues: Replay['cues'] = [];
  let t = 0;
  const orig = sys.play.bind(sys);
  sys.play = (id: EventId | string, o = {}) => {
    played.push({ t: o.at ?? t, id, params: o.params });
    orig(id, o);
  };
  let phase = 0;
  let wasDown = false;
  const { op } = playWithBot(def, {
    think: 1,
    onFrame: (op, ptr, dt) => {
      t += dt;
      for (const c of op.cues) cues.push({ t, cue: c, litanyTime: op.litanyTime });
      const bpm = op.status === 'lost' ? 0 : 58 + (99 - op.vitals) * 0.9;
      phase = (phase + (dt * op.timeScale * bpm) / 60) % 1;
      const down = ptr?.down ?? false;
      sys.op.frame({
        op,
        dt,
        paused: false,
        beatPhase: phase,
        bpm,
        input: { pos: ptr?.pos ?? { x: 660, y: 410 }, down, pressed: down && !wasDown, released: !down && wasDown, rightDown: false },
        keyPressed: () => false,
      });
      wasDown = down;
      sys.engine.update(dt);
      onFrame?.(t, sys);
    },
  });
  return { op, sys, played, cues };
}
