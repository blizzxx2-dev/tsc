/**
 * Saint's Salve film (ENG-0118): a glossy, translucent gel over every cell of a wound the Salve
 * has covered, with a lamp highlight. It holds while the wound is open and fades over
 * FILM_FADE_S once the simulation marks the wound set (the entity leaves the field).
 */
import type { Vec } from '../core/math';
import type { Coverage } from '../surgery/coverage';
import type { Entity } from '../surgery/entity';
import { hex } from './color';
import type { Gfx } from './gfx';

export const FILM_FADE_S = 1.5;

/** The salve coverage an entity carries, if any (burns, buboes, rot, salve-closable cuts). */
export function coverageOf(e: Entity): Coverage | null {
  const c = (e as { cov?: unknown; salve?: unknown }).salve ?? (e as { cov?: unknown }).cov;
  return c && typeof c === 'object' && 'cells' in c ? (c as Coverage) : null;
}

/** Covered cell centres of a coverage, in world space. */
export const filmPoints = (c: Coverage): Vec[] => c.cells.filter((k) => k.done).map((k) => ({ x: c.center.x + k.x, y: c.center.y + k.y }));

export class SalveFilm {
  /** Films of wounds already set, fading out. */
  private fading: { pts: Vec[]; r: number; at: number }[] = [];

  /** A wound left the field: its film starts to fade. */
  set(e: Entity, now: number): void {
    const c = coverageOf(e);
    if (!c) return;
    const pts = filmPoints(c);
    if (pts.length) this.fading.push({ pts, r: c.step * 0.8, at: now });
  }

  get fadingCount(): number {
    return this.fading.length;
  }

  clear(): void {
    this.fading.length = 0;
  }

  draw(g: Gfx, live: readonly Entity[], now: number): void {
    for (const e of live) {
      if (!e.alive) continue;
      const c = coverageOf(e);
      if (c) blobs(g, filmPoints(c), c.step * 0.8, 1);
    }
    this.fading = this.fading.filter((f) => now - f.at < FILM_FADE_S);
    for (const f of this.fading) blobs(g, f.pts, f.r, 1 - (now - f.at) / FILM_FADE_S);
  }
}

function blobs(g: Gfx, pts: readonly Vec[], r: number, a: number): void {
  if (a <= 0) return;
  for (const p of pts) g.circleGrad(p.x, p.y, r * 1.4, hex('#f6efd8', 0.16 * a), hex('#f6efd8', 0));
  // High specular: a sharp lamp glint on every other cell.
  for (let i = 0; i < pts.length; i += 2) g.circle(pts[i].x - r * 0.35, pts[i].y - r * 0.45, Math.max(1.2, r * 0.18), hex('#ffffff', 0.45 * a));
}
