import { dist, type Vec } from '../../core/math';
import { drawBoneView } from '../../art/boneView';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { angleDiff, BloodPool, surfDisc } from '../entities';
import { Entity } from '../entity';
import { onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

/** Fracture tuning (px, degrees, s). */
export const FRACTURE = {
  segLen: 52,
  grab: 22,
  coolPx: 4,
  coolDeg: 3,
  goodPx: 8,
  goodDeg: 6,
  roughPx: 14,
  roughDeg: 10,
  wheelDeg: 2,
  pinReach: 16,
  misalignPenalty: 150,
  baseDrain: 0.3,
  perLoose: 0.1,
  compoundBlock: 130,
  splinterDrain: 0.2,
};

const RAD = Math.PI / 180;

export interface Fragment {
  pos: Vec;
  rot: number;
  target: Vec;
  targetRot: number;
  set: boolean;
  anchored: boolean;
}

/**
 * A broken bone in 2–5 fragments. Seize a fragment with the tongs, drag it
 * home and turn it with the mouse wheel; within 4 px and 3° it snaps (COOL),
 * within 8 px / 6° (GOOD). Once every fragment is roughly aligned, two pin
 * points appear: tap them in order with the lancet (the awl). Pinning a
 * fragment that never snapped rates BAD and costs end bonus. A compound
 * fracture pokes through the skin: nothing near it can be stitched until set.
 */
export class Fracture extends Entity {
  fragments: Fragment[] = [];
  pins: Vec[] = [];
  pinned = 0;
  private held: Fragment | null = null;
  private grabOff: Vec = { x: 0, y: 0 };
  noun = 'the broken bone';

  constructor(
    pos: Vec,
    op: Operation,
    public axis = 0,
    count = 3,
    public compound = false,
  ) {
    super(pos);
    this.layer = 2;
    const n = Math.max(2, Math.min(5, count));
    const ca = Math.cos(axis);
    const sa = Math.sin(axis);
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      const target = { x: pos.x + ca * k * FRACTURE.segLen, y: pos.y + sa * k * FRACTURE.segLen };
      const anchored = i === 0;
      const a = op.rng.range(0, Math.PI * 2);
      const d = anchored ? 0 : op.rng.range(22, 48);
      const rot = anchored ? axis : axis + op.rng.range(12, 34) * RAD * (op.rng.next() < 0.5 ? -1 : 1);
      this.fragments.push({ pos: { x: target.x + Math.cos(a) * d, y: target.y + Math.sin(a) * d }, rot, target, targetRot: axis, set: anchored, anchored });
    }
    for (let i = 1; i < n; i++) {
      const a = this.fragments[i - 1].target;
      const b = this.fragments[i].target;
      this.pins.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    // Two pins at most, in order along the bone.
    if (this.pins.length > 2) this.pins = [this.pins[0], this.pins[this.pins.length - 1]];
    this.stitchBlockRadius = compound ? FRACTURE.compoundBlock : 0;
  }

  get aligned(): boolean {
    return this.fragments.every((f) => f.set);
  }

  /** Every fragment within the rough tolerance: the pins can go in. */
  get roughlyAligned(): boolean {
    return this.fragments.every((f) => f.set || (dist(f.pos, f.target) <= FRACTURE.roughPx && angleDiff(f.rot, f.targetRot) <= FRACTURE.roughDeg));
  }

  override wants(): readonly ToolId[] {
    return this.roughlyAligned ? ['lancet'] : ['tongs'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.fragments.some((f) => dist(f.pos, p) < FRACTURE.segLen / 2 + pad) || this.pins.some((q) => dist(q, p) < FRACTURE.pinReach + pad);
  }

  override drain(): number {
    return FRACTURE.baseDrain + this.fragments.filter((f) => !f.set).length * FRACTURE.perLoose;
  }

  override update(_op: Operation, _dt: number): void {
    if (this.compound && this.aligned) this.stitchBlockRadius = 0;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'lancet' && this.roughlyAligned) {
      const i = this.pins.findIndex((q) => dist(q, ptr.pos) < FRACTURE.pinReach + op.hitPad);
      if (i < 0) return false;
      if (i !== this.pinned) {
        op.rate('bad', ptr.pos, 'Pin order');
        op.sayOnce('pin-order', 'The first pin first, Doctor — nearest the joint you set first.');
        return true;
      }
      this.pinned++;
      op.cues.push('pluck');
      if (this.pinned === this.pins.length) this.finish(op, ptr.pos);
      return true;
    }
    if (tool !== 'tongs') return false;
    let best: Fragment | null = null;
    let bd = FRACTURE.grab + op.hitPad;
    for (const f of this.fragments) {
      if (f.set) continue;
      const d = dist(f.pos, ptr.pos);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    if (!best) return false;
    this.held = best;
    this.grabOff = { x: best.pos.x - ptr.pos.x, y: best.pos.y - ptr.pos.y };
    op.cues.push('pluck');
    return true;
  }

  override onDrag(_op: Operation, ptr: Pointer, tool: ToolId): void {
    if (!this.held || tool !== 'tongs') return;
    this.held.pos = { x: ptr.pos.x + this.grabOff.x, y: ptr.pos.y + this.grabOff.y };
  }

  override onWheel(_op: Operation, dir: number): boolean {
    if (!this.held) return false;
    this.held.rot += dir * FRACTURE.wheelDeg * RAD;
    return true;
  }

  override onRelease(op: Operation): void {
    const f = this.held;
    this.held = null;
    if (!f) return;
    const d = dist(f.pos, f.target);
    const a = angleDiff(f.rot, f.targetRot);
    if (d <= FRACTURE.coolPx && a <= FRACTURE.coolDeg) this.snap(op, f, 'cool');
    else if (d <= FRACTURE.goodPx && a <= FRACTURE.goodDeg) this.snap(op, f, 'good');
    if (this.aligned) op.sayOnce('fracture-pins', 'It’s set. Now the pins — tap each point with the awl, in order.');
  }

  private snap(op: Operation, f: Fragment, r: 'cool' | 'good'): void {
    f.pos = { ...f.target };
    f.rot = f.targetRot;
    f.set = true;
    op.cues.push('squelch');
    op.rate(r, f.pos, 'Set');
  }

  private finish(op: Operation, at: Vec): void {
    const loose = this.fragments.filter((f) => !f.set).length;
    this.kill();
    if (loose > 0) {
      op.rate('bad', at, 'Misaligned');
      op.endPenalty += FRACTURE.misalignPenalty * loose;
      op.sayOnce('misaligned', 'That bone will knit crooked. It holds — but he’ll limp.');
      return;
    }
    op.rate('good', at, 'Pinned');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, FRACTURE.segLen * this.fragments.length * 0.6, 0, 0.25, 0.05, 0.4);
  }

  draw(g: Gfx, op: Operation): void {
    // The vellum anatomy plate (ENG-0273): the inked bone, its breaks and, with guides on, where each fragment goes.
    drawBoneView(g, this, op.elapsed, op.guides);
    for (const f of this.fragments) {
      const a = this.end(f.pos, f.rot, -1);
      const b = this.end(f.pos, f.rot, 1);
      g.line(a, b, 16, hex(f.set ? '#e8e0cc' : '#d8ceb4'));
      g.line(a, b, 6, hex('#f8f2e4', 0.6));
      if (this.held === f) g.glow(f.pos.x, f.pos.y, 30, hex('#ffe0a0', 0.3));
    }
    if (this.roughlyAligned)
      this.pins.forEach((q, i) => {
        const done = i < this.pinned;
        g.circle(q.x, q.y, done ? 5 : 8, hex(done ? '#9aa0a6' : '#ffebbe', done ? 1 : 0.5 + 0.4 * Math.sin(op.elapsed * 6)));
        if (!done && op.guides) g.text(String(i + 1), q.x, q.y + 5, { size: 12, color: hex('#20100a'), align: 'center', shadow: false });
      });
    if (this.compound && !this.aligned) g.arc(this.pos.x, this.pos.y, 30, 2, hex('#ff8060', 0.4));
  }

  private end(c: Vec, rot: number, s: number): Vec {
    const h = (FRACTURE.segLen / 2 - 3) * s;
    return { x: c.x + Math.cos(rot) * h, y: c.y + Math.sin(rot) * h };
  }
}

/** A sliver of bone hidden near a fracture (lens). Left in at closing, it festers (0.2/s). */
export class BoneSplinter extends Entity {
  private grabbed = false;
  noun = 'the bone splinter';
  constructor(pos: Vec) {
    super(pos);
    this.required = false;
    this.hidden = true;
    this.feverOnClose = true;
    this.feverDrain = FRACTURE.splinterDrain;
    this.layer = 3;
  }
  override wants(): readonly ToolId[] {
    return ['tongs'];
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > op.tuning.tongs.grab + op.hitPad) return false;
    this.grabbed = true;
    return true;
  }
  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }
  override onRelease(op: Operation, ptr: Pointer): void {
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('good', ptr.pos, 'Splinter');
    }
  }
  draw(g: Gfx): void {
    g.line({ x: this.pos.x - 6, y: this.pos.y - 2 }, { x: this.pos.x + 6, y: this.pos.y + 2 }, 3, hex('#efe8d8'));
  }
}

/** A fracture with its hidden splinters and a drift of bone dust. */
export function fractureSite(op: Operation, pos: Vec, opts: { axis?: number; fragments?: number; compound?: boolean; splinters?: number } = {}): Entity[] {
  const f = new Fracture(pos, op, opts.axis ?? 0, opts.fragments ?? 3, opts.compound ?? false);
  const out: Entity[] = [f];
  for (let i = 0; i < (opts.splinters ?? 1); i++) {
    const a = op.rng.range(0, Math.PI * 2);
    out.push(new BoneSplinter({ x: pos.x + Math.cos(a) * 70, y: pos.y + Math.sin(a) * 50 }));
  }
  out.push(new BloodPool({ x: pos.x, y: pos.y + 30 }, 22, 'bonedust'));
  return out;
}
