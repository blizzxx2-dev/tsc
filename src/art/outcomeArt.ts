/**
 * Operation outcome transitions (ART-0292): a won operation leaves through the woodcut page turn
 * (`nextTransitionStyle('page')`, src/ui/transition.ts); a lost one floods with ink from the
 * edges until a Holbein-style Dance-of-Death skeleton, holding up its hourglass, is left standing
 * in bone-white line on the black.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import { EASE } from './timing';

/** Seconds from the loss until the flood covers the view, and when the skeleton starts to show. */
export const FLOOD_START = 0.9;
export const FLOOD_FULL = 2.0;

/** A woodcut skeleton, `h` px tall, standing at (x, foot y), raising an hourglass. `a` = ink alpha. */
export function holbeinSkeleton(g: Gfx, x: number, y: number, h: number, a: number, t = 0): void {
  const u = h / 100;
  const bone = hex(SWATCHES.bone, a);
  const shade = hex(SWATCHES.ash, 0.8 * a);
  const P = (px: number, py: number): Vec => ({ x: x + px * u, y: y - py * u });
  const L = (p: Vec, q: Vec, w = 2.2) => g.line(p, q, w * u * 0.6, bone);
  const sway = Math.sin(t * 2) * 1.5;
  // Skull: cranium, eye sockets, nasal notch and a grinning jaw.
  const head = P(2 + sway * 0.3, 90);
  g.ellipse(head.x, head.y, 7 * u, 8 * u, 0, bone);
  g.ellipse(head.x - 2.6 * u, head.y + 0.5 * u, 2 * u, 2.4 * u, 0, hex(SWATCHES.soot, a));
  g.ellipse(head.x + 2.6 * u, head.y + 0.5 * u, 2 * u, 2.4 * u, 0, hex(SWATCHES.soot, a));
  g.poly([{ x: head.x, y: head.y + 3 * u }, { x: head.x - 1 * u, y: head.y + 5 * u }, { x: head.x + 1 * u, y: head.y + 5 * u }], hex(SWATCHES.soot, a));
  g.rect(head.x - 4 * u, head.y + 6 * u, 8 * u, 3 * u, bone);
  for (let i = -3; i <= 3; i++) g.line({ x: head.x + i * u, y: head.y + 6 * u }, { x: head.x + i * u, y: head.y + 9 * u }, 0.5 * u, hex(SWATCHES.soot, a));
  // Spine and ribcage.
  const neck = P(1, 80);
  const hip = P(0, 45);
  L(neck, hip, 2.4);
  for (let i = 0; i < 6; i++) {
    const ry = 76 - i * 4.5;
    const w = 11 - Math.abs(i - 2) * 1.4;
    g.quadCurve(P(0.5, ry), P(-w, ry - 1), P(-w * 0.8, ry - 4), 1.3 * u * 0.6, bone, 8);
    g.quadCurve(P(0.5, ry), P(w, ry - 1), P(w * 0.8, ry - 4), 1.3 * u * 0.6, bone, 8);
  }
  // Pelvis.
  g.ellipse(hip.x, hip.y, 8 * u, 4.5 * u, 0, shade);
  g.ellipse(hip.x, hip.y, 4 * u, 2.2 * u, 0, hex(SWATCHES.soot, a));
  // Legs mid-stride (the dance).
  const kneeL = P(-7, 24);
  const kneeR = P(8, 26);
  L(P(-4, 44), kneeL);
  L(kneeL, P(-12, 2));
  L(P(4, 44), kneeR);
  L(kneeR, P(14, 4));
  L(P(-12, 2), P(-18, 1), 1.8);
  L(P(14, 4), P(20, 2), 1.8);
  // Arms: the left hangs with a scythe-less open hand, the right raises the hourglass.
  const shL = P(-8, 76);
  const shR = P(9, 76);
  const elL = P(-16, 60);
  L(shL, elL);
  L(elL, P(-20, 45));
  const elR = P(20, 84);
  const handR = P(24 + sway, 100);
  L(shR, elR);
  L(elR, handR);
  // The hourglass, sand running out.
  const gx = handR.x;
  const gy = handR.y - 8 * u;
  g.rect(gx - 5 * u, gy - 9 * u, 10 * u, 1.5 * u, bone);
  g.rect(gx - 5 * u, gy + 7.5 * u, 10 * u, 1.5 * u, bone);
  g.poly([{ x: gx - 4 * u, y: gy - 7.5 * u }, { x: gx + 4 * u, y: gy - 7.5 * u }, { x: gx, y: gy }], shade);
  g.poly([{ x: gx - 4 * u, y: gy + 7.5 * u }, { x: gx + 4 * u, y: gy + 7.5 * u }, { x: gx, y: gy }], shade);
  g.line({ x: gx, y: gy }, { x: gx, y: gy + 6 * u }, 0.6 * u, hex(SWATCHES.gilt, a));
  // Woodcut ground line with hatching.
  g.line(P(-40, 0), P(40, 0), 1.2 * u, bone);
  for (let i = -38; i < 40; i += 4) g.line(P(i, 0), P(i - 3, -3), 0.5 * u, shade);
}

/** The ink flood for a lost operation, `t` seconds after the loss (drawn over the HUD). */
export function inkFlood(g: Gfx, v: { x: number; y: number; w: number; h: number }, t: number, reduceMotion = false): void {
  if (t < FLOOD_START) return;
  const k = Math.min(1, (t - FLOOD_START) / (FLOOD_FULL - FLOOD_START));
  const e = reduceMotion ? 1 : EASE.inCubic(k);
  const ink = hex('#070304', 0.97);
  // Ragged ink tongues creep in from all four edges and meet in the middle.
  const reach = e * 0.62;
  for (let i = 0; i < 24; i++) {
    const u = (i + 0.5) / 24;
    const wob = 1 + 0.25 * Math.sin(i * 2.7);
    g.circleGrad(v.x + u * v.w, v.y, v.h * reach * wob, ink, hex('#070304', 0));
    g.circleGrad(v.x + u * v.w, v.y + v.h, v.h * reach * wob, ink, hex('#070304', 0));
  }
  for (let i = 0; i < 14; i++) {
    const u = (i + 0.5) / 14;
    const wob = 1 + 0.25 * Math.cos(i * 1.9);
    g.circleGrad(v.x, v.y + u * v.h, v.w * reach * 0.7 * wob, ink, hex('#070304', 0));
    g.circleGrad(v.x + v.w, v.y + u * v.h, v.w * reach * 0.7 * wob, ink, hex('#070304', 0));
  }
  g.rect(v.x, v.y, v.w, v.h, hex('#070304', 0.9 * Math.max(0, k - 0.5) * 2));
  // The skeleton surfaces from the ink in the last half.
  const s = Math.max(0, (k - 0.45) / 0.55);
  if (s > 0) holbeinSkeleton(g, v.x + v.w * 0.2, v.y + v.h * 0.85, v.h * 0.6, s, t);
}
