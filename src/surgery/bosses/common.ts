import { fxRandom } from '../fxRandom';
import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer } from '../types';

export const TAU = Math.PI * 2;

/** Cosmetic randomness only — never the simulation RNG, so effects can't change outcomes. */
export const fxRange = (lo: number, hi: number): number => lo + fxRandom() * (hi - lo);

/** Step `pos` toward `target` at `speed` px/s; returns the new position. */
export function stepToward(pos: Vec, target: Vec, speed: number, dt: number): Vec {
  const d = dist(pos, target);
  if (d < 1e-6) return { ...target };
  const s = Math.min(d, speed * dt);
  return { x: pos.x + ((target.x - pos.x) / d) * s, y: pos.y + ((target.y - pos.y) / d) * s };
}

/** A seeded point on the body, within a fraction of the field's radii. */
export function randomOnBody(op: Operation, fx = 0.6, fy = 0.5): Vec {
  for (let i = 0; i < 50; i++) {
    const p = { x: FIELD.cx + op.rng.range(-fx, fx) * FIELD.rx, y: FIELD.cy + op.rng.range(-fy, fy) * FIELD.ry };
    if (onBody(p)) return p;
  }
  return { x: FIELD.cx, y: FIELD.cy };
}

/** Total length of a polyline. */
export function pathLength(pts: Vec[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += dist(pts[i - 1], pts[i]);
  return t;
}

/** The point `s` pixels along a polyline (clamped to its ends). */
export function pointAlong(pts: Vec[], s: number): Vec {
  if (s <= 0) return { ...pts[0] };
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (s <= l) {
      const t = l === 0 ? 0 : s / l;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    s -= l;
  }
  return { ...pts[pts.length - 1] };
}

/** Evenly spaced samples along a polyline (used for trace-coverage checks). */
export function samplePath(pts: Vec[], step = 8): Vec[] {
  const total = pathLength(pts);
  const n = Math.max(2, Math.ceil(total / step));
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) out.push(pointAlong(pts, (total * i) / n));
  return out;
}

// ------------------------------------------------------------------ input distortion

/**
 * The input distortions a Malison can lay on the surgeon: torpor (the tools
 * answer late) and heat-haze (the tools land a little off the cursor). One
 * filter per operation composes whatever the living bosses ask for; bosses
 * write `lag`/`haze` every frame they are active and zero them when they die.
 */
export class InputDistortion {
  /** Seconds between the hand moving and the instrument answering. */
  lag = 0;
  /** Pixels of heat-haze displacement (a slow deterministic wobble). */
  haze = 0;
  /** An instrument fouled (e.g. by Prime's ink) and useless until `until` (filter time). */
  fouled: { tool: string; until: number } | null = null;
  private buf: { pos: Vec; down: boolean; t: number }[] = [];
  private now = 0;
  private outDown = false;
  private outPos: Vec | null = null;

  /** Foul an instrument for `seconds`. */
  foul(tool: string, seconds: number): void {
    this.fouled = { tool, until: this.now + seconds };
  }

  isFouled(tool: string): boolean {
    return this.fouled !== null && this.fouled.tool === tool && this.now < this.fouled.until;
  }

  /** The filter for Operation.inputFilter; `tool` is the instrument in hand. */
  apply(ptr: Pointer, dt: number, tool: string): Pointer {
    const out = this.filter(ptr, dt);
    // A fouled instrument does nothing: the press never lands.
    if (this.isFouled(tool) && out.down) return { pos: out.pos, prev: out.pos, down: false, pressed: false, released: out.released };
    return out;
  }

  filter = (ptr: Pointer, dt: number): Pointer => {
    this.buf.push({ pos: { ...ptr.pos }, down: ptr.down, t: this.now });
    const cutoff = this.now - this.lag;
    this.now += dt;
    // Consume buffered frames up to the lagged time, but never skip a press or release.
    let out = this.buf[0];
    let k = 0;
    while (k < this.buf.length && this.buf[k].t <= cutoff + 1e-9) {
      out = this.buf[k];
      k++;
      if (out.down !== this.outDown) break;
    }
    if (k === 0) {
      // Nothing old enough yet: the instrument holds where it was.
      const pos = this.outPos ?? ptr.pos;
      return { pos, prev: pos, down: this.outDown, pressed: false, released: false };
    }
    this.buf.splice(0, k);
    const prev = this.outPos ?? out.pos;
    const pos = this.haze > 0 ? { x: out.pos.x + Math.sin(this.now * 2.3) * this.haze, y: out.pos.y + Math.cos(this.now * 1.7) * this.haze } : out.pos;
    const res: Pointer = { pos, prev, down: out.down, pressed: out.down && !this.outDown, released: !out.down && this.outDown };
    this.outDown = out.down;
    this.outPos = pos;
    return res;
  };
}

/** The longest torpor lag in assisted play (CON-0162), seconds. */
export const TORPOR_ASSIST_CAP = 0.3;

const distortions = new WeakMap<Operation, InputDistortion>();

/** The operation's shared input distortion, installing its filter on first use. */
export function distortion(op: Operation): InputDistortion {
  let d = distortions.get(op);
  if (!d) {
    const dd = new InputDistortion();
    d = dd;
    distortions.set(op, dd);
    op.inputFilter = (ptr, dt) => {
      // Accessibility (CON-0162): with slow tells on, or on Novice, torpor never lags past 0.3 s.
      if (op.assists.slowTells || op.difficulty === 'novice') dd.lag = Math.min(dd.lag, TORPOR_ASSIST_CAP);
      return dd.apply(ptr, dt, op.tool);
    };
  }
  return d;
}

/** Current lag without installing a filter (for HUD tells and the bot). */
export function currentLag(op: Operation): number {
  return distortions.get(op)?.lag ?? 0;
}

// ------------------------------------------------------------------ small shared pieces

/**
 * Silences the operation's sound cues for the rest of the frame. Spawned by a
 * boss during its update; the entity loop reaches it last, so it swallows every
 * cue raised by input and by the other entities, then removes itself.
 */
export class Muffler extends Entity {
  constructor() {
    super({ x: -999, y: -999 });
    this.required = false;
  }
  override update(op: Operation): void {
    op.cues.muteFrame();
    this.kill();
  }
  draw(): void {}
}

/** Detects that the surgeon has just completed a tincture injection (the cooldown jumps up). */
export class InjectionWatch {
  private last = 0;
  check(op: Operation): boolean {
    const now = op.injectCooldown;
    const fired = now > this.last + 0.5;
    this.last = now;
    return fired;
  }
}

/** Boss health ring with phase notches. */
export function drawBossRing(g: Gfx, p: Vec, r: number, frac: number, notches: number[], color = '#b478ff'): void {
  g.arc(p.x, p.y, r, 3, hex(color, 0.75), Math.max(0, frac));
  for (const n of notches) {
    const a = -Math.PI / 2 + TAU * n;
    g.line({ x: p.x + Math.cos(a) * (r - 5), y: p.y + Math.sin(a) * (r - 5) }, { x: p.x + Math.cos(a) * (r + 5), y: p.y + Math.sin(a) * (r + 5) }, 2, hex('#f0e0c0', 0.8));
  }
}

/** A simple hold-the-brand node (Compline's silence nodes, Sext's sun-dials, the Office's hour-sigils). */
export abstract class BrandNode extends Entity {
  heat = 0;
  constructor(
    pos: Vec,
    public holdTime = 0.8,
    public radius = 24,
  ) {
    super(pos);
    this.layer = 5;
  }
  protected abstract broken(op: Operation): void;
  override update(_op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt * 0.4);
    this.branded = false;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: string, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    this.heat += dt;
    if (fxRandom() < dt * 20) op.emit('spark', this.pos, 2);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (this.heat >= this.holdTime) {
      this.kill();
      this.broken(op);
    }
  }
}
