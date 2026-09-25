import type { Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { Laceration, Rot } from '../entities';
import { FIELD, type Operation } from '../operation';
import type { Pointer, Rating, ToolId } from '../types';
import { bossSound, difficultyOf, type BossOpDef, type Difficulty } from './signals';

/**
 * The shared frame of every Malison fight (BOS-0001): HP, a phase list keyed to
 * HP fractions, a hurt flash, an exposure window, a registry of boss-spawned
 * adds (with the drain budget, BOS-0006), the phase-transition beat (BOS-0004),
 * the death sequence (BOS-0005) and the music-intensity hook (BOS-0008).
 */

export interface BossPhase {
  /** Stable key (i18n `boss.<hour>.phase.<key>`). */
  key: string;
  /** HP fraction at which the phase begins (the first phase: 1). */
  from: number;
  /** Adaptive-music intensity while this phase holds. */
  music: 0 | 1 | 2 | 3;
}

/** Sum of boss + adds drain per second never exceeds this (BOS-0006). */
export const DRAIN_BUDGET: Record<Difficulty, number> = { novice: 1.6, surgeon: 2.0, master: 2.5 };
/** The phase-transition beat: the sim stands still while the choir stings. */
export const CINEMATIC_SECONDS = 1.2;
/** Death: the body dissolves over 2.5 s; its adds wither over 3 s. */
export const DEATH_SECONDS = 2.5;
export const WITHER_SECONDS = 3;

const adds = new WeakSet<Entity>();
const bosses = new WeakMap<Operation, MalisonBase[]>();

/** True for an entity a boss spawned (its adds and the wounds its attacks open). */
export const spawnedByBoss = (e: Entity): boolean => adds.has(e);

/** The bosses (and elites) of an operation, living ones first. */
export function bossesOf(op: Operation): MalisonBase[] {
  return (bosses.get(op) ?? []).filter((b) => b.alive || b.dying);
}

/** The boss the HUD should show: the first living one. */
export function activeBoss(op: Operation): MalisonBase | null {
  return (bosses.get(op) ?? []).find((b) => b.alive && !b.hidden) ?? (bosses.get(op) ?? []).find((b) => b.alive) ?? null;
}

/**
 * Farming guard: good ratings earned on boss-spawned adds and wounds score
 * only up to this many per operation; past it they still show, for 0 points
 * and without extending the chain. Penalties always apply.
 */
export const ADD_RATING_CAP = 12;
const addRatings = new WeakMap<Operation, number>();

/** Number of scored add ratings so far (tests). */
export const addRatingsOf = (op: Operation): number => addRatings.get(op) ?? 0;

/** Rate an action on a boss add, under the farming cap. */
export function rateAdd(op: Operation, r: Rating, pos: Vec, label?: string, rate: Operation['rate'] = op.rate): void {
  if (r === 'bad' || r === 'miss') return rate.call(op, r, pos, label);
  const n = addRatings.get(op) ?? 0;
  if (n < ADD_RATING_CAP) {
    addRatings.set(op, n + 1);
    return rate.call(op, r, pos, label);
  }
  op.popup(label ?? 'Seared', pos, '#c8b8a0');
}

/** Run `fn` with every rating it makes treated as an add rating. */
export function asAdd<T>(op: Operation, fn: () => T): T {
  const orig = op.rate;
  op.rate = (r, pos, label) => rateAdd(op, r, pos, label, orig);
  try {
    return fn();
  } finally {
    op.rate = orig;
  }
}

/** A wound a boss's attack opened: tended like any laceration, scored as an add. */
export class BossWound extends Laceration {
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    asAdd(op, () => super.onSweep(op, ptr, tool));
  }
}

/** Rot a boss left in its wake: salved like any rot, scored as an add. */
export class BossRot extends Rot {
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    asAdd(op, () => super.onSweep(op, ptr, tool));
  }
}

/** Debug-build check of the drain budget (tests read `violations`). */
export const drainAudit = { violations: 0, worst: 0 };

export abstract class MalisonBase extends Entity {
  hp: number;
  readonly maxHp: number;
  hurtFlash = 0;
  phaseIx = 0;
  exposedT = 0;
  /** Set once the death sequence has begun. */
  dying = false;
  /** Adds spawned by this boss (the registry; dead ones drop out). */
  readonly adds: Entity[] = [];
  /** Elites show a compact HUD bar and have no checkpoints (BOS-0162). */
  elite = false;
  private met = false;

  abstract readonly bossId: string;
  abstract readonly phases: readonly BossPhase[];

  constructor(pos: Vec, op: Operation, hp: number) {
    super(pos);
    this.hp = this.maxHp = hp;
    let list = bosses.get(op);
    if (!list) bosses.set(op, (list = []));
    list.push(this);
  }

  /** Apply a checkpoint resume (call at the end of the subclass constructor). */
  protected resume(op: Operation): void {
    const cp = (op.def as BossOpDef).bossCheckpoint;
    if (cp === undefined || this.elite || cp <= 0 || cp >= this.phases.length) return;
    this.phaseIx = cp;
    this.hp = this.maxHp * this.phases[cp].from;
  }

  get frac(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  get phase(): BossPhase {
    return this.phases[this.phaseIx];
  }

  get exposed(): boolean {
    return this.exposedT > 0;
  }

  get difficulty(): Difficulty {
    return this.opDifficulty;
  }
  private opDifficulty: Difficulty = 'surgeon';

  /** Living adds. */
  liveAdds(): Entity[] {
    return this.adds.filter((e) => e.alive);
  }

  /** Current vitals drain of the boss and all its living adds. */
  /**
   * The drain this fight puts on the table: the boss plus each live add at no more than it drained
   * when spawned. A neglected wound that worsens later is the surgeon's to tend, not the boss's budget.
   */
  drainTotal(op: Operation): number {
    let d = this.hidden ? 0 : this.drain(op);
    for (const e of this.adds) if (e.alive && !e.hidden) d += Math.min(e.drain(op), this.spawnDrain.get(e) ?? Infinity);
    return d;
  }
  private spawnDrain = new WeakMap<Entity, number>();

  /**
   * Spawn an add (or a wound) on the boss's behalf. Refused — nothing spawns —
   * if it would take the fight's drain past the budget.
   */
  spawnAdd(op: Operation, e: Entity): boolean {
    if (this.drainTotal(op) + e.drain(op) > DRAIN_BUDGET[difficultyOf(op)] + 1e-9) return false;
    adds.add(e);
    this.spawnDrain.set(e, e.drain(op));
    for (let i = this.adds.length - 1; i >= 0; i--) if (!this.adds[i].alive) this.adds.splice(i, 1);
    this.adds.push(e);
    op.spawn(e);
    return true;
  }

  expose(seconds: number): void {
    this.exposedT = Math.max(this.exposedT, seconds);
  }

  /** Called from the subclass's update first. */
  protected tickBase(op: Operation, dt: number): void {
    this.opDifficulty = difficultyOf(op);
    if (!this.met) {
      this.met = true;
      op.events.emit('boss', { kind: 'encounter', boss: this.bossId });
      op.events.emit('boss', { kind: 'music', boss: this.bossId, intensity: this.phase.music });
    }
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (this.exposedT > 0) this.exposedT = Math.max(0, this.exposedT - dt);
    if (import.meta.env.DEV) {
      const d = this.drainTotal(op);
      drainAudit.worst = Math.max(drainAudit.worst, d);
      if (d > DRAIN_BUDGET[difficultyOf(op)] + 1e-6) {
        drainAudit.violations++;
        console.error(`[boss] ${this.bossId} drain ${d.toFixed(2)}/s exceeds budget`);
      }
    }
  }

  /**
   * Wound the boss. Crossing a phase threshold starts the next phase (with its
   * cinematic beat); reaching zero starts the death sequence. Returns the HP taken.
   */
  damage(op: Operation, amount: number, pos: Vec = this.pos): number {
    if (!this.alive || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 1;
    op.events.emit('malisonHit', { pos: { x: pos.x, y: pos.y }, damage: before - this.hp });
    if (this.hp <= 0) {
      this.die(op);
      return before;
    }
    let next = this.phaseIx;
    while (next + 1 < this.phases.length && this.frac <= this.phases[next + 1].from) next++;
    if (next !== this.phaseIx) {
      // One phase at a time: a huge hit stops at the threshold of the next.
      next = this.phaseIx + 1;
      this.hp = Math.max(this.hp, this.maxHp * this.phases[next].from);
      this.enterPhase(op, next);
    }
    return before - this.hp;
  }

  private enterPhase(op: Operation, ix: number): void {
    const from = this.phaseIx;
    this.phaseIx = ix;
    this.exposedT = 0;
    const p = this.phases[ix];
    op.events.emit('boss', { kind: 'phase', boss: this.bossId, index: ix, count: this.phases.length, name: p.key });
    op.events.emit('boss', { kind: 'music', boss: this.bossId, intensity: p.music });
    if (!this.elite && !(op.def as BossOpDef).skipCinematics) {
      op.freezeT = Math.max(op.freezeT, CINEMATIC_SECONDS);
      op.shake = Math.max(op.shake, 10);
      op.events.emit('boss', { kind: 'cinematic', boss: this.bossId, seconds: CINEMATIC_SECONDS });
      bossSound(op, 'sting', this.pos);
    }
    this.onPhase(op, ix, from);
  }

  /** Does this boss blind an instrument right now (greyed in the tray)? */
  blinds(_tool: ToolId): boolean {
    return false;
  }

  /** Subclass hook: a new phase has begun. */
  protected onPhase(_op: Operation, _ix: number, _from: number): void {}
  /** Subclass hook: the boss has just died (spawn death shards etc.). */
  protected onDeath(_op: Operation): void {}

  /** The death sequence: dissolve, ash, and every add withers (scored 0, never failed). */
  die(op: Operation): void {
    if (this.dying) return;
    this.dying = true;
    this.kill();
    const withering = this.liveAdds().filter((e) => !(e instanceof BossDeath));
    for (const e of withering) e.kill();
    op.spawn(new BossDeath({ ...this.pos }, this.deathLook(), withering.map((e) => ({ ...e.pos }))));
    op.shake = Math.max(op.shake, 14);
    op.emit('mote', this.pos, 60, undefined, undefined, 140);
    op.events.emit('boss', { kind: 'death', boss: this.bossId });
    op.events.emit('boss', { kind: 'music', boss: this.bossId, intensity: 0 });
    bossSound(op, 'withering', this.pos);
    this.onDeath(op);
  }

  /** Creature look for the dissolve: [mode, size]. */
  protected deathLook(): [number, number] {
    return [0, 140];
  }
}

/**
 * The death sequence (cosmetic, not required): the creature dissolves over
 * 2.5 s shedding ash, and ghosts of its adds shrivel away over 3 s.
 */
export class BossDeath extends Entity {
  t = 0;
  constructor(
    pos: Vec,
    private look: [number, number],
    private ghosts: Vec[],
  ) {
    super(pos);
    this.required = false;
    this.layer = 8;
  }
  override update(op: Operation, dt: number): void {
    this.t += dt;
    if (this.t < DEATH_SECONDS && Math.random() < dt * 30) op.emit('mote', { x: this.pos.x + (Math.random() - 0.5) * 80, y: this.pos.y + (Math.random() - 0.5) * 80 }, 1, -Math.PI / 2, 0.8, 40);
    for (const g of this.ghosts) if (this.t < WITHER_SECONDS && Math.random() < dt * 4) op.emit('smoke', g, 1);
    if (this.t >= Math.max(DEATH_SECONDS, WITHER_SECONDS)) this.kill();
  }
  draw(g: Gfx): void {
    const [mode, size] = this.look;
    if (this.t < DEATH_SECONDS) g.creature(mode, this.pos.x, this.pos.y, size, { seed: this.id, dissolve: Math.min(1, this.t / DEATH_SECONDS), health: 0.6 });
    const w = Math.max(0, 1 - this.t / WITHER_SECONDS);
    for (const p of this.ghosts) {
      g.circle(p.x, p.y, 3 + 7 * w, hex('#2a2018', 0.7 * w));
      g.arc(p.x, p.y, 10 * w + 2, 1.5, hex('#8a7a60', 0.5 * w));
    }
  }
}

/** Keep a point at least `margin` px inside the operating field (and so clear of the HUD). */
export function clampToField(p: Vec, margin: number): Vec {
  const rx = FIELD.rx - margin;
  const ry = FIELD.ry - margin;
  const dx = (p.x - FIELD.cx) / rx;
  const dy = (p.y - FIELD.cy) / ry;
  const k = Math.hypot(dx, dy);
  if (k <= 1) return { ...p };
  return { x: FIELD.cx + (dx / k) * rx, y: FIELD.cy + (dy / k) * ry };
}
