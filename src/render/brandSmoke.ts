/**
 * Cautery smoke (GAM-0051): what the brand is searing sets how much it smokes — bare flesh a wisp,
 * a grub more, a curse-sigil more again, a Malison most — and heavy searing leaves a brief veil
 * of smoke over the field. Purely cosmetic: the sizzle loop (audio director) reads the same
 * material, the scene emits the particles and draws the veil; the simulation never sees it.
 */
import { dist, pointSegment, type Vec } from '../core/math';
import { Grub, Sigil } from '../surgery/entities';
import { ChoirVoice, LaudsMalison } from '../surgery/lauds';
import { Malison } from '../surgery/malison';
import type { Operation } from '../surgery/operation';

/** 0 flesh, 1 grub, 2 curse-sigil, 3 Malison. */
export type BrandMaterial = 0 | 1 | 2 | 3;

/** What the brand at `pos` is searing (the densest thing under it). */
export function brandMaterial(op: Operation, pos: Vec): BrandMaterial {
  let m: BrandMaterial = 0;
  for (const e of op.entities) {
    if (!e.alive || e.hidden) continue;
    if ((e instanceof Malison || e instanceof LaudsMalison) && dist(e.pos, pos) < e.radius) return 3;
    if (e instanceof ChoirVoice && dist(e.pos, pos) < 22) return 3;
    if (e instanceof Sigil && e.segs.some((s) => pointSegment(pos, s.a, s.b).d < 14)) m = 2;
    else if (e instanceof Grub && dist(e.pos, pos) < 20 && m < 1) m = 1;
  }
  return m;
}

/** Smoke puffs per second while searing each material. */
export const SMOKE_PER_S: Readonly<Record<BrandMaterial, number>> = { 0: 3, 1: 8, 2: 14, 3: 22 };
/** How much each puff thickens the veil, and how fast it clears (per second). */
const VEIL_PER_PUFF = 0.035;
const VEIL_CLEAR = 0.6;
export const VEIL_MAX = 0.6;

/** The running smoke state for one operation scene. */
export class BrandSmoke {
  /** 0–VEIL_MAX: how thickly smoke hangs over the field right now. */
  veil = 0;
  private acc = 0;

  /** Advance; returns how many smoke puffs to emit this frame (0 when not searing). */
  update(dt: number, searing: BrandMaterial | null): number {
    this.veil = Math.max(0, this.veil - VEIL_CLEAR * dt);
    if (searing === null) {
      this.acc = 0;
      return 0;
    }
    this.acc += SMOKE_PER_S[searing] * dt;
    const n = Math.floor(this.acc);
    this.acc -= n;
    this.veil = Math.min(VEIL_MAX, this.veil + n * VEIL_PER_PUFF);
    return n;
  }
}
