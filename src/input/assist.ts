import { dist, pointSegment, type Vec } from '../core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Sigil, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../surgery/lauds';
import { Malison, MalisonShard } from '../surgery/malison';
import type { Operation } from '../surgery/operation';
import type { ToolId } from '../surgery/types';

/**
 * Input-side assists. Entities stay pure simulation with their tuned radii; the
 * assists work by describing each entity's interaction zones (read-only) and
 * adjusting the pointer the Operation sees:
 *
 * - Target Size (`hitScale`): a pointer within `r × hitScale` of a zone is pulled
 *   towards it so the entity sees distance `d / hitScale` — exactly equivalent to
 *   multiplying the entity's radius, including trace tolerances.
 * - Gamepad aim assist: slow the virtual cursor near a zone valid for the tool.
 * - Assisted stitching: synthesise crossings as the cursor runs along a wound.
 */

export type ZoneKind =
  /** Tested only on the press (grabs, nicks, lancing). */
  | 'press'
  /** Tested on the press and for the rest of that stroke with `dragR` (incision tracing, antidote hold). */
  | 'trace'
  /** Tested every held frame (drain, sear). */
  | 'hold'
  /** Tested while hovering (the lens). */
  | 'hover';

export interface Zone {
  entity: Entity;
  kind: ZoneKind;
  /** Base radius as tuned in the entity. */
  r: number;
  /** Radius used for the rest of a 'trace' stroke. */
  dragR?: number;
  closest(p: Vec): { q: Vec; d: number };
  /** Extra acceptance rule beyond distance (e.g. an incision must resume at its progress point). */
  accepts?(p: Vec): boolean;
}

const point = (c: () => Vec) => (p: Vec) => {
  const q = c();
  return { q, d: dist(p, q) };
};
const segment = (a: Vec, b: Vec) => (p: Vec) => {
  const { d, t } = pointSegment(p, a, b);
  return { q: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, d };
};

/** Interaction zones for the current tool, read from the live entities. */
export function zonesFor(op: Operation, tool: ToolId): Zone[] {
  const out: Zone[] = [];
  for (const e of op.entities) {
    if (!e.alive) continue;
    if (e.hidden) {
      if (tool === 'lens') out.push({ entity: e, kind: 'hover', r: e instanceof LaudsMalison ? 70 : 60, closest: point(() => e.pos) });
      continue;
    }
    if (e instanceof Incision && tool === 'lancet' && e.state === 'mark') {
      out.push({
        entity: e,
        kind: 'trace',
        r: 22,
        dragR: 34,
        closest: (p) => {
          const pr = e.project(p);
          return { q: e.pointAt(pr.at), d: pr.d };
        },
        accepts: (p) => Math.abs(e.project(p).at - e.progress) <= 30,
      });
    } else if (e instanceof Embedded) {
      if (tool === 'lancet' && e.barbed && e.nicks < 2) out.push({ entity: e, kind: 'press', r: 30, closest: point(() => e.origin) });
      if (tool === 'tongs') out.push({ entity: e, kind: 'press', r: 20, closest: e.spec.len > 0 ? segment(e.handle, e.origin) : point(() => e.pos) });
    } else if (e instanceof Grub || e instanceof SpiderlingGrub) {
      if (tool === 'brand') out.push({ entity: e, kind: 'hold', r: 20, closest: point(() => e.pos) });
      if (tool === 'tongs' && e instanceof Grub) out.push({ entity: e, kind: 'press', r: 18, closest: point(() => e.pos) });
    } else if (e instanceof BloodPool && tool === 'leech') {
      out.push({ entity: e, kind: 'hold', r: e.r + 10, closest: point(() => e.pos) });
    } else if (e instanceof Bubo && tool === 'lancet' && !e.lanced) {
      out.push({ entity: e, kind: 'press', r: e.r + 6, closest: point(() => e.pos) });
    } else if (e instanceof EggSac && tool === 'lancet') {
      out.push({ entity: e, kind: 'press', r: 24, closest: point(() => e.pos) });
    } else if (e instanceof Venom && tool === 'tincture') {
      out.push({ entity: e, kind: 'trace', r: 26, dragR: 30, closest: point(() => e.pos) });
    } else if (e instanceof Burn && tool === 'tongs') {
      for (const f of e.flakes) out.push({ entity: e, kind: 'press', r: 16, closest: point(() => f) });
    } else if (e instanceof Sigil && tool === 'brand') {
      for (const s of e.segs) if (s.burned.some((b) => !b)) out.push({ entity: e, kind: 'hold', r: 14, closest: segment(s.a, s.b) });
    } else if ((e instanceof Malison || e instanceof LaudsMalison) && tool === 'brand') {
      out.push({ entity: e, kind: 'hold', r: e.radius, closest: point(() => e.pos) });
    } else if (e instanceof ChoirVoice && tool === 'brand') {
      out.push({ entity: e, kind: 'hold', r: 22, closest: point(() => e.pos) });
    } else if (e instanceof MalisonShard && tool === 'tongs') {
      out.push({ entity: e, kind: 'press', r: 22, closest: point(() => e.pos) });
    }
  }
  return out;
}

/**
 * Pull `p` towards the best zone so that the zone sees distance d / scale.
 * Returns the adjusted point and the zone used (null if unchanged).
 */
export function magnet(p: Vec, zones: readonly Zone[], scale: number, kinds: readonly ZoneKind[], useDrag = false): { p: Vec; zone: Zone | null } {
  if (scale <= 1) return { p, zone: null };
  let best: { z: Zone; q: Vec; d: number; ratio: number } | null = null;
  for (const z of zones) {
    if (!kinds.includes(z.kind)) continue;
    const r = useDrag && z.dragR ? z.dragR : z.r;
    const { q, d } = z.closest(p);
    if (d > r * scale) continue;
    if (z.accepts && !z.accepts(p)) continue;
    const ratio = d / r;
    if (!best || ratio < best.ratio) best = { z, q, d, ratio };
  }
  if (!best) return { p, zone: null };
  const r = useDrag && best.z.dragR ? best.z.dragR : best.z.r;
  // Already inside the tuned radius: nothing to do.
  if (best.d <= r) return { p, zone: best.z };
  const k = 1 / scale;
  return { p: { x: best.q.x + (p.x - best.q.x) * k, y: best.q.y + (p.y - best.q.y) * k }, zone: best.z };
}

/** Brush-tool widening: extra zero-time samples on a ring so the Salve covers `26 × scale` px. */
export const SALVE_BRUSH = 26;
export function brushRing(p: Vec, scale: number): Vec[] {
  if (scale <= 1) return [];
  const rr = SALVE_BRUSH * (scale - 1);
  const out: Vec[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr });
  }
  return out;
}

export const AIM_SLOW_RADIUS = 30;
export const AIM_SLOW_FACTOR = 0.5;
export const AIM_SNAP_RADIUS = 45;

/** Gamepad cursor speed factor at `p`: halved within 30 px of anything the tool can act on. */
export function aimSlow(p: Vec, zones: readonly Zone[]): number {
  for (const z of zones) if (z.closest(p).d <= AIM_SLOW_RADIUS) return AIM_SLOW_FACTOR;
  return 1;
}

/** With the Lancet, a gamepad press near an incision's progress node snaps onto it. */
export function lancetSnap(op: Operation, p: Vec): Vec | null {
  let best: Vec | null = null;
  let bd = AIM_SNAP_RADIUS;
  for (const e of op.entities) {
    if (!(e instanceof Incision) || !e.alive || e.hidden || e.state !== 'mark') continue;
    const node = e.pointAt(e.progress);
    const d = dist(node, p);
    if (d <= bd) {
      bd = d;
      best = node;
    }
  }
  return best;
}

// ------------------------------------------------------------ assisted stitching

export interface Wound {
  entity: Entity;
  points: Vec[];
  needed: number;
}

/** Open wounds the Gut Thread can close. */
export function woundsFor(op: Operation): Wound[] {
  const out: Wound[] = [];
  for (const e of op.entities) {
    if (!e.alive || e.hidden) continue;
    if (e instanceof Laceration) out.push({ entity: e, points: [e.a, e.b], needed: e.stitch.needed });
    else if (e instanceof Incision && e.state === 'closing' && e.stitch) out.push({ entity: e, points: e.stitch.points, needed: e.stitch.needed });
  }
  return out;
}

function polyLength(pts: Vec[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += dist(pts[i - 1], pts[i]);
  return t;
}

/** Nearest point on a polyline: distance, arc position and the local unit normal. */
export function projectPoly(pts: Vec[], p: Vec): { d: number; at: number; q: Vec; n: Vec } {
  let best = { d: Infinity, at: 0, q: pts[0], n: { x: 0, y: 1 } };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = dist(a, b);
    const { d, t } = pointSegment(p, a, b);
    if (d < best.d) {
      const ux = seg ? (b.x - a.x) / seg : 1;
      const uy = seg ? (b.y - a.y) / seg : 0;
      best = { d, at: acc + t * seg, q: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, n: { x: -uy, y: ux } };
    }
    acc += seg;
  }
  return best;
}

export const STITCH_ASSIST_RANGE = 20;
export const STITCH_ASSIST_AMP = 9;

/**
 * Tracks a held Gut Thread running along a wound and says when to lay a stitch:
 * once on arrival, then every wound-length / needed px of travel along it.
 */
export class StitchAssist {
  private wound: Entity | null = null;
  private lastAt = 0;

  reset(): void {
    this.wound = null;
  }

  /** Returns a crossing (from → to, straddling the wound) to synthesise, or null. */
  step(op: Operation, p: Vec): { from: Vec; to: Vec } | null {
    let pick: { w: Wound; pr: ReturnType<typeof projectPoly> } | null = null;
    for (const w of woundsFor(op)) {
      const pr = projectPoly(w.points, p);
      if (pr.d <= STITCH_ASSIST_RANGE && (!pick || pr.d < pick.pr.d)) pick = { w, pr };
    }
    if (!pick) {
      this.wound = null;
      return null;
    }
    const total = polyLength(pick.w.points);
    // A crossing exactly through a wound end is not a proper intersection; wait until inside it.
    if (pick.pr.at < 3 || pick.pr.at > total - 3) return null;
    const spacing = total / Math.max(1, pick.w.needed);
    const fresh = this.wound !== pick.w.entity;
    if (!fresh && Math.abs(pick.pr.at - this.lastAt) < spacing) return null;
    this.wound = pick.w.entity;
    this.lastAt = pick.pr.at;
    const { q, n } = pick.pr;
    return { from: { x: q.x + n.x * STITCH_ASSIST_AMP, y: q.y + n.y * STITCH_ASSIST_AMP }, to: { x: q.x - n.x * STITCH_ASSIST_AMP, y: q.y - n.y * STITCH_ASSIST_AMP } };
  }
}
