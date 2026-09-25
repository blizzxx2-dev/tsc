import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Entity } from './entity';
import { Embedded, Laceration, Rot, surfDisc } from './entities';
import { FIELD, onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';

const TAU = Math.PI * 2;
/** Cosmetic randomness only — never the simulation RNG, so effects can't change outcomes. */
const fxRange = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const SILENCE_TIME = 0.6;
const HYMN_EVERY = 6.5;

/**
 * The Malison of Lauds — "the Chorister". A core shielded by orbiting Voices.
 * Sear every Voice (tracking them as they orbit) to expose the core, then brand it.
 * Every few seconds it sings a Hymn: a ring that opens curse-cuts where it passes.
 * Wounded past half, it submerges and must be found with the Scrying Lens.
 * When unmade it shatters into hexstone that must be pulled out.
 */
export class LaudsMalison extends Entity {
  hp = 100;
  readonly maxHp = 100;
  voices: ChoirVoice[] = [];
  exposedT = 0;
  submerged = false;
  private submergedOnce = false;
  private hymnT = 0;
  hymnR = -1;
  private hurtFlash = 0;
  private drift: Vec;
  private lensT = 0;
  private rekindleT = 0;

  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 4;
    this.drift = { ...pos };
    this.spawnVoices(op, 4);
  }

  private spawnVoices(op: Operation, n: number): void {
    for (let i = 0; i < n; i++) {
      const v = new ChoirVoice(this, (i / n) * TAU + op.rng.range(0, 0.4));
      this.voices.push(v);
      op.spawn(v);
    }
  }

  get livingVoices(): ChoirVoice[] {
    return this.voices.filter((v) => v.alive);
  }

  get radius(): number {
    return 30 + 12 * (this.hp / this.maxHp);
  }

  override drain(): number {
    return this.submerged ? 0.8 : 0.5;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (!this.submerged && Math.random() < dt * 10) op.emit('mote', { x: this.pos.x + fxRange(-30, 30), y: this.pos.y + fxRange(-30, 30) }, 1);

    if (this.submerged) {
      // Burrowing beneath the flesh, leaving a trail of rot.
      if (dist(this.pos, this.drift) < 8) {
        this.drift = { x: FIELD.cx + op.rng.range(-0.6, 0.6) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.5, 0.5) * FIELD.ry };
        if (op.entities.filter((e) => e instanceof Rot).length < 3) op.spawn(new Rot({ ...this.pos }, 26, 0.5));
      }
      this.moveToward(this.drift, 70, dt);
      return;
    }

    this.moveToward(this.drift, 20, dt);
    if (dist(this.pos, this.drift) < 6) this.drift = { x: FIELD.cx + op.rng.range(-0.35, 0.35) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.3, 0.3) * FIELD.ry };

    const shielded = this.livingVoices.length > 0;
    if (!shielded) {
      if (this.exposedT === 0) {
        op.say('The choir is silenced — its heart is bare! Brand it, now!');
        op.shake = 6;
      }
      this.exposedT += dt;
      if (this.exposedT > 5) {
        // Too slow: the choir is rekindled.
        this.exposedT = 0;
        this.spawnVoices(op, 2);
        op.say('It’s calling its Voices back!');
      }
    } else {
      this.exposedT = 0;
      // A silenced Voice slowly rekindles while any still sing.
      if (this.livingVoices.length < 4) {
        this.rekindleT += dt;
        if (this.rekindleT > 11) {
          this.rekindleT = 0;
          this.spawnVoices(op, 1);
        }
      }
    }

    // The Hymn: an expanding ring that tears the flesh.
    this.hymnT += dt;
    if (this.hymnR < 0 && this.hymnT > HYMN_EVERY) {
      this.hymnT = 0;
      this.hymnR = 0;
      op.sayOnce('lauds-hymn', 'It’s singing — every verse tears him open! Stitch the cuts as they come!');
      op.cues.push('bell');
    }
    if (this.hymnR >= 0) {
      const prev = this.hymnR;
      this.hymnR += dt * 220;
      if (prev < 150 && this.hymnR >= 150) {
        for (let i = 0; i < 1; i++) {
          const a = op.rng.range(0, TAU);
          const p = { x: this.pos.x + Math.cos(a) * 150, y: this.pos.y + Math.sin(a) * 120 };
          if (onBody(p)) op.spawn(new Laceration(p, a + Math.PI / 2, op.rng.range(40, 70), 0.9));
        }
        op.hurt(2, this.pos);
        op.shake = Math.max(op.shake, 5);
      }
      if (this.hymnR > 320) this.hymnR = -1;
    }
  }

  private moveToward(t: Vec, speed: number, dt: number): void {
    const d = dist(this.pos, t);
    if (d < 1) return;
    this.pos = { x: this.pos.x + ((t.x - this.pos.x) / d) * speed * dt, y: this.pos.y + ((t.y - this.pos.y) / d) * speed * dt };
  }

  override onReveal(op: Operation, p: Vec, dt: number): void {
    if (!this.submerged || dist(p, this.pos) > 70) return;
    this.lensT += dt;
    if (this.lensT > 0.5) {
      this.submerged = false;
      this.hidden = false;
      this.lensT = 0;
      op.popup('Found it!', this.pos, '#b9d7ff');
      op.cues.push('good');
      op.say('There! It’s surfacing — finish it!');
      // Surfacing without its choir: exposed.
      for (const v of this.livingVoices) v.kill();
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.submerged || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (this.livingVoices.length > 0) {
      op.sayOnce('lauds-shielded', 'The Voices shield it. Silence them first — hold the brand on each as it circles.');
      return;
    }
    this.hp -= 50 * dt;
    op.events.emit('malisonHit', { pos: this.pos, damage: 50 * dt });
    this.hurtFlash = 1;
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (!this.submergedOnce && this.hp <= this.maxHp / 2) {
      this.submergedOnce = true;
      this.submerged = true;
      this.hidden = true;
      this.hymnR = -1;
      op.rate('good', this.pos, 'Wounded');
      op.say('It’s gone under the skin! The Scrying Lens — hunt it down!');
      return;
    }
    if (this.hp <= 0) {
      this.kill();
      op.rate('cool', this.pos, 'Malison unmade');
      op.shake = 14;
      op.say('It shattered — hexstone, everywhere! Get every shard out before it spoils him!');
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        const p = { x: this.pos.x + Math.cos(a) * 70, y: this.pos.y + Math.sin(a) * 55 };
        op.spawn(new Embedded(onBody(p) ? p : { ...this.pos }, 'hexstone', a, false));
      }
    }
  }

  override drawSurface(g: Gfx): void {
    if (!this.submerged) surfDisc(g, this.pos, this.radius * 1.9, 0.05, 0.35, 0.1, 0.7);
    else surfDisc(g, this.pos, 46, 0, 0.1, 0.05, 0.9);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const t = op.elapsed;
    if (this.hymnR >= 0) {
      const a = Math.max(0, 1 - this.hymnR / 320);
      g.arc(x, y, this.hymnR, 10, hex('#d8b0ff', 0.12 * a));
      g.arc(x, y, this.hymnR, 3, hex('#f0d8ff', 0.7 * a));
    }
    const exposed = this.livingVoices.length === 0;
    g.glow(x, y, this.radius * 2.4, hex(exposed ? '#ff9050' : '#c0a0ff', 0.25));
    // A mouth-like core that sings.
    const sing = 0.5 + 0.5 * Math.sin(t * 5);
    g.circleGrad(x, y, this.radius, this.hurtFlash > 0 ? hex('#ffc080') : hex('#5a3080'), hex('#1a0828', 0.6));
    g.ellipse(x, y, this.radius * 0.35, this.radius * (0.1 + 0.25 * sing), 0, hex('#0a0005'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - t * 0.6;
      g.line({ x: x + Math.cos(a) * this.radius * 0.8, y: y + Math.sin(a) * this.radius * 0.8 }, { x: x + Math.cos(a) * this.radius * 1.35, y: y + Math.sin(a) * this.radius * 1.35 }, 3, hex('#2a1040', 0.8));
    }
    if (exposed) g.arc(x, y, this.radius + 12, 3, hex('#ff8040'), 1 - this.exposedT / 5);
    g.arc(x, y, this.radius + 6, 3, hex('#b478ff', 0.7), this.hp / this.maxHp);
  }
}

/** One Voice of the Lauds choir: orbits the core; hold the brand on it to silence it. */
export class ChoirVoice extends Entity {
  silence = 0;
  private orbitR: number;

  constructor(
    public core: LaudsMalison,
    public angle: number,
  ) {
    super({ ...core.pos });
    this.layer = 5;
    this.orbitR = 95;
    this.place();
  }

  private place(): void {
    this.pos = { x: this.core.pos.x + Math.cos(this.angle) * this.orbitR, y: this.core.pos.y + Math.sin(this.angle) * this.orbitR * 0.75 };
  }

  override drain(): number {
    return 0.1;
  }

  override update(_op: Operation, dt: number): void {
    if (!this.branded) this.silence = Math.max(0, this.silence - dt * 0.35);
    this.branded = false;
    if (!this.core.alive || this.core.submerged) return this.kill();
    this.angle += dt * 0.9;
    this.place();
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 22) return;
    this.branded = true;
    this.silence += dt;
    if (op.rng.next() < dt * 8) op.cues.push('burn');
    if (Math.random() < dt * 20) op.emit('spark', this.pos, 2);
    if (this.silence >= SILENCE_TIME) {
      this.kill();
      op.emit('mote', this.pos, 16, undefined, undefined, 90);
      op.rate('cool', this.pos, 'Silenced');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 8 + this.id);
    g.glow(x, y, 34, hex('#c890ff', 0.35 * glow));
    // A small singing glyph: a triangle with a mouth.
    const s = 13;
    const pts = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * TAU) / 3 + op.elapsed;
      return { x: x + Math.cos(a) * s, y: y + Math.sin(a) * s };
    });
    g.polyline([...pts, pts[0]], 3, hex('#e0c0ff', glow));
    g.circle(x, y, 3 + 2 * glow, hex('#20082a'));
    if (this.silence > 0) g.arc(x, y, 20, 3, hex('#ff9040'), this.silence / SILENCE_TIME);
  }
}

/** A spider's egg sac under the skin. Lance it and sear what spills out — or it hatches on its own. */
export class EggSac extends Entity {
  private hatchT: number;
  constructor(
    pos: Vec,
    public brood = 3,
    hatchIn = 18,
  ) {
    super(pos);
    this.layer = 2;
    this.hatchT = hatchIn;
  }

  override drain(): number {
    return 0.2;
  }

  override update(op: Operation, dt: number): void {
    this.hatchT -= dt;
    if (this.hatchT <= 5) op.sayOnce('eggsac-' + this.id, 'That sac is moving… it’s about to hatch!');
    if (this.hatchT <= 0) this.burst(op, this.brood + 2, true);
  }

  private burst(op: Operation, n: number, hatched: boolean): void {
    this.kill();
    op.emit('pus', this.pos, 14, undefined, undefined, 140);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      op.spawn(new SpiderlingGrub({ x: this.pos.x + Math.cos(a) * 14, y: this.pos.y + Math.sin(a) * 14 }, op));
    }
    op.spawn(new Laceration(this.pos, op.rng.range(0, TAU), 38, 0.6));
    if (hatched) {
      op.rate('miss', this.pos, 'Hatched');
      op.hurt(6, this.pos);
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > 24) return false;
    op.cues.push('squelch');
    op.rate(this.hatchT > 8 ? 'cool' : 'good', this.pos, 'Lanced');
    op.sayOnce('eggsac-lanced', 'Spiderlings! Brand them before they scatter!');
    this.burst(op, this.brood, false);
    return true;
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, 34, 0, 0.1, 0, 0.8);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const urgency = Math.max(0, 1 - this.hatchT / 18);
    const wob = 1 + Math.sin(op.elapsed * (4 + urgency * 14)) * 0.05 * (1 + urgency * 2);
    g.ellipse(x, y, 24 * wob, 20 / wob, 0.3, hex('#d8d0b8', 0.95), hex('#8a8068', 0.9));
    for (let i = 0; i < this.brood + 2; i++) {
      const a = (i / (this.brood + 2)) * TAU + op.elapsed * 0.5;
      g.circle(x + Math.cos(a) * 9, y + Math.sin(a) * 7, 3.5, hex('#3a3020', 0.6));
    }
    g.arc(x, y, 30, 2, hex('#e05040', 0.3 + 0.5 * urgency), Math.max(0, this.hatchT) / 18);
  }
}

/** A hatchling: faster than a grub, same cure. */
export class SpiderlingGrub extends Entity {
  heat = 0;
  private heading: number;
  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 6;
    this.heading = op.rng.range(0, TAU);
  }

  override drain(): number {
    return 0.3;
  }

  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt * 0.6);
    this.branded = false;
    this.heading += op.rng.range(-3, 3) * dt;
    const sp = 65;
    const next = { x: this.pos.x + Math.cos(this.heading) * sp * dt, y: this.pos.y + Math.sin(this.heading) * sp * dt };
    if (onBody(next)) this.pos = next;
    else this.heading += Math.PI * 0.8;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 20) return;
    this.branded = true;
    this.heat += dt;
    if (this.heat > 0.25) {
      this.kill();
      op.cues.push('burn');
      op.emit('spark', this.pos, 10);
      op.emit('smoke', this.pos, 3);
      op.rate('cool', this.pos, 'Seared');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(op.elapsed * 20 + i) * 0.2;
      g.line({ x, y }, { x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }, 1.5, hex('#1a1410'));
    }
    g.circle(x, y, 6, hex('#2a2018'));
    g.circle(x, y - 2, 2, hex('#e04030', 0.8));
    if (this.heat > 0) g.arc(x, y, 15, 3, hex('#ff9040'), this.heat / 0.25);
  }
}
