/**
 * Brood silk (ART-0217, CON-0066): the web-spinner wraps her victim in strands of silk that must
 * be cut with the lancet before anything beneath can be reached. Each strand parts when a lancet
 * stroke crosses it; the last one cut frees the field.
 */
import { pointSegment, segmentsIntersect, type Vec } from '../../core/math';

const TAU = Math.PI * 2;
import { Entity } from '../entity';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export interface Strand {
  a: Vec;
  b: Vec;
  /** World time it was cut (−1 while whole). */
  cutAt: number;
}

export class WebSilk extends Entity {
  readonly strands: Strand[] = [];
  noun = 'the silk';

  constructor(pos: Vec, op: Operation, count = 5, radius = 110) {
    super(pos);
    this.layer = 7;
    const base = op.rng.range(0, TAU);
    for (let i = 0; i < count; i++) {
      const a = base + (i / count) * Math.PI + op.rng.range(-0.15, 0.15);
      const off = op.rng.range(-radius * 0.35, radius * 0.35);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const c = { x: pos.x + nx * off, y: pos.y + ny * off };
      this.strands.push({ a: { x: c.x - Math.cos(a) * radius, y: c.y - Math.sin(a) * radius }, b: { x: c.x + Math.cos(a) * radius, y: c.y + Math.sin(a) * radius }, cutAt: -1 });
    }
  }

  get left(): number {
    return this.strands.filter((s) => s.cutAt < 0).length;
  }

  override wants(): readonly ToolId[] {
    return ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.strands.some((s) => s.cutAt < 0 && pointSegment(p, s.a, s.b).d < 10 + pad);
  }

  override drain(): number {
    return 0.05;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || !ptr.down) return;
    for (const s of this.strands) {
      if (s.cutAt >= 0 || !segmentsIntersect(ptr.prev, ptr.pos, s.a, s.b)) continue;
      s.cutAt = op.elapsed;
      op.cues.push('pluck');
      op.rate('good', ptr.pos, 'Strand cut');
    }
    if (this.left === 0) {
      this.kill();
      op.rate('cool', this.pos, 'Web cut away');
    }
  }
}
