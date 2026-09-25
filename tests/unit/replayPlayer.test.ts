/** ENG-0258: the replay player — speeds, keyframe scrubbing and a drift check on seek. */
import { describe, expect, it } from 'vitest';
import { Input } from '../../src/core/input';
import type { Game } from '../../src/core/scene';
import { Bindings } from '../../src/input/bindings';
import { RECORDING_FORMAT, RECORDING_VERSION, type Recording } from '../../src/input/record';
import type { InputFrame } from '../../src/input/types';
import { KEYFRAME_S, ReplayClock, ReplayPlayerScene } from '../../src/scenes/replayPlayer';
import { fakeCanvas, fakeGl, installFakeDom } from '../fakegl';
import { defWith } from '../helpers/sim';
import { Laceration } from '../../src/surgery/entities';
import { FIELD } from '../../src/surgery/operation';

describe('replay clock (ENG-0258)', () => {
  it('plays at 0.25×–4×, pauses, and scrubs by 5 s keyframes', () => {
    const c = new ReplayClock(120 * 30);
    expect(c.step()).toBe(1);
    c.faster();
    c.faster();
    expect(c.speed).toBe(4);
    c.faster();
    expect(c.speed).toBe(4);
    expect(c.step()).toBe(4);
    for (let i = 0; i < 4; i++) c.slower();
    expect(c.speed).toBe(0.25);
    const at = c.frame;
    const n = [c.step(), c.step(), c.step(), c.step()].reduce((a, b) => a + b);
    expect(n).toBe(1);
    expect(c.frame).toBe(at + 1);
    c.playing = false;
    expect(c.step()).toBe(0);
    expect(c.keyframes()).toHaveLength(30 / KEYFRAME_S);
    c.frame = 120 * 12;
    expect(c.seekTarget(1)).toBe(120 * 15);
    expect(c.seekTarget(-1)).toBe(120 * 10);
    c.frame = 10;
    expect(c.seekTarget(-1)).toBe(0);
  });
});

describe('replay player scene (ENG-0258)', () => {
  it('replays a recording at speed and seeks back to a keyframe without drifting', async () => {
    installFakeDom();
    const { Gfx } = await import('../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const bindings = new Bindings(null);
    // Record 12 s of an idle surgeon.
    const rec: Recording = { format: RECORDING_FORMAT, version: RECORDING_VERSION, opId: 'test', seed: 1, timerAssist: 1, prefs: bindings.prefs, frames: [] };
    const src = new Input(null, 1280, 720, bindings);
    src.recorder = (f: InputFrame) => rec.frames.push(JSON.parse(JSON.stringify(f)) as InputFrame);
    for (let i = 0; i < 120 * 12; i++) {
      src.beginStep(Infinity, 1 / 120);
      src.endFrame();
    }
    const watcher = new Input(null, 1280, 720, bindings);
    const game = { input: watcher, gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
    const def = defWith(() => [new Laceration({ x: FIELD.cx, y: FIELD.cy }, 0.3, 80, 0.5)]);
    const scene = new ReplayPlayerScene(def, rec, () => undefined);
    scene.enter(game);
    scene.clock.faster(); // 2×
    for (let i = 0; i < 360; i++) scene.update(1 / 120, game);
    expect(scene.clock.frame).toBe(720);
    scene.seek(game, 600);
    expect(scene.clock.frame).toBe(600);
    for (let i = 0; i < 60; i++) scene.update(1 / 120, game);
    expect(scene.drift).toBe(false);
    scene.render(g, game, 1);
  });
});
