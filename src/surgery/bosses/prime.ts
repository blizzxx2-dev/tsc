import { dist, pointSegment, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { BloodPool, Laceration, surfDisc, surfLine } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { distortion, drawBossRing, fxRange, randomOnBody, samplePath, stepToward, TAU } from './common';
import { Voice } from './voices';

/**
 * The roll of the dead that Prime writes into its host. Original Kessendorf
 * names (IP-checked against the avoid-list; no real or franchise figures).
 */
export const PRIME_NAMES: readonly string[] = [
  'Aldo Brenck', 'Grete Hollweg', 'Martin Sauerbrey', 'Liesbeth Kramm', 'Utz Pfennig', 'Hedda Morgenroth',
  'Kilian Farr', 'Walburga Stein', 'Ottmar Leuwe', 'Brigitte Hasenclev', 'Jobst Kettler', 'Irmel Voss',
  'Anselm Truchs', 'Dorle Wendt', 'Fridolin Asch', 'Marthe Grauel', 'Egidius Holt', 'Veit Brennecke',
  'Ursel Tanne', 'Lorenz Mühlbach', 'Adelheid Sporer', 'Gottschalk Ruh', 'Kathrein Lindt', 'Wendelin Oost',
  'Barbel Kranich', 'Sixt Gerber', 'Agnes Kolbe', 'Heinrich Wachs', 'Mechthild Rabe', 'Florian Esch',
  'Trude Haberland', 'Clemens Nagl', 'Walpurga Dorn', 'Benedikt Schrot', 'Ottilie Brandt', 'Lutz Weidner',
  'Rosamund Keil', 'Ambros Hecht', 'Gundel Riese', 'Severin Lamm',
];

/** Erased-stroke ratings are capped so a player cannot farm points by letting Prime write. */
export const PRIME_STROKE_RATING_CAP = 36;
const strokeRatings = new WeakMap<Operation, number>();

/**
 * One name-sigil, written by Prime stroke by stroke. Erase it by tracing its
 * strokes with the lancet in reverse order — the newest ink first. A tracing of
 * any older stroke is rated BAD. If every stroke is written, the name "takes":
 * the patient loses 18 vitals and the letters split open as cuts.
 */
export class NameSigil extends Entity {
  readonly strokes: Vec[][] = [];
  private samples: Vec[][] = [];
  written = 0;
  writeT = 0;
  /** After an erasure the quill recoils before it writes again. */
  recoil = 0;
  tracing = -1;
  private covered: boolean[] = [];
  private traceStart = 0;
  onErased: ((op: Operation, n: NameSigil) => void) | null = null;
  onWritten: ((op: Operation, n: NameSigil) => void) | null = null;
  /** Called as each stroke is completed (Prime moves its quill on to another name). */
  onStroke: ((op: Operation, n: NameSigil) => void) | null = null;
  /** The quill is elsewhere: this name waits. */
  paused = false;
  /** Written in red ink (near the heart): faster, more urgent. */
  red = false;

  constructor(
    pos: Vec,
    public name: string,
    op: Operation,
    public strokeTime = 1.2,
    count = 5,
    public damage = 18,
  ) {
    super(pos);
    this.layer = 1;
    const gap = 30;
    for (let i = 0; i < count; i++) {
      const x = pos.x + (i - (count - 1) / 2) * gap;
      const y = pos.y + op.rng.range(-4, 4);
      const kind = op.rng.int(0, 3);
      const j = () => op.rng.range(-3, 3);
      const s: Vec[] =
        kind === 0
          ? [{ x: x + j(), y: y - 20 }, { x: x + j(), y: y + 20 }]
          : kind === 1
            ? [{ x: x - 11, y: y + 18 }, { x: x + j(), y: y - 20 }, { x: x + 11, y: y + 18 }]
            : kind === 2
              ? [{ x: x - 2, y: y - 20 }, { x: x + j(), y: y + 12 }, { x: x + 10, y: y + 20 }]
              : [{ x: x - 12, y: y - 14 }, { x: x + 12, y: y + 2 + j() }, { x: x - 8, y: y + 20 }];
      this.strokes.push(s);
      this.samples.push(samplePath(s, 7));
    }
  }

  get count(): number {
    return this.strokes.length;
  }

  override drain(): number {
    return 0.08 + 0.05 * this.written;
  }

  override update(op: Operation, dt: number): void {
    // The Litany stills the quill entirely; and the quill writes one name at a time.
    if (op.litanyTime > 0 || this.paused) return;
    if (this.recoil > 0) {
      this.recoil -= dt;
      return;
    }
    const lead = 1 - 0.8 / this.strokeTime;
    const before = this.writeT;
    this.writeT += dt / this.strokeTime;
    // Tell: the nib glints (and scratches) 0.8 s before the next stroke begins.
    if (before < lead && this.writeT >= lead && this.written < this.count - 1) op.cues.push('cut');
    if (this.writeT >= 1) {
      this.writeT = 0;
      this.written++;
      if (Math.random() < 0.6) op.emit('mote', this.strokes[this.written - 1][0], 3);
      if (this.written === this.count - 1) {
        op.sayOnce('prime-nearly', 'It’s nearly written! Strike the last stroke out!');
        op.cues.push('bell');
      }
      if (this.written >= this.count) this.take(op);
      else this.onStroke?.(op, this);
    }
  }

  private take(op: Operation): void {
    this.kill();
    op.hurt(this.damage, this.pos);
    op.rate('miss', this.pos, 'The name is written');
    op.cues.push('bell');
    op.shake = Math.max(op.shake, 8);
    // Every letter splits open as a shallow cut.
    for (const s of this.strokes) {
      const c = { x: (s[0].x + s[s.length - 1].x) / 2, y: (s[0].y + s[s.length - 1].y) / 2 };
      if (onBody(c)) op.spawn(new Laceration(c, Math.PI / 2 + op.rng.range(-0.3, 0.3), 26, 0.3));
    }
    this.onWritten?.(op, this);
  }

  /** Index of the written stroke nearest p, and its distance. */
  private nearest(p: Vec): { i: number; d: number } {
    let best = { i: -1, d: Infinity };
    for (let i = 0; i < this.written; i++) {
      const s = this.strokes[i];
      for (let k = 1; k < s.length; k++) {
        const d = pointSegment(p, s[k - 1], s[k]).d;
        if (d < best.d) best = { i, d };
      }
    }
    return best;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.written === 0) return false;
    const { i, d } = this.nearest(ptr.pos);
    if (i < 0 || d > 18) return false;
    if (i !== this.written - 1) {
      op.rate('bad', ptr.pos, 'Wrong stroke');
      op.hurt(2, ptr.pos);
      op.sayOnce('prime-order', 'Newest ink first, Doctor — strike the strokes out in reverse!');
      this.tracing = -1;
      return true;
    }
    this.tracing = i;
    this.covered = this.samples[i].map(() => false);
    this.traceStart = op.elapsed;
    this.mark(ptr.pos, ptr.pos);
    return true;
  }

  private mark(a: Vec, b: Vec): void {
    const ss = this.samples[this.tracing];
    for (let k = 0; k < ss.length; k++) if (!this.covered[k] && pointSegment(ss[k], a, b).d < 14) this.covered[k] = true;
  }

  get traceFraction(): number {
    return this.covered.length ? this.covered.filter(Boolean).length / this.covered.length : 0;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || this.tracing < 0) return;
    this.mark(ptr.prev, ptr.pos);
    if (this.traceFraction >= 0.8) this.erase(op, ptr.pos);
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (this.tracing >= 0 && this.traceFraction >= 0.7) this.erase(op, ptr.pos);
    this.tracing = -1;
  }

  private erase(op: Operation, p: Vec): void {
    const quick = op.elapsed - this.traceStart < 0.7;
    this.tracing = -1;
    this.written--;
    this.writeT = 0;
    this.recoil = 2;
    op.cues.push('cut');
    op.emit('smoke', p, 2);
    const n = strokeRatings.get(op) ?? 0;
    if (n < PRIME_STROKE_RATING_CAP) {
      strokeRatings.set(op, n + 1);
      // Erasing in the Stillness is always clean if the order is right.
      op.rate(op.litanyTime > 0 || quick ? 'cool' : 'good', p, 'Struck out');
    } else op.popup('Struck out', p, '#c8b8a0');
    if (this.written === 0) {
      this.kill();
      op.rate('cool', this.pos, 'Name unwritten');
      this.onErased?.(op, this);
    }
  }

  override drawSurface(g: Gfx): void {
    for (let i = 0; i < this.written; i++) surfLine(g, this.strokes[i], 7, 0.25, 0, 0.9);
  }

  draw(g: Gfx, op: Operation): void {
    const ink = this.red ? '#8a0a14' : '#140a1c';
    for (let i = 0; i < this.count; i++) {
      const s = this.strokes[i];
      if (i < this.written) {
        g.polyline(s, 5, hex(ink, 0.95));
        if (i === this.written - 1) g.polyline(s, 9, hex(this.red ? '#ff4040' : '#b478ff', 0.18 + 0.12 * Math.sin(op.elapsed * 8)));
      } else if (i === this.written) {
        // The stroke being written, and a faint indentation of the path it will take.
        g.dashed(s, 1.5, hex('#e8dcc0', 0.25), 4, 5);
        const total = samplePath(s, 4);
        const upto = Math.max(1, Math.floor(total.length * this.writeT));
        if (upto > 1) g.polyline(total.slice(0, upto), 5, hex(ink, 0.9));
        const nib = total[Math.min(total.length - 1, upto)];
        g.circle(nib.x, nib.y, 3, hex('#f0e0ff', 0.8));
      } else if (i === this.written + 1 && (1 - this.writeT) * this.strokeTime < 0.8) {
        // Nib glint where the next stroke will begin.
        g.glow(s[0].x, s[0].y, 18, hex('#f0e0ff', 0.7));
      } else g.dashed(s, 1, hex('#e8dcc0', 0.12), 3, 6);
    }
    if (this.tracing >= 0) {
      const ss = this.samples[this.tracing];
      ss.forEach((p, k) => this.covered[k] && g.circle(p.x, p.y, 2.5, hex('#ffd080', 0.9)));
    }
    const pr = this.written / this.count;
    // Completion warning: the whole name glows as its last stroke is written.
    if (this.written === this.count - 1) g.glow(this.pos.x, this.pos.y, 110, hex('#ff5040', 0.12 + 0.08 * Math.sin(op.elapsed * 10)));
    g.text(this.name, this.pos.x, this.pos.y + 44, { size: 15, font: 'italic', color: hex(this.red ? '#ff9080' : '#d8c8f0', 0.5 + 0.5 * pr), align: 'center' });
  }
}

/** Ink spilled by Prime: draw it off with the leech-pipe, or in 8 s it becomes a new name. */
export class InkBlot extends BloodPool {
  age = 0;
  constructor(
    pos: Vec,
    private prime: PrimeMalison,
  ) {
    super(pos, 24, 'blackbile');
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' && tool !== 'lens' && dist(ptr.pos, this.pos) < this.r) {
      const d = distortion(op);
      if (!d.isFouled(tool)) {
        d.foul(tool, 3);
        op.popup('Ink on the instrument!', ptr.pos, '#b478ff');
        op.sayOnce('prime-foul', 'Keep clear of the ink — it fouls whatever touches it! Draw it off with the leech-pipe.');
      }
      return;
    }
    super.onSweep(op, ptr, tool, dt);
  }

  override update(op: Operation, dt: number): void {
    if (op.litanyTime > 0) return;
    this.age += dt;
    if (this.age >= 8 && this.prime.alive) {
      this.kill();
      op.say('The ink is writing by itself!');
      this.prime.adopt(op, new NameSigil({ ...this.pos }, op.rng.pick(PRIME_NAMES), op, 1.6, 3, 12));
    }
  }
  override draw(g?: Gfx, op?: Operation): void {
    if (g && op && this.age > 5) g.arc(this.pos.x, this.pos.y, this.r + 6, 2, hex('#b478ff', 0.4 + 0.3 * Math.sin(op.elapsed * 10)), 1 - (this.age - 5) / 3);
  }
}

export interface PrimeTuning {
  hp: number;
  /** Brand damage per second while exposed. */
  dps: number;
  /** Seconds of exposure after a name is struck out. */
  exposure: number;
  /** Stroke time of names in phase 1 and phase 2 (red ink is 30 % faster). */
  stroke1: number;
  stroke2: number;
  /** Names written in parallel in phase 2 (grows by one below 45 % hp). */
  parallel: number;
}

export const PRIME_DEFAULT: PrimeTuning = { hp: 100, dps: 7, exposure: 3, stroke1: 1.2, stroke2: 2.4, parallel: 2 };

/**
 * The Malison of Prime — "the Registrar". A quill-like mass that writes the
 * roll of the dead into its host. Phase 1 "Roll-Call" writes one name at a
 * time; phase 2 "The Ledger" writes several at once, faster near the heart;
 * phase 3 "Kreuzer" writes the surgeon's own name along the edge of the field
 * and spills ink that becomes new names if left. Striking a name out exposes
 * the quill to the brand for a few seconds.
 */
export class PrimeMalison extends Entity {
  private voice = new Voice('prime', 9, '#d8c8f0');
  hp: number;
  readonly maxHp: number;
  exposedT = 0;
  names: NameSigil[] = [];
  private spawnT = 1;
  private blotT = 4;
  private hurtFlash = 0;
  private target: Vec;
  private wroteKreuzer = false;
  readonly heart: Vec;
  private nameIx: number;

  constructor(
    pos: Vec,
    op: Operation,
    public tune: PrimeTuning = PRIME_DEFAULT,
    heart?: Vec,
  ) {
    super(pos);
    this.layer = 4;
    this.hp = this.maxHp = tune.hp;
    this.target = { ...pos };
    this.heart = heart ?? { x: FIELD.cx - 70, y: FIELD.cy - 20 };
    this.nameIx = op.rng.int(0, PRIME_NAMES.length - 1);
  }

  get phaseNo(): 1 | 2 | 3 {
    const f = this.hp / this.maxHp;
    return f > 0.6 ? 1 : f > 0.25 ? 2 : 3;
  }

  get exposed(): boolean {
    return this.exposedT > 0;
  }

  get radius(): number {
    return 26 + 10 * (this.hp / this.maxHp);
  }

  get living(): NameSigil[] {
    return this.names.filter((n) => n.alive);
  }

  override drain(): number {
    return 0.2;
  }

  private nextName(): string {
    this.nameIx = (this.nameIx + 7) % PRIME_NAMES.length;
    return PRIME_NAMES[this.nameIx];
  }

  adopt(op: Operation, n: NameSigil): void {
    n.onErased = (o) => this.expose(o);
    n.onStroke = () => this.moveQuill(n);
    n.onWritten = () => this.moveQuill(n);
    this.names.push(n);
    op.spawn(n);
    if (this.living.length > 1) n.paused = true;
  }

  /**
   * One quill, many names: after each stroke it moves on to the next living
   * name, so names in parallel share its pace rather than multiply it.
   */
  private moveQuill(from: NameSigil): void {
    const live = this.living.filter((n) => n.alive && n !== from);
    if (!live.length) {
      from.paused = false;
      return;
    }
    const i = this.names.indexOf(from);
    const next = [...this.names.slice(i + 1), ...this.names.slice(0, i)].find((n) => n.alive) ?? live[0];
    for (const n of this.names) n.paused = n !== next;
    if (!from.alive) from.paused = true;
  }

  private expose(op: Operation): void {
    if (!this.alive) return;
    this.exposedT = this.tune.exposure;
    op.sayOnce('prime-exposed', 'The quill is bare — brand it while it hesitates!');
    op.shake = Math.max(op.shake, 4);
  }

  /** A spot on the body for a new name, clear of the other names. */
  private spot(op: Operation, band = 0.55): Vec {
    for (let i = 0; i < 30; i++) {
      const p = randomOnBody(op, band, 0.5);
      if (!onBody({ x: p.x - 90, y: p.y }) || !onBody({ x: p.x + 90, y: p.y + 30 })) continue;
      if (this.living.every((n) => dist(n.pos, p) > 150) && dist(p, this.pos) > 70) return p;
    }
    return randomOnBody(op, 0.4, 0.3);
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (Math.random() < dt * 6) op.emit('mote', { x: this.pos.x + fxRange(-20, 20), y: this.pos.y + fxRange(-20, 20) }, 1);
    if (this.exposedT > 0) this.exposedT = Math.max(0, this.exposedT - dt);
    // The quill drifts while it is not exposed.
    if (!this.exposed) {
      if (dist(this.pos, this.target) < 6) this.target = randomOnBody(op, 0.45, 0.35);
      this.pos = stepToward(this.pos, this.target, 22, dt);
    }
    if (op.litanyTime > 0) return;

    const phase = this.phaseNo;
    const live = this.living;
    if (live.length && live.every((n) => n.paused)) live[0].paused = false;
    this.spawnT -= dt;
    if (phase === 1) {
      if (live.length === 0 && !this.exposed && this.spawnT <= 0) {
        this.spawnT = 1;
        this.adopt(op, new NameSigil(this.spot(op), this.nextName(), op, this.tune.stroke1));
        op.sayOnce('prime-writes', 'It’s writing a name into him! Trace the strokes out with the lancet — newest first!');
      }
    } else if (phase === 2) {
      // Two names, and a third (slower) one late in the Ledger.
      const want = this.tune.parallel + (this.hp / this.maxHp < 0.4 ? 1 : 0);
      if (live.length < want && this.spawnT <= 0) {
        this.spawnT = 3;
        const p = this.spot(op);
        const red = dist(p, this.heart) < 190;
        const n = new NameSigil(p, this.nextName(), op, this.tune.stroke2 * (red ? 0.7 : 1) * (live.length >= this.tune.parallel ? 1.4 : 1));
        n.red = red;
        this.adopt(op, n);
        op.sayOnce('prime-ledger', 'Several at once now! The red ink is nearest the heart — strike those first!');
      }
    } else {
      if (!this.wroteKreuzer || (live.length === 0 && !this.exposed && this.spawnT <= 0)) {
        this.wroteKreuzer = true;
        this.spawnT = 2;
        const k = new NameSigil({ x: FIELD.cx, y: FIELD.cy - FIELD.ry * 0.72 }, 'KREUZER', op, 2, 7, 18);
        k.red = true;
        this.adopt(op, k);
        op.say('Doctor… that is your name it’s writing.');
      }
      this.blotT -= dt;
      const blots = op.entities.filter((e) => e instanceof InkBlot && e.alive).length;
      if (this.blotT <= 0) {
        this.blotT = 7;
        if (blots < 2) {
          op.spawn(new InkBlot(randomOnBody(op, 0.5, 0.4), this));
          op.sayOnce('prime-ink', 'Ink, pooling — draw it off before it starts to write!');
        }
      }
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (!this.exposed) {
      op.sayOnce('prime-guarded', 'The quill won’t take the brand while it writes. Strike out a name first!');
      return;
    }
    const before = this.phaseNo;
    this.hp -= this.tune.dps * dt;
    this.hurtFlash = 1;
    if (Math.random() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (this.hp <= 0) return this.die(op);
    // Crossing into a new phase ends the exposure and starts the next movement.
    if (this.phaseNo !== before) {
      this.exposedT = 0;
      this.spawnT = 1.5;
    }
  }

  override kill(): void {
    super.kill();
    for (const n of this.names) n.kill();
  }

  private die(op: Operation): void {
    this.kill();
    for (const e of op.entities) if (e instanceof InkBlot) e.kill();
    op.rate('cool', this.pos, 'Prime unmade');
    op.shake = 14;
    op.emit('mote', this.pos, 60, undefined, undefined, 140);
    op.say('The quill has snapped. The roll is closed.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.radius * 1.8, 0.05, 0.3, 0.3, 0.5);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const r = this.radius;
    const t = op.elapsed;
    g.glow(x, y, r * 2.4, hex(this.exposed ? '#ff9050' : '#9060d0', 0.22));
    // A feathered quill-mass: vanes around a dark nib.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.3;
      const l = r * (1.2 + 0.25 * Math.sin(t * 3 + i));
      g.line({ x, y }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l * 0.8 }, 3, hex('#2a1838', 0.8));
    }
    g.circleGrad(x, y, r, this.hurtFlash > 0 ? hex('#ffc080') : hex('#3c2450'), hex('#0e0616', 0.5));
    g.tri(x - 6, y - r * 0.7, x + 6, y - r * 0.7, x, y + r * 0.9, hex(this.exposed ? '#ffb070' : '#d8c8f0'));
    if (this.exposed) g.arc(x, y, r + 12, 3, hex('#ff8040'), this.exposedT / this.tune.exposure);
    drawBossRing(g, this.pos, r + 6, this.hp / this.maxHp, [0.6, 0.25]);
  }
}
