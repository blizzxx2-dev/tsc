/**
 * Bone-setting view (ENG-0273): while a fracture is being set, a translucent vellum anatomy plate
 * lies over the field — the whole bone drawn in iron-gall ink as an anatomist's figure, the breaks
 * picked out in red, and for each loose fragment an alignment guide to its place, coloured by how
 * close it is (cool / good / rough / off, the same tolerances the sim judges by).
 */
import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { angleDiff } from '../surgery/entities';
import { FRACTURE, type Fracture, type Fragment } from '../surgery/ailments/fracture';

export type AlignGrade = 'cool' | 'good' | 'rough' | 'off';


/** How close a fragment sits to its place, by the sim's own tolerances. */
export function alignGrade(f: Fragment): AlignGrade {
  if (f.set) return 'cool';
  const d = dist(f.pos, f.target);
  const a = angleDiff(f.rot, f.targetRot);
  if (d <= FRACTURE.coolPx && a <= FRACTURE.coolDeg) return 'cool';
  if (d <= FRACTURE.goodPx && a <= FRACTURE.goodDeg) return 'good';
  if (d <= FRACTURE.roughPx && a <= FRACTURE.roughDeg) return 'rough';
  return 'off';
}

export const GRADE_INK: Record<AlignGrade, string> = { cool: '#6fd08a', good: '#c8e070', rough: '#f0b050', off: '#e05a48' };

const INK = '#2a1a10';

/** The bone's two ends along its axis (the targets span it), with the epiphyses just beyond. */
export function boneSpan(fr: Fracture): { a: Vec; b: Vec; axis: number } {
  const t = fr.fragments.map((f) => f.target);
  const half = FRACTURE.segLen / 2;
  const ca = Math.cos(fr.axis);
  const sa = Math.sin(fr.axis);
  const first = t[0];
  const last = t[t.length - 1];
  return { a: { x: first.x - ca * half, y: first.y - sa * half }, b: { x: last.x + ca * half, y: last.y + sa * half }, axis: fr.axis };
}

/** The vellum plate: parchment wash, inked bone figure, red breaks and alignment guides. */
export function drawBoneView(g: Gfx, fr: Fracture, t: number, guides: boolean): void {
  const { a, b, axis } = boneSpan(fr);
  const ca = Math.cos(axis);
  const sa = Math.sin(axis);
  const nx = -sa;
  const ny = ca;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const len = dist(a, b);
  // Vellum: a translucent parchment leaf over the site, its edge faintly darker.
  g.ellipse(cx, cy, len * 0.62 + 30, 70, axis, hex('#e8dcc0', 0.3), hex('#b8a47c', 0.1));
  // The bone figure: shaft contours with epiphyseal bulbs, and cross-hatching along the shadow side.
  const w = 11;
  for (const s of [-1, 1]) g.line({ x: a.x + nx * w * s, y: a.y + ny * w * s }, { x: b.x + nx * w * s, y: b.y + ny * w * s }, 1.8, hex(INK, 0.8));
  for (const e of [a, b]) {
    g.arc(e.x, e.y, 17, 1.8, hex(INK, 0.8));
    g.circle(e.x, e.y, 16, hex('#f2e8d0', 0.18));
  }
  const hatch = Math.max(4, Math.floor(len / 9));
  for (let i = 1; i < hatch; i++) {
    const k = i / hatch;
    const p = { x: a.x + (b.x - a.x) * k + nx * w * 0.3, y: a.y + (b.y - a.y) * k + ny * w * 0.3 };
    g.line(p, { x: p.x + nx * w * 0.65 + ca * 4, y: p.y + ny * w * 0.65 + sa * 4 }, 1, hex(INK, 0.45));
  }
  // Breaks: a jagged red line across the bone between each pair of fragments not yet both set.
  const pulse = 0.55 + 0.35 * Math.sin(t * 5);
  for (let i = 1; i < fr.fragments.length; i++) {
    const f0 = fr.fragments[i - 1];
    const f1 = fr.fragments[i];
    if (f0.set && f1.set) continue;
    const m = { x: (f0.target.x + f1.target.x) / 2, y: (f0.target.y + f1.target.y) / 2 };
    const zig: Vec[] = [];
    for (let j = -3; j <= 3; j++) {
      const off = (j % 2 === 0 ? 1 : -1) * 3.5;
      zig.push({ x: m.x + nx * j * 5 + ca * off, y: m.y + ny * j * 5 + sa * off });
    }
    g.polyline(zig, 2.6, hex('#e0301c', pulse));
  }
  if (!guides) return;
  // Alignment guides: a dashed line home, and the rotation still to turn as an arc at the target.
  for (const f of fr.fragments) {
    if (f.set) continue;
    const c = hex(GRADE_INK[alignGrade(f)], 0.85);
    g.dashed([f.pos, f.target], 1.6, c, 6, 5, -t * 20);
    const h = FRACTURE.segLen / 2 - 3;
    g.line({ x: f.target.x - ca * h, y: f.target.y - sa * h }, { x: f.target.x + ca * h, y: f.target.y + sa * h }, 1.2, hex(GRADE_INK[alignGrade(f)], 0.5));
    // angleDiff is in degrees; the arc spans the turn still owed.
    const turn = angleDiff(f.rot, f.targetRot);
    if (turn > 0.5) g.arc(f.target.x, f.target.y, 20, 1.6, c, Math.min(1, turn / 180), f.targetRot);
  }
}
