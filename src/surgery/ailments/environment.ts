import { dist, type Vec } from '../../core/math';
import { Coverage } from '../coverage';
import { BloodPool } from '../entities';
import { Entity } from '../entity';
import { ENV_EFFECTS, FIELD, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const RAIN = { every: 5, poolR: 14, spread: 0.6 };

/** Mud in a field wound (CON-0138): salve it clean (80 % of it) before the thread will take. */
export const MUD = { r: 34, clean: 0.8, block: 50, drain: 0.05 };

/**
 * Field Tent in Rain (challenge mutator, and `env: ['rain']`): drips thin the blood into small pools
 * every 5 s. The pools pay nothing — they are weather, not surgery.
 */
export class RainDrips extends Entity {
  private t = 0;
  noun = 'the rain';

  constructor() {
    super({ x: FIELD.cx, y: FIELD.cy - FIELD.ry });
    this.required = false;
    this.layer = -4;
  }

  override hitTest(): boolean {
    return false;
  }

  override update(op: Operation, dt: number): void {
    this.t += dt;
    if (this.t < RAIN.every) return;
    this.t = 0;
    const p = { x: FIELD.cx + op.rng.range(-RAIN.spread, RAIN.spread) * FIELD.rx, y: FIELD.cy + op.rng.range(-RAIN.spread, RAIN.spread) * FIELD.ry };
    op.spawnPenalty(new BloodPool(p, RAIN.poolR));
  }
}

/**
 * Field mud fouling a wound (`env: ['mud']`, CON-0138): nothing within 50 px of it can be stitched
 * until the salve has cleaned it. Cleaned, it is gone.
 */
export class MudSmear extends Entity {
  readonly cov: Coverage;
  noun = 'the mud';
  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
    this.cov = new Coverage(pos, MUD.r);
    this.stitchBlockRadius = MUD.block;
    this.stitchBlockFlag = 'mud';
    this.stitchBlockHint = 'There’s mud in it. Salve it clean first, or you’ll sew the field into him.';
  }
  override wants(): readonly ToolId[] {
    return ['salve'];
  }
  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < MUD.r + pad;
  }
  override drain(): number {
    return MUD.drain;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.cov.contains(ptr.pos, 12)) return;
    this.cov.brush(ptr.pos);
    if (this.cov.fraction >= MUD.clean) {
      this.kill();
      op.rate('good', this.pos, 'Mud cleaned');
    }
  }
}

// The environment's answer to each phase (CON-0139).
ENV_EFFECTS.rain = (op) => (op.entities.some((e) => e.alive && e instanceof RainDrips) ? [] : [new RainDrips()]);
ENV_EFFECTS.mud = (_op, spawned) => spawned.filter((e) => (e as { openWound?: boolean }).openWound === true && e.required).map((e) => new MudSmear({ ...e.pos }));
