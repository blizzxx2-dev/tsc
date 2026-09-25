import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { Input } from '../src/core/input';
import type { Game } from '../src/core/scene';
import { Bindings } from '../src/input/bindings';
import { parseRecording, Recorder, RECORDING_FORMAT } from '../src/input/record';
import { runRecording } from '../src/input/replayRunner';
import { OperationScene } from '../src/scenes/operation';
import { playWithBotThroughInput } from './bot';

const snapshot = (op: OperationScene['op']) => ({ status: op.status, score: op.score, vitals: op.vitals, timeLeft: op.timeLeft, counts: { ...op.counts }, phase: op.phase, litanyUsed: op.litanyUsed });

describe('the bot wins through the real input pipeline (device events → Input → OperationScene)', () => {
  for (const def of allOperations()) {
    it(def.id, () => {
      const input = new Input(null, 1280, 720, new Bindings(null));
      const { scene } = playWithBotThroughInput(def, input);
      expect(scene.op.status, `${def.id} ${scene.op.lostReason}`).toBe('won');
    });
  }
});

describe('input record/replay (INP-0016)', () => {
  it('a recorded session replays to the identical result', () => {
    const def = allOperations()[0];
    const b = new Bindings(null);
    const input = new Input(null, 1280, 720, b);
    const rec = new Recorder();
    rec.begin(def.id, def.seed ?? 1, 1, b.prefs);
    input.recorder = (f) => rec.push(f);
    const { scene } = playWithBotThroughInput(def, input);
    const live = snapshot(scene.op);
    const recording = rec.finish({ status: scene.op.status, score: scene.op.score, vitals: scene.op.vitals, timeLeft: scene.op.timeLeft })!;
    expect(recording.format).toBe(RECORDING_FORMAT);
    expect(recording.frames.length).toBeGreaterThan(100);
    // Round-trip through JSON, as a file would.
    const replayed = runRecording(def, parseRecording(JSON.stringify(recording)));
    expect(snapshot(replayed)).toEqual(live);
    // And again: replays are deterministic.
    expect(snapshot(runRecording(def, recording))).toEqual(live);
  });

  it('rejects files that are not recordings', () => {
    expect(() => parseRecording('{"format":"nope"}')).toThrow();
  });
});

describe('focus-loss auto-pause (INP-0007)', () => {
  it('hidden for 10 s: the operation pauses and the timer does not move', () => {
    const def = allOperations()[0];
    const input = new Input(null, 1280, 720, new Bindings(null));
    const game: Game = { input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: null as unknown as Game['gfx'], go: () => undefined };
    const scene = new OperationScene(
      def,
      () => undefined,
      () => undefined,
    );
    scene.enter();
    let t = 1000;
    const frame = () => {
      t += 1000 / 60;
      input.beginFrame(t, 1 / 60);
      scene.update(1 / 60, game);
      input.endFrame();
    };
    for (let i = 0; i < 120; i++) frame();
    expect(scene.op.status).toBe('running');
    const before = scene.op.timeLeft;
    input.focusChange(true, t + 1); // visibilitychange → hidden
    for (let i = 0; i < 600; i++) frame();
    expect(scene.op.timeLeft).toBe(before);
    // Coming back leaves it paused until the player resumes.
    input.focusChange(false, t + 1);
    for (let i = 0; i < 60; i++) frame();
    expect(scene.op.timeLeft).toBe(before);
    // Pause toggles off with the pause action.
    input.push({ t: t + 1, type: 'down', code: 'key:Escape' });
    frame();
    for (let i = 0; i < 60; i++) frame();
    expect(scene.op.timeLeft).toBeLessThan(before);
  });
});
