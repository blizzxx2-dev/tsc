/**
 * Lancet feedback (GAM-0026), all cosmetic: a short blade trail that follows the tip while it
 * cuts, the flesh "parting wet" behind it (a glossy sheen along the stroke that fades), and a
 * 40 ms micro-shake when a lancet stroke is rated BAD.
 */
import type { Vec } from '../core/math';
import { hex } from './color';
import type { Gfx } from './gfx';

/** Seconds the blade trail lingers behind the tip. */
export const TRAIL_SECONDS = 0.15;
/** Seconds the wet sheen of a parting takes to dry. */
export const WET_SECONDS = 0.8;
/** The BAD micro-shake: 40 ms of a couple of pixels. */
export const MICRO_SHAKE_SECONDS = 0.04;
const MICRO_SHAKE_PX = 2.5;

interface Stamp {
  p: Vec;
  t: number;
  /** Over flesh (it parts wet) or in the air (trail only). */
  flesh: boolean;
}

export class BladeFeedback {
  private now = 0;
  private stamps: Stamp[] = [];
  private shakeT = 0;

  /** Advance; `tip` is where the lancet is while it is pressed (null when lifted or another tool). */
  update(dt: number, tip: Vec | null, overFlesh: boolean): void {
    this.now += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (tip) {
      const last = this.stamps[this.stamps.length - 1];
      if (!last || last.p.x !== tip.x || last.p.y !== tip.y) this.stamps.push({ p: { ...tip }, t: this.now, flesh: overFlesh });
    }
    while (this.stamps.length && this.now - this.stamps[0].t > WET_SECONDS) this.stamps.shift();
  }

  /** A lancet stroke was rated BAD: jolt the view for 40 ms. */
  bad(): void {
    this.shakeT = MICRO_SHAKE_SECONDS;
  }

  /** The micro-shake offset for this frame (scaled by the shake slider; zero under Reduced Motion). */
  shakeOffset(scale: number): Vec {
    if (this.shakeT <= 0 || scale <= 0) return { x: 0, y: 0 };
    const k = (this.shakeT / MICRO_SHAKE_SECONDS) * MICRO_SHAKE_PX * scale;
    const phase = this.now * 180;
    return { x: Math.sin(phase) * k, y: Math.cos(phase * 1.3) * k };
  }

  /** Points of the live blade trail (newest last). */
  trail(): Vec[] {
    return this.stamps.filter((s) => this.now - s.t <= TRAIL_SECONDS).map((s) => s.p);
  }

  draw(g: Gfx): void {
    // The wet parting: a glossy line along the flesh the blade opened, drying as it ages.
    for (let i = 1; i < this.stamps.length; i++) {
      const a = this.stamps[i - 1];
      const b = this.stamps[i];
      if (!a.flesh || !b.flesh || b.t - a.t > 0.1) continue;
      const wet = 1 - (this.now - b.t) / WET_SECONDS;
      if (wet <= 0) continue;
      g.line(a.p, b.p, 3, hex('#5a0a10', 0.55 * wet));
      g.line({ x: a.p.x, y: a.p.y - 1 }, { x: b.p.x, y: b.p.y - 1 }, 1, hex('#ffd8d0', 0.5 * wet));
    }
    // The blade trail: a thin steel streak fading behind the tip.
    const tr = this.trail();
    for (let i = 1; i < tr.length; i++) g.line(tr[i - 1], tr[i], 1 + (2 * i) / tr.length, hex('#e8eef4', (0.7 * i) / tr.length));
  }
}
