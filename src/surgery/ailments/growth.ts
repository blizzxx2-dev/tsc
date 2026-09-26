import { dist, pointSegment, type Vec } from '../../core/math';
import { Entity } from '../entity';
import { analyseLoop, loopRating } from '../gesture';
import { onBody, strokeCrosses, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const GROWTH = {
  drain: 0.3,
  ripBleed: 15,
  ripHurt: 6,
  bleedPerVessel: 15,
  vesselLen: 36,
  /** Tap-and-hold alternative to the loop (simplified gestures). */
  holdExcise: 1,
  budRoot: 8,
  budBrand: 0.6,
  budR: 12,
  budDrain: 0.15,
};

export type GrowthVariant = 'plain' | 'tooth' | 'finger' | 'eye';

/** A feeder vessel: a line from the growth's edge outward, to be tied with a stitch across it. */
interface Vessel {
  a: Vec;
  b: Vec;
  tied: boolean;
}

/**
 * A pulsing tumour. Tie off any feeder vessels with the thread, then cut a
 * closed loop around it with the lancet (encircle-excise), then lift it off
 * with the tongs. Lifting it before the loop is closed rips it (BAD, bleeding);
 * cutting it free with vessels still feeding it bleeds hard (−15 each).
 */
export class Growth extends Entity {
  excised = false;
  vessels: Vessel[] = [];
  path: Vec[] = [];
  private pressT = 0;
  private grabbed = false;
  private offset: Vec = { x: 0, y: 0 };
  noun = 'the growth';

  constructor(
    pos: Vec,
    op: Operation,
    public r = 28,
    feeders = 0,
    public variant: GrowthVariant = 'plain',
  ) {
    super(pos);
    this.layer = 2;
    for (let i = 0; i < feeders; i++) {
      const a = (i / Math.max(1, feeders)) * Math.PI * 2 + op.rng.range(-0.3, 0.3);
      const from = { x: pos.x + Math.cos(a) * (r + 30), y: pos.y + Math.sin(a) * (r + 30) };
      this.vessels.push({ a: from, b: { x: from.x + Math.cos(a) * GROWTH.vesselLen, y: from.y + Math.sin(a) * GROWTH.vesselLen }, tied: false });
    }
  }

  override wants(): readonly ToolId[] {
    if (this.vessels.some((v) => !v.tied)) return ['thread', 'lancet'];
    return this.excised ? ['tongs'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.r + 30 + pad || this.vessels.some((v) => pointSegment(p, v.a, v.b).d < 14 + pad);
  }

  override drain(): number {
    return GROWTH.drain + this.vessels.filter((v) => !v.tied).length * 0.1;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    const d = dist(ptr.pos, this.pos);
    if (tool === 'lancet' && !this.excised && d < this.r + 40 + op.hitPad) {
      this.path = [{ ...ptr.pos }];
      this.pressT = 0;
      return true;
    }
    if (tool === 'tongs' && d < this.r + op.hitPad) {
      if (!this.excised) {
        op.rate('bad', this.pos, 'Ripped');
        op.harm(GROWTH.ripHurt, this.pos);
        op.emit('blood', this.pos, 20);
        op.sayOnce('growth-rip', 'Cut all the way round it first — you’re tearing it out by the roots!', 'danger');
        return true;
      }
      this.grabbed = true;
      this.offset = { x: this.pos.x - ptr.pos.x, y: this.pos.y - ptr.pos.y };
      return true;
    }
    return false;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'lancet' && this.path.length) {
      this.path.push({ ...ptr.pos });
      this.pressT += dt;
      if (op.assists.simpleGestures && this.pressT >= GROWTH.holdExcise && dist(this.path[0], ptr.pos) < 8) this.excise(op, 'good');
    }
    if (tool === 'tongs' && this.grabbed) this.pos = { x: ptr.pos.x + this.offset.x, y: ptr.pos.y + this.offset.y };
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'thread' || ptr.pressed) return;
    for (const v of this.vessels) {
      if (v.tied || !strokeCrosses(ptr.prev, ptr.pos, v.a, v.b)) continue;
      v.tied = true;
      op.cues.push('stitch');
      op.rate('good', ptr.pos, 'Tied off');
    }
  }

  override onRelease(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool === 'lancet' && this.path.length > 2 && !this.excised) {
      const l = analyseLoop(this.path, this.pos, this.r);
      this.path = [];
      if (l.closed && l.encloses) this.excise(op, loopRating(l));
      else op.sayOnce('growth-loop', 'All the way round, Doctor — close the loop where you began.');
      return;
    }
    this.path = [];
    if (tool === 'tongs' && this.grabbed) {
      this.grabbed = false;
      if (!onBody(ptr.pos)) {
        this.kill();
        op.rate('good', ptr.pos, 'Growth lifted');
      }
    }
  }

  private excise(op: Operation, r: 'cool' | 'good' | 'bad'): void {
    this.excised = true;
    this.path = [];
    op.cues.push('cut');
    op.rate(r, this.pos, 'Excised');
    const open = this.vessels.filter((v) => !v.tied).length;
    if (open) {
      op.hurt(GROWTH.bleedPerVessel * open, this.pos);
      op.emit('blood', this.pos, 30);
      op.say('It was still fed — tie the vessels before you cut!', 'danger');
      for (const v of this.vessels) v.tied = true;
    }
  }
}

/**
 * A mutation bud (hexstone corruption). Unrooted, one closed lancet loop cuts
 * it away. After 8 s it roots: then it needs the loop and 0.6 s of brand.
 */
export class MutationBud extends Entity {
  looped = false;
  path: Vec[] = [];
  private brandT = 0;
  noun = 'the mutation bud';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 2;
  }

  get rooted(): boolean {
    return this.age >= GROWTH.budRoot;
  }

  override wants(): readonly ToolId[] {
    return this.looped ? ['brand'] : ['lancet'];
  }

  override drain(): number {
    return GROWTH.budDrain * (this.rooted ? 2 : 1);
  }

  override update(op: Operation): void {
    this.branded = false;
    if (this.rooted) op.sayOnce('bud-root', 'That bud has rooted — cut round it, then sear the root.');
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.looped || dist(ptr.pos, this.pos) > GROWTH.budR + 34 + op.hitPad) return false;
    this.path = [{ ...ptr.pos }];
    return true;
  }

  override onDrag(_op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool === 'lancet' && this.path.length) this.path.push({ ...ptr.pos });
  }

  override onRelease(op: Operation): void {
    if (this.path.length < 3) return;
    const l = analyseLoop(this.path, this.pos, GROWTH.budR);
    this.path = [];
    if (!(l.closed && l.encloses)) return;
    const r = loopRating(l);
    if (!this.rooted) {
      this.kill();
      op.rate(r, this.pos, 'Bud cut');
      return;
    }
    this.looped = true;
    op.rate(r === 'bad' ? 'bad' : 'good', this.pos, 'Bud cut');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.looped || tool !== 'brand' || dist(ptr.pos, this.pos) > GROWTH.budR + 8 + op.hitPad) return;
    this.branded = true;
    this.brandT += dt;
    if (this.brandT >= GROWTH.budBrand) {
      this.kill();
      op.cues.push('burn');
      op.rate('good', this.pos, 'Root seared');
    }
  }
}
