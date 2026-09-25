/**
 * Operation VFX director: turns simulation state and events into particle emitters (all defined in
 * src/render/fx/emitters.json). Presentation only — it reads the operation and never changes it.
 *
 * - ENG-0133 arterial spray: severe lacerations pulse a jet on each heartbeat, strength ∝ bleed rate;
 *   droplets land as stains (the scene's landing callback).
 * - ENG-0134 cut spatter: lancet strokes and harmful tears burst along the stroke, scaled by severity.
 * - ENG-0135 cautery: white-hot sparks, rising smoke drifting toward the lamp and an ember glow while
 *   the Brand touches tissue.
 * - ENG-0136 hexfire: violet/green flames and sparks, with curse motes drifting toward live Sigils.
 * - ENG-0139 venom mist rising from live Venom (stops when neutralised).
 * - ENG-0140 grub extraction gore: squish burst and twitching segments.
 * - ENG-0141 tincture shimmer at the needle; salve droplets along the stroke.
 * - ENG-0142 Litany dust: gold motes along the star trail and "held time" motes while the Litany holds.
 */
import type { Vec } from '../core/math';
import type { Particles } from '../render/particles';
import { Burn, Grub, Laceration, Sigil, Venom } from '../surgery/entities';
import { FIELD, onBody, type Operation } from '../surgery/operation';
import type { Rating } from '../surgery/types';

/** Laceration drain (vitals/s) from which a wound sprays rather than seeps. */
export const ARTERIAL_DRAIN = 0.5;
/** Spatter particles per rating: a clean cut barely spits, a miss on healthy flesh sprays. */
export const SPATTER: Record<Rating, number> = { cool: 3, good: 6, bad: 14, miss: 24 };

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export interface VfxFrame {
  /** Heartbeat phase 0..1 (0 = systole). */
  beat: number;
  /** Pointer in world coordinates and whether the primary button is held. */
  pointer: Vec;
  down: boolean;
  /** The lamp (smoke drifts toward it). */
  light: Vec;
  /** Points of the Litany star being drawn (empty when not drawing). */
  starTrail: readonly Vec[];
  /** Blood particle multiplier from the gore setting (0 = none). */
  gore: number;
}

export class OperationVfx {
  private lastBeat = 0;
  private prevPtr: Vec | null = null;
  private sprayStep = 0;
  private trailN = 0;
  private litanyOn = false;

  /** `particles` is read each call: the scene replaces its particle pool on restart. */
  constructor(private particles: () => Particles) {}

  private get fx(): Particles {
    return this.particles();
  }

  /** Subscribe to the operation's events (call once per operation instance). */
  listen(op: Operation, gore: () => number): void {
    op.events.on('rate', ({ rating, pos, label }) => {
      if (op.tool === 'lancet' && !/stitch/i.test(label ?? '')) this.spatter(pos, SPATTER[rating] * gore(), rating);
      else if (op.tool === 'tincture') this.fx.burst('tinctureShimmer', pos);
    });
    op.events.on('impact', ({ amount, pos }) => this.spatter(pos, (10 + amount * 2) * gore(), 'miss'));
    op.events.on('death', ({ entity }) => {
      if (entity instanceof Grub) {
        this.fx.burst('grubSquish', entity.pos, Math.round(16 * Math.max(0.3, gore())));
        this.fx.burst('grubSegment', entity.pos);
      }
    });
  }

  /** Direction of the current stroke (radians), or undefined before the pointer has moved. */
  private strokeAngle: number | undefined;

  private spatter(pos: Vec, n: number, rating: Rating): void {
    if (n < 0.5) return;
    const dir = this.strokeAngle;
    // Worse cuts fling harder and wider.
    const hard = rating === 'miss' || rating === 'bad';
    this.fx.burst('spatter', pos, Math.round(n), { dir: dir !== undefined ? dir + Math.PI / 2 : undefined, spread: hard ? 1.1 : 0.5, speed: hard ? 280 : 190 });
    if (dir !== undefined && hard) this.fx.burst('spatter', pos, Math.round(n / 2), { dir: dir - Math.PI / 2, spread: 0.9, speed: 240 });
  }

  /** Per-tick emitters; `dt` is world time (the Litany slows every emitter with the world). */
  update(op: Operation, dt: number, f: VfxFrame): void {
    const fx = this.fx;
    // Stroke direction from pointer motion.
    if (this.prevPtr && dist(this.prevPtr, f.pointer) > 1.5) this.strokeAngle = Math.atan2(f.pointer.y - this.prevPtr.y, f.pointer.x - this.prevPtr.x);
    this.prevPtr = { ...f.pointer };

    // Heartbeat edge: the phase wrapped since last tick.
    const systole = f.beat < this.lastBeat;
    this.lastBeat = f.beat;
    const running = op.status === 'running';

    for (const e of op.entities) {
      if (!e.alive) continue;
      if (e instanceof Laceration && running && f.gore > 0) {
        const rate = e.drain(op);
        if (rate < ARTERIAL_DRAIN) continue;
        // Jet strength ∝ bleed rate (capped so a haemorrhage cannot flood the particle budget).
        const k = Math.min(4, rate / ARTERIAL_DRAIN);
        const along = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
        // The jet leaves from a point along the wound, alternating sides beat to beat.
        const t = 0.3 + 0.4 * ((this.sprayStep * 0.618) % 1);
        const at = { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t };
        const side = this.sprayStep % 2 ? 1 : -1;
        const dir = along + (side * Math.PI) / 2 - 0.35;
        if (systole) {
          this.sprayStep++;
          fx.burst('arterial', at, Math.round(9 * k * f.gore), { dir, speed: 200 + 60 * k });
          fx.burst('arterialMist', at, Math.round(4 * k), { dir });
        } else if (f.beat < 0.18) fx.burst('arterial', at, Math.max(0, Math.round(dt * 90 * k * f.gore)), { dir, speed: 120 + 45 * k });
      } else if (e instanceof Burn && e.source === 'hexfire') {
        fx.emitContinuous('hexFlame', e.pos, dt);
        fx.emitContinuous('hexSpark', e.pos, dt);
        // Curse motes drift from the fire toward the nearest live Sigil.
        let target: Sigil | null = null;
        for (const s of op.entities) if (s instanceof Sigil && s.alive && (!target || dist(s.pos, e.pos) < dist(target.pos, e.pos))) target = s;
        if (target) fx.emitContinuous('curseMote', e.pos, dt, 1, { dir: Math.atan2(target.pos.y - e.pos.y, target.pos.x - e.pos.x) });
      } else if (e instanceof Venom) fx.emitContinuous('venomMist', e.pos, dt);
    }

    // Cautery: the Brand on tissue.
    if (running && op.tool === 'brand' && f.down && onBody(f.pointer)) {
      fx.emitContinuous('searSpark', f.pointer, dt);
      fx.emitContinuous('searEmber', f.pointer, dt);
      // Smoke rises, leaning toward the lamp (the draught the candles draw).
      fx.emitContinuous('searSmoke', f.pointer, dt, 1, { dir: -Math.PI / 2 + Math.sign(f.light.x - f.pointer.x) * 0.5 });
    }
    // Salve droplets along the stroke.
    if (running && op.tool === 'salve' && f.down && onBody(f.pointer)) fx.emitContinuous('salveDrop', f.pointer, dt);

    // Litany: gold motes along the star as it is drawn; suspended motes while the Litany holds.
    if (f.starTrail.length > this.trailN) {
      for (let i = Math.max(1, this.trailN); i < f.starTrail.length; i++) fx.burst('litanyGold', f.starTrail[i], 1);
    }
    this.trailN = f.starTrail.length;
    if (op.litanyTime > 0) {
      this.litanyOn = true;
      fx.emitContinuous('heldMote', { x: FIELD.cx, y: FIELD.cy }, dt);
    } else if (this.litanyOn) {
      this.litanyOn = false;
      fx.expire('heldMote', 0.4);
    }
  }
}
