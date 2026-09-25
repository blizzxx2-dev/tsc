/**
 * Replay player (ENG-0258): watch a recorded operation back with play/pause, 0.25×–4× speed,
 * scrubbing by keyframes every 5 s, and the controls bar toggled off for a clean view.
 *
 * The recording drives a private operation scene through its own `Input` (so the watcher's own
 * keys work the player, never the surgeon). Keyframes: each 5 s mark stores the frame index and the
 * sim summary seen there; a seek rebuilds the run and fast-forwards (headless, no drawing) to the
 * keyframe, then checks the summary still matches — a drifted replay is reported, not shown wrong.
 */
import { FIXED_DT } from '../core/loop';
import { Input } from '../core/input';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { Replayer, type Recording } from '../input/record';
import type { Gfx } from '../render/gfx';
import { hex } from '../render/color';
import { summarise } from '../surgery/snapshot';
import type { OperationDef } from '../surgery/operation';
import { caps, glass, INK } from '../ui/hudKit';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { OperationScene } from './operation';

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
/** Seconds between keyframes. */
export const KEYFRAME_S = 5;
const KEY_FRAMES = Math.round(KEYFRAME_S / FIXED_DT);

/** Playback state, free of rendering: which frame, how fast, and how many frames each tick advances. */
export class ReplayClock {
  frame = 0;
  playing = true;
  private speedI = REPLAY_SPEEDS.indexOf(1);
  private acc = 0;
  constructor(readonly total: number) {}

  get speed(): number {
    return REPLAY_SPEEDS[this.speedI];
  }
  faster(): void {
    this.speedI = Math.min(REPLAY_SPEEDS.length - 1, this.speedI + 1);
  }
  slower(): void {
    this.speedI = Math.max(0, this.speedI - 1);
  }
  /** Frames to simulate this tick (0.25× advances one frame every fourth tick). */
  step(): number {
    if (!this.playing || this.frame >= this.total) return 0;
    this.acc += this.speed;
    const n = Math.min(Math.floor(this.acc), this.total - this.frame);
    this.acc -= Math.floor(this.acc);
    this.frame += n;
    return n;
  }
  /** Keyframe frame indices (0, 5 s, 10 s, …) within the recording. */
  keyframes(): number[] {
    const out: number[] = [];
    for (let f = 0; f < this.total; f += KEY_FRAMES) out.push(f);
    return out;
  }
  /** The keyframe to seek to from here, `dir` keyframes away (−1 back, +1 forward). */
  seekTarget(dir: number): number {
    const k = Math.floor(this.frame / KEY_FRAMES) + (dir < 0 && this.frame % KEY_FRAMES > KEY_FRAMES / 4 ? 0 : dir);
    return Math.max(0, Math.min(this.total - 1, k * KEY_FRAMES));
  }
}

export class ReplayPlayerScene implements Scene {
  readonly clock: ReplayClock;
  private inner!: OperationScene;
  private input!: Input;
  private proxy!: Game;
  private hud = true;
  /** Sim summaries seen at each keyframe, by frame index (checked again after a seek). */
  private seen = new Map<number, string>();
  drift = false;

  constructor(
    private def: OperationDef,
    private rec: Recording,
    private onExit: () => void,
  ) {
    this.clock = new ReplayClock(rec.frames.length);
  }

  enter(game: Game): void {
    this.build(game);
  }

  /** A fresh run from the first frame. */
  private build(game: Game): void {
    this.input = new Input(null, VIEW_W, VIEW_H, game.input.bindings);
    this.input.replay = new Replayer(this.rec);
    this.proxy = Object.create(game, { input: { value: this.input } }) as Game;
    this.inner = new OperationScene(
      this.def,
      () => undefined,
      () => undefined,
    );
    this.inner.enter();
  }

  /** Simulate one recorded frame. */
  private stepFrame(frame: number): void {
    this.input.beginStep(Infinity, FIXED_DT);
    this.inner.update(FIXED_DT, this.proxy);
    this.input.endFrame();
    if (frame % KEY_FRAMES === 0) {
      const s = JSON.stringify(summarise(this.inner.op));
      const was = this.seen.get(frame);
      if (was === undefined) this.seen.set(frame, s);
      else if (was !== s) this.drift = true;
    }
  }

  /** Jump to a frame: rebuild and fast-forward without drawing. */
  seek(game: Game, frame: number): void {
    this.build(game);
    for (let f = 1; f <= frame; f++) this.stepFrame(f);
    this.clock.frame = frame;
  }

  update(_dt: number, game: Game): void {
    const i = game.input;
    if (i.actPressed('ui.back')) return this.onExit();
    if (i.actPressed('ui.confirm')) this.clock.playing = !this.clock.playing;
    if (i.actPressed('ui.up')) this.clock.faster();
    if (i.actPressed('ui.down')) this.clock.slower();
    if (i.actPressed('vn.hide')) this.hud = !this.hud;
    if (i.actPressed('ui.left')) this.seek(game, this.clock.seekTarget(-1));
    if (i.actPressed('ui.right')) this.seek(game, this.clock.seekTarget(1));
    const from = this.clock.frame;
    const n = this.clock.step();
    for (let k = 1; k <= n; k++) this.stepFrame(from + k);
  }

  render(g: Gfx, _game: Game, alpha = 1): void {
    this.inner.render(g, this.proxy, alpha);
    if (!this.hud) return;
    const bar = { x: 200, y: VIEW_H - 92, w: VIEW_W - 400, h: 64 };
    glass(g, bar);
    const c = this.clock;
    const secs = (f: number) => {
      const s = Math.floor(f * FIXED_DT);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    caps(g, t(c.playing ? 'ui.replay.playing' : 'ui.replay.paused'), bar.x + 20, bar.y + 26, 16, hex(INK.gold));
    caps(g, `${c.speed}×`, bar.x + 20, bar.y + 50, 16, hex(INK.text));
    caps(g, `${secs(c.frame)} / ${secs(c.total)}`, bar.x + bar.w - 20, bar.y + 26, 16, hex(INK.text), 'right');
    if (this.drift) caps(g, t('ui.replay.drift'), bar.x + bar.w - 20, bar.y + 50, 16, hex(INK.blood), 'right');
    else caps(g, t('ui.replay.keys'), bar.x + bar.w - 20, bar.y + 50, 16, hex(INK.dim), 'right');
    // The scrub bar with its keyframe ticks.
    const sx = bar.x + 150;
    const sw = bar.w - 420;
    const sy = bar.y + 32;
    g.rect(sx, sy - 2, sw, 4, hex(INK.faint));
    g.rect(sx, sy - 2, (sw * c.frame) / Math.max(1, c.total), 4, hex(INK.gold));
    for (const k of c.keyframes()) g.rect(sx + (sw * k) / Math.max(1, c.total) - 1, sy - 7, 2, 14, hex(INK.gilt, 0.8));
  }
}
