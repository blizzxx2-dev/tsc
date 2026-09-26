import { dist, type Vec } from '../../core/math';
import { Rot } from '../entities';
import { Entity } from '../entity';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

const TAU = Math.PI * 2;

/**
 * Grave-dirt (CON-0058): what a corpse-eating hound carries on its claws. Hold the leech on it to
 * draw it out; salve over it seals the dirt in — BAD, and a few seconds later it festers into rot.
 */
export const GRAVE_DIRT = { r: 20, leech: 1.2, drain: 0.08, harm: 4, rotR: 24, rotSpread: 0.3, clumps: 6, festerAfter: 5 };

export class GraveDirt extends Entity {
  /** Seconds the leech has drawn on it. */
  drawn = 0;
  /** Seconds since the salve sealed it in (−1: not sealed). */
  sealed = -1;
  noun = 'the grave-dirt';
  readonly clumps: { x: number; y: number; r: number }[] = [];

  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 3;
    for (let i = 0; i < GRAVE_DIRT.clumps; i++) {
      const a = op.rng.range(0, TAU);
      const d = op.rng.range(0, GRAVE_DIRT.r * 0.7);
      this.clumps.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: op.rng.range(3, 6) });
    }
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < GRAVE_DIRT.r + pad;
  }

  override drain(): number {
    return GRAVE_DIRT.drain;
  }

  override wants(): readonly ToolId[] {
    return this.sealed >= 0 ? [] : ['leech'];
  }

  override update(op: Operation, dt: number): void {
    if (this.sealed < 0) return;
    this.sealed += dt;
    if (this.sealed < GRAVE_DIRT.festerAfter) return;
    this.kill();
    op.spawnPenalty(new Rot({ ...this.pos }, GRAVE_DIRT.rotR, GRAVE_DIRT.rotSpread));
    op.sayOnce('grave-dirt-fester', 'There — it’s festering where you sealed it. Clean that rot.', 'danger');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (this.sealed >= 0 || dist(ptr.pos, this.pos) > GRAVE_DIRT.r + op.hitPad) return;
    if (tool === 'salve') {
      this.sealed = 0;
      op.rate('bad', this.pos, 'Dirt sealed in');
      op.harm(GRAVE_DIRT.harm, this.pos);
      op.sayOnce('grave-dirt-sealed', 'You’ve salved grave-dirt into him — it’ll fester. The Leech-Pipe first, next time.', 'danger');
      return;
    }
    if (tool !== 'leech') return;
    this.drawn += dt;
    if (this.drawn >= GRAVE_DIRT.leech) {
      this.kill();
      op.rate('good', this.pos, 'Dirt drawn');
    }
  }
}
