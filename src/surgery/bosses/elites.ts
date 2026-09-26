import { fxRandom } from '../fxRandom';
import { dist, type Vec } from '../../core/math';
import { Entity } from '../entity';
import { Embedded, Sigil, SIGILS } from '../entities';
import { EggSac } from '../lauds';
import { onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { BossRot, MalisonBase, type BossPhase } from './base';
import { attack, bossSound, Cadence, leadFor, tell } from './signals';
import { TAU } from './common';

/**
 * Demo elites (BOS-0147..0150) on the elite frame (BOS-0162): MalisonBase with
 * one or two phases, the compact HUD bar, no checkpoints and no cinematic beat.
 */
const ONE: readonly BossPhase[] = [{ key: 'main', from: 1, music: 1 }];

// ------------------------------------------------------------------ Brood-Mother's egg-cluster

/**
 * Three egg sacs under one membrane. Lance a sac while the membrane holds and
 * the others hatch with it; leave them and all three hatch at once. Cut the
 * membrane first — a lancet drawn right around the cluster — and the sacs part,
 * each ripening on its own time (BOS-0147).
 */
export class EggCluster extends MalisonBase {
  readonly bossId = 'broodmother';
  readonly phases = ONE;
  readonly sacs: EggSac[] = [];
  /** Angular bins the current lancet stroke has swept around the cluster. */
  private bins: boolean[] = [];
  stroking = false;
  /** Once cut, the sacs no longer hatch together. */
  cut = false;
  /** Seconds between each freed sac's hatching. */
  static readonly STAGGER = 5;

  constructor(
    pos: Vec,
    op: Operation,
    public hatchIn = 26,
    brood = 2,
  ) {
    super(pos, op, 100);
    this.elite = true;
    this.layer = 1;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      this.sacs.push(new EggSac({ x: pos.x + Math.cos(a) * 30, y: pos.y + Math.sin(a) * 26 }, brood, hatchIn));
    }
  }

  /** The cluster and its sacs, for a phase's spawn list. */
  get all(): Entity[] {
    return [this, ...this.sacs];
  }

  override drain(): number {
    return 0;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    const live = this.sacs.filter((s) => s.alive);
    if (!live.length) {
      if (!this.cut) this.kill();
      return;
    }
    if (!this.cut && live.length < this.sacs.length) {
      // One sac opened under the membrane: the brood wakes together.
      for (const s of live) s.hatchT = Math.min(s.hatchT, 0.8);
      op.sayOnce('cluster-wake', 'They share one membrane — you’ve woken the whole brood!');
    }
    op.sayOnce('cluster', 'Three sacs under one skin. Cut the membrane around them first — all the way round — or they’ll hatch as one.');
  }

  /** The ring the lancet must follow (between the sacs and the rim). */
  private onRing(p: Vec): boolean {
    const d = dist(p, this.pos);
    return d > 56 && d < 115;
  }

  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.cut || tool !== 'lancet' || !this.onRing(ptr.pos)) return false;
    this.bins = new Array(24).fill(false);
    this.stroking = true;
    this.mark(ptr.pos);
    return true;
  }

  private mark(p: Vec): void {
    if (!this.onRing(p)) return;
    const a = Math.atan2(p.y - this.pos.y, p.x - this.pos.x);
    this.bins[Math.floor(((a + Math.PI) / TAU) * 24) % 24] = true;
  }

  get encircled(): number {
    return this.bins.length ? this.bins.filter(Boolean).length / this.bins.length : 0;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (!this.stroking || tool !== 'lancet') return;
    this.mark(ptr.pos);
    this.hp = Math.min(this.hp, this.maxHp * (1 - this.encircled));
    if (this.encircled >= 0.9) this.sever(op, ptr.pos);
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (this.stroking && !this.cut) {
      if (this.encircled >= 0.9) this.sever(op, ptr.pos);
      else {
        op.popup('Not all the way round', { ...ptr.pos }, '#e0c0a0');
        this.hp = this.maxHp;
      }
    }
    this.stroking = false;
  }

  private sever(op: Operation, at: Vec): void {
    if (this.cut) return;
    this.cut = true;
    this.stroking = false;
    op.cues.push('cut');
    op.rate('cool', at, 'Membrane cut');
    // Freed, each sac ripens on its own clock.
    this.sacs
      .filter((s) => s.alive)
      .forEach((s, i) => (s.hatchT = Math.max(s.hatchT, 6) + i * EggCluster.STAGGER));
    op.say('The membrane’s cut — they’ll ripen one by one now. Lance them!');
    this.die(op);
  }
}

// ------------------------------------------------------------------ Cantor's Knot

/**
 * A curse-sigil knotted round the larynx. Every few seconds its bearer hums
 * (tell: a hum and a swelling glow), and the knot re-draws one stroke; it must
 * be traced out with the brand between the hums (BOS-0148).
 */
export class CantorKnot extends MalisonBase {
  readonly bossId = 'cantor';
  readonly phases = ONE;
  readonly sigil: Sigil;
  private song: Cadence;
  /** Strokes re-drawn so far (tests). */
  redrawn = 0;

  constructor(pos: Vec, op: Operation, every = 5) {
    super(pos, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = -2;
    this.sigil = new Sigil(pos, SIGILS.hourglass, 46, 99);
    this.song = new Cadence(every, leadFor(op, 'cantor', 'hum'));
  }

  get all(): Entity[] {
    return [this, this.sigil];
  }

  /** True while the bearer hums (the tell). */
  get humming(): boolean {
    return this.song.telling;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    if (!this.sigil.alive) {
      if (!this.dying) this.die(op);
      return;
    }
    this.hp = this.maxHp * (1 - this.sigil.progress);
    const ev = this.song.step(dt);
    if (ev === 'tell') {
      tell(op, 'cantor', 'hum', this.pos);
      bossSound(op, 'hum', this.pos);
      op.sayOnce('cantor-hum', 'Hear that hum? Each time he sings, the knot re-ties a stroke. Burn it between the verses!');
    }
    if (ev === 'attack') {
      // Re-tie the latest stroke touched: every segment of it, and it must be caught at its node again.
      const touched = this.sigil.segs.filter((s) => s.burned.some(Boolean)).map((s) => s.stroke);
      if (touched.length) {
        const stroke = Math.max(...touched);
        for (const s of this.sigil.segs) if (s.stroke === stroke) s.burned.fill(false);
        this.sigil.ignited[stroke] = false;
        this.redrawn++;
        attack(op, 'cantor', 'hum', this.pos);
        op.popup('The knot re-ties', { x: this.pos.x, y: this.pos.y - 60 }, '#d0a0ff');
      }
    }
  }

  protected override onDeath(op: Operation): void {
    op.say('The knot is undone. He can breathe — and sing no more of theirs.');
  }
}

// ------------------------------------------------------------------ Gravehound fang-nest

/**
 * Three fangs knotted together by a web of rot. Pull them in order — the web
 * shows which — or tearing one out early spreads the rot 30 px (BOS-0149).
 */
export class FangNest extends MalisonBase {
  readonly bossId = 'gravehound';
  readonly phases = ONE;
  readonly fangs: Embedded[];
  next = 0;
  /** Out-of-order pulls (tests). */
  spreads = 0;

  constructor(op: Operation, spots: readonly [Vec, number][], opts: { broken?: number } = {}) {
    const c = spots.reduce((a, [p]) => ({ x: a.x + p.x / spots.length, y: a.y + p.y / spots.length }), { x: 0, y: 0 });
    super(c, op, 100);
    this.elite = true;
    this.required = false;
    this.layer = -1;
    this.fangs = spots.map(([p, a]) => new Embedded(p, 'tooth', a, false));
    // CON-0057: one fang broken at the crown — the tongs must go in twice.
    if (opts.broken !== undefined && this.fangs[opts.broken]) this.fangs[opts.broken].crowns = 1;
  }

  get all(): Entity[] {
    return [this, ...this.fangs];
  }

  /** The fang to pull next. */
  get due(): Embedded | null {
    return this.fangs.slice(this.next).find((f) => f.alive) ?? null;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    op.sayOnce('fangnest', 'Those fangs are webbed together with rot. Pull them in order — the lowest numeral first.');
    for (let i = 0; i < this.fangs.length; i++) {
      const f = this.fangs[i];
      if (f.alive || (f as Embedded & { counted?: boolean }).counted) continue;
      (f as Embedded & { counted?: boolean }).counted = true;
      if (i !== this.next) {
        this.spreads++;
        const p = f.origin;
        this.spawnAdd(op, new BossRot(onBody(p) ? { ...p } : { ...this.pos }, 30, 0.4));
        op.popup('The web tears — rot spreads', { x: p.x, y: p.y - 30 }, '#a0c060');
      }
      while (this.next < this.fangs.length && !this.fangs[this.next].alive) this.next++;
    }
    const left = this.fangs.filter((f) => f.alive).length;
    this.hp = (this.maxHp * left) / this.fangs.length;
    if (left === 0 && !this.dying) this.die(op);
  }
}

/** Spawn list for the Gravehound nest in op2-1. */
export function gravehoundNest(op: Operation, spots: readonly [Vec, number][]): Entity[] {
  return new FangNest(op, spots).all;
}

// ------------------------------------------------------------------ Matins herald

/**
 * A single shard of Matins, loosed ahead of its Hour (BOS-0150). It flees the
 * Scrying Lens; searing it with the brand earns 300. Optional — it slips away
 * after a while.
 */
export const HERALD_BONUS = 300;

export class MatinsHerald extends Entity {
  heat = 0;
  life = 30;
  private vel: Vec;
  caught = false;

  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.required = false;
    this.layer = 7;
    const a = op.rng.range(0, TAU);
    this.vel = { x: Math.cos(a) * 45, y: Math.sin(a) * 45 };
  }

  override update(op: Operation, dt: number): void {
    op.sayOnce('herald', 'What is that — a sliver of the curse, loose? It shies from the Lens… sear it if you can.');
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
    this.life -= dt;
    if (this.life <= 0) {
      this.kill();
      op.popup('It slipped away', { ...this.pos }, '#b0a0c0');
      return;
    }
    let v = this.vel;
    // It flees the Lens.
    if (op.tool === 'lens' && dist(op.pointer, this.pos) < 160) {
      const d = dist(op.pointer, this.pos) || 1;
      v = { x: ((this.pos.x - op.pointer.x) / d) * 130, y: ((this.pos.y - op.pointer.y) / d) * 130 };
    }
    const next = { x: this.pos.x + v.x * dt, y: this.pos.y + v.y * dt };
    if (onBody(next)) this.pos = next;
    else this.vel = { x: -this.vel.x, y: -this.vel.y };
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 22) return;
    this.branded = true;
    this.heat += dt;
    if (fxRandom() < dt * 20) op.emit('spark', this.pos, 2);
    if (this.heat >= 0.5) {
      this.kill();
      this.caught = true;
      op.score += HERALD_BONUS;
      op.rate('cool', this.pos, 'Herald burned');
      op.emit('mote', this.pos, 20, undefined, undefined, 100);
      op.say('It screamed like a choir as it burned… Doctor, I think that was a herald.');
    }
  }
}
