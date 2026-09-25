import { dist, type Vec } from '../core/math';
import { Entity } from './entity';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Grub, Laceration } from './entities';
import { FIELD, onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';

const TAU = Math.PI * 2;

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
      if (this.rendT > 3.2) {
        this.rendT = 0;
        const lac = new Laceration({ ...this.pos }, op.rng.range(0, TAU), op.rng.range(40, 80), 1);
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
    this.hurtFlash = 1;
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
      op.shake = 14;
      op.spawn(...[0, 1, 2].map((i) => new MalisonShard({ x: this.pos.x + Math.cos((i * TAU) / 3) * 50, y: this.pos.y + Math.sin((i * TAU) / 3) * 40 }, op)));
      op.say('It’s splitting apart! Seize every shard with the tongs and cast it out — before they rejoin!');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const r = this.radius;
    const t = op.elapsed;
    // Shroud tendrils.
    const ta = this.open ? 0.5 : 0.9;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * 0.4;
      const l = r * (1.3 + 0.3 * Math.sin(t * 2 + i));
      g.quadCurve(this.pos, { x: x + Math.cos(a + 0.5) * l * 0.6, y: y + Math.sin(a + 0.5) * l * 0.6 }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }, 7, hex('#1a0a24', ta));
    }
    g.glow(x, y, r * 2.2, hex(this.open ? '#ff6030' : '#8030c0', 0.25));
    g.circleGrad(x, y, r, this.hurtFlash > 0 ? hex('#ffb070') : hex('#4a2060'), hex('#140820', 0.4));
    // The eye opens as the shroud parts.
    const openness = this.open ? Math.min(1, this.cycleT * 4) : 0;
    g.ellipse(x, y, r * 0.55, r * 0.35 * Math.max(0.05, openness), 0, hex('#d8c8f0'));
    if (openness > 0.2) {
      const ex = x + Math.sin(t) * 6;
      g.circle(ex, y, r * 0.18, hex('#6a0a2a'));
      g.ellipse(ex, y, r * 0.05, r * 0.15, 0, hex('#000000'));
    }
    g.arc(x, y, r + 8, 3, this.open ? hex('#ff8040') : hex('#b478ff', 0.6), this.hp / this.maxHp);
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
