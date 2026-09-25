import { clamp, dist, pointSegment, type Vec } from '../core/math';
import { drawBlotch, presentation } from '../render/presentation';
import { hex, rgba } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Coverage } from './coverage';
import { Entity } from './entity';
import { FIELD, inLeadDish, isOpenWound, onBody, strokeCrosses, type Operation } from './operation';
import { DEFAULT_TUNING } from './tuning';
import type { Pointer, ToolId } from './types';

const TAU = Math.PI * 2;
/** Hexstone writhing frequencies (rad/s). */
const WRITHE_X = 9;
const WRITHE_Y = 7;
const REKINDLE_COLOR = '#80ff90';
/** Gap between an entity and a popup label above it. */
const LABEL_GAP = 10;
const BURST_COLOR = '#c8c050';

// ============================================================ layer helpers

/** Soft-edged channel stroke into the surface layer: stacked widths approximate a falloff. */
export function surfLine(g: Gfx, pts: Vec[], w: number, r: number, gc = 0, b = 0, a = 0): void {
  for (const [k, f] of [
    [1.8, 0.25],
    [1.2, 0.35],
    [0.7, 0.4],
  ] as const)
    g.polyline(pts, w * k, rgba(Math.round(r * f * 255), Math.round(gc * f * 255), Math.round(b * f * 255), a * f));
}

/** Soft channel disc into the surface layer. */
export function surfDisc(g: Gfx, p: Vec, rad: number, r: number, gc = 0, b = 0, a = 0): void {
  g.circleGrad(p.x, p.y, rad, rgba(Math.round(r * 255), Math.round(gc * 255), Math.round(b * 255), a), rgba(0, 0, 0, 0));
}

/** Position along a polyline (arc length) nearest to p. */
export function projectAlong(points: Vec[], p: Vec): { d: number; at: number } {
  let best = { d: Infinity, at: 0 };
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    const { d, t } = pointSegment(p, a, b);
    if (d < best.d) best = { d, at: acc + t * seg };
    acc += seg;
  }
  return best;
}

export function polyLength(points: Vec[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i++) t += dist(points[i - 1], points[i]);
  return t;
}

export function pointAlong(points: Vec[], at: number): Vec {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a, b);
    if (acc + seg >= at) {
      const t = seg === 0 ? 0 : (at - acc) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += seg;
  }
  return points[points.length - 1];
}

/** Angle difference in degrees, 0..180. */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % TAU;
  if (d > Math.PI) d = TAU - d;
  return (d * 180) / Math.PI;
}

// ============================================================ incision

/**
 * A dotted guide line the surgeon must trace with the lancet. Once cut it stays
 * open (not required) until the closing phase asks for it to be stitched.
 * Deep incisions have more than one layer (skin, then fascia): the next guide
 * appears only once the layer above is open.
 */
export class Incision extends Entity {
  state: 'mark' | 'open' | 'closing' | 'closed' = 'mark';
  progress = 0; // length traced so far in the current layer
  depth = 0; // layers opened
  private devSum = 0;
  private devN = 0;
  private slipped = false;
  private strokeTime = 0;
  private strokeLen = 0;
  private donePress = -1;
  private overshot = false;
  readonly total: number;
  stitch: StitchLine | null = null;
  noun = 'the incision line';

  constructor(
    public points: Vec[],
    public layers = 1,
  ) {
    super(points[0]);
    this.layer = -1;
    this.total = polyLength(points);
  }

  get openWound(): boolean {
    return this.state === 'open' || this.state === 'closing';
  }

  /** Nearest distance to the path and the path length at that point. */
  project(p: Vec): { d: number; at: number } {
    return projectAlong(this.points, p);
  }

  pointAt(at: number): Vec {
    return pointAlong(this.points, at);
  }

  beginClosing(): void {
    this.state = 'closing';
    this.required = true;
    this.stitch = new StitchLine(this.points);
  }

  override wants(): readonly ToolId[] {
    return this.state === 'mark' ? ['lancet'] : this.state === 'closing' ? ['thread'] : [];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.project(p).d < 24 + pad;
  }

  override drain(op: Operation): number {
    // An open incision with nothing left to do inside bleeds gently: get on with it.
    if (this.state !== 'open') return 0;
    return op.entities.some((e) => e !== this && e.alive && e.required) ? 0 : op.tuning.incision.idleBleed;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.state !== 'mark' || tool !== 'lancet') return false;
    const T = op.tuning.incision;
    const pr = this.project(ptr.pos);
    // Must start at the head of the line or where the last stroke stopped.
    if (pr.d > T.startTol + op.hitPad || Math.abs(pr.at - this.progress) > T.resumeTol) return false;
    op.cues.push('cut');
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId, dt: number): void {
    const T = op.tuning.incision;
    if (this.state === 'open' && this.donePress === op.pressId && !this.overshot) {
      // Carrying on past the end of the line nicks healthy flesh.
      const end = this.points[this.points.length - 1];
      const pr = this.project(ptr.pos);
      if (pr.at >= this.total - 1 && dist(ptr.pos, end) > T.overshoot) {
        this.overshot = true;
        const ang = Math.atan2(ptr.pos.y - end.y, ptr.pos.x - end.x);
        op.spawnPenalty(new Laceration({ x: (end.x + ptr.pos.x) / 2, y: (end.y + ptr.pos.y) / 2 }, ang, T.overshootNick, 0.4));
        op.harm(1, ptr.pos);
        op.sayOnce('overshoot', 'Stop at the end of the line — you’ve nicked him.');
      }
      return;
    }
    if (this.state !== 'mark' || this.slipped) return;
    // A racing heart only lets the blade bite between beats.
    if (op.entities.some((e) => e.alive && e !== this && e.blocksTool(op, ptr.pos, 'lancet'))) return;
    this.strokeTime += dt;
    const pr = this.project(ptr.pos);
    if (pr.d > T.slipDist + op.hitPad) {
      // Slipped off the guide: penalise once and stop tracking until the next press.
      op.rate('bad', ptr.pos, 'Off the line');
      op.harm(T.slipHurt, ptr.pos);
      this.slipped = true;
      return;
    }
    if (pr.at > this.progress && pr.at - this.progress < 60) {
      if (Math.floor(pr.at / 14) > Math.floor(this.progress / 14)) op.emit('blood', ptr.pos, 3, undefined, undefined, 90);
      this.strokeLen += pr.at - this.progress;
      this.progress = pr.at;
      this.devSum += pr.d;
      this.devN++;
    }
    if (this.progress >= this.total - 8) this.completeLayer(op, ptr);
  }

  private completeLayer(op: Operation, ptr: Pointer): void {
    const T = op.tuning.incision;
    const avg = this.devSum / Math.max(1, this.devN);
    const speed = this.strokeLen / Math.max(1e-3, this.strokeTime);
    let r: 'cool' | 'good' | 'bad' = avg <= T.coolDev ? 'cool' : avg <= T.goodDev ? 'good' : 'bad';
    let label = this.layers > 1 ? (this.depth === 0 ? 'Skin' : 'Fascia') : 'Incision';
    if (speed > T.rushedSpeed) {
      r = 'bad';
      label = 'Rushed';
    } else if (speed < T.slowSpeed && r === 'cool') r = 'good';
    op.rate(r, ptr.pos, label);
    this.depth++;
    this.devSum = this.devN = 0;
    this.strokeTime = this.strokeLen = 0;
    op.cues.push('squelch');
    if (this.depth < this.layers) {
      this.progress = 0;
      op.sayOnce('incision-layer', 'Through the skin. Now the layer beneath — trace it again.');
      return;
    }
    this.state = 'open';
    this.required = false;
    this.donePress = op.pressId;
  }

  override onRelease(): void {
    this.slipped = false;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (this.state !== 'closing' || !this.stitch) return;
    if (tool === 'thread' && this.stitch.sweep(op, ptr)) {
      this.state = 'closed';
      this.kill();
      op.scars.push(this.points.map((p) => ({ ...p })));
      const q = this.stitch.quality(op);
      op.rate(q, ptr.pos, 'Closed');
      if (q === 'cool') op.closureBonus();
    }
  }

  override drawSurface(g: Gfx): void {
    if (this.state === 'mark') {
      if (this.progress > 0 || this.depth > 0) surfLine(g, this.depth > 0 ? this.points : this.tracedPoints(), 10 + this.depth * 4, 0.9, 0.3);
    } else surfLine(g, this.points, 16, 1, 0.45, 0, 0.15);
  }

  draw(g: Gfx, op: Operation): void {
    if (this.state === 'mark') {
      // The guide fades in; on Master (no guides) only the start and end nubs show.
      const a = Math.min(1, this.age / op.tuning.incision.guideFade);
      if (op.guides) g.dashed(this.points, 3, hex(this.depth > 0 ? '#ffd0a0' : '#ffebbe', 0.85 * a), 10, 9, -op.elapsed * 20);
      const end = this.points[this.points.length - 1];
      g.circle(this.points[0].x, this.points[0].y, 4, hex('#ffebbe', 0.7 * a));
      g.circle(end.x, end.y, 4, hex('#ffebbe', 0.7 * a));
      const head = this.pointAt(this.progress);
      g.glow(head.x, head.y, 22, hex('#ffe0a0', 0.35 * a));
      g.circle(head.x, head.y, 6 + Math.sin(op.elapsed * 6) * 2, hex('#ffebbe', 0.9 * a));
    } else {
      // The gash itself is carved by the flesh shader (surface layer); add only a wet glint.
      g.polyline(this.points, 2, hex('#ff9090', 0.25));
      if (this.state === 'closing') g.dashed(this.points, 2, hex('#ffebbe', 0.35 + 0.2 * Math.sin(op.elapsed * 4)), 6, 10, op.elapsed * 10);
      if (this.stitch) this.stitch.draw(g, op);
    }
  }

  private tracedPoints(): Vec[] {
    const out = [this.points[0]];
    let acc = 0;
    for (let i = 1; i < this.points.length; i++) {
      const seg = dist(this.points[i - 1], this.points[i]);
      if (acc + seg >= this.progress) {
        out.push(this.pointAt(this.progress));
        break;
      }
      out.push(this.points[i]);
      acc += seg;
    }
    return out;
  }
}

// ============================================================ stitching

/**
 * Shared zig-zag stitching logic: each crossing of the wound line is a stitch.
 * A wound needs ceil(length / 22) stitches and closes only when no gap along it
 * is wider than 40 px; a closed-but-gappy line keeps bleeding at 30 %.
 */
export class StitchLine {
  count = 0;
  strokes = new Set<number>();
  marks: Vec[] = [];
  readonly length: number;
  readonly needed: number;

  constructor(
    public points: Vec[],
    needed?: number,
  ) {
    this.length = polyLength(points);
    this.needed = needed ?? Math.max(2, Math.ceil(this.length / DEFAULT_TUNING.stitch.pxPerStitch));
  }

  /** Gaps along the wound, including from each end to the nearest stitch. */
  gaps(): number[] {
    const at = this.marks.map((m) => projectAlong(this.points, m).at).sort((a, b) => a - b);
    const out: number[] = [];
    let prev = 0;
    for (const s of at) {
      out.push(s - prev);
      prev = s;
    }
    out.push(this.length - prev);
    return out;
  }

  /** Spacing between consecutive stitches. */
  spacings(): number[] {
    const g = this.gaps();
    return g.slice(1, -1);
  }

  /** Enough stitches, but a hole wider than the tolerance remains. */
  gapped(op: Operation): boolean {
    return this.count >= this.needed && this.gaps().some((g) => g > op.tuning.stitch.goodMax);
  }

  quality(op: Operation): 'cool' | 'good' {
    const S = op.tuning.stitch;
    const sp = this.spacings();
    const even = sp.every((s) => s >= S.coolMin && s <= S.coolMax);
    return this.strokes.size <= 1 && even ? 'cool' : 'good';
  }

  private add(op: Operation, p: Vec): boolean {
    this.count++;
    this.strokes.add(op.pressId);
    this.marks.push({ ...p });
    op.cues.push('stitch');
    op.emit('blood', p, 2, undefined, undefined, 60);
    if (this.count < this.needed) return false;
    if (this.gapped(op)) {
      op.sayOnce('stitch-gap', 'There’s a gap in the suture — it’s still bleeding. Close it up.');
      return false;
    }
    return true;
  }

  /** Returns true when the final stitch lands. */
  sweep(op: Operation, ptr: Pointer): boolean {
    const S = op.tuning.stitch;
    // Simplified gestures: one click, one stitch.
    if (ptr.pressed && op.assists.simpleGestures) {
      const pr = projectAlong(this.points, ptr.pos);
      if (pr.d > 24 + op.hitPad) return false;
      const p = pointAlong(this.points, pr.at);
      if (this.marks.some((m) => dist(m, p) < S.minSpacing)) return false;
      return this.add(op, p);
    }
    if (ptr.pressed) return false;
    for (let i = 1; i < this.points.length; i++) {
      if (strokeCrosses(ptr.prev, ptr.pos, this.points[i - 1], this.points[i])) {
        // Reject a stitch too close to an existing one so players must travel the wound.
        if (this.marks.some((m) => dist(m, ptr.pos) < S.minSpacing)) return false;
        return this.add(op, ptr.pos);
      }
    }
    return false;
  }

  draw(g: Gfx, op?: Operation): void {
    for (let i = 1; i < this.marks.length; i++) g.line(this.marks[i - 1], this.marks[i], 2, hex('#d9cfa8'));
    for (const m of this.marks) g.rect(m.x - 2, m.y - 2, 4, 4, hex('#efe6c4'));
    // Thread tension: a taut line from the last stitch to the needle while stitching.
    if (op && op.tool === 'thread' && this.marks.length && this.count < this.needed) {
      const last = this.marks[this.marks.length - 1];
      if (dist(last, op.cursor) < 120) g.line(last, op.cursor, 1.2, hex('#efe6c4', 0.6));
    }
  }
}

// ============================================================ blood

export class BloodPool extends Entity {
  private startR: number;
  private contactT = -1;
  private touched = false;
  /** The wound that feeds this pool (a wound's refills only pay once). */
  sourceId = 0;
  noun = 'the pooled blood';
  constructor(
    pos: Vec,
    public r: number,
    public ichor: 'blood' | 'pus' | 'blackbile' | 'bonedust' = 'blood',
  ) {
    super(pos);
    this.layer = 5;
    this.startR = r;
    // Blood only has to be drawn off when it's in the way; it never holds up a phase.
    this.required = false;
    if (ichor !== 'blood') this.noun = ichor === 'pus' ? 'the pus' : ichor === 'bonedust' ? 'the bone dust' : 'the black bile';
  }

  override drain(op: Operation): number {
    const B = op.tuning.blood;
    return this.ichor === 'blood' ? B.baseDrain + this.r * B.drainPerPx : B.ichorDrain;
  }

  override wants(): readonly ToolId[] {
    return ['leech'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.r + 10 + pad;
  }

  grow(amount: number, max = DEFAULT_TUNING.blood.maxR, op?: Operation): void {
    this.r = Math.min(max, this.r + amount);
    this.startR = Math.max(this.startR, this.r);
    if (this.touched && op) {
      // Refilling a pool you've already drawn: the wound under it wants stitching.
      const n = (op.flags.has('refill-2') ? 3 : op.flags.has('refill-1') ? 2 : 1);
      op.flags.add(`refill-${n}`);
      if (n >= op.tuning.blood.refillHint) op.sayOnce('stitch-first', 'It keeps filling — stitch the wound beneath it first, then drain.');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    const B = op.tuning.blood;
    const d = dist(ptr.pos, this.pos);
    if (tool !== 'leech' || op.leechReverse || d > this.r + B.reach + op.hitPad) return;
    if (this.contactT < 0) this.contactT = op.elapsed;
    this.touched = true;
    const rate = B.unitPx / B.unitTime;
    const falloff = 1 - (1 - B.rimFactor) * clamp(d / (this.r + B.reach), 0, 1);
    const mult = op.upgrades.has('deep-leech') ? 1.2 : 1;
    this.r -= rate * falloff * mult * dt;
    if (this.r < Math.max(3, this.startR * B.autoClear)) {
      this.kill();
      op.flags.add('drained-any');
      op.cues.push('squelch');
      const took = op.elapsed - this.contactT;
      // Only pools that were there to begin with pay: blood from a wound left
      // bleeding keeps the combo alive but earns nothing (no farming an unstitched cut).
      if (this.startR >= B.minRated && took <= B.goodTime) op.rate(took <= B.coolTime ? 'cool' : 'good', this.pos, 'Drained', this.sourceId === 0);
      if (this.ichor === 'blood') op.stain(this.pos, this.startR * 0.9, 0.35);
    }
  }

  override drawFluid(g: Gfx, op: Operation): void {
    if (this.ichor === 'bonedust') return;
    const c = this.ichor === 'blood' ? rgba(255, 0, 0, 1) : this.ichor === 'pus' ? rgba(0, 255, 0, 1) : rgba(0, 0, 255, 1);
    const z = rgba(0, 0, 0, 0);
    g.circleGrad(this.pos.x, this.pos.y, this.r * 1.9, c, z);
    // Satellite lobes keep the edge organic.
    for (let i = 0; i < 3; i++) {
      const a = this.id * 1.7 + i * 2.1 + Math.sin(op.elapsed * 0.7 + i) * 0.3;
      const rr = this.r * 0.55;
      g.circleGrad(this.pos.x + Math.cos(a) * rr, this.pos.y + Math.sin(a) * rr * 0.8, this.r * 1.1, c, z);
    }
  }

  draw(g: Gfx): void {
    // Liquids render through the fluid layer (drawFluid); bone dust is a pale powder.
    if (this.ichor === 'bonedust') g.circleGrad(this.pos.x, this.pos.y, this.r * 1.3, hex('#e8e0d0', 0.7), hex('#e8e0d0', 0));
  }
}

/** Find (or open) the pool a wound bleeds into. */
export function feedPool(op: Operation, at: Vec, amount: number): void {
  const pool = op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.alive && e.ichor === 'blood' && dist(e.pos, at) < e.r + 16);
  if (pool) pool.grow(amount, undefined, op);
  else {
    const p = new BloodPool({ x: at.x + op.rng.range(-6, 6), y: at.y + op.rng.range(-6, 6) }, 8);
    p.sourceId = op.actor?.id ?? 0;
    op.spawn(p);
  }
}

// ============================================================ lacerations

/**
 * A cut from a blade, claw or the surgeon's own tugging. Long ones need thread;
 * nicks no longer than SALVE_MAX can be sealed with salve instead.
 */
export const SALVE_MAX = 46;

export class Laceration extends Entity {
  readonly a: Vec;
  readonly b: Vec;
  readonly length: number;
  readonly stitch: StitchLine;
  private cov: Coverage | null;
  bleed: number;
  private poolT = 0;
  /** Seconds pus has been seeping into this wound. */
  pusT = 0;
  readonly openWound = true;
  noun = 'the wound';

  constructor(
    center: Vec,
    angle: number,
    length: number,
    bleed = 1,
    public source: 'blade' | 'claw' = 'blade',
  ) {
    super(center);
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    this.a = { x: center.x - dx, y: center.y - dy };
    this.b = { x: center.x + dx, y: center.y + dy };
    this.length = length;
    this.bleed = bleed;
    this.stitch = new StitchLine([this.a, this.b]);
    this.cov = length <= SALVE_MAX ? new Coverage(center, length / 2 + 6, 10) : null;
  }

  get small(): boolean {
    return this.cov !== null;
  }

  get half(): number {
    return this.length / 2;
  }

  override wants(): readonly ToolId[] {
    return this.small ? ['thread', 'salve'] : ['thread'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return pointSegment(p, this.a, this.b).d < 24 + pad;
  }

  override drain(op: Operation): number {
    const L = op.tuning.laceration;
    const gap = this.stitch.count >= this.stitch.needed ? op.tuning.stitch.gapBleed : 1;
    return (L.baseDrain + this.length * L.drainPerPx) * this.bleed * gap;
  }

  override update(op: Operation, dt: number): void {
    const L = op.tuning.laceration;
    if (this.bleed > 0) {
      this.poolT += dt;
      if (this.poolT >= L.poolEvery) {
        this.poolT = 0;
        feedPool(op, this.pos, (L.poolBase + this.length * L.poolPerPx) * this.bleed);
      }
    }
    // Pus seeping into an open wound turns it to rot.
    const pus = op.entities.some((e) => e instanceof BloodPool && e.alive && e.ichor === 'pus' && dist(e.pos, this.pos) < e.r + this.half);
    this.pusT = pus ? this.pusT + dt : Math.max(0, this.pusT - dt);
    if (pus) op.sayOnce('pus-wound', 'The pus is getting into that cut — drain it before it festers!', 'danger');
    if (this.pusT >= L.pusRotTime) {
      this.kill();
      op.spawnPenalty(new Rot({ ...this.pos }, Math.max(L.festerMinR, this.half + L.festerPad), L.festerSpread));
      op.rate('bad', this.pos, 'Festered');
    }
  }

  private flooded(op: Operation): boolean {
    return op.entities.some((e) => e instanceof BloodPool && e.alive && e.r > 30 && dist(e.pos, this.pos) < e.r * 0.8);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool === 'thread') {
      if (pointSegment(ptr.pos, this.a, this.b).d > op.tuning.stitch.reach + op.hitPad) return;
      if (this.flooded(op)) {
        op.sayOnce('flooded', 'Too much blood — draw it off with the leech-pipe before you stitch!');
        return;
      }
      if (op.entities.some((e) => e.alive && e.stitchBlockRadius > 0 && dist(e.pos, this.pos) < e.stitchBlockRadius)) {
        op.sayOnce('compound', 'The bone’s through the skin — set it before you stitch over it.');
        return;
      }
      if (this.stitch.sweep(op, ptr)) {
        this.kill();
        op.scars.push([{ ...this.a }, { ...this.b }]);
        op.rate(this.stitch.quality(op), this.pos, 'Stitched');
      }
    } else if (tool === 'salve') {
      if (!this.cov) {
        if (pointSegment(ptr.pos, this.a, this.b).d < 20) op.sayOnce('salve-big', 'Salve won’t hold a wound that size. Stitch it first.');
        return;
      }
      if (!this.cov.contains(ptr.pos, 20)) return;
      if (!op.canSalve()) return;
      const n = this.cov.brush(ptr.pos);
      op.useSalve(n);
      if (n > 0 && this.cov.fraction >= op.tuning.laceration.salveCoverage) {
        this.kill();
        op.rate('good', this.pos, 'Sealed');
      }
    }
  }

  private edge(): Vec[] {
    if (this.source === 'blade') return [this.a, this.b];
    // Claw rakes tear a ragged line.
    const pts: Vec[] = [];
    const n = Math.max(3, Math.round(this.length / 10));
    const nx = -(this.b.y - this.a.y) / this.length;
    const ny = (this.b.x - this.a.x) / this.length;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : Math.sin(i * 2.7 + this.id) * 3.5;
      pts.push({ x: this.a.x + (this.b.x - this.a.x) * t + nx * j, y: this.a.y + (this.b.y - this.a.y) * t + ny * j });
    }
    return pts;
  }

  override drawSurface(g: Gfx): void {
    surfLine(g, this.edge(), this.small ? 8 : 13, 1, 0.5, 0, 0.1);
  }

  draw(g: Gfx, op: Operation): void {
    // Carved by the flesh shader; a faint wet glint along the lip, then stitches and salve.
    g.polyline(this.edge(), 1.5, hex(presentation.gore === 2 ? '#000000' : '#ff9090', 0.3));
    if (this.pusT > 0) g.polyline(this.edge(), 5, hex('#d8c040', Math.min(0.6, this.pusT / op.tuning.laceration.pusRotTime)));
    this.stitch.draw(g, op);
    if (this.cov) drawCoverage(g, this.cov);
  }
}

// ============================================================ embedded objects

export type EmbeddedKind = 'arrow' | 'bolt' | 'shot' | 'tooth' | 'shard' | 'glass' | 'hexstone';

export const EMBED_SPEC: Record<EmbeddedKind, { len: number; wound: number; drain: number; label: string; heavy: boolean }> = {
  arrow: { len: 90, wound: 56, drain: 0.45, label: 'Arrow', heavy: false },
  bolt: { len: 60, wound: 50, drain: 0.5, label: 'Bolt', heavy: true },
  shot: { len: 0, wound: 30, drain: 0.4, label: 'Lead shot', heavy: true },
  tooth: { len: 26, wound: 36, drain: 0.35, label: 'Fang', heavy: false },
  shard: { len: 30, wound: 34, drain: 0.3, label: 'Shard', heavy: false },
  glass: { len: 24, wound: 28, drain: 0.25, label: 'Glass', heavy: false },
  hexstone: { len: 30, wound: 40, drain: 0.45, label: 'Hexstone', heavy: false },
};

/**
 * Anything lodged in the flesh. Seize with tongs and pull it clear off the body
 * along its axis. Barbed heads must first be freed with two lancet nicks at the
 * entry; bolts come out in two stages; glass cuts if hurried; hexstone writhes
 * until branded still and must go in the lead dish.
 */
export class Embedded extends Entity {
  grabbed = false;
  private grabT = 0;
  private offset: Vec = { x: 0, y: 0 };
  readonly origin: Vec;
  nicks = 0;
  private corruptT = 0;
  private tore = false;
  /** Pull quality judged once it leaves the entry. */
  private pull: 'cool' | 'good' | null = null;
  private target: Vec;
  /** Bolt: loosened by a pause mid-pull. */
  staged = false;
  private stillT = 0;
  snapped = false;
  private glassNicked = false;
  /** Hexstone: branded still. */
  calmed = false;
  private calmT = 0;
  private whisperT = 0;
  shallow = false;
  noun: string;

  constructor(
    pos: Vec,
    public kind: EmbeddedKind,
    public angle = 0,
    public barbed = kind === 'arrow',
  ) {
    super(pos);
    this.origin = { ...pos };
    this.target = { ...pos };
    this.layer = 3;
    this.noun = `the ${EMBED_SPEC[kind].label.toLowerCase()}`;
    if (kind !== 'hexstone') this.calmed = true;
  }

  get spec() {
    return EMBED_SPEC[this.kind];
  }

  /** Direction the object must be drawn out along (from the entry towards the shaft end). */
  get axis(): number {
    return this.angle + Math.PI;
  }

  /** The graspable end of the object (shaft end or the object itself). */
  get handle(): Vec {
    const l = this.spec.len * 0.7;
    return { x: this.pos.x - Math.cos(this.angle) * l, y: this.pos.y - Math.sin(this.angle) * l };
  }

  override drain(): number {
    return this.spec.drain * (this.shallow ? 0.5 : 1);
  }

  override wants(): readonly ToolId[] {
    if (this.barbed && this.nicks < 2) return ['lancet', 'tongs'];
    if (!this.calmed) return ['brand', 'tongs'];
    return ['tongs'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    const d = this.spec.len > 0 ? pointSegment(p, this.handle, this.origin).d : dist(p, this.pos);
    return d < 24 + pad;
  }

  override update(op: Operation, dt: number): void {
    if (this.kind !== 'hexstone') return;
    this.branded = false;
    if (this.grabbed) {
      // Bare tongs on hexstone: it whispers to the patient.
      this.whisperT += dt;
      const every = op.tuning.tongs.hexWhisperEvery;
      if (this.whisperT >= every) {
        this.whisperT -= every;
        op.hurt(op.tuning.tongs.hexWhisperHurt * (op.upgrades.has('silver-tongs') ? op.tuning.tongs.silverTongs : 1), this.pos);
        op.sayOnce('hex-whisper', 'It’s whispering to him through the tongs — into the lead dish, quickly!', 'danger');
      }
      return;
    }
    if (!this.calmed) {
      const j = op.tuning.tongs.hexJitter;
      this.pos = { x: this.origin.x + Math.sin(this.age * WRITHE_X + this.id) * j, y: this.origin.y + Math.cos(this.age * WRITHE_Y + this.id) * j };
    }
    // Hexstone corrupts the flesh around it while it stays lodged.
    this.corruptT += dt;
    // Corruption spreads, but never faster than a steady hand can salve it.
    const T = op.tuning.tongs;
    if (this.corruptT > T.hexCorruptEvery && op.entities.filter((e) => e instanceof Rot && e.alive).length < T.hexCorruptMax) {
      this.corruptT = 0;
      const a = op.rng.range(0, TAU);
      const p = { x: this.origin.x + Math.cos(a) * T.hexCorruptDist, y: this.origin.y + Math.sin(a) * T.hexCorruptDist * T.hexCorruptAspect };
      // The patient's rot is the surgeon's delay: it pays nothing.
      if (onBody(p)) op.spawnPenalty(new Rot(p, T.hexCorruptRot));
      op.sayOnce('hexstone', 'The hexstone is corrupting the flesh around it — get it out!');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (this.kind !== 'hexstone' || this.calmed || tool !== 'brand' || dist(ptr.pos, this.pos) > 22 + op.hitPad) return;
    this.branded = true;
    this.calmT += dt;
    if (this.calmT >= op.tuning.tongs.hexCalm) {
      this.calmed = true;
      this.pos = { ...this.origin };
      op.cues.push('burn');
      op.rate('good', this.pos, 'Stilled');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'lancet' && this.barbed && this.nicks < 2 && dist(ptr.pos, this.origin) < 30 + op.hitPad) {
      this.nicks++;
      op.cues.push('cut');
      op.rate('good', ptr.pos, this.nicks === 2 ? 'Barbs freed' : 'Nick');
      return true;
    }
    if (tool !== 'tongs') return false;
    const target = this.spec.len > 0 ? pointSegment(ptr.pos, this.handle, this.origin).d : dist(ptr.pos, this.pos);
    if (target > op.tuning.tongs.grab + op.hitPad) return false;
    this.grabbed = true;
    this.grabT = 0;
    this.stillT = 0;
    this.offset = { x: this.pos.x - ptr.pos.x, y: this.pos.y - ptr.pos.y };
    this.target = { ...this.pos };
    op.cues.push('pluck');
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.grabbed || tool !== 'tongs') return;
    const T = op.tuning.tongs;
    this.grabT += dt;
    const prevTarget = this.target;
    this.target = { x: ptr.pos.x + this.offset.x, y: ptr.pos.y + this.offset.y };
    const speed = dt > 0 ? dist(prevTarget, this.target) / dt : 0;
    // Heavy objects lag the hand; light ones follow it exactly.
    if (this.spec.heavy) {
      const k = 1 - Math.exp(-dt / T.heavyLag);
      this.pos = { x: this.pos.x + (this.target.x - this.pos.x) * k, y: this.pos.y + (this.target.y - this.pos.y) * k };
    } else this.pos = { ...this.target };
    const d = dist(this.pos, this.origin);

    if (this.barbed && this.nicks < 2 && d > T.judgeAt) {
      // Ripped a barbed head out through the flesh.
      op.rate('bad', this.origin, 'Torn');
      op.harm(T.tornHurt, this.origin);
      op.spawnPenalty(new Laceration(this.origin, this.angle + Math.PI / 2, this.spec.wound + T.tornExtra, T.tornBleed));
      op.sayOnce('barbs', 'Barbed! Nick the flesh at the entry with the lancet before you pull.');
      this.barbed = false;
      this.nicks = 2;
      this.tore = true;
    }
    if (!this.pull && !this.tore && d > T.judgeAt) {
      // Judge the pull against the object's axis.
      if (this.spec.len === 0) this.pull = 'cool';
      else {
        const dev = angleDiff(Math.atan2(this.pos.y - this.origin.y, this.pos.x - this.origin.x), this.axis);
        if (dev <= T.coolAngle) this.pull = 'cool';
        else if (dev <= T.goodAngle) this.pull = 'good';
        else {
          this.tore = true;
          op.rate('bad', this.origin, 'Wrenched');
          op.harm(4, this.origin);
          op.spawnPenalty(new Laceration(this.origin, this.axis + Math.PI / 2, this.spec.wound + 10, 1.2));
          op.sayOnce('axis', 'Pull along the line it went in — you’re tearing the channel!');
        }
      }
    }
    if (this.kind === 'bolt' && !this.snapped && !this.staged) {
      const f = d / this.spec.len;
      if (f >= T.boltStage && speed < T.boltStill) {
        this.stillT += dt;
        if (this.stillT >= T.boltPause) {
          this.staged = true;
          op.popup('Loosened', this.pos, '#e8dcc0');
        }
      } else if (f >= T.boltSnap) {
        this.snapped = true;
        this.tore = true;
        op.rate('bad', this.origin, 'Snapped');
        const frag = new Embedded({ ...this.origin }, 'shard', this.angle, false);
        frag.noun = 'the bolt-head';
        frag.hidden = op.def.tools.includes('lens');
        op.spawnPenalty(frag);
        op.sayOnce('bolt-snap', 'It snapped — the head’s still in there! Ease them out: pull, pause, then draw.', 'danger');
      } else this.stillT = 0;
    }
    if (this.kind === 'glass' && !this.glassNicked && speed > T.glassSpeed && onBody(this.pos)) {
      this.glassNicked = true;
      op.rate('bad', this.pos, 'Sliced');
      op.spawnPenalty(new Laceration({ ...this.pos }, Math.atan2(this.target.y - prevTarget.y, this.target.x - prevTarget.x), 18, 0.4));
      op.sayOnce('glass-slow', 'Slowly with glass — it slices as it goes.');
    }
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.whisperT = 0;
    const off = !onBody(this.pos);
    if (off && this.kind === 'hexstone' && !inLeadDish(this.pos)) {
      op.sayOnce('lead-dish', 'Not the tray — hexstone goes in the lead dish!', 'danger');
      this.pos = { ...this.origin };
      this.shallow = true;
      return;
    }
    if (off) {
      this.kill();
      const pull = Math.atan2(this.pos.y - this.origin.y, this.pos.x - this.origin.x);
      op.emit('blood', this.origin, 18, pull, 0.6, 220);
      op.stain(this.origin, 26, 0.4);
      if (!this.tore) op.rate(this.pull ?? 'good', ptr.pos, this.spec.label);
      if (!this.tore || this.snapped) op.spawn(new Laceration(this.origin, this.angle + Math.PI / 2, this.spec.wound, 0.8));
      if (this.kind === 'shot') this.leaveWadding(op);
    } else {
      // Not pulled clear of the body: it sinks back in, shallowly.
      this.pos = { ...this.origin };
      this.target = { ...this.origin };
      if (dist(ptr.pos, this.origin) > 30) {
        this.shallow = true;
        op.sayOnce('drop-off', 'Right off the body, Doctor — into the tray, or it sinks back in.');
      }
      this.pull = null;
    }
  }

  /** Lead shot drives cloth wadding in after it. */
  private leaveWadding(op: Operation): void {
    const first = !op.flags.has('wadding');
    if (!first && op.rng.next() < 0.5) return;
    op.flags.add('wadding');
    const a = op.rng.range(0, TAU);
    const w = new Wadding({ x: this.origin.x + Math.cos(a) * 22, y: this.origin.y + Math.sin(a) * 18 });
    w.hidden = op.def.tools.includes('lens');
    op.spawn(w);
    if (!w.hidden) op.sayOnce('wadding', 'Scraps of wadding went in with the shot — pull those out too, or it’ll fester.');
    else op.sayOnce('wadding', 'Shot drives wadding in after it. Search with the lens before we close.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.origin, 11, 1, 0.5);
    surfDisc(g, this.origin, 38, 0, 0.25, 0, this.kind === 'hexstone' ? 0.2 : 0.35);
    if (this.kind === 'hexstone') surfDisc(g, this.origin, 50, 0, 0, 0.35);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);
    // Entry wound.
    g.ellipse(this.origin.x, this.origin.y, 10, 7, this.angle, hex('#2a0306'), hex('#5a0a10'));
    if (this.barbed && this.nicks > 0) {
      for (let i = 0; i < this.nicks; i++) {
        const a = this.angle + Math.PI / 2 + i * Math.PI;
        g.line(this.origin, { x: this.origin.x + Math.cos(a) * 14, y: this.origin.y + Math.sin(a) * 14 }, 3, hex('#8a1016'));
      }
    } else if (this.barbed) {
      g.arc(this.origin.x, this.origin.y, 26, 2, hex('#ffebbe', 0.25 + 0.2 * Math.sin(op.elapsed * 4)));
    }
    // Pull-axis hint: shown with guides on; a fang's true angle only under the lens.
    const lensNear = op.tool === 'lens' && dist(op.cursor, this.origin) < op.tuning.lens.radius;
    if (!this.grabbed && this.spec.len > 0 && ((this.kind !== 'tooth' && op.guides) || lensNear)) {
      const ax = this.axis;
      const far = { x: this.origin.x + Math.cos(ax) * (this.spec.len + 40), y: this.origin.y + Math.sin(ax) * (this.spec.len + 40) };
      g.dashed([this.origin, far], 1.5, hex(lensNear ? '#b9d7ff' : '#ffebbe', 0.35), 5, 7, -op.elapsed * 10);
    }
    const tail = { x: x - ca * this.spec.len, y: y - sa * this.spec.len };
    switch (this.kind) {
      case 'arrow':
      case 'bolt': {
        g.line({ x, y }, tail, this.kind === 'arrow' ? 4 : 6, hex(this.kind === 'arrow' ? '#7a5a36' : '#4d3a26'));
        const fl = hex(this.kind === 'arrow' ? '#d8d2c0' : '#6d6452');
        for (const s of [-1, 1]) {
          g.tri(tail.x, tail.y, tail.x - sa * 8 * s + ca * 14, tail.y + ca * 8 * s + sa * 14, tail.x + ca * 24, tail.y + sa * 24, fl);
        }
        if (this.grabbed || dist(this.pos, this.origin) > 1) {
          g.tri(x + ca * 12, y + sa * 12, x - sa * 6, y + ca * 6, x + sa * 6, y - ca * 6, hex('#9aa0a6'));
        }
        if (this.kind === 'bolt' && this.grabbed && !this.staged) {
          const f = dist(this.pos, this.origin) / this.spec.len;
          if (f > 0.3) g.arc(x, y, 18, 2, hex('#ffebbe', 0.6), Math.min(1, this.stillT / 0.3));
        }
        break;
      }
      case 'shot':
        g.circleGrad(x, y, 9, hex('#d0d0d8'), hex('#3a3a45'));
        break;
      case 'tooth':
        g.tri(x, y, tail.x - sa * 8, tail.y + ca * 8, tail.x + sa * 8, tail.y - ca * 8, hex('#e8e0c8'), hex('#b8ae90'), hex('#b8ae90'));
        break;
      case 'shard':
      case 'glass':
      case 'hexstone': {
        const warp = this.kind === 'hexstone';
        const c = warp ? hex('#e8a838', 0.75 + 0.25 * Math.sin(op.elapsed * 5)) : this.kind === 'glass' ? hex('#c8e6f0', 0.75) : hex('#8a8f96');
        if (warp) g.creature(3, x, y, 90, { seed: this.id, blend: 'add' });
        g.poly(
          [
            { x, y },
            { x: tail.x - sa * 7, y: tail.y + ca * 7 },
            { x: tail.x - ca * 6, y: tail.y - sa * 6 },
            { x: tail.x + sa * 7, y: tail.y - ca * 7 },
          ],
          c,
        );
        if (warp && !this.calmed && this.calmT > 0) g.arc(this.origin.x, this.origin.y, 24, 3, hex('#ff9040'), this.calmT / 0.5);
        break;
      }
    }
  }
}

/** Cloth wadding driven in behind lead shot. Leave it in and the wound festers. */
export class Wadding extends Entity {
  private grabbed = false;
  noun = 'the wadding';
  constructor(pos: Vec) {
    super(pos);
    this.required = false;
    this.feverOnClose = true;
    this.layer = 3;
  }
  override wants(): readonly ToolId[] {
    return ['tongs'];
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > op.tuning.tongs.grab + op.hitPad) return false;
    this.grabbed = true;
    op.cues.push('pluck');
    return true;
  }
  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }
  override onRelease(op: Operation, ptr: Pointer): void {
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('good', ptr.pos, 'Wadding');
    }
  }
  draw(g: Gfx): void {
    g.ellipse(this.pos.x, this.pos.y, 7, 5, 0.4, hex('#b8a888'), hex('#6a5a40'));
  }
}

// ============================================================ burns

/**
 * A burn. Fire: pluck the eschar away with tongs (grade-3 burns first need their
 * dead black centre excised with the lancet), then salve. Acid: keeps spreading
 * until the leech-pipe draws the acid off. Hexfire: rekindles after salving
 * unless its ember is branded out.
 */
export class Burn extends Entity {
  flakes: Vec[] = [];
  readonly cov: Coverage;
  readonly total: number;
  /** Grade-3: a charred core to excise with the lancet before salving. */
  charCore: boolean;
  private coreCut = 0;
  private corePress = -1;
  /** Acid: still eating outward. */
  acidLive: boolean;
  private acidT = 0;
  private acidPress = -1;
  /** Hexfire: the ember that rekindles it. */
  ember: Vec | null;
  private emberT = 0;
  smoulder = -1;
  radiusNow: number;
  private stroke = -1;
  private oneStroke = true;
  noun = 'the burn';

  constructor(
    pos: Vec,
    public radius: number,
    op: Operation,
    public source: 'fire' | 'acid' | 'hexfire' = 'fire',
  ) {
    super(pos);
    const B = op.tuning.burn;
    this.radiusNow = radius;
    this.cov = new Coverage(pos, source === 'acid' ? Math.max(radius, B.acidMax) : radius, 12);
    const n = source === 'acid' ? 0 : Math.max(3, Math.round(radius / 12));
    for (let i = 0; i < n; i++) {
      const a = op.rng.range(0, TAU);
      const r = op.rng.range(radius * 0.35, radius * 0.8);
      this.flakes.push({ x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r });
    }
    this.total = Math.max(1, n);
    this.charCore = source === 'fire' && radius >= B.grade3Radius;
    this.acidLive = source === 'acid';
    this.ember = source === 'hexfire' ? { x: pos.x + radius * 0.3, y: pos.y - radius * 0.2 } : null;
  }

  get grade(): 1 | 2 | 3 {
    return this.charCore || this.coreCut > 0 ? 3 : this.flakes.length > 0 || this.source !== 'fire' ? 2 : 1;
  }

  /** Coverage of the cells currently burned (acid grows). */
  healed(): number {
    let n = 0;
    let d = 0;
    for (const c of this.cov.cells) {
      if (c.x * c.x + c.y * c.y > this.radiusNow * this.radiusNow) continue;
      n++;
      if (c.done) d++;
    }
    return n ? d / n : 1;
  }

  override wants(): readonly ToolId[] {
    if (this.charCore) return ['lancet'];
    if (this.acidLive) return ['leech'];
    if (this.flakes.length) return ['tongs'];
    if (this.ember && this.healed() >= 0.5) return ['brand', 'salve'];
    return ['salve'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.radiusNow + 10 + pad;
  }

  override drain(op: Operation): number {
    const B = op.tuning.burn;
    const base = this.source === 'hexfire' ? B.hexDrain : this.source === 'acid' ? B.acidDrain : B.fireDrain;
    return base * (this.radiusNow / this.radius) + this.flakes.length * B.perFlake;
  }

  override update(op: Operation, dt: number): void {
    const B = op.tuning.burn;
    this.branded = false;
    if (this.acidLive) this.radiusNow = Math.min(B.acidMax, this.radiusNow + B.acidSpread * dt);
    if (this.smoulder >= 0) {
      this.smoulder -= dt;
      if (this.smoulder <= B.hexTell && this.smoulder + dt > B.hexTell) op.sayOnce('hex-tell', 'Green flicker — it’s rekindling! Brand out the ember!', 'danger');
      if (this.smoulder <= 0) {
        this.smoulder = -1;
        for (const c of this.cov.cells) c.done = false;
        op.hurt(B.reigniteHurt, this.pos);
        op.popup('It rekindles!', this.pos, REKINDLE_COLOR);
        this.oneStroke = false;
      }
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'lancet' && this.charCore && dist(ptr.pos, this.pos) < this.radius * 0.5 + op.hitPad) {
      this.corePress = op.pressId;
      this.coreCut = 0;
      op.cues.push('cut');
      return true;
    }
    if (tool !== 'tongs') return false;
    const i = this.flakes.findIndex((f) => dist(f, ptr.pos) < 16 + op.hitPad);
    if (i < 0) return false;
    const [f] = this.flakes.splice(i, 1);
    op.cues.push('pluck');
    op.emit('smoke', f, 2);
    op.emit('blood', f, 2, undefined, undefined, 60);
    op.rate('good', f, 'Debrided');
    if (this.flakes.length === 0) op.sayOnce('burn-salve', 'The dead flesh is off. Now salve the raw burn.');
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || this.corePress !== op.pressId || !this.charCore) return;
    if (dist(ptr.pos, this.pos) > this.radius) return;
    this.coreCut += dist(ptr.prev, ptr.pos);
    if (this.coreCut >= this.radius * 0.8) {
      this.charCore = false;
      op.emit('smoke', this.pos, 6);
      op.rate('good', this.pos, 'Char excised');
      op.sayOnce('burn-core', 'The dead core’s out. Pluck the rest of the eschar, then salve.');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    const B = op.tuning.burn;
    if (tool === 'leech' && this.acidLive && dist(ptr.pos, this.pos) < this.radiusNow + 10) {
      this.acidT += dt;
      if (this.acidT >= B.acidNeutralise) {
        this.acidLive = false;
        op.cues.push('squelch');
        op.rate('good', this.pos, 'Neutralised');
      }
      return;
    }
    if (tool === 'brand' && this.ember && dist(ptr.pos, this.ember) < 16 + op.hitPad) {
      this.branded = true;
      this.emberT += dt;
      if (this.emberT >= op.tuning.brand.hexfireEmber) {
        this.ember = null;
        this.smoulder = -1;
        op.cues.push('burn');
        op.rate('good', this.pos, 'Ember out');
        if (this.healed() >= B.coverage) this.finish(op);
      }
      return;
    }
    if (tool !== 'salve' || !this.cov.contains(ptr.pos, 18) || dist(ptr.pos, this.pos) > this.radiusNow + 18) return;
    if (this.charCore) {
      op.sayOnce('burn-char', 'That centre is dead flesh — cut the char out with the lancet first!');
      return;
    }
    if (this.acidLive) {
      if (this.acidPress !== op.pressId) {
        this.acidPress = op.pressId;
        op.rate('bad', this.pos, 'Salve on acid');
        op.sayOnce('acid-first', 'The acid’s still live! Draw it off with the leech-pipe before you salve.');
      }
      return;
    }
    if (this.flakes.length > 0) {
      op.sayOnce('burn-eschar', 'Pluck away the charred eschar with the tongs first!');
      return;
    }
    if (this.stroke !== op.pressId) {
      if (this.stroke >= 0) this.oneStroke = false;
      this.stroke = op.pressId;
    }
    if (!op.canSalve()) return;
    const n = this.cov.brush(ptr.pos, op.tuning.salve.brush);
    op.useSalve(n);
    if (n > 0 && this.healed() >= B.coverage && this.smoulder < 0) {
      if (this.ember) {
        this.smoulder = B.hexReignite;
        op.sayOnce('hex-ember', 'Its ember still glows — brand it out or the hexfire will rekindle!', 'danger');
        return;
      }
      this.finish(op);
    }
  }

  private finish(op: Operation): void {
    this.kill();
    op.rate(this.oneStroke ? 'cool' : 'good', this.pos, 'Burn dressed');
  }

  override drawSurface(g: Gfx): void {
    const left = this.flakes.length / this.total;
    const healed = this.healed();
    const core = this.charCore ? 1 : 0;
    const char = Math.min(1, (0.3 + 0.7 * left + core * 0.4) * (1 - healed * 0.85));
    const r = this.radiusNow;
    // Inflamed halo, raw red bed, then a solid char core while eschar remains.
    surfDisc(g, this.pos, r * 1.7, 0, 0.3 * (1 - healed), 0, 0.45);
    surfDisc(g, this.pos, r * 1.25, 0, this.source === 'acid' ? 0.5 * (1 - healed) : 0.35 * (1 - healed), char * 0.6, 0);
    surfDisc(g, this.pos, r * 0.9, 0, 0, char * 0.7, 0);
    if (core) surfDisc(g, this.pos, this.radius * 0.45, 0, 0, 1, 0);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    // Char and rawness come from the surface layer; embers and eschar crusts are drawn here.
    if (this.source === 'hexfire') g.creature(2, x, y - this.radiusNow * 0.3, this.radiusNow * 3, { seed: this.id, intensity: 0.35 + 0.65 * (1 - this.cov.fraction), blend: 'add' });
    else if (this.source === 'acid') g.glow(x, y, this.radiusNow * 1.1, hex(this.acidLive ? '#b8e040' : '#708040', 0.14 + (this.acidLive ? 0.06 * Math.sin(op.elapsed * 6) : 0)));
    else if (this.flakes.length) g.glow(x, y, this.radius * 0.9, hex('#ff5a1a', 0.1 + 0.05 * Math.sin(op.elapsed * 5 + this.id)));
    if (this.charCore) g.circleGrad(x, y, this.radius * 0.45, hex('#050302', 0.85), hex('#1a0e08', 0.2));
    for (const f of this.flakes) {
      const rot = (f.x * 0.37 + f.y * 0.11) % 3;
      g.ellipse(f.x + 1.5, f.y + 2, 12, 9, rot, hex('#000000', 0.5));
      g.ellipse(f.x, f.y, 12, 9, rot, hex('#2a1c16'), hex('#0e0806'));
      g.ellipse(f.x - 3, f.y - 3, 4, 2, rot, hex('#6a5040', 0.6));
    }
    if (this.ember) {
      g.glow(this.ember.x, this.ember.y, 18, hex('#c060ff', 0.5 + 0.3 * Math.sin(op.elapsed * 9))); // curse-violet: hexfire is Malison-born
      g.circle(this.ember.x, this.ember.y, 4, hex('#f0c0ff'));
    }
    drawCoverage(g, this.cov, this.radiusNow);
  }
}

// ============================================================ disease

/**
 * A plague bubo. Lance it with a short cut across its crown (longer than the
 * bubo is wide and it spills), draw off the pus, then salve. Left alone it
 * swells for 30 s and bursts.
 */
export class Bubo extends Entity {
  lanced = false;
  readonly cov: Coverage;
  private readonly r0: number;
  private pressAt: Vec | null = null;
  noun = 'the bubo';
  constructor(
    pos: Vec,
    public r = 22,
    public maxR = 40,
  ) {
    super(pos);
    this.layer = 2;
    this.r0 = r;
    this.cov = new Coverage(pos, maxR * 0.8, 12);
  }

  override wants(): readonly ToolId[] {
    return this.lanced ? ['salve'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < (this.lanced ? this.cov.radius : this.r) + 8 + pad;
  }

  override drain(op: Operation): number {
    const B = op.tuning.bubo;
    return this.lanced ? B.lancedDrain : B.drainBase + this.r * B.drainPerPx;
  }

  /** Seconds until it bursts. */
  timeToBurst(op: Operation): number {
    const rate = (this.maxR - this.r0) / op.tuning.bubo.swellTime;
    return rate > 0 ? (this.maxR - this.r) / rate : Infinity;
  }

  override update(op: Operation, dt: number): void {
    if (this.lanced) return;
    this.r += (dt * (this.maxR - this.r0)) / op.tuning.bubo.swellTime;
    if (this.r >= this.maxR) {
      op.hurt(op.tuning.bubo.burstHurt, this.pos);
      const B = op.tuning.bubo;
      op.popup('It burst!', this.pos, BURST_COLOR);
      op.spawnPenalty(new BloodPool(this.pos, B.burstPool, 'pus'), new Laceration(this.pos, op.rng.range(0, TAU), B.burstCut, B.burstBleed));
      this.lanced = true;
      op.counts.miss++;
      op.combo = 0;
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.lanced || tool !== 'lancet' || dist(ptr.pos, this.pos) > this.r + 6 + op.hitPad) return false;
    this.pressAt = { ...ptr.pos };
    if (op.assists.simpleGestures) this.lance(op, ptr.pos, 0);
    return true;
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (this.lanced || !this.pressAt) return;
    const a = this.pressAt;
    this.pressAt = null;
    const len = dist(a, ptr.pos);
    if (len < op.tuning.bubo.minCut) {
      op.sayOnce('bubo-cut', 'Draw a short cut across the crown — a prick won’t open it.');
      return;
    }
    if (pointSegment(this.pos, a, ptr.pos).d > this.r * 0.6) return;
    this.lance(op, ptr.pos, len);
  }

  private lance(op: Operation, at: Vec, len: number): void {
    this.lanced = true;
    op.cues.push('squelch');
    op.emit('pus', this.pos, 20, undefined, undefined, 160);
    op.spawn(new BloodPool({ x: this.pos.x, y: this.pos.y + 6 }, this.r * 1.1, 'pus'));
    if (len > this.r * 2) {
      op.rate('bad', at, 'Overcut');
      op.spawnPenalty(new BloodPool({ x: this.pos.x + this.r, y: this.pos.y - 4 }, this.r * 0.8, 'pus'));
      op.sayOnce('bubo-overcut', 'Too long a cut — it’s spilling everywhere. Short and across the crown!');
      return;
    }
    op.rate(this.r < this.maxR * 0.75 ? 'cool' : 'good', this.pos, 'Lanced');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.lanced || !this.cov.contains(ptr.pos, 18)) return;
    if (op.entities.some((e) => e instanceof BloodPool && e.alive && e.ichor === 'pus' && dist(e.pos, this.pos) < 30)) {
      op.sayOnce('pus', 'Draw off the pus before you salve it.');
      return;
    }
    if (!op.canSalve()) return;
    const n = this.cov.brush(ptr.pos, op.tuning.salve.brush);
    op.useSalve(n);
    if (n > 0 && this.cov.fraction >= 0.85) {
      this.kill();
      op.rate('good', this.pos, 'Cleansed');
    }
  }

  override drawSurface(g: Gfx): void {
    if (!this.lanced) {
      surfDisc(g, this.pos, this.r * 2.1, 0, 0.25, 0, 1);
      surfDisc(g, this.pos, this.r * 1.2, 0, 0.1, 0, 0.8);
    } else {
      surfDisc(g, this.pos, 14, 0.95, 0.4);
      surfDisc(g, this.pos, this.maxR * 1.3, 0, 0.4 * (1 - this.cov.fraction), 0, 0.35);
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    if (!this.lanced) {
      // Swelling comes from the surface layer; show the ripe head and a tight shine.
      const ripe = this.r / this.maxR;
      g.circleGrad(x, y, this.r * 0.55, hex('#f0e090', 0.55 + 0.35 * ripe), hex('#c89050', 0));
      g.ellipse(x - this.r * 0.3, y - this.r * 0.35, this.r * 0.22, this.r * 0.1, -0.6, hex('#ffffff', 0.45), hex('#ffffff', 0));
      if (ripe > 0.75) g.arc(x, y, this.r + 4, 2, hex('#ff503c', 0.4 + 0.4 * Math.sin(op.elapsed * 12)));
    } else drawCoverage(g, this.cov);
  }
}

/**
 * Rot, gangrene or blight: a patch spreading 2 px/s up to 60 px, soothed with
 * salve. It dies only at 95 % coverage; islands left behind regrow at 20 % of
 * the remainder per second.
 */
export class Rot extends Entity {
  readonly cov: Coverage;
  private regrowAcc = 0;
  private brushedAt = -1;
  private strokes = new Set<number>();
  readonly maxR: number;
  noun = 'the rot';
  constructor(
    pos: Vec,
    public r: number,
    public spread = 0.6,
  ) {
    super(pos);
    this.layer = -2;
    this.maxR = Math.max(r, DEFAULT_TUNING.rot.maxR);
    this.cov = new Coverage(pos, this.maxR, 12);
  }

  private active(c: { x: number; y: number }): boolean {
    return c.x * c.x + c.y * c.y <= this.r * this.r;
  }

  /** Healed fraction of the patch as it stands now. */
  get fraction(): number {
    let n = 0;
    let d = 0;
    for (const c of this.cov.cells) {
      if (!this.active(c)) continue;
      n++;
      if (c.done) d++;
    }
    return n ? d / n : 1;
  }

  override wants(): readonly ToolId[] {
    return ['salve'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.r + 8 + pad;
  }

  override drain(op: Operation): number {
    return (op.tuning.rot.baseDrain + this.r * op.tuning.rot.drainPerPx) * (1 - this.fraction * 0.5);
  }

  override update(op: Operation, dt: number): void {
    const R = op.tuning.rot;
    this.r = Math.min(this.maxR, this.r + R.growth * dt);
    // Islands left unsalved spread back over the salved flesh.
    if (op.pressId === this.brushedAt && op.tool === 'salve') return;
    const done = this.cov.cells.filter((c) => c.done && this.active(c));
    if (!done.length) return;
    const rotten = this.cov.cells.filter((c) => !c.done && this.active(c)).length;
    this.regrowAcc += (this.spread + rotten * op.tuning.salve.regrowFrac) * dt;
    while (this.regrowAcc >= 1 && done.length) {
      this.regrowAcc -= 1;
      const i = Math.floor(op.rng.next() * done.length);
      done[i].done = false;
      done.splice(i, 1);
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || dist(ptr.pos, this.pos) > this.r + 18) return;
    this.brushedAt = op.pressId;
    const hit = this.cov.cells.filter((c) => {
      if (c.done || !this.active(c)) return false;
      const dx = this.pos.x + c.x - ptr.pos.x;
      const dy = this.pos.y + c.y - ptr.pos.y;
      return dx * dx + dy * dy <= op.tuning.salve.brush ** 2;
    });
    if (hit.length === 0 || !op.canSalve()) return;
    op.useSalve(hit.length);
    for (const c of hit) c.done = true;
    this.strokes.add(op.pressId);
    if (this.fraction >= op.tuning.rot.coverage) {
      this.kill();
      op.rate(this.strokes.size <= 1 ? 'cool' : 'good', this.pos, 'Rot purged');
    }
  }

  override drawSurface(g: Gfx): void {
    for (const c of this.cov.cells) if (!c.done && this.active(c)) surfDisc(g, { x: this.pos.x + c.x, y: this.pos.y + c.y }, 16, 0, 0.12, 0.12, 0.05);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    // Bubbling slows as the rot is salved away.
    const speed = 2 * (1 - this.fraction);
    for (const c of this.cov.cells) {
      if (c.done || !this.active(c)) continue;
      const w = Math.sin(op.elapsed * speed + c.x * 0.1 + c.y * 0.13) * 1.5;
      g.circleGrad(x + c.x, y + c.y, 11 + w, hex('#46582a', 0.6), hex('#46582a', 0));
    }
    for (const c of this.cov.cells) {
      if (c.done || !this.active(c) || (c.x + c.y) % 3 !== 0) continue;
      g.circle(x + c.x, y + c.y, 3, hex('#1e280f', 0.7));
    }
  }
}

/** A drop of venom racing along a vein toward the heart. */
export interface VenomMote {
  s: number;
  alive: boolean;
}

/**
 * Venom from a bite or sting, spreading as black veins. Hold the tincture on it
 * to neutralise. Until then it sends motes along a vein toward the heart: brand
 * or leech them, or tie the vein off with a stitch across it.
 */
export class Venom extends Entity {
  spreadR = 16;
  private holdT = 0;
  private veins: { a: number; l: number }[] = [];
  /** Vein from the bite to the heart. */
  readonly vein: Vec[];
  readonly veinLen: number;
  motes: VenomMote[] = [];
  private moteT = 0;
  /** Arc length at which the vein has been tied off (Infinity = open). */
  ligature = Infinity;
  noun = 'the venom';

  constructor(
    pos: Vec,
    op: Operation,
    public rate = 6,
    public color: 'green' | 'violet' = 'violet',
  ) {
    super(pos);
    this.layer = 1;
    for (let i = 0; i < 7; i++) this.veins.push({ a: op.rng.range(0, TAU), l: op.rng.range(0.6, 1.2) });
    const heart = Venom.heart();
    const n = 8;
    const pts: Vec[] = [];
    const nx = -(heart.y - pos.y);
    const ny = heart.x - pos.x;
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = Math.sin(t * Math.PI * 2 + this.id) * 14 * Math.sin(t * Math.PI);
      pts.push({ x: pos.x + (heart.x - pos.x) * t + (nx / nl) * w, y: pos.y + (heart.y - pos.y) * t + (ny / nl) * w });
    }
    this.vein = pts;
    this.veinLen = polyLength(pts);
  }

  /** Where every vein leads. */
  static heart(): Vec {
    return { x: FIELD.cx, y: FIELD.cy - FIELD.ry * 0.55 };
  }

  motePos(m: VenomMote): Vec {
    return pointAlong(this.vein, m.s);
  }

  override wants(): readonly ToolId[] {
    return ['tincture'];
  }

  override drain(op: Operation): number {
    return op.tuning.venom.baseDrain + this.spreadR * op.tuning.venom.drainPerPx;
  }

  override update(op: Operation, dt: number): void {
    const V = op.tuning.venom;
    // Green antivenom slows every venom for a while.
    if (op.venomSlowT > 0) dt *= V.antivenomSlow;
    this.spreadR = Math.min(V.maxSpread, this.spreadR + this.rate * dt);
    if (this.rate <= 0) return;
    this.moteT += dt;
    if (this.moteT >= V.moteEvery) {
      this.moteT = 0;
      this.motes.push({ s: 0, alive: true });
      op.sayOnce('venom-mote', 'The venom’s running for his heart along the vein — sear or draw off the drops, or tie the vein!', 'danger');
    }
    for (const m of this.motes) {
      if (!m.alive) continue;
      m.s += V.moteSpeed * dt;
      if (m.s >= this.ligature) {
        m.alive = false;
        continue;
      }
      if (m.s >= this.veinLen) {
        m.alive = false;
        op.hurt(V.moteHurt, Venom.heart());
        op.popup('It reached the heart!', Venom.heart(), '#e0b040');
      }
    }
    this.motes = this.motes.filter((m) => m.alive);
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 26 + op.hitPad) return false;
    this.holdT = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId, dt: number): void {
    if (dist(ptr.pos, this.pos) > 30 + op.hitPad) return;
    this.holdT += dt;
    if (this.holdT > op.tuning.tincture.antivenomHold) {
      this.kill();
      op.cues.push('inject');
      op.rate(this.spreadR < 50 ? 'cool' : 'good', this.pos, 'Antidote');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    const V = op.tuning.venom;
    if (tool === 'brand' || tool === 'leech') {
      for (const m of this.motes) {
        if (m.alive && dist(this.motePos(m), ptr.pos) < V.moteHit + op.hitPad) {
          m.alive = false;
          if (tool === 'brand') this.branded = true;
          op.popup('Caught', this.motePos(m), '#9fd3a8');
          op.cues.push(tool === 'brand' ? 'burn' : 'squelch');
        }
      }
      if (tool === 'brand' && dist(ptr.pos, this.pos) < 20) this.branded = true;
    } else if (tool === 'thread' && this.ligature === Infinity && !ptr.pressed) {
      for (let i = 1; i < this.vein.length; i++) {
        if (!strokeCrosses(ptr.prev, ptr.pos, this.vein[i - 1], this.vein[i])) continue;
        this.ligature = projectAlong(this.vein, ptr.pos).at;
        op.cues.push('stitch');
        op.rate('good', ptr.pos, 'Ligature');
        return;
      }
    }
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.spreadR * 1.5 + 26, 0, 0.55, 0.12, 0.35);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const ink = this.color === 'green' ? '#0e1a0a' : '#140a1e';
    for (const v of this.veins) {
      const pts: Vec[] = [{ x, y }];
      const r = this.spreadR * v.l;
      for (let s = 1; s <= 6; s++) {
        const t = s / 6;
        const wob = Math.sin(t * 9 + v.a * 3) * 8 * t;
        pts.push({ x: x + Math.cos(v.a) * r * t - Math.sin(v.a) * wob, y: y + Math.sin(v.a) * r * t + Math.cos(v.a) * wob });
      }
      g.polyline(pts, 3, hex(ink, 0.8));
    }
    // The vein to the heart, and any motes on it.
    g.polyline(this.vein, 2, hex(ink, 0.35));
    if (this.ligature !== Infinity) {
      const p = pointAlong(this.vein, this.ligature);
      g.circle(p.x, p.y, 5, hex('#efe6c4'));
    }
    const moteCol = this.color === 'green' ? '#90e060' : '#e0b040';
    for (const m of this.motes) {
      const p = this.motePos(m);
      g.glow(p.x, p.y, 14, hex(moteCol, 0.5));
      g.circle(p.x, p.y, 4, hex(moteCol));
    }
    g.circle(x, y, 10, hex(this.color === 'green' ? '#1a3010' : '#2a1030'));
    // Twin puncture marks.
    g.circle(x - 5, y, 3, hex('#000000'));
    g.circle(x + 5, y, 3, hex('#000000'));
    if (this.holdT > 0) g.arc(x, y, 20, 3, hex('#9fd3a8'), this.holdT / 0.9);
    else g.arc(x, y, 20 + Math.sin(op.elapsed * 5) * 2, 2, hex('#a0dcaa', 0.4));
    if (this.color === 'green') for (let i = 0; i < 3; i++) g.circle(x - 14 + i * 14, y + 16, 2, hex('#90e060', 0.8));
  }
}

// ============================================================ vermin

/**
 * A rot-grub, maggot or monster larva crawling toward the nearest open wound.
 * Sear it (0.8 s of brand) or drag it off the body with tongs. A brief touch of
 * the brand puffs it up and, if released too soon, it splits in two. Left for
 * 6 s it burrows (the lens finds it again).
 */
export class Grub extends Entity {
  heat = 0;
  private heading: number;
  private grabbed = false;
  private wasBranded = false;
  private soloBrand = true;
  burrowed = false;
  private sinceSurface = 0;
  noun = 'a grub';
  constructor(
    pos: Vec,
    op: Operation,
    public speed = 40,
    public small = false,
  ) {
    super(pos);
    this.layer = 6;
    this.heading = op.rng.range(0, TAU);
  }

  override wants(): readonly ToolId[] {
    return ['brand', 'tongs'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < 22 + pad;
  }

  override drain(op: Operation): number {
    return this.hidden ? op.tuning.grub.hiddenDrain : op.tuning.grub.drain * (this.small ? 0.6 : 1);
  }

  override reveal(op: Operation): void {
    super.reveal(op);
    this.burrowed = false;
    this.sinceSurface = 0;
  }

  override update(op: Operation, dt: number): void {
    const G = op.tuning.grub;
    const Br = op.tuning.brand;
    // Heat only bleeds away when the brand is off it.
    if (!this.branded) {
      if (this.wasBranded && this.soloBrand && !this.small && this.heat >= Br.grubSplitMin && this.heat < Br.grubSplitMax) return this.split(op);
      this.heat = Math.max(0, this.heat - dt * G.heatDecay);
    } else this.soloBrand = op.brandTargets <= 1;
    this.wasBranded = this.branded;
    this.branded = false;
    if (this.grabbed || this.hidden) return;
    this.sinceSurface += dt;
    if (this.sinceSurface > G.burrowAfter && op.def.tools.includes('lens') && this.heat === 0) {
      this.hidden = true;
      this.burrowed = true;
      op.sayOnce('grub-burrow', 'One’s burrowed in! Find it with the lens.', 'danger');
      return;
    }
    // Crawl toward the nearest open wound.
    let best: Vec | null = null;
    let bd = Infinity;
    for (const e of op.entities) {
      if (!e.alive || e.hidden || !isOpenWound(e)) continue;
      const d = dist(e.pos, this.pos);
      if (d < bd) {
        bd = d;
        best = e.pos;
      }
    }
    if (best && bd > G.seekStop) {
      const want = Math.atan2(best.y - this.pos.y, best.x - this.pos.x);
      let dA = want - this.heading;
      while (dA > Math.PI) dA -= TAU;
      while (dA < -Math.PI) dA += TAU;
      this.heading += clamp(dA, -G.steer * dt, G.steer * dt);
    }
    this.heading += op.rng.range(-G.wander, G.wander) * dt;
    const sp = this.speed * (this.small ? G.smallSpeed : 1);
    const next = { x: this.pos.x + Math.cos(this.heading) * sp * dt, y: this.pos.y + Math.sin(this.heading) * sp * dt };
    if (onBody(next)) this.pos = next;
    else this.heading += Math.PI * G.bounceTurn;
  }

  private split(op: Operation): void {
    this.kill();
    op.rate('bad', this.pos, 'Split');
    op.sayOnce('grub-split', 'Don’t let go half-way — hold the brand until it stops moving!');
    for (const s of [-1, 1]) {
      const g = new Grub({ x: this.pos.x + s * 12, y: this.pos.y }, op, this.speed, true);
      g.required = this.required;
      op.spawnPenalty(g);
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 20 + op.hitPad) return;
    this.branded = true;
    this.heat += dt;
    if (Math.random() < dt * 20) op.emit('spark', this.pos, 2);
    const need = op.tuning.brand.grubHold * (this.small ? 0.5 : 1);
    if (this.heat >= need) {
      this.kill();
      op.cues.push('burn');
      op.emit('spark', this.pos, 12);
      op.emit('smoke', this.pos, 4);
      op.stain(this.pos, 10, 0.3);
      op.rate('cool', this.pos, 'Seared');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > op.tuning.grub.grab + op.hitPad) return false;
    this.grabbed = true;
    op.cues.push('pluck');
    return true;
  }

  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('good', ptr.pos, 'Plucked');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const puff = this.heat > 0.15 && this.heat < 0.4 ? 1.25 : 1;
    if (presentation.creatureFilter) return drawBlotch(g, this.pos.x, this.pos.y, this.small ? 9 : 14);
    const s = (this.small ? 0.65 : 1) * puff;
    g.save();
    g.translate(this.pos.x, this.pos.y);
    g.rotate(this.heading);
    g.scale(s);
    for (let i = 3; i >= 0; i--) {
      const wig = Math.sin(op.elapsed * 10 + i) * 2;
      g.circle(-i * 7, wig, 7 - i * 0.8, i === 0 ? hex('#3a2a20') : rgba(220 - i * 10, 210 - i * 12, 170 - i * 10));
    }
    g.restore();
    if (this.heat > 0) {
      const need = DEFAULT_TUNING.brand.grubHold * (this.small ? 0.5 : 1);
      g.glow(this.pos.x, this.pos.y, 26, hex('#ff9040', Math.min(1, this.heat)));
      g.arc(this.pos.x, this.pos.y, 16, 3, hex('#ff9040'), this.heat / need);
    }
  }
}

// ============================================================ curses

/**
 * A curse-sigil burned into the flesh. Its strokes must be seared in order:
 * hold the brand on a stroke's numbered node to catch it (1 s), then trace the
 * stroke. Touching a later stroke first snaps it (BAD, a lash of torn flesh).
 * Left half-traced, it regresses one stroke every 4 s. It lashes the patient
 * periodically until broken.
 */
export class Sigil extends Entity {
  readonly segs: { a: Vec; b: Vec; burned: boolean[]; stroke: number }[] = [];
  readonly strokeCount: number;
  /** Stroke start nodes. */
  readonly nodes: Vec[] = [];
  ignited: boolean[];
  private nodeT = 0;
  private lashT = 0;
  private startT = -1;
  private idleT = 0;
  private snaps = 0;
  private snapPress = -1;
  noun = 'the curse-sigil';

  constructor(
    pos: Vec,
    shape: Vec[][],
    public size = 60,
    public lashEvery = 5,
  ) {
    super(pos);
    this.layer = -1;
    shape.forEach((stroke, si) => {
      this.nodes.push({ x: pos.x + stroke[0].x * size, y: pos.y + stroke[0].y * size });
      for (let i = 1; i < stroke.length; i++) {
        const a = { x: pos.x + stroke[i - 1].x * size, y: pos.y + stroke[i - 1].y * size };
        const b = { x: pos.x + stroke[i].x * size, y: pos.y + stroke[i].y * size };
        const n = Math.max(2, Math.round(dist(a, b) / 12));
        this.segs.push({ a, b, burned: new Array(n).fill(false), stroke: si });
      }
    });
    this.strokeCount = shape.length;
    this.ignited = new Array(shape.length).fill(false);
  }

  get progress(): number {
    let done = 0;
    let all = 0;
    for (const s of this.segs) {
      all += s.burned.length;
      done += s.burned.filter(Boolean).length;
    }
    return done / all;
  }

  strokeDone(i: number): boolean {
    return this.segs.every((s) => s.stroke !== i || s.burned.every(Boolean));
  }

  /** The stroke that must be traced next. */
  get current(): number {
    for (let i = 0; i < this.strokeCount; i++) if (!this.strokeDone(i)) return i;
    return this.strokeCount;
  }

  override wants(): readonly ToolId[] {
    return ['brand'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.segs.some((s) => pointSegment(p, s.a, s.b).d < 16 + pad) || this.nodes.some((n) => dist(n, p) < 16 + pad);
  }

  override drain(op: Operation): number {
    return op.tuning.sigil.drain;
  }

  override update(op: Operation, dt: number): void {
    const S = op.tuning.sigil;
    this.idleT = this.branded ? 0 : this.idleT + dt;
    this.branded = false;
    this.lashT += dt;
    if (this.lashT >= this.lashEvery) {
      this.lashT = 0;
      op.hurt(S.lashHurt, this.pos);
      op.popup('The curse lashes out!', { x: this.pos.x, y: this.pos.y - this.size - LABEL_GAP }, '#c890ff'); // curse-violet: curse sigil
    }
    // Half-traced curses knit themselves back together.
    if (this.idleT >= S.regressEvery && this.progress > 0) {
      this.idleT = 0;
      this.regress(op);
    }
  }

  private regress(op: Operation): void {
    const cur = this.current;
    const partial = cur < this.strokeCount && this.segs.some((s) => s.stroke === cur && s.burned.some(Boolean));
    const target = partial ? cur : Math.min(cur, this.strokeCount) - 1;
    if (target < 0) return;
    for (const s of this.segs) if (s.stroke === target) s.burned.fill(false);
    this.ignited[target] = false;
    op.popup('The sigil knits back!', { x: this.pos.x, y: this.pos.y - this.size }, '#c890ff'); // curse-violet: curse sigil
    op.sayOnce('sigil-regress', 'Don’t stop half-way — the curse heals what you leave!');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand') return;
    const S = op.tuning.sigil;
    const reach = S.reach + op.hitPad;
    const cur = this.current;
    if (cur >= this.strokeCount) return;
    // Catch the stroke at its numbered node.
    if (!this.ignited[cur]) {
      if (dist(ptr.pos, this.nodes[cur]) < reach + 4) {
        this.branded = true;
        this.nodeT += dt;
        if (this.nodeT >= op.tuning.brand.sigilNode) {
          this.nodeT = 0;
          this.ignited[cur] = true;
          if (this.startT < 0) this.startT = op.elapsed;
          op.cues.push('burn');
          op.popup(`Stroke ${cur + 1}`, this.nodes[cur], '#f0c0ff');
        }
        return;
      }
      this.nodeT = 0;
    }
    let hit = false;
    let wrong = false;
    for (const s of this.segs) {
      const { d, t } = pointSegment(ptr.pos, s.a, s.b);
      if (d >= reach) continue;
      if (s.stroke === cur && this.ignited[cur]) {
        hit = true;
        s.burned[Math.min(s.burned.length - 1, Math.floor(t * s.burned.length))] = true;
      } else if (s.stroke > cur) wrong = true;
      else if (s.stroke === cur) hit = true;
    }
    if (wrong && !hit && this.snapPress !== op.pressId) {
      this.snapPress = op.pressId;
      this.snaps++;
      op.rate('bad', ptr.pos, 'Wrong stroke');
      op.harm(S.wrongHurt, ptr.pos);
      op.spawnPenalty(new Laceration({ ...ptr.pos }, op.rng.range(0, TAU), 30, 0.5));
      op.sayOnce('sigil-order', `In order, Doctor! Stroke ${cur + 1} first — follow the numbers.`);
      return;
    }
    if (!hit) return;
    this.branded = true;
    if (Math.random() < 0.3) op.emit('spark', ptr.pos, 2);
    if (Math.random() < 0.1) op.emit('smoke', ptr.pos, 1);
    if (op.rng.next() < 0.15) op.cues.push('burn');
    if (this.progress >= 1) {
      this.kill();
      const par = this.strokeCount * (op.tuning.brand.sigilNode + 3);
      op.rate(this.snaps === 0 && op.elapsed - this.startT < par ? 'cool' : 'good', this.pos, 'Curse broken');
    }
  }

  override drawSurface(g: Gfx): void {
    for (const sg of this.segs) {
      const n = sg.burned.length;
      for (let i = 0; i < n; i++) {
        if (!sg.burned[i]) continue;
        const p0 = { x: sg.a.x + ((sg.b.x - sg.a.x) * i) / n, y: sg.a.y + ((sg.b.y - sg.a.y) * i) / n };
        const p1 = { x: sg.a.x + ((sg.b.x - sg.a.x) * (i + 1)) / n, y: sg.a.y + ((sg.b.y - sg.a.y) * (i + 1)) / n };
        surfLine(g, [p0, p1], 10, 0.15, 0, 1);
      }
    }
    surfDisc(g, this.pos, this.size * 1.3, 0, 0.2, 0, 0.2);
  }

  draw(g: Gfx, op: Operation): void {
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 3 + this.id);
    g.glow(this.pos.x, this.pos.y, this.size * 1.4, hex('#b060ff', 0.12 * glow)); // curse-violet: curse sigil
    const cur = this.current;
    for (const s of this.segs) {
      const n = s.burned.length;
      const later = s.stroke > cur;
      for (let i = 0; i < n; i++) {
        const p0 = { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n };
        const p1 = { x: s.a.x + ((s.b.x - s.a.x) * (i + 1)) / n, y: s.a.y + ((s.b.y - s.a.y) * (i + 1)) / n };
        if (s.burned[i]) g.line(p0, p1, 5, hex('#2a1a14'));
        else {
          g.line(p0, p1, 9, hex('#9040ff', 0.25 * glow * (later ? 0.5 : 1))); // curse-violet: curse sigil
          g.line(p0, p1, 4, hex('#d0a0ff', glow * (later ? 0.55 : 1))); // curse-violet: curse sigil
        }
      }
    }
    // Numbered nodes (guides): the next stroke's node pulses.
    this.nodes.forEach((nd, i) => {
      if (this.strokeDone(i)) return;
      const next = i === cur;
      if (!op.guides && !next) return;
      g.circle(nd.x, nd.y, next ? 9 : 6, hex(next ? '#ffe0ff' : '#c8a0e0', next ? 0.5 + 0.4 * Math.sin(op.elapsed * 6) : 0.35));
      if (op.guides) g.text(String(i + 1), nd.x, nd.y + 5, { size: 13, color: hex('#20082a'), align: 'center', shadow: false });
      if (next && this.nodeT > 0) g.arc(nd.x, nd.y, 13, 3, hex('#ff9040'), this.nodeT / 1);
    });
    g.arc(this.pos.x, this.pos.y, this.size * 0.25, 3, hex('#c88cff', 0.5), this.lashT / this.lashEvery); // curse-violet: curse sigil
  }
}

/** Sigil shapes in unit space (roughly -1..1). Strokes are traced in array order. */
export const SIGILS = {
  eye: [
    [
      { x: -1, y: 0 },
      { x: -0.5, y: -0.45 },
      { x: 0.5, y: -0.45 },
      { x: 1, y: 0 },
      { x: 0.5, y: 0.45 },
      { x: -0.5, y: 0.45 },
      { x: -1, y: 0 },
    ],
    [
      { x: 0, y: -0.25 },
      { x: 0, y: 0.25 },
    ],
  ],
  trident: [
    [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ],
    [
      { x: -0.7, y: -0.6 },
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.7, y: -0.6 },
    ],
  ],
  hourglass: [
    [
      { x: -0.7, y: -0.9 },
      { x: 0.7, y: -0.9 },
      { x: -0.7, y: 0.9 },
      { x: 0.7, y: 0.9 },
      { x: -0.7, y: -0.9 },
    ],
  ],
  crown: [
    [
      { x: -0.9, y: 0.5 },
      { x: -0.9, y: -0.5 },
      { x: -0.45, y: 0 },
      { x: 0, y: -0.7 },
      { x: 0.45, y: 0 },
      { x: 0.9, y: -0.5 },
      { x: 0.9, y: 0.5 },
      { x: -0.9, y: 0.5 },
    ],
  ],
  /** The Choir's mark: a mouth under three rising notes. */
  choir: [
    [
      { x: -0.8, y: 0.3 },
      { x: 0, y: 0.8 },
      { x: 0.8, y: 0.3 },
    ],
    [
      { x: -0.6, y: -0.2 },
      { x: -0.6, y: -0.8 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: -0.9 },
    ],
    [
      { x: 0.6, y: -0.2 },
      { x: 0.6, y: -0.8 },
    ],
  ],
  /** A key with a broken bit: locks the tongue. */
  key: [
    [
      { x: -0.9, y: 0 },
      { x: 0.6, y: 0 },
    ],
    [
      { x: 0.6, y: -0.35 },
      { x: 0.95, y: 0 },
      { x: 0.6, y: 0.35 },
      { x: 0.6, y: -0.35 },
    ],
    [
      { x: -0.6, y: 0 },
      { x: -0.6, y: 0.5 },
      { x: -0.3, y: 0.5 },
    ],
  ],
} satisfies Record<string, Vec[][]>;

// ============================================================ drawing helpers

export function drawCoverage(g: Gfx, cov: Coverage, within = Infinity): void {
  for (const c of cov.cells) if (c.done && c.x * c.x + c.y * c.y <= within * within) g.circleGrad(cov.center.x + c.x, cov.center.y + c.y, 10, hex('#bff0c8', 0.35), hex('#bff0c8', 0));
}
