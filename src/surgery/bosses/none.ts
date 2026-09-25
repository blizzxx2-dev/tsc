import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { Laceration, surfDisc, surfLine } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { drawBossRing, pathLength, pointAlong, TAU } from './common';
import { Voice, VoiceLine } from './voices';
import { attack, bossSound, leadFor, tell } from './signals';

/** The Precentor's voice, heard through Pieter's mouth as None is cut down (phase 3). */
export const PRECENTOR_THROUGH_NONE: readonly string[] = [
  'Doctor Kreuzer. At last we speak without a Registrar between us.',
  'You keep saving them for the next wound. I would save them from all of them.',
  'Haller struck me from the rolls for mercy. Ask him what he meant.',
  'Come home to Kessendorf for Hollow Night. I will be singing.',
];

export interface NoneTuning {
  hp: number;
  /** Burrowing speed of the head (px/s). */
  speed: number;
  /** Speed of the split segments in phase 2 (px/s). */
  segSpeed: number;
  segments: number;
  /** Vitals lost when a phase-2 segment reaches the heart. */
  heartHit: number;
  /** Lancet cuts to bring the phase-3 core down to extraction size. */
  cuts: number;
  /** Seconds the cut-down core can be pulled with the tongs before it regrows a stage. */
  pullWindow: number;
  /** No path ever starts closer than this many seconds of travel from the heart. */
  minTravel: number;
  /** Brand damage per second while exposed. */
  dps: number;
  /** Phase 2 segments reaching the heart is instant loss too (X-op). */
  segmentsLethal?: boolean;
}

export const NONE_DEFAULT: NoneTuning = { hp: 100, speed: 26, segSpeed: 18, segments: 3, heartHit: 40, cuts: 3, pullWindow: 2, minTravel: 8, dps: 5 };

/** Organ waypoints the burrower tunnels through, relative to the field centre. */
export const NONE_ORGANS: readonly Vec[] = [
  { x: -250, y: 50 },
  { x: -150, y: 120 },
  { x: 40, y: 120 },
  { x: 210, y: 60 },
  { x: 250, y: -60 },
  { x: 110, y: -120 },
  { x: -220, y: -110 },
  { x: 0, y: 10 },
].map((o) => ({ x: FIELD.cx + o.x, y: FIELD.cy + o.y }));

export const NONE_HEART: Vec = { x: FIELD.cx - 70, y: FIELD.cy - 60 };

/**
 * A seeded tunnel from `from` through `organs` waypoints to the heart, long
 * enough that it takes at least `minTravel` seconds at `speed`.
 */
export function burrowPath(op: Operation, from: Vec, organs: number, speed: number, minTravel: number, heart = NONE_HEART): Vec[] {
  const pool = NONE_ORGANS.filter((o) => dist(o, from) > 60 && dist(o, heart) > 80);
  const pts: Vec[] = [{ ...from }];
  const used = new Set<number>();
  const pickNext = () => {
    const free = pool.map((_, i) => i).filter((i) => !used.has(i));
    if (!free.length) return false;
    const i = op.rng.pick(free);
    used.add(i);
    pts.push({ ...pool[i] });
    return true;
  };
  for (let i = 0; i < organs; i++) pickNext();
  while (pathLength([...pts, heart]) < speed * minTravel && pickNext());
  pts.push({ ...heart });
  return pts;
}

/** A length of abandoned tunnel: it caves in and opens as a cut ten seconds later. */
export class TunnelScar extends Entity {
  private t = 10;
  constructor(
    pos: Vec,
    public angle: number,
  ) {
    super(pos);
    this.required = false;
    this.layer = -2;
  }
  override update(op: Operation, dt: number): void {
    this.t -= dt;
    if (this.t <= 0) {
      this.kill();
      if (onBody(this.pos)) {
        op.spawn(new Laceration(this.pos, this.angle, 44, 0.6));
        op.sayOnce('none-collapse', 'The old tunnels are caving in — they’re opening as wounds!');
      }
    }
  }
  override drawSurface(g: Gfx): void {
    surfLine(g, [{ x: this.pos.x - Math.cos(this.angle) * 22, y: this.pos.y - Math.sin(this.angle) * 22 }, { x: this.pos.x + Math.cos(this.angle) * 22, y: this.pos.y + Math.sin(this.angle) * 22 }], 10, 0.2, 0.2, 0, 0.3);
  }
  draw(g: Gfx): void {
    if (this.t < 2) g.circle(this.pos.x, this.pos.y, 3, hex('#ff5040', 0.6));
  }
}

/** The skin ripple over the burrowing head: a tell visible without the lens. */
export class BurrowRipple extends Entity {
  constructor(private owner: NoneMalison) {
    super({ ...owner.pos });
    this.required = false;
    this.layer = -1;
  }
  override update(): void {
    if (!this.owner.alive) return this.kill();
    this.pos = { ...this.owner.pos };
  }
  override drawSurface(g: Gfx, op: Operation): void {
    if (!this.owner.hidden) return;
    if (this.owner.surfacingT > 0) {
      // The bulge swells where the core will break through.
      const k = 1 - this.owner.surfacingT;
      surfDisc(g, this.pos, 30 + 26 * Math.max(0, k), 0, 0.2, 0, 1);
      return;
    }
    surfDisc(g, this.pos, 34 + 6 * Math.sin(op.elapsed * 6), 0, 0.15, 0, 0.9);
  }
  draw(g: Gfx, op: Operation): void {
    // Ninth-hour gloom over the field.
    if (this.owner.gloom) g.rect(0, 0, 1320, 820, hex('#05040c', 0.22));
    if (this.owner.surfacingT > 0) g.arc(this.pos.x, this.pos.y, 40, 2, hex('#e0a0a0', 0.6), 1 - this.owner.surfacingT);
    if (!this.owner.hidden || this.owner.stage !== 1) return;
    g.arc(this.pos.x, this.pos.y, 26 + 8 * ((op.elapsed * 1.5) % 1), 2, hex('#e0b0b0', 0.25 * (1 - ((op.elapsed * 1.5) % 1))));
  }
}

/** One segment split from None in phase 2: it races its own tunnel to the heart. Brand it. */
export class BurrowSegment extends Entity {
  s = 0;
  heat = 0;
  readonly total: number;
  constructor(
    public path: Vec[],
    public speed: number,
    private owner: NoneMalison | null,
    public heartHit = 40,
    public lethal = false,
  ) {
    super({ ...path[0] });
    this.layer = 6;
    this.total = pathLength(path);
  }
  /** Seconds until it reaches the heart. */
  get eta(): number {
    return (this.total - this.s) / this.speed;
  }
  override drain(): number {
    return 0.25;
  }
  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt * 0.5);
    this.branded = false;
    if (op.litanyTime > 0) return;
    this.s += this.speed * dt;
    this.pos = pointAlong(this.path, this.s);
    if (this.s >= this.total) {
      this.kill();
      if (this.lethal) return op.lose('A burrower reached the heart.');
      op.hurt(this.heartHit, this.pos);
      op.rate('miss', this.pos, 'It reached the heart');
      op.shake = 14;
      this.owner?.segmentDone(op, false);
    }
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 22) return;
    this.branded = true;
    this.heat += dt;
    if (Math.random() < dt * 20) op.emit('spark', this.pos, 2);
    if (this.heat >= 0.7) {
      this.kill();
      op.cues.push('burn');
      op.rate('cool', this.pos, 'Segment seared');
      this.owner?.segmentDone(op, true);
    }
  }
  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, 26, 0.1, 0.25, 0.1, 0.8);
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const a = op.elapsed * 12;
    for (let i = 0; i < 4; i++) g.circle(x - Math.cos(a + i) * i * 3, y - Math.sin(a + i) * i * 3, 7 - i, hex('#3a1020', 0.9));
    g.circle(x, y, 3, hex('#e04060'));
    if (this.heat > 0) g.arc(x, y, 16, 3, hex('#ff9040'), this.heat / 0.7);
  }
}

/**
 * The Malison of None — "the Hour of Death". A heart-seeking burrower that
 * tunnels through the host's organs toward the heart; if it arrives, the
 * patient dies at once (the Litany freezes it entirely). Phase 1 "Descent":
 * track the head with the Scrying Lens, cut it off with the lancet, brand it
 * while exposed. Phase 2 "Division": it splits into segments that race to the
 * heart independently — each that arrives costs 40 vitals. Phase 3 "Ninth
 * Hour": the shrunken core must be cut down to size and pulled out with the
 * tongs within a short window, or it regrows. Old tunnels cave in as cuts.
 */
export class NoneMalison extends Entity {
  private voice = new Voice('none', 9, '#f0a0b0');
  private precentorT = 1;
  private precentorIx = 0;
  hp: number;
  readonly maxHp: number;
  stage: 1 | 2 | 3 = 1;
  path: Vec[];
  s = 0;
  total: number;
  trackedT = 0;
  exposedT = 0;
  cutsDone = 0;
  pullT = 0;
  private grabbed = false;
  private lensT = 0;
  private scarS = 0;
  private scars = 0;
  segments: BurrowSegment[] = [];
  private hurtFlash = 0;
  private beatT = 1;
  /** Seconds of skin-bulge tell left before the phase-3 core surfaces. */
  surfacingT = 0;
  /** Ninth-hour gloom (phase 3). */
  gloom = false;

  constructor(
    op: Operation,
    public tune: NoneTuning = NONE_DEFAULT,
    start?: Vec,
    public heart: Vec = NONE_HEART,
  ) {
    const from = start ?? { x: FIELD.cx + 280, y: FIELD.cy + 40 };
    super({ ...from });
    this.layer = 6;
    this.hp = this.maxHp = tune.hp;
    this.hidden = true;
    this.path = burrowPath(op, from, 3, tune.speed, Math.max(tune.minTravel, 22), heart);
    this.total = pathLength(this.path);
    op.spawn(new BurrowRipple(this));
  }

  get speed(): number {
    return this.stage === 3 ? this.tune.speed * 0.45 : this.tune.speed;
  }

  /** Seconds of travel left to the heart. */
  get eta(): number {
    return (this.total - this.s) / this.speed;
  }

  get exposed(): boolean {
    return this.exposedT > 0;
  }

  /** Stage-3 core size: 3 = whole, 0 = small enough to extract. */
  get size(): number {
    return this.tune.cuts - this.cutsDone;
  }

  override drain(): number {
    return 0.3;
  }

  private newPath(op: Operation, organs: number, speed: number): void {
    this.path = burrowPath(op, this.pos, organs, speed, this.tune.minTravel, this.heart);
    this.total = pathLength(this.path);
    this.s = 0;
    this.scarS = 0;
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.hidden ? this.heart : this.pos);
    // Phase 3: the Precentor speaks through the host for the first time.
    if (this.stage === 3) {
      this.precentorT -= dt;
      if (this.precentorT <= 0 && this.precentorIx < PRECENTOR_THROUGH_NONE.length) {
        this.precentorT = 6;
        op.spawn(new VoiceLine({ x: FIELD.cx, y: FIELD.cy - FIELD.ry - 20 }, `The Precentor: ${PRECENTOR_THROUGH_NONE[this.precentorIx++]}`, '#f5d76e', 5));
      }
    }
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    // The heartbeat: audible whether or not the Lens is in hand.
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = this.beatGap;
      bossSound(op, 'ripple', this.heart, 0.5 + 0.5 * (1 - (this.beatGap - 0.3) / 1.1));
    }
    if (this.surfacingT > 0) {
      this.surfacingT -= dt;
      if (this.surfacingT <= 0) {
        this.hidden = false;
        attack(op, 'none', 'surface', this.pos);
      }
      return;
    }
    if (this.stage === 2) return;
    if (this.exposedT > 0) {
      this.exposedT -= dt;
      if (this.exposedT <= 0 && this.stage === 1) {
        // Re-burrows along a new tunnel.
        this.hidden = true;
        this.newPath(op, 2, this.speed);
        op.say('It’s gone under again — find it with the lens!');
      }
      return;
    }
    if (this.trackedT > 0) {
      this.trackedT -= dt;
      if (this.trackedT <= 0 && this.stage === 1) this.hidden = true;
    }
    if (this.grabbed) return;
    if (this.stage === 3 && this.size === 0) {
      this.pullT -= dt;
      if (this.pullT <= 0) {
        this.cutsDone--;
        op.rate('miss', this.pos, 'It regrew');
        op.say('Too slow — it’s growing back! Cut it down again!');
      }
      return;
    }
    // The Litany holds the Hour of Death entirely still.
    if (op.litanyTime > 0) return;
    const before = this.s;
    this.s += this.speed * dt;
    this.pos = pointAlong(this.path, this.s);
    if (this.eta < 6) op.sayOnce('none-near', 'It’s nearly at the heart! Stop it — now!');
    this.scarS += this.s - before;
    if (this.scarS > 160 && this.scars < 4) {
      this.scarS = 0;
      this.scars++;
      const ahead = pointAlong(this.path, this.s + 5);
      op.spawn(new TunnelScar({ ...this.pos }, Math.atan2(ahead.y - this.pos.y, ahead.x - this.pos.x)));
    }
    if (this.s >= this.total) op.lose('The burrower reached the heart.');
  }

  override onReveal(op: Operation, p: Vec, dt: number): void {
    if (this.stage !== 1 || dist(p, this.pos) > 70) return;
    this.lensT += dt;
    if (this.lensT > 0.3) {
      this.lensT = 0;
      this.hidden = false;
      this.trackedT = 4;
      op.popup('Tracked!', this.pos, '#b9d7ff');
      op.cues.push('good');
      op.sayOnce('none-track', 'There’s its head! Cut across it with the lancet to bring it up!');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    const d = dist(ptr.pos, this.pos);
    if (this.stage === 1 && tool === 'lancet' && !this.exposed && d < 32) {
      this.exposedT = 3;
      this.trackedT = 0;
      op.cues.push('cut');
      op.rate('good', this.pos, 'Intercepted');
      op.sayOnce('none-exposed', 'It’s surfaced — brand it before it dives!');
      return true;
    }
    if (this.stage === 3 && tool === 'lancet' && this.size > 0 && d < 28) {
      this.cutsDone++;
      op.cues.push('cut');
      op.emit('blood', this.pos, 6);
      op.rate('good', this.pos, this.size === 0 ? 'Small enough!' : 'Cut down');
      if (this.size === 0) {
        this.pullT = this.tune.pullWindow;
        op.say('Now — the tongs! Pull it out before it regrows!');
      }
      return true;
    }
    if (this.stage === 3 && tool === 'tongs' && this.size === 0 && d < 26) {
      this.grabbed = true;
      op.cues.push('pluck');
      return true;
    }
    return false;
  }

  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (!onBody(ptr.pos)) return this.die(op);
    // Dropped back on the body: it burrows from where it fell.
    this.newPath(op, 1, this.speed);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.stage !== 1 || !this.exposed || dist(ptr.pos, this.pos) > 30) return;
    this.branded = true;
    this.hp -= this.tune.dps * dt;
    this.hurtFlash = 1;
    if (Math.random() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (this.hp <= this.maxHp * 0.7) this.divide(op);
  }

  private divide(op: Operation): void {
    this.stage = 2;
    this.hp = this.maxHp * 0.7;
    this.exposedT = 0;
    this.hidden = true;
    op.rate('good', this.pos, 'It divides');
    op.say('It’s split into pieces — they’re all racing for the heart! Sear them!');
    op.cues.push('bell');
    for (let i = 0; i < this.tune.segments; i++) {
      const a = (i / this.tune.segments) * TAU + op.rng.range(0, 1);
      const from = { x: this.pos.x + Math.cos(a) * 40, y: this.pos.y + Math.sin(a) * 30 };
      const seg = new BurrowSegment(burrowPath(op, onBody(from) ? from : this.pos, 1 + i, this.tune.segSpeed, this.tune.minTravel + i * 2, this.heart), this.tune.segSpeed, this, this.tune.heartHit, this.tune.segmentsLethal);
      this.segments.push(seg);
      op.spawn(seg);
    }
  }

  segmentDone(op: Operation, _seared: boolean): void {
    this.hp -= (this.maxHp * 0.35) / this.tune.segments;
    if (this.segments.some((s) => s.alive)) return;
    this.stage = 3;
    this.hp = this.maxHp * 0.35;
    this.cutsDone = 0;
    this.pos = { x: FIELD.cx + 200, y: FIELD.cy + 60 };
    this.newPath(op, 2, this.speed);
    // Surfacing tell (BOS-0098): the skin bulges before the core breaks through.
    this.hidden = true;
    this.surfacingT = leadFor(op, 'none', 'surface');
    tell(op, 'none', 'surface', this.pos);
    bossSound(op, 'bulge', this.pos);
    // The ninth hour tolls three, and the light goes grey (BOS-0099).
    this.gloom = true;
    bossSound(op, 'three');
    op.events.emit('boss', { kind: 'lighting', dim: 0.25 });
    op.say('Three bells — the ninth hour. The core is coming up, shrunken — cut it down to size, then pull it out!');
    op.cues.push('bell');
    op.shake = 8;
  }

  /** The heartbeat quickens as the nearest head nears the heart (BOS-0097): seconds between beats. */
  get beatGap(): number {
    const live = this.segments.filter((s) => s.alive);
    const eta = this.stage === 2 && live.length ? Math.min(...live.map((s) => s.eta)) : this.eta;
    return Math.max(0.3, Math.min(1.4, 0.25 + eta * 0.06));
  }

  override kill(): void {
    super.kill();
    for (const s of this.segments) s.kill();
  }

  private die(op: Operation): void {
    this.kill();
    op.rate('cool', this.pos, 'None unmade');
    op.shake = 14;
    op.emit('blood', this.pos, 20);
    op.emit('mote', this.pos, 40, undefined, undefined, 120);
    op.say('Out. The ninth hour is out of him.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, 30, 0.15, 0.2, 0, this.hidden ? 0.9 : 0.5);
  }

  draw(g: Gfx, op: Operation): void {
    const t = op.elapsed;
    // The heart, and how near the burrower is to it.
    const eta = Math.min(this.stage === 2 ? Math.min(...this.segments.filter((s) => s.alive).map((s) => s.eta), 99) : this.eta, 30);
    const near = 1 - eta / 30;
    g.glow(this.heart.x, this.heart.y, 50, hex('#ff3040', 0.15 + 0.25 * near * (0.5 + 0.5 * Math.sin(t * (4 + near * 12)))));
    g.arc(this.heart.x, this.heart.y, 34, 3, hex(near > 0.8 ? '#ff4040' : '#e0a0a0', 0.8), near);
    const { x, y } = this.pos;
    if (this.stage === 2) return;
    const r = this.stage === 3 ? 10 + this.size * 6 : 20;
    if (this.stage === 1 && this.hidden) return;
    g.glow(x, y, r * 2.5, hex(this.exposed ? '#ff9050' : '#b04060', 0.25));
    g.circleGrad(x, y, r, this.hurtFlash > 0 ? hex('#ffc080') : hex('#5a1828'), hex('#1a0408', 0.6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 3;
      g.line({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5 }, { x: x + Math.cos(a) * r * 1.3, y: y + Math.sin(a) * r * 1.3 }, 2, hex('#e8c0c8', 0.7));
    }
    if (this.exposed) g.arc(x, y, r + 10, 3, hex('#ff8040'), this.exposedT / 3);
    if (this.trackedT > 0) g.arc(x, y, r + 10, 2, hex('#b9d7ff'), this.trackedT / 4);
    if (this.stage === 3 && this.size === 0) g.arc(x, y, r + 12, 3, hex('#f5d76e'), this.pullT / this.tune.pullWindow);
    drawBossRing(g, this.pos, r + 4, this.hp / this.maxHp, [0.7, 0.35], '#e06080');
  }
}
