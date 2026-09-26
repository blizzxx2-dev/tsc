import type { Vec } from '../core/math';

/**
 * Cosmetic particle effects the simulation asks for (GAM-0012): the operation emits these as
 * events and the renderer's particle system (src/render/particles.ts) draws them.
 */
export type FxKind = 'blood' | 'pus' | 'spark' | 'smoke' | 'mote' | 'gold' | 'dust' | 'curl' | 'knot' | 'suck' | 'leaf' | 'ember';

export interface FxEvent {
  kind: FxKind;
  pos: Vec;
  n: number;
  /** Preferred direction in radians; omitted = radial burst. */
  dir?: number;
  spread?: number;
  speed?: number;
}
