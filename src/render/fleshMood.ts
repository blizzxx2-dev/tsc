/**
 * Whole-field moods driven by the patient's state (presentation only):
 * - Anaemia (GAM-0119): as blood volume falls the flesh pales and loses its wet shine.
 * - Frost (GAM-0103): the cold-blue grade and the breath fog follow how much frost is still unthawed.
 */
import type { Gfx } from './gfx';
import { hex } from './color';
import type { Operation } from '../surgery/operation';
import { FrostPatch } from '../surgery/ailments/frost';
import { Gangrene } from '../surgery/ailments/gangrene';
import { InfectionLine } from '../surgery/ailments/infection';
import { WoundFever } from '../surgery/ailments/kilnrows';
import { Bubo, Rot } from '../surgery/entities';

type RGB = [number, number, number];

/** 0 healthy .. 1 exsanguinated, for ops that track blood volume (pallor starts below 85 %). */
export function anaemia(op: Pick<Operation, 'bloodVolume' | 'def'>): number {
  if (!op.def.secondary?.bloodVolume) return 0;
  return Math.max(0, Math.min(1, (85 - op.bloodVolume) / 60));
}

/** A flesh colour washed toward a waxy, bloodless pallor by `a`. */
export function paleFlesh(c: RGB, a: number): RGB {
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const wax: RGB = [l * 1.1 + 0.16, l * 0.98 + 0.13, l * 0.95 + 0.12];
  const k = a * 0.7;
  return [c[0] + (wax[0] - c[0]) * k, c[1] + (wax[1] - c[1]) * k, c[2] + (wax[2] - c[2]) * k];
}

/** Roughness raised by pallor: a bloodless field loses its wet specular. */
export const paleRough = (rough: number, a: number): number => Math.min(0.9, rough + 0.3 * a);

/** Unthawed frost area now, in px² (each patch weighted by how much of it is still frozen). */
export function frostArea(op: Pick<Operation, 'entities'>): number {
  let a = 0;
  for (const e of op.entities) if (e instanceof FrostPatch && e.alive) a += Math.PI * e.radius * e.radius * (1 - e.thaw);
  return a;
}

/** The post-process tint with the cold grade mixed in by `f` (0..1 of the frost still standing). */
export function coldTint(tint: RGB, f: number): RGB {
  const k = Math.max(0, Math.min(1, f)) * 0.8;
  return [tint[0] * (1 - 0.12 * k), tint[1] * (1 - 0.04 * k), tint[2] * (1 + 0.12 * k)];
}

/**
 * Breath fog (GAM-0103): pale plumes drifting up from the bottom edge of the view on a slow
 * breathing cycle, as dense as the frost still on the patient. Reduced Motion holds them still.
 */
export function drawBreathFog(g: Gfx, f: number, t: number, view: { x: number; y: number; w: number; h: number }, still = false): void {
  if (f <= 0.01) return;
  const breath = still ? 0.6 : 0.5 + 0.5 * Math.sin((t / 4) * Math.PI * 2);
  for (let i = 0; i < 7; i++) {
    const drift = still ? 0 : ((t * 12 + i * 37) % 120) - 60;
    const x = view.x + ((i + 0.5) / 7) * view.w + Math.sin(t * 0.3 + i) * 30;
    const y = view.y + view.h - 40 - drift - i * 6;
    const r = 110 + (i % 3) * 40;
    g.circleGrad(x, y, r, hex('#e8f0ff', 0.1 * f * (0.5 + breath * 0.5)), hex('#e8f0ff', 0));
  }
}

/**
 * Fever (ART-0212): 0..1 from the infective ailments alive on the table — buboes and rot burn
 * hottest, a wound fever outright. The flesh pass flushes the field and beads it with sweat.
 */
export function fever(op: Pick<Operation, 'entities'>): number {
  let f = 0;
  for (const e of op.entities) {
    if (!e.alive) continue;
    if (e instanceof WoundFever) f += 0.6;
    else if (e instanceof Bubo) f += 0.22;
    else if (e instanceof Rot || e instanceof Gangrene || e instanceof InfectionLine) f += 0.15;
  }
  return Math.min(1, f);
}
