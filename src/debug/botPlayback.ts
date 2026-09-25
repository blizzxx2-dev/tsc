/**
 * Bot visual playback (GAM-0189): a dev scene that plays an operation with the bot surgeon of the
 * balance tests and draws it with the real operation renderer, so a run can be eyeballed. Reached
 * from the debug console (`botplay <op> [profile] [speed]`) or `?botplay=<op>` in dev/QA builds;
 * never shipped (src/debug is dropped from production bundles).
 */
import type { Game, Scene } from '../core/scene';
import type { Gfx } from '../render/gfx';
import { OperationScene } from '../scenes/operation';
import type { OperationDef } from '../surgery/operation';
import { applyBotEvents, BotDriver, DT, PROFILES, type Profile } from '../../tests/bot';

export const isProfile = (p: string): p is Profile => p in PROFILES;

export class BotPlaybackScene implements Scene {
  readonly scene: OperationScene;
  readonly bot: BotDriver;
  private acc = 0;
  private endT = 0;

  constructor(
    def: OperationDef,
    readonly profile: Profile = 'steady',
    /** Simulation speed multiplier (1 = real time). */
    readonly speed = 1,
    private readonly done: () => void = () => undefined,
  ) {
    this.scene = new OperationScene(
      def,
      () => undefined,
      () => undefined,
    );
    this.scene.enter();
    this.bot = new BotDriver(this.scene.op, { profile });
  }

  get op() {
    return this.scene.op;
  }

  /** Advance the bot and the simulation by fixed steps (the real input is ignored). */
  update(dt: number, _game?: Game): void {
    const op = this.op;
    if (op.status !== 'intro' && op.status !== 'running') {
      this.endT += dt;
      if (this.endT > 3) this.done();
      return;
    }
    this.acc += dt * this.speed;
    for (let guard = 0; this.acc >= DT && guard < 240; guard++) {
      this.acc -= DT;
      applyBotEvents(op, this.bot.tick());
      op.update(DT);
      if (op.status !== 'intro' && op.status !== 'running') break;
    }
  }

  render(g: Gfx, game: Game): void {
    // The real renderer, with the reticle (and hover outlines) following the bot's hand, not the mouse.
    const input = Object.create(game.input, { pos: { value: { ...this.bot.hand } } }) as Game['input'];
    this.scene.render(g, { ...game, input });
  }
}
