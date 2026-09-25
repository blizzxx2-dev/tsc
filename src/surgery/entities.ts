import { dist, pointSegment, segmentsIntersect, type Vec } from '../core/math';
import { hex, rgba } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Coverage } from './coverage';
import { Entity } from './entity';
import { onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';

const TAU = Math.PI * 2;

// ============================================================ incision

/**
 * A dotted guide line the surgeon must trace with the lancet. Once cut it stays
 * open (not required) until the closing phase asks for it to be stitched.
 */
export class Incision extends Entity {
  state: 'mark' | 'open' | 'closing' | 'closed' = 'mark';
  progress = 0; // length traced so far
  private devSum = 0;
  private devN = 0;
  private slipped = false;
  readonly total: number;
  stitch: StitchLine | null = null;

  constructor(public points: Vec[]) {
    super(points[0]);
    this.layer = -1;
    let t = 0;
    for (let i = 1; i < points.length; i++) t += dist(points[i - 1], points[i]);
    this.total = t;
  }

  /** Nearest distance to the path and the path length at that point. */
  project(p: Vec): { d: number; at: number } {
    let best = { d: Infinity, at: 0 };
    let acc = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const seg = dist(a, b);
      const { d, t } = pointSegment(p, a, b);
      if (d < best.d) best = { d, at: acc + t * seg };
      acc += seg;
    }
    return best;
  }

  pointAt(at: number): Vec {
    let acc = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const seg = dist(a, b);
      if (acc + seg >= at) {
        const t = seg === 0 ? 0 : (at - acc) / seg;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      acc += seg;
    }
    return this.points[this.points.length - 1];
  }

  beginClosing(): void {
    this.state = 'closing';
    this.required = true;
    this.stitch = new StitchLine(this.points, Math.max(4, Math.round(this.total / 30)));
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.state !== 'mark' || tool !== 'lancet') return false;
    const pr = this.project(ptr.pos);
    // Must start at the head of the line or where the last stroke stopped.
    if (pr.d > 22 || Math.abs(pr.at - this.progress) > 30) return false;
    op.cues.push('cut');
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId): void {
    if (this.state !== 'mark' || this.slipped) return;
    const pr = this.project(ptr.pos);
    if (pr.d > 34) {
      // Slipped off the guide: penalise once and stop tracking until the next press.
      op.rate('bad', ptr.pos, 'Off the line');
      op.hurt(2, ptr.pos);
      this.slipped = true;
      return;
    }
    if (pr.at > this.progress && pr.at - this.progress < 60) {
      this.progress = pr.at;
      this.devSum += pr.d;
      this.devN++;
    }
    if (this.progress >= this.total - 8) {
      const avg = this.devSum / Math.max(1, this.devN);
      op.rate(avg < 6 ? 'cool' : avg < 13 ? 'good' : 'bad', ptr.pos, 'Incision');
      this.state = 'open';
      this.required = false;
      op.cues.push('squelch');
    }
  }

  override onRelease(): void {
    this.slipped = false;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (this.state !== 'closing' || !this.stitch) return;
    if (tool === 'thread' && this.stitch.sweep(op, ptr)) {
      this.state = 'closed';
      this.kill();
      op.rate(this.stitch.strokes.size <= 1 ? 'cool' : 'good', ptr.pos, 'Closed');
    }
  }

  draw(g: Gfx, op: Operation): void {
    if (this.state === 'mark') {
      g.dashed(this.points, 3, hex('#ffebbe', 0.85), 10, 9, -op.elapsed * 20);
      if (this.progress > 0) g.polyline(this.tracedPoints(), 5, hex('#5a0d0d'));
      const head = this.pointAt(this.progress);
      g.glow(head.x, head.y, 22, hex('#ffe0a0', 0.35));
      g.circle(head.x, head.y, 6 + Math.sin(op.elapsed * 6) * 2, hex('#ffebbe', 0.9));
    } else {
      // An open wound: dark gash with a wet rim.
      g.polyline(this.points, 18, hex('#2a0306'));
      g.polyline(this.points, 10, hex('#6d1016'));
      g.polyline(this.points, 3, hex('#c0404a', 0.6));
      if (this.stitch) this.stitch.draw(g);
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

/** Shared zig-zag stitching logic: each crossing of the wound line is a stitch. */
export class StitchLine {
  count = 0;
  strokes = new Set<number>();
  marks: Vec[] = [];

  constructor(
    public points: Vec[],
    public needed: number,
  ) {}

  /** Returns true when the final stitch lands. */
  sweep(op: Operation, ptr: Pointer): boolean {
    if (ptr.pressed) return false;
    for (let i = 1; i < this.points.length; i++) {
      if (segmentsIntersect(ptr.prev, ptr.pos, this.points[i - 1], this.points[i])) {
        // Reject a stitch too close to an existing one so players must travel the wound.
        if (this.marks.some((m) => dist(m, ptr.pos) < 10)) return false;
        this.count++;
        this.strokes.add(op.pressId);
        this.marks.push({ ...ptr.pos });
        op.cues.push('stitch');
        return this.count >= this.needed;
      }
    }
    return false;
  }

  draw(g: Gfx): void {
    for (let i = 1; i < this.marks.length; i++) g.line(this.marks[i - 1], this.marks[i], 2, hex('#d9cfa8'));
    for (const m of this.marks) g.rect(m.x - 2, m.y - 2, 4, 4, hex('#efe6c4'));
  }
}

// ============================================================ blood

export class BloodPool extends Entity {
  private startR: number;
  constructor(
    pos: Vec,
    public r: number,
    public ichor: 'blood' | 'pus' | 'blackbile' = 'blood',
  ) {
    super(pos);
    this.layer = 5;
    this.startR = r;
  }

  override drain(): number {
    return this.ichor === 'blood' ? 0.08 + this.r * 0.002 : 0.05;
  }

  grow(amount: number, max = 70): void {
    this.r = Math.min(max, this.r + amount);
    this.startR = Math.max(this.startR, this.r);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > this.r + 10) return;
    this.r -= 55 * dt;
    if (this.r < 5) {
      this.kill();
      op.cues.push('squelch');
      if (this.startR >= 20) op.rate('good', this.pos, 'Drained');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const col =
      this.ichor === 'blood' ? ['#8a0810', '#3d0006'] : this.ichor === 'pus' ? ['#c8b850', '#6a6a18'] : ['#241824', '#080408'];
    const pts: Vec[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const wob = 1 + 0.08 * Math.sin(a * 3 + this.id + op.elapsed * 1.5);
      pts.push({ x: this.pos.x + Math.cos(a) * this.r * wob, y: this.pos.y + Math.sin(a) * this.r * wob * 0.85 });
    }
    g.poly(pts, hex(col[1], 0.92), hex(col[0], 0.96));
    g.ellipse(this.pos.x - this.r * 0.35, this.pos.y - this.r * 0.35, this.r * 0.25, this.r * 0.1, -0.5, hex('#ffffff', 0.35), hex('#ffffff', 0));
  }
}

/** Find (or open) the pool a wound bleeds into. */
function feedPool(op: Operation, at: Vec, amount: number): void {
  const pool = op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.alive && e.ichor === 'blood' && dist(e.pos, at) < e.r + 16);
  if (pool) pool.grow(amount);
  else op.spawn(new BloodPool({ x: at.x + op.rng.range(-6, 6), y: at.y + op.rng.range(-6, 6) }, 8));
}

// ============================================================ lacerations

/**
 * A cut from a blade, claw or the surgeon's own tugging. Long ones need thread;
 * nicks shorter than SALVE_MAX can be sealed with salve instead.
 */
export const SALVE_MAX = 46;

export class Laceration extends Entity {
  readonly a: Vec;
  readonly b: Vec;
  readonly length: number;
  readonly stitch: StitchLine;
  private cov: Coverage | null;
  bleed: number;

  constructor(center: Vec, angle: number, length: number, bleed = 1) {
    super(center);
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    this.a = { x: center.x - dx, y: center.y - dy };
    this.b = { x: center.x + dx, y: center.y + dy };
    this.length = length;
    this.bleed = bleed;
    this.stitch = new StitchLine([this.a, this.b], Math.max(2, Math.round(length / 22)));
    this.cov = length <= SALVE_MAX ? new Coverage(center, length / 2 + 6, 10) : null;
  }

  get small(): boolean {
    return this.cov !== null;
  }

  override drain(): number {
    return (0.15 + this.length * 0.006) * this.bleed;
  }

  override update(op: Operation, dt: number): void {
    if (this.bleed <= 0) return;
    if (op.rng.next() < dt * 0.9 * this.bleed) feedPool(op, this.pos, 4 + this.length * 0.08);
  }

  private flooded(op: Operation): boolean {
    return op.entities.some((e) => e instanceof BloodPool && e.alive && e.r > 22 && dist(e.pos, this.pos) < e.r);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool === 'thread') {
      if (pointSegment(ptr.pos, this.a, this.b).d > 40) return;
      if (this.flooded(op)) {
        op.sayOnce('flooded', 'Too much blood — draw it off with the leech-pipe before you stitch!');
        return;
      }
      if (this.stitch.sweep(op, ptr)) {
        this.kill();
        op.rate(this.stitch.strokes.size <= 1 ? 'cool' : 'good', this.pos, 'Stitched');
      }
    } else if (tool === 'salve' && this.cov && this.cov.contains(ptr.pos, 20)) {
      if (this.cov.brush(ptr.pos) > 0 && this.cov.fraction >= 0.85) {
        this.kill();
        op.rate('good', this.pos, 'Sealed');
      }
    }
  }

  draw(g: Gfx): void {
    g.line(this.a, this.b, this.small ? 7 : 12, hex('#3a0306'));
    g.line(this.a, this.b, this.small ? 3 : 6, hex('#a3141c'));
    this.stitch.draw(g);
    if (this.cov) drawCoverage(g, this.cov);
  }
}

// ============================================================ embedded objects

export type EmbeddedKind = 'arrow' | 'bolt' | 'shot' | 'tooth' | 'shard' | 'glass' | 'warpshard';

const EMBED_SPEC: Record<EmbeddedKind, { len: number; wound: number; drain: number; label: string }> = {
  arrow: { len: 90, wound: 56, drain: 0.45, label: 'Arrow' },
  bolt: { len: 60, wound: 50, drain: 0.5, label: 'Bolt' },
  shot: { len: 0, wound: 30, drain: 0.4, label: 'Lead shot' },
  tooth: { len: 26, wound: 36, drain: 0.35, label: 'Fang' },
  shard: { len: 30, wound: 34, drain: 0.3, label: 'Shard' },
  glass: { len: 24, wound: 28, drain: 0.25, label: 'Glass' },
  warpshard: { len: 30, wound: 40, drain: 0.6, label: 'Hexstone' },
};

/**
 * Anything lodged in the flesh. Seize with tongs and pull clear. Barbed heads
 * must first be freed with two lancet nicks at the entry, or they tear the wound open.
 */
export class Embedded extends Entity {
  grabbed = false;
  private grabT = 0;
  private offset: Vec = { x: 0, y: 0 };
  readonly origin: Vec;
  nicks = 0;
  private corruptT = 0;
  private tore = false;
  private revealT = 0;

  constructor(
    pos: Vec,
    public kind: EmbeddedKind,
    public angle = 0,
    public barbed = kind === 'arrow',
  ) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 3;
  }

  get spec() {
    return EMBED_SPEC[this.kind];
  }

  /** The graspable end of the object (shaft end or the object itself). */
  get handle(): Vec {
    const l = this.spec.len * 0.7;
    return { x: this.pos.x - Math.cos(this.angle) * l, y: this.pos.y - Math.sin(this.angle) * l };
  }

  override drain(): number {
    return this.spec.drain;
  }

  override update(op: Operation, dt: number): void {
    if (this.kind !== 'warpshard' || this.grabbed) return;
    // Hexstone corrupts the flesh around it while it stays lodged.
    this.corruptT += dt;
    if (this.corruptT > 7) {
      this.corruptT = 0;
      const a = op.rng.range(0, TAU);
      const p = { x: this.origin.x + Math.cos(a) * 60, y: this.origin.y + Math.sin(a) * 45 };
      if (onBody(p)) op.spawn(new Rot(p, 18));
      op.sayOnce('hexstone', 'The hexstone is corrupting the flesh around it — get it out!');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'lancet' && this.barbed && this.nicks < 2 && dist(ptr.pos, this.origin) < 30) {
      this.nicks++;
      op.cues.push('cut');
      op.rate('good', ptr.pos, this.nicks === 2 ? 'Barbs freed' : 'Nick');
      return true;
    }
    if (tool !== 'tongs') return false;
    const target = this.spec.len > 0 ? pointSegment(ptr.pos, this.handle, this.origin).d : dist(ptr.pos, this.pos);
    if (target > 20) return false;
    this.grabbed = true;
    this.grabT = 0;
    this.offset = { x: this.pos.x - ptr.pos.x, y: this.pos.y - ptr.pos.y };
    op.cues.push('pluck');
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.grabbed || tool !== 'tongs') return;
    this.grabT += dt;
    this.pos = { x: ptr.pos.x + this.offset.x, y: ptr.pos.y + this.offset.y };
    if (this.barbed && this.nicks < 2 && dist(this.pos, this.origin) > 18) {
      // Ripped a barbed head out through the flesh.
      op.rate('bad', this.origin, 'Torn');
      op.hurt(8, this.origin);
      op.spawn(new Laceration(this.origin, this.angle + Math.PI / 2, this.spec.wound + 30, 1.6));
      op.sayOnce('barbs', 'Barbed! Nick the flesh at the entry with the lancet before you pull.');
      this.barbed = false;
      this.nicks = 2;
      this.tore = true;
    }
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (dist(this.pos, this.origin) > 70) {
      this.kill();
      if (!this.tore) {
        op.rate(this.grabT < 0.9 ? 'cool' : 'good', ptr.pos, this.spec.label);
        op.spawn(new Laceration(this.origin, this.angle + Math.PI / 2, this.spec.wound, 0.8));
      }
    } else {
      // Not pulled clear: it sinks back in.
      this.pos = { ...this.origin };
    }
  }

  override onReveal(op: Operation, p: Vec, dt: number): void {
    if (dist(p, this.origin) < 60) {
      this.revealT += dt;
      if (this.revealT > 0.4) {
        this.hidden = false;
        op.popup('Found!', this.origin, '#b9d7ff');
        op.cues.push('good');
      }
    }
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
      case 'warpshard': {
        const warp = this.kind === 'warpshard';
        const c = warp ? hex('#5aff8c', 0.7 + 0.3 * Math.sin(op.elapsed * 5)) : this.kind === 'glass' ? hex('#c8e6f0', 0.75) : hex('#8a8f96');
        if (warp) g.glow(x, y, 40, hex('#5aff8c', 0.35));
        g.poly(
          [
            { x, y },
            { x: tail.x - sa * 7, y: tail.y + ca * 7 },
            { x: tail.x - ca * 6, y: tail.y - sa * 6 },
            { x: tail.x + sa * 7, y: tail.y - ca * 7 },
          ],
          c,
        );
        break;
      }
    }
  }
}

// ============================================================ burns

/** Charred flesh: pluck the eschar away with tongs, then salve the raw burn. */
export class Burn extends Entity {
  flakes: Vec[] = [];
  readonly cov: Coverage;
  readonly total: number;

  constructor(
    pos: Vec,
    public radius: number,
    op: Operation,
    public source: 'fire' | 'acid' | 'hexfire' = 'fire',
  ) {
    super(pos);
    this.cov = new Coverage(pos, radius, 12);
    const n = Math.max(3, Math.round(radius / 12));
    for (let i = 0; i < n; i++) {
      const a = op.rng.range(0, TAU);
      const r = op.rng.range(0, radius * 0.75);
      this.flakes.push({ x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r });
    }
    this.total = n;
  }

  override drain(): number {
    return (this.source === 'hexfire' ? 0.5 : 0.3) + this.flakes.length * 0.06;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs') return false;
    const i = this.flakes.findIndex((f) => dist(f, ptr.pos) < 16);
    if (i < 0) return false;
    const [f] = this.flakes.splice(i, 1);
    op.cues.push('pluck');
    op.rate('good', f, 'Debrided');
    if (this.flakes.length === 0) op.sayOnce('burn-salve', 'The dead flesh is off. Now salve the raw burn.');
    return true;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.cov.contains(ptr.pos, 18)) return;
    if (this.flakes.length > 0) {
      op.sayOnce('burn-eschar', 'Pluck away the charred eschar with the tongs first!');
      return;
    }
    if (this.cov.brush(ptr.pos, 26) > 0 && this.cov.fraction >= 0.9) {
      this.kill();
      op.rate('cool', this.pos, 'Burn dressed');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const base = this.source === 'acid' ? ['#b8a040', '#6a5a10'] : this.source === 'hexfire' ? ['#8a3cc8', '#2a0a40'] : ['#d0503a', '#5a1a10'];
    g.circleGrad(x, y, this.radius * 1.15, hex(base[0], 0.95), hex(base[1], 0));
    if (this.source === 'hexfire') g.glow(x, y, this.radius, hex('#c878ff', 0.25 + 0.15 * Math.sin(op.elapsed * 7)));
    for (const f of this.flakes) g.ellipse(f.x, f.y, 11, 8, (f.x + f.y) % 3, hex('#140e0c'), hex('#3d2a20'));
    drawCoverage(g, this.cov);
  }
}

// ============================================================ disease

/** A plague bubo. Lance it (one lancet press) to release the pus, then salve. Left alone it swells and bursts. */
export class Bubo extends Entity {
  lanced = false;
  readonly cov: Coverage;
  constructor(
    pos: Vec,
    public r = 22,
    public maxR = 40,
  ) {
    super(pos);
    this.layer = 2;
    this.cov = new Coverage(pos, maxR * 0.8, 12);
  }

  override drain(): number {
    return this.lanced ? 0.1 : 0.2 + this.r * 0.01;
  }

  override update(op: Operation, dt: number): void {
    if (this.lanced) return;
    this.r += dt * 0.9;
    if (this.r >= this.maxR) {
      op.hurt(10, this.pos);
      op.popup('It burst!', this.pos, '#c8c050');
      op.spawn(new BloodPool(this.pos, 40, 'pus'), new Laceration(this.pos, op.rng.range(0, TAU), 40, 0.7));
      this.lanced = true;
      op.counts.miss++;
      op.combo = 0;
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.lanced || tool !== 'lancet' || dist(ptr.pos, this.pos) > this.r + 6) return false;
    this.lanced = true;
    op.cues.push('squelch');
    op.rate(this.r < this.maxR * 0.75 ? 'cool' : 'good', this.pos, 'Lanced');
    op.spawn(new BloodPool({ x: this.pos.x, y: this.pos.y + 6 }, this.r * 1.1, 'pus'));
    return true;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.lanced || !this.cov.contains(ptr.pos, 18)) return;
    if (op.entities.some((e) => e instanceof BloodPool && e.alive && e.ichor === 'pus' && dist(e.pos, this.pos) < 30)) {
      op.sayOnce('pus', 'Draw off the pus before you salve it.');
      return;
    }
    if (this.cov.brush(ptr.pos, 26) > 0 && this.cov.fraction >= 0.85) {
      this.kill();
      op.rate('good', this.pos, 'Cleansed');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    if (!this.lanced) {
      const r = this.r * (1 + Math.sin(op.elapsed * 4 + this.id) * 0.04);
      g.circleGrad(x, y, r, hex('#e8d890'), hex('#5a1a20'));
      g.circle(x - r * 0.3, y - r * 0.3, r * 0.2, hex('#fff8d0', 0.4));
      if (this.r > this.maxR * 0.75) g.arc(x, y, r + 3, 2, hex('#ff503c', 0.5 + 0.5 * Math.sin(op.elapsed * 12)));
    } else {
      g.circleGrad(x, y, this.maxR * 0.5, hex('#4a1a18'), hex('#8a3a30'));
      drawCoverage(g, this.cov);
    }
  }
}

/** Rot, gangrene or blight: a spreading patch soothed with salve. */
export class Rot extends Entity {
  readonly cov: Coverage;
  constructor(
    pos: Vec,
    public r: number,
    public spread = 0.6,
  ) {
    super(pos);
    this.layer = -2;
    this.cov = new Coverage(pos, r, 12);
  }

  override drain(): number {
    return 0.1 + this.r * 0.005;
  }

  override update(op: Operation, dt: number): void {
    // Rot slowly creeps back over salved flesh.
    const done = this.cov.cells.filter((c) => c.done);
    if (done.length > 0 && op.rng.next() < dt * this.spread) done[Math.floor(op.rng.next() * done.length)].done = false;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.cov.contains(ptr.pos, 18)) return;
    if (this.cov.brush(ptr.pos, 26) > 0 && this.cov.fraction >= 0.9) {
      this.kill();
      op.rate('good', this.pos, 'Rot purged');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    for (const c of this.cov.cells) {
      if (c.done) continue;
      const w = Math.sin(op.elapsed * 2 + c.x * 0.1 + c.y * 0.13) * 1.5;
      g.circleGrad(x + c.x, y + c.y, 11 + w, hex('#46582a', 0.6), hex('#46582a', 0));
    }
    for (const c of this.cov.cells) {
      if (c.done || (c.x + c.y) % 3 !== 0) continue;
      g.circle(x + c.x, y + c.y, 3, hex('#1e280f', 0.7));
    }
  }
}

/** Venom from a bite or sting, spreading as black veins. Hold the tincture on it to neutralise. */
export class Venom extends Entity {
  spreadR = 16;
  private holdT = 0;
  private veins: { a: number; l: number }[] = [];
  constructor(
    pos: Vec,
    op: Operation,
    public rate = 6,
  ) {
    super(pos);
    this.layer = 1;
    for (let i = 0; i < 7; i++) this.veins.push({ a: op.rng.range(0, TAU), l: op.rng.range(0.6, 1.2) });
  }

  override drain(): number {
    return 0.2 + this.spreadR * 0.012;
  }

  override update(_op: Operation, dt: number): void {
    this.spreadR = Math.min(120, this.spreadR + this.rate * dt);
  }

  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 26) return false;
    this.holdT = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId, dt: number): void {
    if (dist(ptr.pos, this.pos) > 30) return;
    this.holdT += dt;
    if (this.holdT > 0.9) {
      this.kill();
      op.cues.push('inject');
      op.rate(this.spreadR < 50 ? 'cool' : 'good', this.pos, 'Antidote');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    for (const v of this.veins) {
      const pts: Vec[] = [{ x, y }];
      const r = this.spreadR * v.l;
      for (let s = 1; s <= 6; s++) {
        const t = s / 6;
        const wob = Math.sin(t * 9 + v.a * 3) * 8 * t;
        pts.push({ x: x + Math.cos(v.a) * r * t - Math.sin(v.a) * wob, y: y + Math.sin(v.a) * r * t + Math.cos(v.a) * wob });
      }
      g.polyline(pts, 3, hex('#140a1e', 0.8));
    }
    g.circle(x, y, 10, hex('#2a1030'));
    // Twin puncture marks.
    g.circle(x - 5, y, 3, hex('#000000'));
    g.circle(x + 5, y, 3, hex('#000000'));
    if (this.holdT > 0) g.arc(x, y, 20, 3, hex('#9fd3a8'), this.holdT / 0.9);
    else g.arc(x, y, 20 + Math.sin(op.elapsed * 5) * 2, 2, hex('#a0dcaa', 0.4));
  }
}

// ============================================================ vermin

/** A rot-grub, maggot or monster larva crawling in the wound. Sear it, or pull it out with tongs. */
export class Grub extends Entity {
  heat = 0;
  private heading: number;
  private grabbed = false;
  constructor(
    pos: Vec,
    op: Operation,
    public speed = 40,
  ) {
    super(pos);
    this.layer = 6;
    this.heading = op.rng.range(0, TAU);
  }

  override drain(): number {
    return 0.35;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    if (this.grabbed) return;
    this.heading += op.rng.range(-2, 2) * dt;
    const next = { x: this.pos.x + Math.cos(this.heading) * this.speed * dt, y: this.pos.y + Math.sin(this.heading) * this.speed * dt };
    if (onBody(next)) this.pos = next;
    else this.heading += Math.PI * 0.75;
    this.heat = Math.max(0, this.heat - dt * 0.5);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 20) return;
    this.branded = true;
    this.heat += dt;
    if (this.heat > 0.35) {
      this.kill();
      op.cues.push('burn');
      op.rate('cool', this.pos, 'Seared');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 18) return false;
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
    g.save();
    g.translate(this.pos.x, this.pos.y);
    g.rotate(this.heading);
    for (let i = 3; i >= 0; i--) {
      const wig = Math.sin(op.elapsed * 10 + i) * 2;
      g.circle(-i * 7, wig, 7 - i * 0.8, i === 0 ? hex('#3a2a20') : rgba(220 - i * 10, 210 - i * 12, 170 - i * 10));
    }
    g.restore();
    if (this.heat > 0) {
      g.glow(this.pos.x, this.pos.y, 26, hex('#ff9040', this.heat));
      g.arc(this.pos.x, this.pos.y, 16, 3, hex('#ff9040'), this.heat / 0.35);
    }
  }
}

// ============================================================ curses

/**
 * A curse-sigil burned into the flesh. Trace every stroke of it with the brand
 * to sear it out. It lashes the patient periodically until broken.
 */
export class Sigil extends Entity {
  readonly segs: { a: Vec; b: Vec; burned: boolean[] }[] = [];
  private lashT = 0;
  private startT = -1;

  constructor(
    pos: Vec,
    shape: Vec[][],
    public size = 60,
    public lashEvery = 5,
  ) {
    super(pos);
    this.layer = -1;
    for (const stroke of shape) {
      for (let i = 1; i < stroke.length; i++) {
        const a = { x: pos.x + stroke[i - 1].x * size, y: pos.y + stroke[i - 1].y * size };
        const b = { x: pos.x + stroke[i].x * size, y: pos.y + stroke[i].y * size };
        const n = Math.max(2, Math.round(dist(a, b) / 12));
        this.segs.push({ a, b, burned: new Array(n).fill(false) });
      }
    }
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

  override drain(): number {
    return 0.4;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    this.lashT += dt;
    if (this.lashT >= this.lashEvery) {
      this.lashT = 0;
      op.hurt(4, this.pos);
      op.popup('The curse lashes out!', { x: this.pos.x, y: this.pos.y - this.size - 10 }, '#c890ff');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'brand') return;
    let hit = false;
    for (const s of this.segs) {
      const { d, t } = pointSegment(ptr.pos, s.a, s.b);
      if (d < 14) {
        hit = true;
        s.burned[Math.min(s.burned.length - 1, Math.floor(t * s.burned.length))] = true;
      }
    }
    if (!hit) return;
    this.branded = true;
    if (this.startT < 0) this.startT = op.elapsed;
    if (op.rng.next() < 0.15) op.cues.push('burn');
    if (this.progress >= 1) {
      this.kill();
      op.rate(op.elapsed - this.startT < 4 ? 'cool' : 'good', this.pos, 'Curse broken');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 3 + this.id);
    g.glow(this.pos.x, this.pos.y, this.size * 1.4, hex('#b060ff', 0.12 * glow));
    for (const s of this.segs) {
      const n = s.burned.length;
      for (let i = 0; i < n; i++) {
        const p0 = { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n };
        const p1 = { x: s.a.x + ((s.b.x - s.a.x) * (i + 1)) / n, y: s.a.y + ((s.b.y - s.a.y) * (i + 1)) / n };
        if (s.burned[i]) g.line(p0, p1, 5, hex('#2a1a14'));
        else {
          g.line(p0, p1, 9, hex('#9040ff', 0.25 * glow));
          g.line(p0, p1, 4, hex('#d0a0ff', glow));
        }
      }
    }
    g.arc(this.pos.x, this.pos.y, this.size * 0.25, 3, hex('#c88cff', 0.5), this.lashT / this.lashEvery);
  }
}

/** Sigil shapes in unit space (roughly -1..1). */
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
} satisfies Record<string, Vec[][]>;

// ============================================================ drawing helpers

function drawCoverage(g: Gfx, cov: Coverage): void {
  for (const c of cov.cells) if (c.done) g.circleGrad(cov.center.x + c.x, cov.center.y + c.y, 10, hex('#bff0c8', 0.35), hex('#bff0c8', 0));
}
