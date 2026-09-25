/**
 * Tissue breathing and heartbeat deformation (ART-0298). Each flesh set has a warp map: how much
 * the field scales on the heartbeat (`u_pulse`, eased like FLESH_FS) and on the breath (the lung
 * shader's `0.5 + 0.5·sin(1.6·t)` cycle), per axis. The flesh shader scales its texture space by it
 * (`u_warp`), and the operation draws the surface, fluid and entity layers through the same
 * transform about the field centre, so ailment sprites ride the tissue instead of sliding over it.
 */
import type { Gfx } from '../render/gfx';

export interface WarpMap {
  /** Fractional growth at peak systole, x and y. */
  beat: [number, number];
  /** Fractional growth at full inspiration, x and y. */
  breath: [number, number];
}

/** Warp maps by FLESH_FS organ kind (0 flesh, 1 heart, 2 lung, 3 gut, 4 liver, 5 brain, 6 bone). */
export const TISSUE_WARP: readonly WarpMap[] = [
  { beat: [0.006, 0.008], breath: [0.003, 0.006] }, // flesh: a faint pulse, the chest rising under it
  { beat: [0.03, 0.035], breath: [0.002, 0.004] }, // heart: a visible systolic squeeze
  { beat: [0.004, 0.005], breath: [0.012, 0.02] }, // lung: breathing dominates
  { beat: [0.004, 0.005], breath: [0.004, 0.006] }, // gut
  { beat: [0.005, 0.006], breath: [0.004, 0.007] }, // liver: pushed by the diaphragm
  { beat: [0.008, 0.008], breath: [0.0, 0.0] }, // brain: pulses, does not breathe
  { beat: [0.0, 0.0], breath: [0.0, 0.0] }, // bone: rigid
];

/** Heartbeat easing shared with FLESH_FS. */
const ease = (p: number): number => p * p * (3 - 2 * p);

/** The warp scale [sx, sy] for organ `kind` at heartbeat `pulse` (0..1) and time `t` (s). */
export function tissueWarp(kind: number, pulse: number, t: number, reduceMotion = false): [number, number] {
  if (reduceMotion) return [1, 1];
  const m = TISSUE_WARP[kind] ?? TISSUE_WARP[0];
  const b = ease(Math.max(0, Math.min(1, pulse)));
  const br = 0.5 + 0.5 * Math.sin(t * 1.6);
  return [1 + m.beat[0] * b + m.breath[0] * br, 1 + m.beat[1] * b + m.breath[1] * br];
}

/** Push the warp as a transform about (cx, cy); pair with `g.restore()`. */
export function pushWarp(g: Gfx, cx: number, cy: number, w: [number, number]): void {
  g.save();
  g.translate(cx, cy);
  g.scale(w[0], w[1]);
  g.translate(-cx, -cy);
}
