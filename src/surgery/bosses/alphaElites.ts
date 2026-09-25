/**
 * Alpha elites (BOS-0153, BOS-0157..0161) on the elite frame: MalisonBase with one phase, the
 * compact HUD bar, no checkpoints. Each spawns its core followed by the wounds it binds
 * (`.all`), so content places one spec and gets the whole encounter.
 */
import { clamp, dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { wormArt } from '../../art/wormArt';
import { Entity } from '../entity';
import { Embedded, Incision, Sigil, SIGILS, surfDisc } from '../entities';
import { FrostPatch } from '../ailments/frost';
import { GutWorm } from '../ailments/parasites';
import { Amputation } from '../ailments/gangrene';
import { onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { BossRot, MalisonBase, type BossPhase } from './base';
import { attack, Cadence, leadFor, tell } from './signals';
import { TAU } from './common';

const ONE: readonly BossPhase[] = [{ key: 'main', from: 1, music: 1 }];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function numeral(g: Gfx, i: number, at: Vec, due: boolean): void {
  g.text(NUMERALS[i] ?? '', at.x + 18, at.y - 16, { size: due ? 18 : 14, font: 'display', color: hex(due ? '#f0e0a0' : '#a09070', 0.9), align: 'center' });
}

// ------------------------------------------------------------------ BOS-0157 Gut-worm matriarch

/** Gut-worm matriarch tuning: px/s above which a pull tears a segment off, and px of body per segment. */
export const MATRIARCH = { speed: 220, segLen: 34, grab: 22 } as const;

/**
 * A giant gut-worm (BOS-0157). Seize the head with the tongs and draw the whole length out
 * slowly, off the body. Pull faster than MATRIARCH.speed and the rearmost segment tears free
 * and wriggles off as a worm of its own; the matriarch is shorter, but the field has another
 * parasite to deal with.
 */
export class WormMatriarch extends MalisonBase {
  readonly bossId = 'matriarch';
  readonly phases = ONE;
  readonly origin: Vec;
  head: Vec;
  segments: number;
  readonly startSegments: number;
  private grabbed = false;
  pulled = 0;
  /** Segments torn off (tests). */
  torn = 0;
  private strain = 0;

  constructor(pos: Vec, op: Operation, segments = 5) {
    super(pos, op, 100);
    this.elite = true;
    this.layer = 4;
    this.origin = { ...pos };
    this.head = { ...pos };
    this.segments = this.startSegments = segments;
  }

  get all(): Entity[] {
    return [this];
  }

  get length(): number {
    return this.segments * MATRIARCH.segLen;
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override drain(): number {
    return 0.2 + 0.08 * this.segments;
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.head) < MATRIARCH.grab + pad;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('matriarch', 'A mother-worm, and a long one. Tongs on the head — draw it out slow, or it sheds pieces of itself.');
    this.strain = Math.max(0, this.strain - dt * 2);
    const left = this.segments / this.startSegments;
    this.hp = this.maxHp * left * (1 - 0.9 * clamp(this.pulled / this.length, 0, 1));
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.head) > MATRIARCH.grab + op.hitPad) return false;
    this.grabbed = true;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.grabbed || tool !== 'tongs') return;
    const step = Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    const speed = dt > 0 ? step / dt : 0;
    this.strain = Math.max(this.strain, speed / MATRIARCH.speed);
    if (!ptr.pressed && speed > MATRIARCH.speed) return this.tear(op, ptr.pos);
    this.head = { ...ptr.pos };
    this.pulled = dist(this.head, this.origin);
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (this.pulled >= this.length && !onBody(ptr.pos)) {
      op.rate('cool', ptr.pos, 'Matriarch drawn');
      this.die(op);
      return;
    }
    this.head = { ...this.origin };
    this.pulled = 0;
  }

  /** Too fast: the rearmost segment tears off and becomes a worm; the head slips back in. */
  private tear(op: Operation, at: Vec): void {
    this.grabbed = false;
    this.torn++;
    op.rate('bad', at, 'Segment torn');
    op.popup('A segment wriggles free', { x: at.x, y: at.y - 30 }, '#e0c8a0');
    op.sayOnce('matriarch-tear', 'Gently! Every piece that tears off is a worm in its own right.');
    const k = 0.35;
    const spot = { x: this.origin.x + (this.head.x - this.origin.x) * k, y: this.origin.y + (this.head.y - this.origin.y) * k };
    this.spawnAdd(op, new GutWorm(onBody(spot) ? spot : { ...this.origin }));
    this.segments = Math.max(0, this.segments - 1);
    this.head = { ...this.origin };
    this.pulled = 0;
    if (this.segments === 0) this.die(op);
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.origin, 26, 0, 0.3, 0.1, 0.1);
  }

  draw(g: Gfx, op: Operation): void {
    wormArt(g, { origin: this.origin, head: this.head, t: op.elapsed, held: this.grabbed, seed: this.id, width: 11 });
    // Segment rings along the drawn-out body; a strain arc warns before a tear.
    const d = dist(this.head, this.origin);
    for (let i = 1; i < this.segments && d > 8; i++) {
      const k = i / this.segments;
      g.circle(this.origin.x + (this.head.x - this.origin.x) * k, this.origin.y + (this.head.y - this.origin.y) * k, 3, hex('#8a5a44', 0.8));
    }
    if (this.grabbed && this.strain > 0.05) g.arc(this.head.x, this.head.y, 20, 3, hex(this.strain > 0.8 ? '#ff4030' : '#f5d76e'), Math.min(1, this.strain));
  }
}

// ------------------------------------------------------------------ BOS-0153 Troll-blood sellsword

export const SELLSWORD = { regrow: 8, sprayEvery: 9, sprayFor: 5, reach: 24 } as const;

/**
 * A troll-blooded sellsword (BOS-0153): shrapnel in flesh that heals over it. Each wound
 * regrows a callus over its fragment in SELLSWORD.regrow seconds; once sealed, the tongs cannot
 * reach the metal until the lancet opens it again. Every SELLSWORD.sprayEvery seconds, after a
 * tell, his acid blood sprays and burns out one instrument for SELLSWORD.sprayFor seconds.
 */
export class Sellsword extends MalisonBase {
  readonly bossId = 'sellsword';
  readonly phases = ONE;
  readonly shards: Embedded[];
  /** Callus growth over each shard, 0 open .. 1 sealed. */
  readonly callus: number[];
  private spray: Cadence;
  /** Tools burned out by the spray so far (tests). */
  readonly burned: ToolId[] = [];

  constructor(op: Operation, spots: readonly Vec[]) {
    const c = spots.reduce((a, p) => ({ x: a.x + p.x / spots.length, y: a.y + p.y / spots.length }), { x: 0, y: 0 });
    super(c, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = 7;
    this.shards = spots.map((p, i) => new Embedded(p, 'shot', (i / spots.length) * TAU, false));
    this.callus = spots.map(() => 0);
    this.spray = new Cadence(SELLSWORD.sprayEvery, leadFor(op, 'sellsword', 'spray'));
  }

  get all(): Entity[] {
    return [this, ...this.shards];
  }

  override wants(): readonly ToolId[] {
    return ['tongs', 'lancet'];
  }

  sealed(i: number): boolean {
    return this.shards[i].alive && this.callus[i] >= 1;
  }

  private sealedAt(p: Vec, pad = 0): number {
    return this.shards.findIndex((s, i) => this.sealed(i) && dist(p, s.origin) < SELLSWORD.reach + pad);
  }

  override drain(): number {
    return 0.2 + 0.1 * this.callus.filter((k, i) => k >= 1 && this.shards[i].alive).length;
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.sealedAt(p, pad) >= 0;
  }

  override blocksTool(_op: Operation, p: Vec, tool: ToolId): string | null {
    return tool === 'tongs' && this.sealedAt(p) >= 0 ? 'Healed over the metal — open it with the lancet.' : null;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet') return false;
    const i = this.sealedAt(ptr.pos, op.hitPad);
    if (i < 0) return false;
    this.callus[i] = 0;
    op.rate('good', this.shards[i].origin, 'Reopened');
    op.emit('blood', this.shards[i].origin, 8);
    return true;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('sellsword', 'Troll blood — the flesh knits over the shrapnel while you watch. Get the metal out before it seals, and mind his blood: it eats instruments.');
    this.shards.forEach((s, i) => {
      if (!s.alive) return;
      const was = this.callus[i];
      this.callus[i] = Math.min(1, was + dt / SELLSWORD.regrow);
      if (was < 1 && this.callus[i] >= 1) op.popup('Healed over', { x: s.origin.x, y: s.origin.y - 26 }, '#c8b8a0');
    });
    const ev = this.spray.step(dt);
    if (ev === 'tell') tell(op, 'sellsword', 'spray', this.pos);
    else if (ev === 'attack') {
      // The spray takes an instrument in the kit other than the tongs and the lancet the fight needs.
      const pool = op.def.tools.filter((t) => t !== 'tongs' && t !== 'lancet');
      if (pool.length) {
        const t = pool[Math.floor(op.rng.next() * pool.length)];
        op.disableTool(t, SELLSWORD.sprayFor);
        this.burned.push(t);
        op.popup('Acid on the instruments!', { x: this.pos.x, y: this.pos.y - 40 }, '#b8e040');
      }
      op.emit('pus', this.pos, 16, undefined, undefined, 180);
      attack(op, 'sellsword', 'spray', this.pos);
    }
    const left = this.shards.filter((s) => s.alive).length;
    this.hp = (this.maxHp * left) / this.shards.length;
    if (left === 0 && !this.dying) this.die(op);
  }

  override drawSurface(g: Gfx): void {
    this.shards.forEach((s, i) => s.alive && surfDisc(g, s.origin, 22, 0, 0.25 * (1 - this.callus[i]), 0.05, 0));
  }

  draw(g: Gfx, op: Operation): void {
    this.shards.forEach((s, i) => {
      if (!s.alive) return;
      const k = this.callus[i];
      // The callus: pale new skin closing in from the rim; sealed, a ridged scar lid.
      g.circle(s.origin.x, s.origin.y, 6 + 12 * k, hex('#d8b8a0', 0.25 + 0.6 * k));
      if (k >= 1) g.arc(s.origin.x, s.origin.y, 18, 2, hex('#8a6a58', 0.9));
      else g.arc(s.origin.x, s.origin.y, 21, 2, hex('#b0e050', 0.6), k);
    });
    if (this.spray.telling) g.glow(this.pos.x, this.pos.y, 60, hex('#a8e040', 0.25 + 0.15 * Math.sin(op.elapsed * 18)));
  }
}

// ------------------------------------------------------------------ BOS-0158 Dead man's pulse

export const DEAD_PULSE = { period: 60, window: 5, first: 4 } as const;

/**
 * The dead man's pulse (BOS-0158): a bite-tranced patient whose heart beats once a minute.
 * Between beats the flesh is still as stone and the lancet will not bite; the incision can only
 * be carried during the DEAD_PULSE.window seconds of each beat. The trance itself is a sigil
 * under the skin that only the Scrying Lens shows; trace it to break the trance.
 */
export class DeadPulse extends MalisonBase {
  readonly bossId = 'deadpulse';
  readonly phases = ONE;
  readonly incision: Incision;
  readonly sigil: Sigil;
  readonly period: number;
  private t: number;

  constructor(op: Operation, path: readonly Vec[], sigilAt: Vec, period: number = DEAD_PULSE.period) {
    super(sigilAt, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = 7;
    this.period = period;
    this.incision = new Incision([...path]);
    this.sigil = new Sigil(sigilAt, SIGILS.eye, 54, 99);
    this.sigil.hidden = true;
    // The first beat comes soon so the rhythm is shown before it has to be waited out.
    this.t = period - DEAD_PULSE.window - DEAD_PULSE.first;
  }

  get all(): Entity[] {
    return [this, this.incision, this.sigil];
  }

  /** Inside a beat window: the flesh answers the blade. */
  get beating(): boolean {
    return this.t >= this.period - DEAD_PULSE.window;
  }

  /** Seconds until the next beat opens (0 while it is open). */
  get untilBeat(): number {
    return this.beating ? 0 : this.period - DEAD_PULSE.window - this.t;
  }

  override drain(): number {
    return 0.15;
  }

  override hitTest(): boolean {
    return false;
  }

  override blocksTool(_op: Operation, p: Vec, tool: ToolId): string | null {
    if (tool !== 'lancet' || this.beating || !this.incision.alive || this.incision.depth >= this.incision.layers) return null;
    const near = this.incision.points.some((q) => dist(p, q) < 40);
    return near ? 'Still as stone — wait for the beat.' : null;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('deadpulse', 'His heart beats once a minute. Cut only on the beat — and look under the skin with the Lens; there is a trance-mark on him.');
    const before = this.beating;
    this.t += dt;
    if (this.t >= this.period) this.t -= this.period;
    if (!before && this.beating) {
      op.cues.push('heartbeat');
      op.popup('The beat — cut now!', { x: this.incision.points[0].x, y: this.incision.points[0].y - 30 }, '#ff9a8a');
    }
    const cut = this.incision.depth >= this.incision.layers;
    const broken = !this.sigil.alive;
    this.hp = this.maxHp * (1 - (Number(cut) + Number(broken)) / 2);
    if (cut && broken && !this.dying) this.die(op);
  }

  draw(g: Gfx, op: Operation): void {
    const p0 = this.incision.points[0];
    // The beat: a slow countdown ring at the head of the line, and a red flush when it lands.
    if (this.beating) g.glow(p0.x, p0.y, 70, hex('#ff5040', 0.3));
    else g.arc(p0.x, p0.y, 26, 3, hex('#e0c0b0', 0.7), 1 - this.untilBeat / (this.period - DEAD_PULSE.window));
    if (op.tool === 'lens' && this.sigil.hidden) g.glow(this.sigil.pos.x, this.sigil.pos.y, 30, hex('#a080ff', 0.08));
  }
}

// ------------------------------------------------------------------ BOS-0159 Frost-wight's kiss

export const FROST_WIGHT = { spreadEvery: 5, refreezeAfter: 3, radius: 30 } as const;

/**
 * The frost-wight's kiss (BOS-0159): a frost-curse creeping out from a bite as a ring of
 * numbered frost patches, one every FROST_WIGHT.spreadEvery seconds. Thaw them in ring order
 * (I, II, III…); a patch thawed out of order refreezes FROST_WIGHT.refreezeAfter seconds later.
 */
export class FrostWight extends MalisonBase {
  readonly bossId = 'frostwight';
  readonly phases = ONE;
  readonly ring: Vec[];
  /** The live patch at each ring spot (null before it spreads there or once it is done). */
  readonly patches: (FrostPatch | null)[];
  /** Ring spots thawed in order. */
  readonly done: boolean[];
  private spreadT = 0;
  private spread = 0;
  /** Out-of-order thaws waiting to refreeze: ring index → seconds left. */
  private refreeze = new Map<number, number>();
  /** Refreezes so far (tests). */
  refrozen = 0;

  constructor(pos: Vec, op: Operation, count = 5, radius = 90) {
    super(pos, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = 0;
    this.ring = Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + (i / count) * TAU;
      return { x: pos.x + Math.cos(a) * radius, y: pos.y + Math.sin(a) * radius * 0.75 };
    });
    this.patches = this.ring.map(() => null);
    this.done = this.ring.map(() => false);
  }

  get all(): Entity[] {
    return [this];
  }

  /** The ring index to thaw next. */
  get next(): number {
    return this.done.indexOf(false);
  }

  override drain(): number {
    return 0.15;
  }

  override hitTest(): boolean {
    return false;
  }

  private place(op: Operation, i: number): void {
    const p = new FrostPatch({ ...this.ring[i] }, FROST_WIGHT.radius);
    this.patches[i] = p;
    this.spawnAdd(op, p);
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('frostwight', 'A wight’s kiss — the cold is spreading from the bite. Thaw it in order round the ring, first mark first, or it freezes again.');
    if (this.spread < this.ring.length) {
      this.spreadT -= dt;
      if (this.spreadT <= 0) {
        this.place(op, this.spread++);
        this.spreadT = FROST_WIGHT.spreadEvery;
      }
    }
    this.patches.forEach((p, i) => {
      if (!p || p.alive) return;
      // Thawed: in order it stays done; out of order it will refreeze.
      this.patches[i] = null;
      if (i === this.next) {
        this.done[i] = true;
        op.rate('good', this.ring[i], 'In order');
      } else {
        this.refreeze.set(i, FROST_WIGHT.refreezeAfter);
        op.popup('Out of order — it will refreeze', { x: this.ring[i].x, y: this.ring[i].y - 30 }, '#b8d8ff');
      }
    });
    for (const [i, s] of this.refreeze) {
      const left = s - dt;
      if (left > 0) this.refreeze.set(i, left);
      else {
        this.refreeze.delete(i);
        // Its turn may have come while it waited: then it simply counts.
        if (i === this.next) this.done[i] = true;
        else {
          this.refrozen++;
          this.place(op, i);
        }
      }
    }
    const n = this.done.filter(Boolean).length;
    this.hp = this.maxHp * (1 - n / this.ring.length);
    if (n === this.ring.length && !this.dying) this.die(op);
  }

  draw(g: Gfx, op: Operation): void {
    // The curse's veins from the bite to every patch still standing.
    this.patches.forEach((p, i) => {
      if (p?.alive) g.line(this.pos, this.ring[i], 2, hex('#b8d8ff', 0.35 + 0.1 * Math.sin(op.elapsed * 2 + i)));
      if (p?.alive || this.refreeze.has(i)) numeral(g, i, this.ring[i], i === this.next);
    });
    g.circle(this.pos.x, this.pos.y, 8, hex('#e8f4ff', 0.9));
  }
}

// ------------------------------------------------------------------ BOS-0160 Ghoul-claw infection

export const GHOUL = { lineSpeed: 1 / 45, burnHold: 0.6, reach: 20 } as const;

/**
 * Ghoul-claw infection (BOS-0160): black lines race from the claw wound up the arm toward the
 * armpit. Hold the brand on a line's front for GHOUL.burnHold seconds to sear it off. If any
 * line reaches the armpit the arm is lost: the fight turns into a forced amputation.
 */
export class GhoulClaw extends MalisonBase {
  readonly bossId = 'ghoulclaw';
  readonly phases = ONE;
  readonly armpit: Vec;
  readonly lines: { from: Vec; to: Vec; k: number; burn: number; dead: boolean; heldAt: number }[];
  amputation: Amputation | null = null;

  constructor(pos: Vec, op: Operation, armpit: Vec, count = 3) {
    super(pos, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = 6;
    this.armpit = { ...armpit };
    this.lines = Array.from({ length: count }, (_, i) => {
      const off = (i - (count - 1) / 2) * 26;
      const ang = Math.atan2(armpit.y - pos.y, armpit.x - pos.x) + Math.PI / 2;
      return { from: { x: pos.x + Math.cos(ang) * off, y: pos.y + Math.sin(ang) * off }, to: { ...armpit }, k: 0.05 + 0.04 * i, burn: 0, dead: false, heldAt: -1 };
    });
  }

  get all(): Entity[] {
    return [this];
  }

  front(i: number): Vec {
    const l = this.lines[i];
    return { x: l.from.x + (l.to.x - l.from.x) * l.k, y: l.from.y + (l.to.y - l.from.y) * l.k };
  }

  private lineAt(p: Vec, pad = 0): number {
    return this.lines.findIndex((l, i) => !l.dead && dist(p, this.front(i)) < GHOUL.reach + pad);
  }

  override wants(): readonly ToolId[] {
    return ['brand'];
  }

  override drain(): number {
    return this.amputation ? 0.3 : 0.12 + 0.12 * this.lines.filter((l) => !l.dead).length;
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return !this.amputation && this.lineAt(p, pad) >= 0;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    return !this.amputation && tool === 'brand' && this.lineAt(ptr.pos, op.hitPad) >= 0;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.amputation) return;
    const i = this.lineAt(ptr.pos, op.hitPad);
    if (i < 0) return;
    const l = this.lines[i];
    l.burn += dt;
    l.heldAt = op.elapsed;
    if (l.burn >= GHOUL.burnHold) {
      l.dead = true;
      op.rate('cool', ptr.pos, 'Line seared');
      op.emit('smoke', ptr.pos, 6);
    }
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    if (this.amputation) {
      if (!this.amputation.alive && !this.dying) this.die(op);
      return;
    }
    op.sayOnce('ghoulclaw', 'Ghoul-claw — the rot runs up the arm. Sear each black line at its tip before it reaches the armpit.');
    for (const l of this.lines) {
      if (l.dead) continue;
      l.k = Math.min(1, l.k + GHOUL.lineSpeed * dt);
      // A front the brand has left cools again.
      if (op.elapsed - l.heldAt > 0.1) l.burn = Math.max(0, l.burn - dt * 0.5);
      if (l.k >= 1) return this.lose(op);
    }
    const live = this.lines.filter((l) => !l.dead).length;
    this.hp = (this.maxHp * live) / this.lines.length;
    if (live === 0 && !this.dying) this.die(op);
  }

  /** A line reached the armpit: the arm must come off (the forced amputation branch). */
  private lose(op: Operation): void {
    op.rate('miss', this.armpit, 'The arm is lost');
    op.say('It’s in the armpit — the arm can’t be saved. Take it off above the line, now.');
    const ang = Math.atan2(this.armpit.y - this.pos.y, this.armpit.x - this.pos.x) + Math.PI / 2;
    const at = { x: this.pos.x + (this.armpit.x - this.pos.x) * 0.75, y: this.pos.y + (this.armpit.y - this.pos.y) * 0.75 };
    this.amputation = new Amputation(at, ang);
    this.spawnAdd(op, this.amputation);
    this.hp = this.maxHp * 0.5;
  }

  draw(g: Gfx, op: Operation): void {
    g.circle(this.armpit.x, this.armpit.y, 10, hex('#5a2a30', 0.6));
    if (this.amputation) return;
    this.lines.forEach((l, i) => {
      if (l.dead) return;
      const f = this.front(i);
      g.line(l.from, f, 3, hex('#1a1210', 0.85));
      g.circle(f.x, f.y, 5 + Math.sin(op.elapsed * 8 + i) * 1.2, hex('#3a2a20'));
      if (l.burn > 0) g.arc(f.x, f.y, 14, 3, hex('#ff9040'), l.burn / GHOUL.burnHold);
    });
  }
}

// ------------------------------------------------------------------ BOS-0161 Choir magus remnant

export const MAGUS = { orbit: 70, swapEvery: 5, swapFor: 0.8, lensReach: 90 } as const;

/**
 * A Choir magus's remnant hex (BOS-0161), the mid-boss before Compline: three hexstones orbit
 * the wound and trade places like a shell game. One of them is the true anchor, which only
 * shows under the Scrying Lens. Pull the true one with the tongs; a false one lashes back and
 * the stones reshuffle. Three anchors, one after another, unmake the hex.
 */
export class ChoirMagus extends MalisonBase {
  readonly bossId = 'magus';
  readonly phases = ONE;
  /** Each stone's slot angle (radians); swaps animate between slots. */
  readonly slots: number[] = [0, TAU / 3, (2 * TAU) / 3];
  /** stone → slot index. */
  readonly at: number[] = [0, 1, 2];
  present: boolean[] = [true, true, true];
  truth = 0;
  anchors = 0;
  /** False pulls (tests). */
  wrong = 0;
  private swapT = 0;
  private swap: { a: number; b: number; t: number } | null = null;
  private spin = 0;

  constructor(pos: Vec, op: Operation) {
    super(pos, op, 100);
    this.elite = true;
    this.layer = 7;
    this.truth = Math.floor(op.rng.next() * 3);
  }

  get all(): Entity[] {
    return [this];
  }

  /** Where stone `s` is now (mid-swap stones travel along the chord between their slots). */
  stonePos(s: number): Vec {
    const angOf = (slot: number) => this.slots[slot] + this.spin;
    let a = angOf(this.at[s]);
    if (this.swap && (s === this.swap.a || s === this.swap.b)) {
      const other = s === this.swap.a ? this.swap.b : this.swap.a;
      const k = this.swap.t / MAGUS.swapFor;
      // Before the swap commits, each stone heads to the other's slot.
      const from = angOf(this.at[s]);
      const to = angOf(this.at[other]);
      const p0 = { x: Math.cos(from), y: Math.sin(from) };
      const p1 = { x: Math.cos(to), y: Math.sin(to) };
      return { x: this.pos.x + (p0.x + (p1.x - p0.x) * k) * MAGUS.orbit, y: this.pos.y + (p0.y + (p1.y - p0.y) * k) * MAGUS.orbit * 0.8 };
    }
    a = angOf(this.at[s]);
    return { x: this.pos.x + Math.cos(a) * MAGUS.orbit, y: this.pos.y + Math.sin(a) * MAGUS.orbit * 0.8 };
  }

  private stoneAt(p: Vec, pad = 0): number {
    for (let s = 0; s < 3; s++) if (this.present[s] && dist(p, this.stonePos(s)) < 20 + pad) return s;
    return -1;
  }

  override wants(): readonly ToolId[] {
    return ['tongs', 'lens'];
  }

  override drain(): number {
    return 0.25;
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.stoneAt(p, pad) >= 0;
  }

  /** Whether the Lens is on the stones: the true anchor shows. */
  scried(op: Operation): boolean {
    return op.tool === 'lens' && dist(op.cursor, this.pos) < MAGUS.lensReach;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.swap) return false;
    const s = this.stoneAt(ptr.pos, op.hitPad);
    if (s < 0) return false;
    if (s === this.truth) {
      this.present[s] = false;
      this.anchors++;
      op.rate('cool', ptr.pos, 'Anchor pulled');
      op.emit('mote', ptr.pos, 12);
      if (this.anchors >= 3) {
        this.die(op);
        return true;
      }
      // The hex re-seats itself in one of the remaining stones.
      this.present = [true, true, true];
      this.truth = Math.floor(op.rng.next() * 3);
      this.swapT = 0;
    } else {
      this.wrong++;
      op.rate('bad', ptr.pos, 'False stone');
      op.hurt(5, ptr.pos);
      this.spawnAdd(op, new BossRot({ ...ptr.pos }, 20, 0.3));
      this.swapT = MAGUS.swapEvery;
    }
    return true;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('magus', 'A magus’s hex, split across three stones — and they won’t sit still. Only one is the anchor. Look with the Lens before you pull.');
    this.spin += dt * 0.25;
    if (this.swap) {
      this.swap.t += dt;
      if (this.swap.t >= MAGUS.swapFor) {
        const { a, b } = this.swap;
        [this.at[a], this.at[b]] = [this.at[b], this.at[a]];
        this.swap = null;
      }
    } else {
      this.swapT += dt;
      if (this.swapT >= MAGUS.swapEvery) {
        this.swapT = 0;
        const a = Math.floor(op.rng.next() * 3);
        const b = (a + 1 + Math.floor(op.rng.next() * 2)) % 3;
        this.swap = { a, b, t: 0 };
      }
    }
    this.hp = this.maxHp * (1 - this.anchors / 3);
  }

  draw(g: Gfx, op: Operation): void {
    g.arc(this.pos.x, this.pos.y, MAGUS.orbit, 1, hex('#8a60c0', 0.3));
    const show = this.scried(op);
    for (let s = 0; s < 3; s++) {
      if (!this.present[s]) continue;
      const p = this.stonePos(s);
      g.poly(
        Array.from({ length: 6 }, (_, i) => ({ x: p.x + Math.cos((i / 6) * TAU) * 13, y: p.y + Math.sin((i / 6) * TAU) * 13 })),
        hex('#3a2a4a'),
        hex('#a080d0', 0.8),
      );
      if (show && s === this.truth) g.glow(p.x, p.y, 34, hex('#e0b0ff', 0.5 + 0.2 * Math.sin(op.elapsed * 6)));
    }
  }
}
