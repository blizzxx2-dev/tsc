/**
 * Teaching phases (GAM-0212): the op that brings in a new mechanic in Chapters III–V opens with a
 * phase the patient cannot die in, so the mechanic can be learned before it can kill. While the
 * phase lasts, vitals never fall below TEACH_FLOOR; the next phase is played for real.
 */
import { Entity } from '../surgery/entity';
import type { Operation, PhaseDef } from '../surgery/operation';

export const TEACH_FLOOR = 35;

/** Holds the vitals floor for the phase it was spawned in, then leaves. */
export class NoFailPhase extends Entity {
  constructor(
    private phase: number,
    readonly floor: number,
  ) {
    super({ x: -9999, y: -9999 });
    this.required = false;
  }
  override hitTest(): boolean {
    return false;
  }
  override update(op: Operation): void {
    if (op.phase !== this.phase) return this.kill();
    if (op.vitals < this.floor) op.vitals = this.floor;
  }
  draw(): void {}
}

export type TeachingPhase = PhaseDef & { teaching: true };

/** Wrap a phase as a no-fail teaching phase. */
export function teach(phase: PhaseDef, floor = TEACH_FLOOR): TeachingPhase {
  return { ...phase, teaching: true, spawn: (op) => [new NoFailPhase(op.phase, floor), ...phase.spawn(op)] };
}

export const isTeaching = (p: PhaseDef): p is TeachingPhase => (p as Partial<TeachingPhase>).teaching === true;
