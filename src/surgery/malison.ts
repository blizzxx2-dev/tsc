import { dist, type Vec } from '../core/math';
import { Entity } from './entity';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Grub, Laceration, surfDisc } from './entities';
import { FIELD, onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';

const TAU = Math.PI * 2;
/** Cosmetic randomness only — never the simulation RNG, so effects can't change outcomes. */
const fxRange = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/**
 * The Malison: a living curse woven by the Hollow Choir. It takes root in a
 * patient's flesh as a shrouded, drifting mass. Its shroud parts on a rhythm
 * (the "eye opens"); only then will the brand bite. Each variant is named for a
 * canonical hour, and varies the rhythm and what the curse does to the flesh.
 */
export type Hour = 'matins';

export class Malison extends Entity {
  hp: number;
  readonly maxHp: number;
  open = false;
  private cycleT = 0;
  private rendT = 0;
  private target: Vec;
  private hurtFlash = 0;
  private spawnedMotes = 0;

  constructor(
    pos: Vec,
    op: Operation,
    public hour: Hour = 'matins',
    hp = 100,
  ) {
    super(pos);
    this.layer = 4;
    this.hp = this.maxHp = hp;
    this.target = this.pickTarget(op);
  }

  get radius(): number {
    return 34 + 16 * (this.hp / this.maxHp);
  }

  private pickTarget(op: Operation): Vec {
    for (;;) {
      const p = { x: FIELD.cx + op.rng.range(-0.7, 0.7) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.6, 0.6) * FIELD.ry };
      if (onBody(p)) return p;
    }
  }

  override drain(): number {
    return 0.6;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (Math.random() < dt * 12) op.emit('mote', { x: this.pos.x + fxRange(-30, 30), y: this.pos.y + fxRange(-30, 30) }, 1);
    // Shroud rhythm: 4s veiled, 2.5s open.
    this.cycleT += dt;
    const period = this.open ? 2.5 : 4;
    if (this.cycleT >= period) {
      this.cycleT = 0;
      this.open = !this.open;
      if (this.open) op.sayOnce('malison-open', 'Its shroud has parted — sear it with the brand, now!');
    }
    // Drift toward a wandering target.
    const d = dist(this.pos, this.target);
    if (d < 10) this.target = this.pickTarget(op);
    else {
      const sp = this.open ? 15 : 45;
      this.pos = { x: this.pos.x + ((this.target.x - this.pos.x) / d) * sp * dt, y: this.pos.y + ((this.target.y - this.pos.y) / d) * sp * dt };
    }
    // While veiled it rends the flesh it passes over.
    if (!this.open) {
      this.rendT += dt;
      if (this.rendT > 4.5) {
        this.rendT = 0;
        const lac = new Laceration({ ...this.pos }, op.rng.range(0, TAU), op.rng.range(40, 70), 0.8);
        op.spawn(lac);
        op.cues.push('cut');
        op.shake = Math.max(op.shake, 6);
        op.sayOnce('malison-rend', 'It’s tearing the flesh as it moves! Stitch those wounds!');
      }
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (!this.open) {
      op.sayOnce('malison-veiled', 'The brand can’t touch it while it’s veiled. Wait for the shroud to part!');
      return;
    }
    this.hp -= 45 * dt;
    op.events.emit('malisonHit', { pos: this.pos, damage: 45 * dt });
    this.hurtFlash = 1;
    if (Math.random() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    // Wounding it shakes loose hexlings.
    const thresholds = [0.75, 0.5, 0.25];
    while (this.spawnedMotes < thresholds.length && this.hp / this.maxHp < thresholds[this.spawnedMotes]) {
      this.spawnedMotes++;
      for (let i = 0; i < 2; i++) {
        const g = new Grub({ x: this.pos.x + op.rng.range(-30, 30), y: this.pos.y + op.rng.range(-30, 30) }, op, 70);
        g.required = true;
        op.spawn(g);
      }
      op.rate('good', this.pos, 'Wounded');
      op.say('It’s shedding hexlings! Burn them before they feed!');
    }
    if (this.hp <= 0) {
      this.kill();
      op.rate('cool', this.pos, 'Malison unmade');
      op.spawn(new MalisonAsh({ ...this.pos }, this.radius));
      op.shake = 14;
      op.emit('mote', this.pos, 60, undefined, undefined, 140);
      op.emit('blood', this.pos, 30, undefined, undefined, 200);
      op.spawn(...[0, 1, 2].map((i) => new MalisonShard({ x: this.pos.x + Math.cos((i * TAU) / 3) * 50, y: this.pos.y + Math.sin((i * TAU) / 3) * 40 }, op)));
      op.say('It’s splitting apart! Seize every shard with the tongs and cast it out — before they rejoin!');
    }
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.radius * 1.8, 0.1, 0.4, 0.15, 0.6);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const r = this.radius;
    const openness = this.open ? Math.min(1, this.cycleT * 4) : Math.max(0, 1 - this.cycleT * 6) * 0;
    g.glow(x, y, r * 2.6, hex(this.open ? '#ff6030' : '#8030c0', 0.22));
    g.creature(0, x, y, r * 4.4, { seed: this.id * 1.3, open: openness, health: this.hp / this.maxHp, flash: this.hurtFlash });
    g.arc(x, y, r + 14, 3, this.open ? hex('#ff8040', 0.9) : hex('#b478ff', 0.5), this.hp / this.maxHp);
    void op;
  }
}

/** A fragment of a broken Malison. Drag it off the body with tongs before it rejoins. */
export class MalisonShard extends Entity {
  private grabbed = false;
  private life = 9;
  private vel: Vec;
  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 7;
    const a = op.rng.range(0, TAU);
    this.vel = { x: Math.cos(a) * 60, y: Math.sin(a) * 60 };
  }

  override drain(): number {
    return 0.5;
  }

  override update(op: Operation, dt: number): void {
    if (this.grabbed) return;
    this.life -= dt;
    const next = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
    if (onBody(next)) this.pos = next;
    else this.vel = { x: -this.vel.x, y: -this.vel.y };
    if (this.life <= 0) {
      // The shards rejoin into a weakened Malison.
      const rest = op.entities.filter((e): e is MalisonShard => e instanceof MalisonShard && e.alive);
      for (const s of rest) s.kill();
      op.spawn(new Malison({ ...this.pos }, op, 'matins', 20 + 15 * rest.length));
      op.rate('miss', this.pos, 'It rejoined');
      op.hurt(10, this.pos);
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 22) return false;
    this.grabbed = true;
    op.cues.push('pluck');
    return true;
  }

  override onDrag(_op: Operation, ptr: Pointer): void {
    this.pos = { ...ptr.pos };
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.cues.push('burn');
      op.rate('cool', ptr.pos, 'Cast out');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const flick = 0.6 + 0.4 * Math.sin(op.elapsed * 15 + this.id);
    g.glow(x, y, 40, hex('#b060ff', 0.4));
    const pts: Vec[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + op.elapsed;
      const rr = i % 2 ? 9 : 17;
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    g.poly(pts, hex('#8c3cc8', flick), hex('#e0b0ff', flick));
    g.arc(x, y, 24, 3, hex('#ffc878', 0.7), this.life / 9);
  }
}

/** Death animation: the ink body dissolves into embers and ash (cosmetic, not required). */
export class MalisonAsh extends Entity {
  private t = 0;
  constructor(
    pos: Vec,
    private r: number,
    private mode = 0,
  ) {
    super(pos);
    this.required = false;
    this.layer = 8;
  }

  override update(_op: Operation, dt: number): void {
    this.t += dt;
    if (this.t > 1.4) this.kill();
  }

  draw(g: Gfx): void {
    g.creature(this.mode, this.pos.x, this.pos.y, this.r * 4.4, { seed: this.id, dissolve: Math.min(1, this.t / 1.2), health: 0.6 });
  }
}
