import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Coverage } from '../coverage';
import { drawCoverage, surfDisc } from '../entities';
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
    const next = plate.nodes[plate.chipped];
    if (dist(next, ptr.pos) <= STONE.nodeReach + op.hitPad) {
      plate.chipped++;
      op.cues.push('pluck');
      op.emit('dust', ptr.pos, 6);
      if (plate.chipped === plate.nodes.length) {
        plate.lifted = true;
        plate.marginT = 0;
        plate.cov = new Coverage(plate.center, STONE.plateR, 10);
        op.rate('cool', plate.center, 'Chipped');
        op.sayOnce('stone-margin', 'The plate’s off — salve the raw flesh beneath, quickly!');
      }
    } else {
      op.rate('bad', ptr.pos, 'Off the crack');
      this.front = Math.max(0, this.front - STONE.wrongSpread);
      op.sayOnce('stone-order', 'Tap the cracks in order — the numbered points. Anywhere else spreads it.');
    }
    return true;
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

  override drawSurface(g: Gfx): void {
    for (const p of this.plates) if (!p.healed) surfDisc(g, p.center, STONE.plateR * 1.5, 0, 0.1, 0.35, 0.2);
  }

  draw(g: Gfx, op: Operation): void {
    for (const p of this.plates) {
      if (p.healed) continue;
      if (!p.lifted) {
        g.circleGrad(p.center.x, p.center.y, STONE.plateR, hex('#9a968c'), hex('#5a5850'));
        for (let i = 1; i < p.nodes.length; i++) g.line(p.nodes[i - 1], p.nodes[i], 2, hex('#2a2824'));
        p.nodes.forEach((n, i) => {
          if (i < p.chipped) return;
          const next = i === p.chipped;
          g.circle(n.x, n.y, next ? 5 : 3, hex(next ? '#ffebbe' : '#d8d0c0', next ? 0.6 + 0.3 * Math.sin(op.elapsed * 6) : 0.5));
          if (op.guides) g.text(String(i + 1), n.x, n.y - 8, { size: 11, color: hex('#ffebbe', 0.8), align: 'center', shadow: false });
        });
      } else if (p.cov) {
        g.circleGrad(p.center.x, p.center.y, STONE.plateR, hex('#c04040', 0.5), hex('#c04040', 0));
        g.arc(p.center.x, p.center.y, STONE.plateR + 4, 2, hex('#ffebbe'), 1 - p.marginT / STONE.marginTime);
        drawCoverage(g, p.cov);
      }
    }
    // The organ glyph and, under the lens, the true front.
    g.circle(this.organ.x, this.organ.y, 9, hex('#c0182a', 0.7));
    if (op.tool === 'lens' && dist(op.cursor, this.pos) < op.tuning.lens.radius * 2) {
      const d = dist(this.pos, this.organ) || 1;
      const t = 1 - (this.front + STONE.lensAhead) / d;
      const f = { x: this.pos.x + (this.organ.x - this.pos.x) * t, y: this.pos.y + (this.organ.y - this.pos.y) * t };
      g.arc(this.pos.x, this.pos.y, dist(this.pos, f), 2, hex('#b0b0a8', 0.6));
    }
  }
}
