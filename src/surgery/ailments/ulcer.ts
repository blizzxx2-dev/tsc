import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { BloodPool, Laceration, Rot, surfDisc } from '../entities';
import { Entity } from '../entity';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const ULCER = {
  rings: 3,
  ringW: 14,
  weepEvery: 5,
  weepR: 14,
  weepGrow: 8,
  /** Salve travel (px) needed per ring. */
  ringWork: 120,
  drain: 0.35,
  spillRot: 6,
  perforateLen: 40,
  spillRotR: 28,
  spillRotSpread: 0.4,
};

/**
 * A weeping ulcer crater. It seeps acid bile: draw that off with the leech-pipe,
 * then salve the crater ring by ring from the outside in. Salving an inner ring
 * first perforates it (BAD, a new wound) and the spill, left undrained for 6 s,
 * rots the neighbouring organ.
 */
export class Ulcer extends Entity {
  /** Rings healed so far, from the outside in. */
  healed = 0;
  private work = 0;
  private weepT = 0;
  private perforatedPress = -1;
  noun = 'the ulcer';

  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
  }

  get radius(): number {
    return ULCER.rings * ULCER.ringW;
  }

  /** Ring index under a point: 0 = outermost. */
  ringAt(p: Vec): number {
    const d = dist(p, this.pos);
    if (d > this.radius) return -1;
    return Math.min(ULCER.rings - 1, Math.floor((this.radius - d) / ULCER.ringW));
  }

  private bile(op: Operation): BloodPool | undefined {
    return op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.alive && e.ichor === 'blackbile' && dist(e.pos, this.pos) < this.radius);
  }

  override wants(op: Operation): readonly ToolId[] {
    return this.bile(op) ? ['leech'] : ['salve'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.radius + pad;
  }

  override drain(): number {
    return ULCER.drain * (1 - this.healed / ULCER.rings);
  }

  override update(op: Operation, dt: number): void {
    this.weepT += dt;
    if (this.weepT < ULCER.weepEvery) return;
    this.weepT = 0;
    const pool = this.bile(op);
    if (pool) pool.grow(ULCER.weepGrow);
    else op.spawn(new BloodPool({ ...this.pos }, ULCER.weepR, 'blackbile'));
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve') return;
    const ring = this.ringAt(ptr.pos);
    if (ring < 0) return;
    if (this.bile(op)) {
      op.sayOnce('ulcer-bile', 'Draw off the bile first — the salve won’t take in acid.');
      return;
    }
    if (ring > this.healed) {
      if (this.perforatedPress === op.pressId) return;
      this.perforatedPress = op.pressId;
      op.rate('bad', ptr.pos, 'Perforated');
      op.harm(3, ptr.pos);
      op.spawnPenalty(new Laceration({ ...ptr.pos }, 0.4, ULCER.perforateLen, 0.6), new Spill({ ...ptr.pos }));
      op.sayOnce('ulcer-order', 'Outside in, Doctor! The centre is paper-thin.', 'danger');
      return;
    }
    if (ring < this.healed || !op.canSalve()) return;
    const step = Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    this.work += step;
    op.useSalve(step / 20);
    if (this.work >= ULCER.ringWork) {
      this.work = 0;
      this.healed++;
      if (this.healed >= ULCER.rings) {
        this.kill();
        op.rate('cool', this.pos, 'Ulcer closed');
      } else op.popup(`Ring ${this.healed} healed`, this.pos, '#bff0c8');
    }
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.radius * 1.2, 0.6, 0.3, 0.1, 0.1);
  }

  draw(g: Gfx, op: Operation): void {
    for (let i = 0; i < ULCER.rings; i++) {
      const r = this.radius - i * ULCER.ringW;
      const done = i < this.healed;
      g.circle(this.pos.x, this.pos.y, r, hex(done ? '#c89888' : i === 0 ? '#8a3a30' : i === 1 ? '#6a2020' : '#3a0a0a', done ? 0.5 : 0.9));
    }
    if (this.healed < ULCER.rings) g.arc(this.pos.x, this.pos.y, this.radius - this.healed * ULCER.ringW - ULCER.ringW / 2, 2, hex('#bff0c8', 0.4 + 0.3 * Math.sin(op.elapsed * 4)));
  }
}

/**
 * Bile spilled through a perforation. Drain it with the leech-pipe within
 * 6 s or the neighbouring organ starts to rot.
 */
export class Spill extends Entity {
  private suck = 0;
  noun = 'the spill';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 5;
  }

  override wants(): readonly ToolId[] {
    return ['leech'];
  }

  override drain(): number {
    return ULCER.drain;
  }

  override update(op: Operation): void {
    if (this.age < ULCER.spillRot) return;
    this.kill();
    op.spawnPenalty(new Rot({ x: this.pos.x + ULCER.perforateLen, y: this.pos.y }, ULCER.spillRotR, ULCER.spillRotSpread));
    op.say('The spill’s reached the gut — it’s rotting!', 'danger');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > 30 + op.hitPad) return;
    this.suck += dt;
    if (this.suck >= 1) {
      this.kill();
      op.cues.push('squelch');
      op.rate('good', this.pos, 'Spill drained');
    }
  }

  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, 26, hex('#304010', 0.8), hex('#304010', 0));
    g.arc(this.pos.x, this.pos.y, 28, 2, hex('#d0c040', 0.8), 1 - this.age / ULCER.spillRot);
  }
}
