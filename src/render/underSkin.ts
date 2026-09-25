/**
 * Under-skin movement (ENG-0265): parasites beneath the tissue raise travelling bulges in the
 * surface layer's swelling channel, so the flesh shader's normal field shows them crawling.
 *
 * - A burrowed grub or tick is one bulge circling its sim position (it stays within the lens's
 *   reach of where the sim keeps it), with a fading trail behind it.
 * - Unseen larvae are a knot of small bulges writhing around theirs.
 * - Everything derives from the entity's id, position and world time: no state, no randomness.
 */
import type { Vec } from '../core/math';
import { Larvae } from '../surgery/ailments/parasites';
import type { Entity } from '../surgery/entity';

export interface Bulge {
  x: number;
  y: number;
  /** Radius, px. */
  r: number;
  /** Swelling height, 0..1 (the surface layer's alpha). */
  h: number;
}

/** How far a burrowed crawler wanders from its sim position, px. */
export const BURROW_WANDER = 14;
const TRAIL = 3;
const TRAIL_LAG = 0.18;

/** Kinds of under-skin mover, by what the entity exposes. */
function moverOf(e: Entity): 'burrower' | 'larvae' | null {
  if (!e.alive || !e.hidden) return null;
  if ((e as { burrowed?: boolean }).burrowed) return 'burrower';
  if (e instanceof Larvae) return 'larvae';
  return null;
}

/** The point a mover's head sits at, `t` seconds in (seeded per id, pinned near `at`). */
export function wanderAt(at: Vec, id: number, t: number, reach = BURROW_WANDER): Vec {
  const k = id * 2.399;
  const a = t * (0.9 + (id % 5) * 0.12) + k;
  return { x: at.x + Math.cos(a) * reach + Math.sin(a * 2.3 + k) * reach * 0.35, y: at.y + Math.sin(a) * reach * 0.8 + Math.cos(a * 1.7) * reach * 0.3 };
}

/** The bulges one entity raises at world time `t` (none for anything above the skin). */
export function bulgesOf(e: Entity, t: number): Bulge[] {
  const kind = moverOf(e);
  if (!kind) return [];
  const out: Bulge[] = [];
  if (kind === 'burrower') {
    // The head, then a trail of shrinking, flattening swellings where it has just been.
    for (let i = 0; i <= TRAIL; i++) {
      const p = wanderAt(e.pos, e.id, t - i * TRAIL_LAG);
      const f = 1 - i / (TRAIL + 1);
      out.push({ x: p.x, y: p.y, r: 9 + 5 * f, h: 0.5 * f });
    }
  } else {
    for (let j = 0; j < 4; j++) {
      const p = wanderAt(e.pos, e.id * 7 + j, t * 1.6, 10 + j * 4);
      out.push({ x: p.x, y: p.y, r: 6, h: 0.22 + 0.08 * Math.sin(t * 5 + j) });
    }
  }
  return out;
}

/** Every bulge under the skin right now. */
export function underSkinBulges(ents: readonly Entity[], t: number): Bulge[] {
  return ents.flatMap((e) => bulgesOf(e, t));
}
