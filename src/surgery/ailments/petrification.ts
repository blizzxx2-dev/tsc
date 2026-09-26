import { dist, type Vec } from '../../core/math';
import { Coverage } from '../coverage';
import { Entity } from '../entity';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const STONE = {
  advance: 3,
  organHit: 30,
  nodeReach: 12,
  wrongSpread: 10,
  marginTime: 5,
  marginCoverage: 0.8,
  plateR: 26,
  drain: 0.35,
  lensAhead: 20,
  /** How much a stone front's edge may overlap the organ before it strikes. */
  organR: 18,
  /** Simple gestures: seconds the lancet rests on a crack point to chip it (INP-0112). */
  holdChip: 0.3,
};

export interface StonePlate {
  center: Vec;
  /** Crack nodes, to be chipped in order. */
  nodes: Vec[];
  chipped: number;
  /** Plate removed: the living margin beneath must be salved in time. */
  lifted: boolean;
  marginT: number;
  cov: Coverage | null;
  healed: boolean;
}

/**
 * Petrification: stone plates spreading toward a vital organ. Chip each plate
 * by tapping its crack nodes with the lancet in the order shown; a tap off
 * the nodes spreads the stone 10 px (BAD). The flesh under a lifted plate must
 * be salved within 5 s or it turns to stone again. The front creeps 3 px/s
 * toward the organ (the Litany stills it entirely); if it arrives, −30 vitals.
 * The lens shows the true front beneath the skin, ahead of the visible plates.
 */
export class Petrification extends Entity {
  plates: StonePlate[] = [];
  /** Distance of the (true) front from the organ. */
  front: number;
  struck = false;
  noun = 'the stone';
  private holdT = 0;

  constructor(
    pos: Vec,
    op: Operation,
    public organ: Vec,
    plates = 3,
  ) {
    super(pos);
    this.layer = -1;
    for (let i = 0; i < plates; i++) {
      const a = (i / plates) * Math.PI * 2 + op.rng.range(-0.3, 0.3);
      const c = { x: pos.x + Math.cos(a) * STONE.plateR * 1.4, y: pos.y + Math.sin(a) * STONE.plateR * 1.1 };
      const nodes: Vec[] = [];
      const n = 3;
      for (let k = 0; k < n; k++) {
        const b = a + (k - 1) * 0.9 + op.rng.range(-0.15, 0.15);
        nodes.push({ x: c.x + Math.cos(b) * STONE.plateR * 0.6, y: c.y + Math.sin(b) * STONE.plateR * 0.6 });
      }
      this.plates.push({ center: c, nodes, chipped: 0, lifted: false, marginT: 0, cov: null, healed: false });
    }
    this.front = Math.max(0, dist(pos, organ) - STONE.plateR * 2.5);
  }

  override wants(): readonly ToolId[] {
    return this.plates.some((p) => p.lifted && !p.healed) ? ['salve'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.plates.some((pl) => dist(pl.center, p) < STONE.plateR + pad);
  }

  override drain(): number {
    return STONE.drain * this.plates.filter((p) => !p.healed).length;
  }

  override update(op: Operation, dt: number): void {
    // The Litany stills the stone entirely.
    if (op.litanyTime <= 0 && !this.struck) {
      this.front = Math.max(0, this.front - STONE.advance * dt);
      if (this.front <= STONE.organR) {
        this.struck = true;
        op.hurt(STONE.organHit, this.organ);
        op.say('The stone has reached his heart!', 'danger');
      }
    }
    for (const p of this.plates) {
      if (!p.lifted || p.healed) continue;
      p.marginT += dt;
      if (p.marginT > STONE.marginTime) {
        // Too slow: the raw margin hardens again.
        p.lifted = false;
        p.chipped = 0;
        p.marginT = 0;
        p.cov = null;
        op.popup('It re-stones!', p.center, '#b0b0a8');
        op.sayOnce('restone', 'Salve the flesh the moment a plate comes away — or it turns again!');
      }
    }
    if (this.plates.every((p) => p.healed)) {
      this.kill();
      op.rate('good', this.pos, 'Unstoned');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet') return false;
    const plate = this.plates.find((p) => !p.lifted && dist(p.center, ptr.pos) < STONE.plateR + op.hitPad);
    if (!plate) return false;
    this.holdT = 0;
    if (dist(plate.nodes[plate.chipped], ptr.pos) <= STONE.nodeReach + op.hitPad) this.chip(op, plate, ptr.pos);
    else {
      op.rate('bad', ptr.pos, 'Off the crack');
      this.front = Math.max(0, this.front - STONE.wrongSpread);
      op.sayOnce('stone-order', 'Tap the cracks in order — the numbered points. Anywhere else spreads it.');
    }
    return true;
  }

  /** Simple gestures (INP-0112): holding the lancet on the next crack point chips it, instead of a fresh tap. */
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'lancet' || !op.assists.simpleGestures) return;
    const plate = this.plates.find((p) => !p.lifted && dist(p.nodes[p.chipped], ptr.pos) <= STONE.nodeReach + op.hitPad);
    if (!plate) {
      this.holdT = 0;
      return;
    }
    this.holdT += dt;
    if (this.holdT >= STONE.holdChip) {
      this.holdT = 0;
      this.chip(op, plate, ptr.pos);
    }
  }

  private chip(op: Operation, plate: StonePlate, at: Vec): void {
    plate.chipped++;
    op.cues.push('pluck');
    op.emit('dust', at, 6);
    if (plate.chipped === plate.nodes.length) {
      plate.lifted = true;
      plate.marginT = 0;
      plate.cov = new Coverage(plate.center, STONE.plateR, 10);
      op.rate('cool', plate.center, 'Chipped');
      op.sayOnce('stone-margin', 'The plate’s off — salve the raw flesh beneath, quickly!');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve') return;
    for (const p of this.plates) {
      if (!p.lifted || p.healed || !p.cov || !p.cov.contains(ptr.pos, 16)) continue;
      if (!op.canSalve()) return;
      op.useSalve(p.cov.brush(ptr.pos, op.tuning.salve.brush));
      if (p.cov.fraction >= STONE.marginCoverage) {
        p.healed = true;
        op.rate('good', p.center, 'Margin salved');
      }
    }
  }
}
