import { BloodPool } from '../entities';
import { Entity } from '../entity';
import { FIELD, type Operation } from '../operation';

export const RAIN = { every: 5, poolR: 14, spread: 0.6 };

/**
 * Field Tent in Rain (challenge mutator): drips thin the blood into small pools
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

  draw(): void {}
}
