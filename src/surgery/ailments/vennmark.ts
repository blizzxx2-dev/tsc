
import { dist, pointSegment, type Vec } from '../../core/math';
import { Coverage } from '../coverage';
import { Entity } from '../entity';
import { BloodPool, Embedded, StitchLine } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { pathLength, pointAlong } from '../bosses/common';

export const TAU = Math.PI * 2;

// ============================================================ the artery

/**
 * A great vessel beside a lodged bolt. Clamp it with the tongs before the bolt
 * comes out; pull the bolt first and the artery sprays (−1 vitals/s) until it
 * is ligated with thread.
 */
export class Artery extends Entity {
  clamped = false;
  spraying = false;
  readonly stitch: StitchLine;
  constructor(
    pos: Vec,
    public angle: number,
    public bolt: Embedded | null,
  ) {
    super(pos);
    this.layer = 2;
    const dx = Math.cos(angle) * 30;
    const dy = Math.sin(angle) * 30;
    this.stitch = new StitchLine(
      [
        { x: pos.x - dx, y: pos.y - dy },
        { x: pos.x + dx, y: pos.y + dy },
      ],
      3,
    );
  }
  get boltOut(): boolean {
    return !this.bolt || !this.bolt.alive;
  }
  override drain(): number {
    return this.spraying ? 1.0 : 0.05;
  }
  override update(op: Operation, dt: number): void {
    if (this.boltOut && !this.clamped && !this.spraying) {
      this.spraying = true;
      op.rate('bad', this.pos, 'Arterial spray');
      op.shake = 10;
      op.say('The artery! It’s spraying — stitch it shut, now!');
    }
    if (this.spraying && op.rng.next() < dt * 3) {
      op.emit('blood', this.pos, 6, this.angle - Math.PI / 2, 0.4, 260);
      const pool = op.entities.find((e): e is BloodPool => e instanceof BloodPool && e.alive && dist(e.pos, this.pos) < 60);
      if (pool) pool.grow(3);
      else op.spawn(new BloodPool({ x: this.pos.x + 20, y: this.pos.y + 20 }, 12));
    }
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.clamped || this.spraying || dist(ptr.pos, this.pos) > 18) return false;
    this.clamped = true;
    op.cues.push('pluck');
    op.rate('good', this.pos, 'Clamped');
    op.sayOnce('artery-clamped', 'Clamped. Now the bolt can come out.');
    return true;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'thread' || !this.boltOut) return;
    if (pointSegment(ptr.pos, this.stitch.points[0], this.stitch.points[1]).d > 36) return;
    if (this.stitch.sweep(op, ptr)) {
      this.kill();
      op.rate(this.clamped ? 'cool' : 'good', this.pos, 'Ligated');
    }
  }
}

// ============================================================ ticks and contamination

/**
 * A tick crawling out of a goring. Pluck it with the tongs within 6 s or it
 * burrows beneath the skin, and must be found with the lens first.
 */
export class Tick extends Entity {
  /** Small and numerous: indexed by position on crowded fields (ENG-0246). */
  override pickReach = 30;
  life = 0;
  burrowed = false;
  heading: number;
  constructor(
    pos: Vec,
    op: Operation,
    public burrowAfter = 6,
  ) {
    super(pos);
    this.layer = 6;
    this.heading = op.rng.range(0, TAU);
  }
  override drain(): number {
    return 0.2;
  }
  override update(op: Operation, dt: number): void {
    if (this.burrowed) return;
    this.life += dt;
    this.heading += op.rng.range(-2, 2) * dt;
    const next = { x: this.pos.x + Math.cos(this.heading) * 28 * dt, y: this.pos.y + Math.sin(this.heading) * 28 * dt };
    if (onBody(next)) this.pos = next;
    else this.heading += Math.PI * 0.8;
    if (this.life >= this.burrowAfter) {
      this.burrowed = true;
      this.hidden = true;
      op.rate('miss', this.pos, 'Burrowed');
      op.sayOnce('tick-burrow', 'One’s burrowed in! Find it with the lens.');
    }
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 18) return false;
    this.kill();
    op.cues.push('pluck');
    op.rate(this.burrowed ? 'good' : 'cool', this.pos, 'Tick plucked');
    return true;
  }
}

/** Dung and mud fouling a wound: it drains the patient until irrigated with the leech-pipe (held 1.5 s). */
export class Contamination extends Entity {
  flushT = 0;
  constructor(
    pos: Vec,
    public r = 34,
  ) {
    super(pos);
    this.layer = -1;
  }
  override drain(): number {
    return 0.35;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > this.r + 8) return;
    this.flushT += dt;
    if (op.rng.next() < dt * 8) op.cues.push('squelch');
    if (this.flushT >= 1.5) {
      this.kill();
      op.rate('good', this.pos, 'Irrigated');
    }
  }
}

// ============================================================ delver's lung

/**
 * A crystal nodule of delver's lung. It grows through stages I–III (every 12 s).
 * Excise with the lancet: stage I cleanly, stage II less so; at stage III it
 * must first be cracked with the brand. While any nodule is at stage II or
 * worse the patient seems to rally — a false recovery.
 */
export class Nodule extends Entity {
  stage = 1;
  private growT = 0;
  cracked = false;
  heat = 0;
  constructor(
    pos: Vec,
    public growEvery = 12,
  ) {
    super(pos);
    this.layer = 3;
  }
  get radius(): number {
    return 8 + this.stage * 5;
  }
  override drain(): number {
    return 0.1 + this.stage * 0.1;
  }
  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt * 0.5);
    this.branded = false;
    if (this.stage < 3) {
      this.growT += dt;
      if (this.growT >= this.growEvery) {
        this.growT = 0;
        this.stage++;
        if (this.stage === 2) op.sayOnce('nodule-false', 'Her colour’s better… no. The crystals are growing — don’t trust it.');
        if (this.stage === 3) op.sayOnce('nodule-3', 'That one’s gone hard as quartz. Crack it with the brand before you cut.');
      }
    }
    // False recovery: the lung, stiffened by crystal, seems to breathe easier.
    if (this.stage >= 2) op.heal(0.12 * dt);
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.stage < 3 || this.cracked || dist(ptr.pos, this.pos) > this.radius + 6) return;
    this.branded = true;
    this.heat += dt;
    if (this.heat >= 0.6) {
      this.cracked = true;
      op.emit('spark', this.pos, 8);
      op.popup('Cracked', this.pos, '#ffd080');
    }
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > this.radius + 6) return false;
    if (this.stage >= 3 && !this.cracked) {
      op.rate('bad', this.pos, 'Blade turned');
      op.sayOnce('nodule-hard', 'The blade skids off it — crack it with the brand first!');
      return true;
    }
    this.kill();
    op.cues.push('cut');
    op.emit('spark', this.pos, 6);
    op.rate(this.stage === 1 ? 'cool' : 'good', this.pos, 'Nodule out');
    return true;
  }
}

/** A region the surgeon must not cut (a mountain-folk beard; a sacred tattoo). A lancet stroke inside it costs score. */
export class NoCutZone extends Entity {
  constructor(
    pos: Vec,
    public rx: number,
    public ry: number,
    public label = 'Not the beard!',
    public penalty = 150,
  ) {
    super(pos);
    this.required = false;
    this.layer = -4;
  }
  inside(p: Vec): boolean {
    const dx = (p.x - this.pos.x) / this.rx;
    const dy = (p.y - this.pos.y) / this.ry;
    return dx * dx + dy * dy <= 1;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || !this.inside(ptr.pos)) return false;
    op.rate('bad', ptr.pos, this.label);
    op.score = Math.max(0, op.score - this.penalty);
    op.sayOnce('nocut', 'Never the beard, Doctor! She’d sooner lose the lung!');
    return true;
  }
}

// ============================================================ the strongbox

/**
 * A swallowed strongbox. Its lock has three rotating pins; tap each with the
 * tongs when its notch comes to the top (±25°). A slipped pin costs 3 s.
 * Once open, draw the box out with the tongs.
 */
export class Lockbox extends Entity {
  pins: { angle: number; speed: number; set: boolean }[];
  private grabbed = false;
  readonly origin: Vec;
  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 4;
    this.pins = [0, 1, 2].map((i) => ({ angle: op.rng.range(0, TAU), speed: (i % 2 ? -1 : 1) * op.rng.range(1.6, 2.4), set: false }));
  }
  get open(): boolean {
    return this.pins.every((p) => p.set);
  }
  pinPos(i: number): Vec {
    return { x: this.pos.x - 34 + i * 34, y: this.pos.y - 6 };
  }
  /** Radians from the notch to the top of pin i. */
  offTop(i: number): number {
    let a = (this.pins[i].angle + Math.PI / 2) % TAU;
    if (a < 0) a += TAU;
    return Math.min(a, TAU - a);
  }
  override drain(): number {
    return 0.2;
  }
  override update(_op: Operation, dt: number): void {
    for (const p of this.pins) if (!p.set) p.angle += p.speed * dt;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs') return false;
    if (this.open) {
      if (dist(ptr.pos, this.pos) > 40) return false;
      this.grabbed = true;
      op.cues.push('pluck');
      return true;
    }
    const i = this.pins.findIndex((p, k) => !p.set && dist(ptr.pos, this.pinPos(k)) < 15);
    if (i < 0) return false;
    if (this.offTop(i) <= (25 * Math.PI) / 180) {
      this.pins[i].set = true;
      this.pins[i].angle = -Math.PI / 2;
      op.cues.push('pluck');
      op.rate('good', this.pinPos(i), 'Pin set');
      if (this.open) op.say('It’s open — now draw the box out!');
    } else {
      op.rate('bad', this.pinPos(i), 'Slipped');
      op.timeLeft = Math.max(1, op.timeLeft - 3);
      op.sayOnce('lock-slip', 'Wait for the notch to come round to the top!');
    }
    return true;
  }
  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }
  override onRelease(op: Operation): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (dist(this.pos, this.origin) > 90) {
      this.kill();
      op.rate('cool', this.pos, 'Strongbox out');
      op.spawn(new BloodPool({ ...this.origin }, 22));
    } else this.pos = { ...this.origin };
  }
}

/**
 * A flap of muscle hiding the organs beneath. Drag it aside with the tongs
 * (80 px) and it is pinned open for 15 s; while closed, what lies beneath is
 * hidden.
 */
export class Retractor extends Entity {
  openT = 0;
  held = false;
  drag: Vec | null = null;
  constructor(
    pos: Vec,
    public beneath: Entity[],
    public holdOpen = 15,
  ) {
    super(pos);
    this.required = false;
    this.layer = 6;
  }
  get open(): boolean {
    return this.openT > 0;
  }
  override update(op: Operation, dt: number): void {
    if (this.openT > 0) {
      this.openT -= dt;
      if (this.openT <= 0) op.sayOnce('retractor-slip', 'The flap slipped back — pull it aside again.');
    }
    for (const e of this.beneath) if (e.alive) e.hidden = !this.open;
    if (this.beneath.every((e) => !e.alive)) this.kill();
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.open || dist(ptr.pos, this.pos) > 30) return false;
    this.held = true;
    this.drag = { ...ptr.pos };
    op.cues.push('pluck');
    return true;
  }
  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.held) this.drag = { ...ptr.pos };
  }
  override onRelease(op: Operation): void {
    if (this.held && this.drag && dist(this.drag, this.pos) > 80) {
      this.openT = this.holdOpen;
      op.rate('good', this.pos, 'Retracted');
    }
    this.held = false;
    this.drag = null;
  }
}

// ============================================================ the stilled heart

/**
 * A bite-tranced heart that beats only once every few seconds. The tincture
 * restarts it only if the injection lands inside a beat (a 0.9 s window); two
 * such restarts and the trance breaks.
 */
export class StilledHeart extends Entity {
  beatT = 0;
  restarts = 0;
  holdT = 0;
  constructor(
    pos: Vec,
    public every = 6,
    public window = 0.9,
    public need = 2,
  ) {
    super(pos);
    this.layer = 2;
  }
  get inBeat(): boolean {
    return this.beatT < this.window;
  }
  /** Seconds until the next beat opens. */
  get nextBeatIn(): number {
    return this.inBeat ? 0 : this.every - this.beatT;
  }
  override drain(): number {
    return 0.3;
  }
  override update(op: Operation, dt: number): void {
    // In a slow-pulse operation (CON-0155) the stilled heart beats with the patient's own pulse.
    if (op.slowPulseEvery > 0) {
      this.every = op.slowPulseEvery;
      this.beatT = op.slowPulseClock;
      return;
    }
    this.beatT += dt;
    if (this.beatT >= this.every) {
      this.beatT = 0;
      op.cues.push('heartbeat');
    }
  }
  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 34) return false;
    this.holdT = 0;
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 38) return;
    this.holdT += dt;
    if (this.holdT < 0.8) return;
    this.holdT = -10;
    if (this.inBeat) {
      this.restarts++;
      op.cues.push('inject');
      op.rate('cool', this.pos, 'Caught the beat');
      if (this.restarts >= this.need) {
        this.kill();
        op.endSlowPulse();
        op.say('A second beat — and a third, on its own! The trance is broken.');
      }
    } else {
      op.rate('bad', this.pos, 'Between beats');
      op.sayOnce('heart-beat', 'Inject on the beat, Doctor — watch for it!');
    }
  }
  override onRelease(): void {
    this.holdT = 0;
  }
}

// ============================================================ the thirsted neck

/**
 * The bite-channel of a blood-thrall. Her choice made on the table: brand it
 * to burn the bond away, or salve it and leave the bond be. Either closes it;
 * the choice is written to the operation's flags ('thirst:brand' / 'thirst:salve').
 */
export class BiteChannel extends Entity {
  readonly cov: Coverage;
  heat = 0;
  constructor(pos: Vec) {
    super(pos);
    this.layer = 2;
    this.cov = new Coverage(pos, 22, 10);
  }
  override drain(): number {
    return 0.2;
  }
  override update(_op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'brand' && dist(ptr.pos, this.pos) < 20) {
      this.branded = true;
      this.heat += dt;
      if (this.heat >= 0.6) {
        this.kill();
        op.flags.add('thirst:brand');
        op.cues.push('burn');
        op.rate('good', this.pos, 'The bond burned away');
      }
    } else if (tool === 'salve' && this.cov.contains(ptr.pos, 14)) {
      if (this.cov.brush(ptr.pos, 22) > 0 && this.cov.fraction >= 0.85) {
        this.kill();
        op.flags.add('thirst:salve');
        op.rate('good', this.pos, 'The bond left be');
      }
    }
  }
}

// ============================================================ petrification

/**
 * A petrification front creeping along a path (fingertip → heart). Stone
 * plates stand along it, numbered: tap them with the lancet in order. A wrong
 * plate makes the front surge. When every plate is cracked, salve the living
 * margin to stop it. If the front reaches the heart the patient is lost. The
 * Litany holds it entirely still.
 */
export class PetrifyFront extends Entity {
  s = 0;
  readonly total: number;
  /** `crackedAt`: world time the lancet broke it (the crack-apart flipbook plays from there). */
  plates: { pos: Vec; cracked: boolean; crackedAt?: number }[] = [];
  next = 0;
  margin: Coverage | null = null;
  constructor(
    public path: Vec[],
    plates: number,
    public speed = 4,
    start = 0,
  ) {
    super({ ...path[0] });
    this.layer = 2;
    this.total = pathLength(path);
    this.s = start;
    for (let i = 0; i < plates; i++) this.plates.push({ pos: pointAlong(path, start + 40 + ((this.total - start - 90) * i) / Math.max(1, plates - 1) * 0.55), cracked: false });
    this.pos = pointAlong(path, this.s);
  }
  get frontPos(): Vec {
    return pointAlong(this.path, this.s);
  }
  /** Seconds before the stone reaches the heart. */
  get eta(): number {
    return (this.total - this.s) / this.speed;
  }
  override drain(): number {
    return 0.25;
  }
  override update(op: Operation, dt: number): void {
    if (op.litanyTime > 0 || this.margin) return;
    this.s += this.speed * dt;
    this.pos = this.frontPos;
    if (this.eta < 8) op.sayOnce('petrify-near', 'The stone is nearly at her heart!');
    if (this.s >= this.total) op.lose('The stone reached her heart.');
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.margin) return false;
    const i = this.plates.findIndex((p) => !p.cracked && dist(p.pos, ptr.pos) < 18);
    if (i < 0) return false;
    if (i !== this.next) {
      op.rate('bad', ptr.pos, 'Wrong plate');
      this.s = Math.min(this.total - this.speed * 10, this.s + 30);
      op.sayOnce('petrify-order', 'In order, Doctor — the numbers! It surged!');
      return true;
    }
    this.plates[i].cracked = true;
    this.plates[i].crackedAt = op.elapsed;
    this.next++;
    op.cues.push('pluck');
    op.emit('dust', ptr.pos, 6);
    op.rate('good', ptr.pos, 'Plate cracked');
    if (this.next >= this.plates.length) {
      this.margin = new Coverage(this.frontPos, 30, 12);
      op.say('The plates are off — salve the living margin to hold it!');
    }
    return true;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.margin || !this.margin.contains(ptr.pos, 16)) return;
    if (this.margin.brush(ptr.pos, 24) > 0 && this.margin.fraction >= 0.85) {
      this.kill();
      op.rate('cool', this.pos, 'The stone halts');
    }
  }
}

// ============================================================ the rain

/** Rain through a torn tent: every few seconds a drip dilutes a fresh pool somewhere on the field (seeded). */
export class RainDrip extends Entity {
  private t: number;
  constructor(
    public every = 7,
    op?: Operation,
  ) {
    super({ x: FIELD.cx, y: FIELD.cy - FIELD.ry });
    this.required = false;
    this.t = every * 0.5;
    void op;
  }
  override update(op: Operation, dt: number): void {
    if (!op.entities.some((e) => e.alive && e.required)) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.every;
    const p = { x: FIELD.cx + op.rng.range(-0.6, 0.6) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.5, 0.5) * FIELD.ry };
    if (onBody(p)) op.spawn(new BloodPool(p, 14));
  }
}
