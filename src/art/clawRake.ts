/**
 * Claw rakes as one wound (ART-0187): a beast's paw leaves three or four parallel lacerations, and
 * the skin between them is torn too. Parallel claw lacerations lying close together are grouped,
 * and the group gets one shared decal under the individual cuts — a bruised, abraded band with
 * fine scratch lines along the rake — so they read as one blow rather than separate cuts.
 */
import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export interface RakeCut {
  a: Vec;
  b: Vec;
}

/** Cuts closer than this (centre to centre, px) and within 0.35 rad of parallel belong to one rake. */
export const RAKE_GAP = 60;

const mid = (c: RakeCut): Vec => ({ x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 });
const ang = (c: RakeCut): number => Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
const parallel = (p: RakeCut, q: RakeCut): boolean => {
  const d = Math.abs(((ang(p) - ang(q) + Math.PI * 1.5) % Math.PI) - Math.PI / 2);
  return d < 0.35;
};

/** Group cuts into rakes (groups of two or more). */
export function rakeGroups<T extends RakeCut>(cuts: readonly T[]): T[][] {
  const groups: T[][] = [];
  const seen = new Set<T>();
  for (const c of cuts) {
    if (seen.has(c)) continue;
    const g = [c];
    seen.add(c);
    for (let i = 0; i < g.length; i++)
      for (const o of cuts) if (!seen.has(o) && dist(mid(g[i]), mid(o)) < RAKE_GAP && parallel(g[i], o)) {
        g.push(o);
        seen.add(o);
      }
    if (g.length >= 2) groups.push(g);
  }
  return groups;
}

/** The shared decal under one rake; `healed` 0..1 fades it as the cuts are stitched. */
export function clawRakeArt(g: Gfx, group: readonly RakeCut[], healed = 0, seed = 0): void {
  const ms = group.map(mid);
  const cx = ms.reduce((s, m) => s + m.x, 0) / ms.length;
  const cy = ms.reduce((s, m) => s + m.y, 0) / ms.length;
  const a = ang(group[0]);
  const len = Math.max(...group.map((c) => dist(c.a, c.b)));
  const spread = Math.max(...ms.map((m) => Math.abs(-(m.x - cx) * Math.sin(a) + (m.y - cy) * Math.cos(a)))) * 2 + 24;
  const k = 1 - healed * 0.7;
  // Bruised, abraded band: dark-red core, purple-brown edges.
  g.ellipse(cx, cy, len * 0.62, spread * 0.62, a, hex('#6a1a1c', 0.38 * k), hex('#4a2030', 0));
  g.ellipse(cx, cy, len * 0.5, spread * 0.42, a, hex('#9a2a24', 0.3 * k), hex('#9a2a24', 0));
  // Fine scratches along the rake between the cuts: skin scraped by the claw sides.
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let i = 0; i < 9; i++) {
    const h = ((i * 7919 + seed * 31) % 100) / 100 - 0.5;
    const off = h * spread * 0.9;
    const l = len * (0.3 + (((i * 37) % 10) / 10) * 0.45);
    const px = cx - sa * off;
    const py = cy + ca * off;
    g.line({ x: px - ca * l * 0.5, y: py - sa * l * 0.5 }, { x: px + ca * l * 0.5, y: py + sa * l * 0.5 }, 1, hex('#5a0e10', 0.35 * k));
  }
}
