import { fxRandom } from '../fxRandom';
import { dist, type Vec } from '../../core/math';
import { Coverage } from '../coverage';
import { Entity } from '../entity';
import { Burn } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { distortion, fxRange, TAU } from './common';
import { Voice } from './voices';
import { attack, bossSound, leadFor, tell } from './signals';

/** The pitch of each tongue's syllable; together, the word the merged core sings. */
export const TERCE_WORD: readonly number[] = [0.8, 1.0, 1.25];

export interface TerceTuning {
  hp: number;
  /** Seconds between leaps of the hexfire from organ to organ. */
  leapEvery: number;
  /** Seconds of warning glow on the organ the fire is about to leap to. */
  leapTell: number;
  /** Phase 2: the three tongues must be doused within this many seconds of each other. */
  douseWindow: number;
  /** Most hexfire burns the flare-ups may leave at once. */
  maxBurns: number;
  /** Heat-haze cursor displacement in phase 3 (px). */
  haze: number;
}

export const TERCE_DEFAULT: TerceTuning = { hp: 100, leapEvery: 5, leapTell: 1, douseWindow: 2, maxBurns: 2, haze: 10 };

/** Default organ zones for the fire to leap between: left lung, gut, right lung. */
export const TERCE_ZONES: readonly Vec[] = [
  { x: FIELD.cx - 180, y: FIELD.cy - 40 },
  { x: FIELD.cx + 10, y: FIELD.cy + 70 },
  { x: FIELD.cx + 180, y: FIELD.cy - 30 },
];

/**
 * A tongue of hexfire. Salve the flame-front until it gutters, then excise the
 * root ember with a lancet touch. Searing it with the brand only feeds it.
 */
export class FlameTongue extends Entity {
  readonly cov: Coverage;
  state: 'flame' | 'root' = 'flame';
  private regrowT = 0;

  constructor(
    pos: Vec,
    public owner: TerceMalison | null,
    public radius = 26,
    /** Pentecost tongues are doused only; they have no root to excise. */
    public pentecost = false,
  ) {
    super(pos);
    this.layer = 3;
    this.cov = new Coverage(pos, radius, 12);
  }

  override drain(): number {
    return this.state === 'flame' ? 0.2 : 0.1;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    if (this.state !== 'flame') return;
    // An untended flame-front creeps back over salved flesh.
    this.regrowT += dt;
    const done = this.cov.cells.filter((c) => c.done);
    if (done.length && this.regrowT > 0.6) {
      this.regrowT = 0;
      done[Math.floor(op.rng.next() * done.length)].done = false;
    }
  }

  rekindle(): void {
    this.state = 'flame';
    for (const c of this.cov.cells) c.done = false;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'brand' && dist(ptr.pos, this.pos) < this.radius + 8) {
      this.branded = true;
      if (this.state === 'root' && !this.pentecost) this.rekindle();
      this.owner?.feed(op, dt, this.pos);
      return;
    }
    if (tool !== 'salve' || this.state !== 'flame' || !this.cov.contains(ptr.pos, 16)) return;
    if (this.cov.brush(ptr.pos, 24) > 0 && this.cov.fraction >= 0.85) {
      this.state = 'root';
      op.emit('smoke', this.pos, 6);
      op.cues.push('squelch');
      if (this.pentecost) {
        op.rate('good', this.pos, 'Doused');
        this.owner?.doused(op, this);
      } else {
        op.rate('good', this.pos, 'Flame-front out');
        op.sayOnce('terce-root', 'The front is out — now excise the root ember with the lancet!');
      }
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.pentecost || dist(ptr.pos, this.pos) > 18) return false;
    if (this.state === 'flame') {
      op.rate('bad', ptr.pos, 'Into the fire');
      op.hurt(3, ptr.pos);
      op.sayOnce('terce-cut-flame', 'Not while it burns! Salve the flame-front first.');
      return true;
    }
    this.kill();
    op.cues.push('cut');
    op.emit('spark', this.pos, 14);
    op.rate('cool', this.pos, 'Root excised');
    this.owner?.hit(op, 10);
    return true;
  }
}

/**
 * The Malison of Terce — "Tongues of Fire". Its hexfire core hides in one of
 * the host's organs and leaps between them. Phase 1 "Kindling": each leap
 * lights a tongue (salve the front, excise the root to wound the core). Phase 2
 * "Pentecost": the core splits into three tongues that must all be doused
 * within a short window of each other, or they rekindle. Phase 3 "Ash": the core
 * lies bare in a heat-haze that throws the instruments off; draw the smoke off
 * with the leech-pipe, then encircle the core with the lancet to cut it out.
 * The brand feeds the fire: it heals Terce and relights what was doused.
 */
export class TerceMalison extends Entity {
  // An Hour: the operation treats it as a boss (banner, time bonus, checkpoints, phase hints).
  override boss = true;
  private voice = new Voice('terce', 9, '#ffb080');
  hp: number;
  readonly maxHp: number;
  zone = 0;
  tongues: FlameTongue[] = [];
  private leapT: number;
  tellZone = -1;
  tellT = 0;
  private lastDouse = -Infinity;
  private fedT = 0;
  private fedWarned = false;
  hazeClearT = 0;
  private smokeT = 0;
  private circling = false;
  private circleSum = 0;
  private circleLast = 0;
  hurtFlash = 0;
  stage: 1 | 2 | 3 = 1;
  private sungT = 2;

  constructor(
    op: Operation,
    public tune: TerceTuning = TERCE_DEFAULT,
    public zones: readonly Vec[] = TERCE_ZONES,
  ) {
    super({ ...zones[0] });
    this.layer = 2;
    this.hp = this.maxHp = tune.hp;
    this.zone = op.rng.int(0, zones.length - 1);
    this.pos = { ...zones[this.zone] };
    this.leapT = 1.5;
  }

  get phaseNo(): 1 | 2 | 3 {
    return this.stage;
  }

  get radius(): number {
    return 22 + 10 * (this.hp / this.maxHp);
  }

  get living(): FlameTongue[] {
    return this.tongues.filter((t) => t.alive);
  }

  get hazed(): boolean {
    return this.stage === 3 && this.hazeClearT <= 0;
  }

  override drain(): number {
    return this.stage === 3 ? 0.5 : 0.15;
  }

  private addTongue(op: Operation, zone: number, pentecost = false): void {
    const z = this.zones[zone];
    const a = op.rng.range(0, TAU);
    const p = { x: z.x + Math.cos(a) * 18, y: z.y + Math.sin(a) * 14 };
    const t = new FlameTongue(onBody(p) ? p : { ...z }, this, pentecost ? 18 : 26, pentecost);
    this.tongues.push(t);
    op.spawn(t);
  }

  /** The brand on the fire: it heals the curse and spreads the flames. */
  feed(op: Operation, dt: number, at: Vec): void {
    this.hp = Math.min(this.phaseCap(), this.hp + this.maxHp * 0.05 * dt);
    for (const t of this.living) if (t.state === 'flame') for (const c of t.cov.cells) c.done = false;
    this.fedT -= dt;
    if (!this.fedWarned) {
      this.fedWarned = true;
      this.fedT = 1;
      op.say('No! The brand feeds it — hexfire drinks heat!');
    } else if (this.fedT <= 0) {
      this.fedT = 1;
      op.rate('bad', at, 'Fed the fire');
    }
  }

  private phaseCap(): number {
    return this.stage === 1 ? this.maxHp : this.stage === 2 ? this.maxHp * 0.65 : this.maxHp * 0.3;
  }

  hit(op: Operation, pct: number): void {
    if (!this.alive) return;
    this.hp -= this.maxHp * (pct / 100);
    this.hurtFlash = 1;
    op.shake = Math.max(op.shake, 5);
    if (this.stage === 1 && this.hp <= this.maxHp * 0.65) this.enterPentecost(op);
    else if (this.stage === 3 && this.hp <= 0) this.die(op);
  }

  private enterPentecost(op: Operation): void {
    this.stage = 2;
    this.hp = this.maxHp * 0.65;
    for (const t of this.tongues) t.kill();
    this.tongues = [];
    this.tellZone = -1;
    for (let z = 0; z < 3; z++) this.addTongue(op, z % this.zones.length, true);
    op.say('It’s split into three tongues! Douse them one after another — quickly, or they catch again!');
    op.cues.push('bell');
  }

  doused(op: Operation, t: FlameTongue): void {
    const now = op.elapsed;
    const others = this.living.filter((o) => o !== t && o.state === 'root');
    if (others.length > 0 && now - this.lastDouse > this.tune.douseWindow) {
      // Too slow: the doused tongues catch again from the ones still burning.
      for (const o of others) o.rekindle();
      op.rate('miss', t.pos, 'Rekindled');
      op.say('Too slow — they’ve caught again! One after the other, Doctor!');
    }
    this.lastDouse = now;
    if (this.living.every((o) => o.state === 'root')) {
      for (const o of this.tongues) o.kill();
      this.tongues = [];
      this.stage = 3;
      this.hp = this.maxHp * 0.3;
      this.pos = { x: FIELD.cx + op.rng.range(-80, 80), y: FIELD.cy + op.rng.range(-30, 30) };
      op.rate('cool', this.pos, 'Pentecost quenched');
      op.say('The core is bare — but the heat… my eyes swim. Draw off the smoke with the leech-pipe, then cut around it!');
      op.shake = 10;
    }
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (fxRandom() < dt * 8) op.emit('spark', { x: this.pos.x + fxRange(-15, 15), y: this.pos.y + fxRange(-15, 15) }, 1);
    if (this.stage === 1) {
      this.leapT -= dt;
      if (this.tellZone < 0 && this.leapT <= Math.max(this.tune.leapTell, leadFor(op, 'terce', 'leap'))) {
        // Tell (BOS-0068): the organ it will leap to glows orange, and a crackle pans toward it.
        const choices = this.zones.map((_, i) => i).filter((i) => i !== this.zone);
        this.tellZone = op.rng.pick(choices);
        op.cues.push('burn');
        const z = this.zones[this.tellZone];
        tell(op, 'terce', 'leap', z);
        bossSound(op, 'crackle', z);
      }
      if (this.leapT <= 0) {
        this.leapT = this.tune.leapEvery;
        this.zone = this.tellZone >= 0 ? this.tellZone : this.zone;
        this.tellZone = -1;
        this.pos = { ...this.zones[this.zone] };
        attack(op, 'terce', 'leap', this.pos);
        if (this.living.length < 3) {
          this.addTongue(op, this.zone);
          op.sayOnce('terce-leap', 'It leapt to another organ! Salve the flame-front — not the brand!');
        } else {
          const burns = op.entities.filter((e) => e instanceof Burn && e.alive && e.source === 'hexfire').length;
          if (burns < this.tune.maxBurns) {
            const src = op.rng.pick(this.living);
            const a = op.rng.range(0, TAU);
            const p = { x: src.pos.x + Math.cos(a) * 60, y: src.pos.y + Math.sin(a) * 45 };
            op.spawn(new Burn(onBody(p) ? p : { ...src.pos }, 24, op, 'hexfire'));
            op.sayOnce('terce-flare', 'The untended tongues are spreading burns!');
          }
        }
      }
    }
    // Each tongue whispers its own syllable; the merged core sings the whole word (BOS-0070).
    this.sungT -= dt;
    if (this.sungT <= 0) {
      this.sungT = 3.2;
      if (this.stage === 3) TERCE_WORD.forEach((p, i) => bossSound(op, 'syllable', this.pos, 1, p * (1 + i * 0.001)));
      else this.living.forEach((t, i) => t.state === 'flame' && bossSound(op, 'syllable', t.pos, 0.7, TERCE_WORD[i % TERCE_WORD.length]));
    }
    if (this.stage === 3) {
      this.hazeClearT = Math.max(0, this.hazeClearT - dt);
      distortion(op).haze = this.hazed ? this.tune.haze : 0;
      this.smokeT = Math.max(0, this.smokeT - dt * 0.5);
      // Embers still spit from the bare core and kindle new tongues.
      this.leapT -= dt;
      if (this.leapT <= 0) {
        this.leapT = this.tune.leapEvery * 1.8;
        if (this.living.length < 2) this.addTongue(op, op.rng.int(0, this.zones.length - 1));
      }
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (this.stage !== 3) return;
    const d = dist(ptr.pos, this.pos);
    if (tool === 'brand' && d < this.radius + 6) {
      this.branded = true;
      this.feed(op, dt, ptr.pos);
    } else if (tool === 'leech' && d < 70) {
      this.smokeT += dt * 1.5;
      if (fxRandom() < dt * 20) op.emit('smoke', ptr.pos, 1);
      if (this.smokeT >= 1) {
        this.smokeT = 0;
        this.hazeClearT = 4;
        op.rate('good', this.pos, 'Smoke drawn');
      }
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.stage !== 3 || tool !== 'lancet') return false;
    const d = dist(ptr.pos, this.pos);
    if (d < 20 || d > 130) return false;
    this.circling = true;
    this.circleSum = 0;
    this.circleLast = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
    void op;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (!this.circling || tool !== 'lancet') return;
    const d = dist(ptr.pos, this.pos);
    if (d < 20 || d > 150) {
      this.circling = false;
      op.sayOnce('terce-circle', 'Keep the lancet circling the core — not too close, not too wide.');
      return;
    }
    const a = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
    let da = a - this.circleLast;
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    this.circleSum += da;
    this.circleLast = a;
    if (Math.abs(this.circleSum) >= TAU * 0.92) {
      this.circling = false;
      op.cues.push('cut');
      op.emit('spark', this.pos, 20);
      op.rate(this.hazed ? 'good' : 'cool', this.pos, 'Encircled');
      this.hit(op, 10);
    }
  }

  override onRelease(): void {
    this.circling = false;
  }

  override kill(): void {
    super.kill();
    for (const t of this.tongues) t.kill();
  }

  private die(op: Operation): void {
    this.kill();
    distortion(op).haze = 0;
    op.rate('cool', this.pos, 'Terce unmade');
    op.shake = 14;
    op.emit('mote', this.pos, 50, undefined, undefined, 140);
    op.emit('smoke', this.pos, 20);
    op.say('The fire is out. Saints… it’s out.');
  }
}
