/**
 * Compline's look (ART-0258, spec in docs/art/vfx/compline.md): the Great Silence greys the world
 * and hatches it like chalk on slate while every sound is muted; stealing the Litany plays the
 * Litany ripple inverted (closing in instead of spreading out); and its death restores the colour
 * with a warm swell. Reads the boss by shape (`muteT`, `litanyStolen`) so the demo build needs no
 * Chapter V import.
 */
import type { Operation } from '../surgery/operation';

interface ComplineLike {
  alive: boolean;
  muteT: number;
  litanyStolen: boolean;
}

const isCompline = (e: unknown): e is ComplineLike => !!e && typeof e === 'object' && 'muteT' in e && 'litanyStolen' in e;

/** Seconds of the inverted ripple, and of the colour's return on death. */
export const INVERT_S = 1.2;
export const RESTORE_S = 2.5;

export class ComplineLook {
  /** 0..1 silence strength (eased in and out). */
  silence = 0;
  private invertT = 99;
  private restoreT = 99;
  private stolenWas = false;
  private seen = false;

  update(op: Operation, dt: number): void {
    const c = (op.entities as unknown[]).find(isCompline);
    if (c) this.seen = true;
    // The boss gone after being seen: its death restores colour.
    if (this.seen && (!c || !c.alive) && this.restoreT > RESTORE_S) {
      this.restoreT = 0;
      this.seen = false;
    }
    const target = c && c.alive && c.muteT > 0 ? 1 : 0;
    this.silence += (target - this.silence) * Math.min(1, dt * (target > this.silence ? 5 : 2));
    if (this.restoreT < RESTORE_S) this.silence = Math.min(this.silence, 1 - this.restoreT / RESTORE_S);
    const stolen = !!c?.litanyStolen;
    if (stolen && !this.stolenWas) this.invertT = 0;
    this.stolenWas = stolen;
    this.invertT += dt;
    this.restoreT += dt;
  }

  /** The inverted Litany ripple while the Litany is being stolen: [strength, ripple age] for POST_FS, or null. */
  invertedLitany(): [number, number] | null {
    if (this.invertT >= INVERT_S) return null;
    const k = this.invertT / INVERT_S;
    // POST_FS puts the ripple front at age × 0.9: running the age backwards pulls the ring inward.
    return [Math.sin(k * Math.PI) * 0.8, 1.1 * (1 - k)];
  }

  /** 0..1 warm colour swell after the death (drives the post pass's victory warmth). */
  get restore(): number {
    return this.restoreT < RESTORE_S ? Math.sin((this.restoreT / RESTORE_S) * Math.PI) : 0;
  }
}
