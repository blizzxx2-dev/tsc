import { dist, pointSegment, type Vec } from '../../core/math';
import { boneChipsArt, boneFragmentArt, drawBoneView, splintArt } from '../../art/boneView';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { angleDiff, BloodPool, surfDisc } from '../entities';
import { rotationAround } from '../gesture';
import { Entity } from '../entity';
import { onBody, PIN_HOLD, strokeCrosses, type Operation } from '../operation';
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
  /** Grip this far along a fragment from its middle, near its line, and the tongs twist it (INP-0106). */
  twistFrom: 17,
  wrapDrain: 0.15,
  wrapBandPx: 6,
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
  /** Holding a fragment by its end turns it about its middle (INP-0106) instead of moving it. */
  private twist: Vec | null = null;
  noun = 'the broken bone';
  /** Turns of bandage the splint needs once pinned (CON-0238); 0 leaves a finished splint. */
  wrapTurns = 0;

  constructor(
    pos: Vec,
    op: Operation,
    public axis = 0,
    count = 3,
    public compound = false,
  ) {
    super(pos);
    this.layer = 2;
    this.canPin = true;
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
    // An end, well clear of the middle and close to the bone's line: the grip twists it (INP-0106).
    for (const f of this.fragments) {
      if (f.set) continue;
      const ax = Math.cos(f.rot);
      const ay = Math.sin(f.rot);
      const along = (ptr.pos.x - f.pos.x) * ax + (ptr.pos.y - f.pos.y) * ay;
      const across = Math.abs(-(ptr.pos.x - f.pos.x) * ay + (ptr.pos.y - f.pos.y) * ax);
      if (Math.abs(along) >= FRACTURE.twistFrom && Math.abs(along) <= FRACTURE.segLen / 2 + 6 && across <= 10 + op.hitPad) {
        this.held = f;
        this.twist = { ...ptr.pos };
        op.cues.push('pluck');
        return true;
      }
    }
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
    if (this.twist) {
      this.held.rot += rotationAround([this.twist, ptr.pos], this.held.pos);
      this.twist = { ...ptr.pos };
      return;
    }
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
    this.twist = null;
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
    // The set bone stays splinted and bandaged for the rest of the operation (ART-0223).
    const first = this.fragments[0];
    const last = this.fragments[this.fragments.length - 1];
    const a = this.end(first.target, first.targetRot, -1);
    const b = this.end(last.target, last.targetRot, 1);
    op.spawn(this.wrapTurns > 0 ? new SplintWrap(a, b, this.wrapTurns) : new Splint(a, b));
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
    // Fracture sprites (ART-0223): broken ends jagged where fragments meet, chips round a comminuted
    // break, and a compound fracture's end through the skin until it is set.
    const n = this.fragments.length;
    this.fragments.forEach((f, i) => {
      boneFragmentArt(g, f.pos, f.rot, FRACTURE.segLen, { brokenA: i > 0, brokenB: i < n - 1, set: f.set, protrude: this.compound && i === n - 1 && !f.set, seed: i });
      if (this.held === f) g.glow(f.pos.x, f.pos.y, 30, hex('#ffe0a0', 0.3));
      // A pinned grip (INP-0107): the seconds it has left, as a ring round the fragment.
      if (this.held === f && op.pinned?.e === this) g.arc(f.pos.x, f.pos.y, 34, 3, hex('#e8dcc0', 0.8), op.pinned.t / PIN_HOLD);
    });
    if (n >= 4) for (let i = 1; i < n; i++) if (!(this.fragments[i - 1].set && this.fragments[i].set)) boneChipsArt(g, this.pins[Math.min(this.pins.length - 1, i - 1)] ?? this.pos, 3, i);
    if (this.roughlyAligned)
      this.pins.forEach((q, i) => {
        const done = i < this.pinned;
        g.circle(q.x, q.y, done ? 5 : 8, hex(done ? '#9aa0a6' : '#ffebbe', done ? 1 : 0.5 + 0.4 * Math.sin(op.elapsed * 6)));
        if (!done && op.guides) g.text(String(i + 1), q.x, q.y + 5, { size: 12, color: hex('#20100a'), align: 'center', shadow: false });
      });
    if (this.compound && !this.aligned) g.arc(this.pos.x, this.pos.y, 30, 2, hex('#ff8060', 0.4));
    this.drawGuides(g);
  }

  /**
   * The bone-setting HUD (UIX-0193): while a fragment is held, an alignment gauge (how far it sits
   * from home, green inside the COOL tolerance) and a guide arc from its angle to the one it wants;
   * once every piece is roughly set, a ghost of the splint that will go on.
   */
  private drawGuides(g: Gfx): void {
    const f = this.held;
    if (f && !f.set) {
      const d = dist(f.pos, f.target);
      const a = angleDiff(f.rot, f.targetRot);
      const ok = (v: number, cool: number, good: number) => (v <= cool ? '#9fd3a8' : v <= good ? '#f0d070' : '#e07050');
      // Gauge: two short bars over the fragment, distance and angle, full when home.
      const gx = f.pos.x - 30;
      const gy = f.pos.y - 44;
      g.rect(gx, gy, 60, 5, hex('#000000', 0.5));
      g.rect(gx, gy, 60 * Math.max(0, 1 - d / 40), 5, hex(ok(d, FRACTURE.coolPx, FRACTURE.goodPx)));
      g.rect(gx, gy + 8, 60, 5, hex('#000000', 0.5));
      g.rect(gx, gy + 8, 60 * Math.max(0, 1 - a / 35), 5, hex(ok(a, FRACTURE.coolDeg, FRACTURE.goodDeg)));
      // Guide arc: from where it points to where it should, round its middle.
      let turn = f.targetRot - f.rot;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      if (Math.abs(turn) > FRACTURE.coolDeg * RAD) g.arc(f.pos.x, f.pos.y, FRACTURE.segLen / 2 + 8, 2, hex(ok(a, FRACTURE.coolDeg, FRACTURE.goodDeg), 0.8), Math.abs(turn) / (Math.PI * 2), Math.min(f.rot, f.rot + turn));
      // And the home it's heading for.
      g.circle(f.target.x, f.target.y, 4, hex('#f4ecd8', 0.6));
    }
    if (this.roughlyAligned && this.pinned === 0) {
      const first = this.fragments[0];
      const last = this.fragments[this.fragments.length - 1];
      g.line(this.end(first.target, first.targetRot, -1), this.end(last.target, last.targetRot, 1), 34, hex('#d8ceb4', 0.14));
    }
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

/** The splint and bandage left on a pinned bone (presentation; not required, no drain). */
export class Splint extends Entity {
  noun = 'the splint';
  constructor(
    public a: Vec,
    public b: Vec,
  ) {
    super({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    this.required = false;
    this.layer = 2;
  }
  override hitTest(): boolean {
    return false;
  }
  draw(g: Gfx): void {
    splintArt(g, this.a, this.b);
  }
}

/**
 * A splint laid along a pinned bone, waiting to be bound (CON-0238): stroke the thread across it,
 * a turn at a time along its length. Each band takes one turn; a turn through the band's centre
 * is COOL, elsewhere in it GOOD, and one through a band already bound is wasted. Unbound, the
 * bone shifts in its pins (0.15/s). Bound, it becomes the finished splint.
 */
export class SplintWrap extends Entity {
  noun = 'the splint';
  readonly bound: boolean[];
  constructor(
    public a: Vec,
    public b: Vec,
    turns: number,
  ) {
    super({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    this.layer = 2;
    this.bound = new Array(Math.max(1, turns)).fill(false);
  }
  /** Where band `i`'s centre lies along the splint. */
  bandAt(i: number): Vec {
    const t = (i + 0.5) / this.bound.length;
    return { x: this.a.x + (this.b.x - this.a.x) * t, y: this.a.y + (this.b.y - this.a.y) * t };
  }
  override wants(): readonly ToolId[] {
    return ['thread'];
  }
  override hitTest(p: Vec, pad = 0): boolean {
    return pointSegment(p, this.a, this.b).d < 16 + pad;
  }
  override drain(): number {
    return FRACTURE.wrapDrain;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'thread' || ptr.pressed || !strokeCrosses(ptr.prev, ptr.pos, this.a, this.b)) return;
    const n = this.bound.length;
    const t = pointSegment({ x: (ptr.prev.x + ptr.pos.x) / 2, y: (ptr.prev.y + ptr.pos.y) / 2 }, this.a, this.b).t;
    const i = Math.min(n - 1, Math.floor(t * n));
    if (this.bound[i]) return;
    this.bound[i] = true;
    op.cues.push('stitch');
    const r = pointSegment(this.bandAt(i), ptr.prev, ptr.pos).d <= FRACTURE.wrapBandPx ? 'cool' : 'good';
    op.rate(r, this.bandAt(i), 'Wrapped');
    if (this.bound.every(Boolean)) {
      this.kill();
      op.spawn(new Splint(this.a, this.b));
      op.rate('good', this.pos, 'Splinted');
    }
  }
  draw(g: Gfx, op: Operation): void {
    splintArt(g, this.a, this.b, this.bound);
    this.bound.forEach((done, i) => {
      const c = this.bandAt(i);
      if (!done) g.circle(c.x, c.y, 6, hex('#ffebbe', 0.35 + 0.3 * Math.sin(op.elapsed * 5 + i)));
    });
  }
}
