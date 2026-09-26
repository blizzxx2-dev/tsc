import { Input } from '../core/input';
import type { Game } from '../core/scene';
import { settings } from '../core/settings';
import type { Gfx } from '../render/gfx';
import { OperationScene } from '../scenes/operation';
import type { Operation, OperationDef } from '../surgery/operation';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { Bindings } from './bindings';
import { Replayer, type Recording } from './record';

/**
 * Re-drive an operation from a recording without a browser: the real
 * `OperationScene.update` consumes the recorded frames exactly as it did live.
 * Returns the operation in its final state.
 */
export function runRecording(def: OperationDef, rec: Recording): Operation {
  const b = new Bindings(null);
  b.prefs = JSON.parse(JSON.stringify(rec.prefs)) as Bindings['prefs'];
  const input = new Input(null, VIEW_W, VIEW_H, b);
  input.replay = new Replayer(rec);
  const saved = settings.timerAssist;
  settings.timerAssist = rec.timerAssist as typeof settings.timerAssist;
  let ended = false;
  const scene = new OperationScene(
    def,
    () => (ended = true),
    () => (ended = true),
    { seed: rec.seed },
  );
  settings.timerAssist = saved;
  const game: Game = { input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: null as unknown as Gfx, go: () => undefined };
  scene.enter();
  for (;;) {
    input.beginFrame(0);
    if (input.replayEnded || ended) break;
    scene.update(input.frame.dt, game);
    input.endFrame();
  }
  return scene.op;
}

/** Record a scripted frame stream into a Recording (tests and tooling). */
export function makeRecording(def: OperationDef, frames: Recording['frames'], prefs: Bindings['prefs'], timerAssist = 1, seed = def.seed ?? 1): Recording {
  return { format: 'suture-and-steel/input-recording', version: 1, opId: def.id, seed, timerAssist, prefs, frames };
}
