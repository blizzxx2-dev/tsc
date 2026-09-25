/**
 * Hostile-spell residue (ENG-0266): every curse sigil leaves a rune-scar in the flesh under its
 * strokes, an emissive violet line that pulses with world time while the spell holds, and fades
 * over RUNE_FADE_S once the sigil is dispelled.
 */
import type { Vec } from '../core/math';
import { Sigil } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { hex } from './color';
import type { Gfx } from './gfx';

export const RUNE_FADE_S = 2;

type Scar = { segs: { a: Vec; b: Vec }[]; at: number };

export class RuneScars {
  private fading: Scar[] = [];

  /** A sigil was dispelled: its scar fades from now. */
  dispelled(e: Entity, now: number): void {
    if (e instanceof Sigil) this.fading.push({ segs: e.segs.map((s) => ({ a: { ...s.a }, b: { ...s.b } })), at: now });
  }

  get fadingCount(): number {
    return this.fading.length;
  }

  clear(): void {
    this.fading.length = 0;
  }

  /** Pulse 0.55..1 at about 0.8 Hz of world time; held steady for reduced flashing. */
  static pulse(t: number, steady = false): number {
    return steady ? 0.8 : 0.775 + 0.225 * Math.sin(t * 5);
  }

  draw(g: Gfx, live: readonly Entity[], t: number, steady = false): void {
    const k = RuneScars.pulse(t, steady);
    for (const e of live) if (e instanceof Sigil && e.alive && !e.hidden) scar(g, e.segs, k);
    this.fading = this.fading.filter((f) => t - f.at < RUNE_FADE_S);
    for (const f of this.fading) scar(g, f.segs, k * (1 - (t - f.at) / RUNE_FADE_S));
  }
}

function scar(g: Gfx, segs: readonly { a: Vec; b: Vec }[], k: number): void {
  if (k <= 0) return;
  g.setBlend('add');
  for (const s of segs) g.line(s.a, s.b, 9, hex('#7a3ab8', 0.22 * k));
  g.setBlend('alpha');
  for (const s of segs) g.line(s.a, s.b, 2, hex('#e8c8ff', 0.5 * k));
}
