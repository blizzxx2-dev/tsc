/**
 * Ailments of Chapter V (Hollow Night): the chorister's extra vocal folds,
 * the talking cyst and its remnant, a child lifted from a labouring mother,
 * mutagenic hexstone shot and the buds it raises.
 */
import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { BloodPool, Embedded, Laceration, surfDisc } from '../entities';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { Muffler } from '../bosses/common';

const TAU = Math.PI * 2;

// ============================================================ choir-throat

/**
 * An extra vocal fold that hums the Choir's hymn. It sings in verses (3 s)
 * and rests between them (2 s); it can only be excised with the lancet in the
 * silence. While it sings, every sound cue is drowned out (the on-screen
 * ratings still show).
 */
export class VocalFold extends Entity {
  t: number;
  constructor(
    pos: Vec,
    public verse = 3,
    public rest = 2,
    offset = 0,
  ) {
    super(pos);
    this.layer = 3;
    this.t = offset;
  }
  get singing(): boolean {
    return this.t % (this.verse + this.rest) < this.verse;
  }
  /** Seconds until the next rest begins (0 while resting). */
  get restIn(): number {
    const c = this.t % (this.verse + this.rest);
    return c < this.verse ? this.verse - c : 0;
  }
  /** Seconds of rest left (0 while singing). */
  get restLeft(): number {
    const c = this.t % (this.verse + this.rest);
    return c < this.verse ? 0 : this.verse + this.rest - c;
  }
  override drain(): number {
    return this.singing ? 0.3 : 0.1;
  }
  override update(op: Operation, dt: number): void {
    this.t += dt;
    if (this.singing) op.spawn(new Muffler());
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > 20) return false;
    if (this.singing) {
      op.rate('bad', this.pos, 'It sang through the blade');
      op.hurt(3, this.pos);
      op.sayOnce('fold-sing', 'Not while it sings! Wait for the silence between verses.');
      return true;
    }
    this.kill();
    op.cues.push('cut');
    op.emit('blood', this.pos, 6);
    op.rate(this.restLeft > this.rest * 0.4 ? 'cool' : 'good', this.pos, 'Fold excised');
    return true;
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const sing = this.singing;
    const w = sing ? 1 + 0.2 * Math.sin(op.elapsed * 30) : 1;
    g.ellipse(x - 8, y, 6 * w, 18, 0.1, hex('#e0a0a8'), hex('#a05060'));
    g.ellipse(x + 8, y, 6 * w, 18, -0.1, hex('#e0a0a8'), hex('#a05060'));
    if (sing) g.glow(x, y, 40, hex('#b060ff', 0.25));
    // Visual metronome: how far through the verse or the rest.
    const cyc = this.verse + this.rest;
    const c = this.t % cyc;
    g.arc(x, y, 26, 3, hex(sing ? '#b060ff' : '#9fd3a8', 0.8), sing ? c / this.verse : (c - this.verse) / this.rest);
  }
}

// ============================================================ the mouth beneath

/**
 * A remnant of a ruptured cyst: it crawls toward the nearest wound and must be
 * seared with the brand (40 hp).
 */
export class Remnant extends Entity {
  hp = 40;
  constructor(pos: Vec) {
    super(pos);
    this.layer = 6;
  }
  override drain(): number {
    return 0.5;
  }
  override update(op: Operation, dt: number): void {
    this.branded = false;
    const wounds = op.entities.filter((e) => e.alive && (e instanceof Laceration || e instanceof BloodPool));
    let target: Vec | null = null;
    let best = Infinity;
    for (const w of wounds) {
      const d = dist(w.pos, this.pos);
      if (d < best && d > 4) {
        best = d;
        target = w.pos;
      }
    }
    if (target) {
      const sp = 45 * dt;
      const next = { x: this.pos.x + ((target.x - this.pos.x) / best) * sp, y: this.pos.y + ((target.y - this.pos.y) / best) * sp };
      if (onBody(next)) this.pos = next;
    }
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 22) return;
    this.branded = true;
    this.hp -= 40 * dt;
    if (Math.random() < dt * 20) op.emit('spark', this.pos, 2);
    if (this.hp <= 0) {
      this.kill();
      op.cues.push('burn');
      op.rate('good', this.pos, 'Remnant seared');
    }
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.sin(op.elapsed * 10 + i) * 0.3;
      g.line({ x, y }, { x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14 }, 2, hex('#6a3040'));
    }
    g.circle(x, y, 10, hex('#8a4050'));
    g.ellipse(x, y + 2, 5, 2, 0, hex('#200008'));
    g.arc(x, y, 18, 2, hex('#ff9040', 0.7), this.hp / 40);
  }
}

/** Lines the cyst mutters while it is being cut free. */
export const CYST_LINES: readonly string[] = [
  '“Doctor. I know what you did with the candle-flames.”',
  '“Leave me in, and I say nothing to the Inquisitor.”',
  '“The page-boy. The standard-bearer. The eight heartbeats. I counted too.”',
  '“Cut me whole and I go quietly. Cut me badly and I talk.”',
];

/**
 * A talking cyst that must come out whole. Encircle it with the lancet (a
 * full loop around it, clear of its wall), then lift it off with the tongs.
 * A lancet straight into it — or pulling it before it is cut free — ruptures
 * it and a crawling remnant spills out.
 */
export class Cyst extends Entity {
  freed = false;
  integrity = 1;
  private circling = false;
  private sum = 0;
  private last = 0;
  private grabbed = false;
  private talkT = 4;
  private line = 0;
  readonly origin: Vec;
  constructor(
    pos: Vec,
    public r = 30,
  ) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 3;
  }
  override drain(): number {
    return 0.35;
  }
  override update(op: Operation, dt: number): void {
    this.talkT -= dt;
    if (this.talkT <= 0) {
      this.talkT = 9;
      op.say(CYST_LINES[this.line++ % CYST_LINES.length]);
    }
  }
  private rupture(op: Operation): void {
    this.kill();
    op.rate('bad', this.pos, 'Ruptured');
    op.hurt(6, this.pos);
    op.emit('pus', this.pos, 20, undefined, undefined, 160);
    op.spawn(new BloodPool({ ...this.pos }, 30, 'pus'), new Remnant({ x: this.pos.x + 10, y: this.pos.y }));
    op.say('It burst — and something’s crawling out of it! Brand it before it reaches a wound!');
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    const d = dist(ptr.pos, this.pos);
    if (tool === 'lancet' && !this.freed) {
      if (d <= this.r) {
        this.rupture(op);
        return true;
      }
      if (d <= this.r + 60) {
        this.circling = true;
        this.sum = 0;
        this.last = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
        return true;
      }
      return false;
    }
    if (tool === 'tongs' && d <= this.r) {
      if (!this.freed) {
        this.integrity -= 0.34;
        op.rate('bad', this.pos, 'Tearing');
        op.sayOnce('cyst-tear', 'It’s still rooted! Cut all the way round it first!');
        if (this.integrity <= 0) this.rupture(op);
        return true;
      }
      this.grabbed = true;
      op.cues.push('pluck');
      return true;
    }
    return false;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (this.grabbed && tool === 'tongs') {
      this.pos = { ...ptr.pos };
      return;
    }
    if (!this.circling || tool !== 'lancet') return;
    const d = dist(ptr.pos, this.pos);
    if (d <= this.r) return this.rupture(op);
    if (d > this.r + 80) {
      this.circling = false;
      return;
    }
    const a = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
    let da = a - this.last;
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    this.sum += da;
    this.last = a;
    if (Math.abs(this.sum) >= TAU * 0.92) {
      this.circling = false;
      this.freed = true;
      op.cues.push('cut');
      op.rate('cool', this.pos, 'Cut free');
      op.say('It’s free. Lift it out whole — gently.');
    }
  }
  override onRelease(op: Operation, ptr: Pointer): void {
    this.circling = false;
    if (!this.grabbed) return;
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('cool', ptr.pos, 'Removed whole');
      op.spawn(new Laceration({ ...this.origin }, 0.2, 50, 0.6));
      op.say('Out, and not a word more out of it.');
    } else this.pos = { ...this.origin };
  }
  override drawSurface(g: Gfx): void {
    surfDisc(g, this.origin, this.r * 1.8, this.freed ? 0.8 : 0, 0.2, 0, 0.8);
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const breath = 1 + 0.04 * Math.sin(op.elapsed * 2);
    g.circleGrad(x, y, this.r * breath, hex('#d8c0a8'), hex('#8a6a5a', 0.9));
    // A mouth, talking.
    const talk = 0.3 + 0.7 * Math.abs(Math.sin(op.elapsed * 7));
    g.ellipse(x, y + 4, this.r * 0.45, this.r * 0.15 * talk, 0, hex('#300810'));
    if (!this.freed)
      g.dashed(
        Array.from({ length: 41 }, (_, i) => ({ x: x + Math.cos((i / 40) * TAU) * (this.r + 24), y: y + Math.sin((i / 40) * TAU) * (this.r + 24) })),
        1.5,
        hex('#f0e0c0', 0.35),
        6,
        6,
      );
    if (this.integrity < 1) g.arc(x, y, this.r + 6, 2, hex('#ff5040'), this.integrity);
  }
}

// ============================================================ under the Hollow Moon

/**
 * The child, lifted from its mother. Grip with the tongs and hold still until
 * the grip is sure (0.6 s) — not so long it is too tight (2.5 s) — then carry
 * it slowly (under 320 px/s) off the table to the waiting arms. The child has
 * its own vigour, which ebbs until it is delivered.
 */
export class Infant extends Entity {
  vigour = 100;
  grip = 0;
  private held = false;
  private moving = false;
  private lastPos: Vec;
  private rough = false;
  readonly origin: Vec;
  constructor(
    pos: Vec,
    public ebb = 0.5,
  ) {
    super(pos);
    this.origin = { ...pos };
    this.lastPos = { ...pos };
    this.layer = 5;
  }
  override drain(): number {
    return 0.1;
  }
  override update(op: Operation, dt: number): void {
    this.vigour = Math.max(0, this.vigour - this.ebb * dt);
    if (this.vigour < 30) op.sayOnce('infant-weak', 'The child is tiring — lift it out, Doctor!');
    if (this.vigour <= 0) op.lose('The child could not be saved.');
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 30) return false;
    this.held = true;
    this.moving = false;
    this.grip = 0;
    this.rough = false;
    this.lastPos = { ...ptr.pos };
    op.cues.push('pluck');
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId, dt: number): void {
    if (!this.held) return;
    const moved = dist(ptr.pos, this.lastPos);
    this.lastPos = { ...ptr.pos };
    if (!this.moving) {
      if (moved < 1.5) {
        this.grip += dt;
        if (this.grip > 2.5 && !this.rough) {
          this.rough = true;
          op.rate('bad', this.pos, 'Too tight');
          op.sayOnce('infant-tight', 'Gently! You’re gripping too hard!');
        }
        return;
      }
      this.moving = true;
      if (this.grip < 0.6 && !this.rough) {
        this.rough = true;
        op.rate('bad', this.pos, 'Unsure grip');
        op.sayOnce('infant-grip', 'Settle your grip before you lift!');
      }
    }
    if (dt > 0 && moved / dt > 320 && !this.rough) {
      this.rough = true;
      op.rate('bad', this.pos, 'Too fast');
      op.sayOnce('infant-fast', 'Slowly — slowly!');
    }
    this.pos = { ...ptr.pos };
  }
  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.held) return;
    this.held = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate(this.rough ? 'good' : 'cool', ptr.pos, 'Delivered');
      op.cues.push('bell');
      op.say('…A cry. A good, loud cry. Hollow Night or no.');
    } else this.pos = { ...this.origin };
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    g.glow(x, y, 50, hex('#ffe0c0', 0.2 + 0.05 * Math.sin(op.elapsed * 2)));
    g.ellipse(x, y, 30, 22, 0.2, hex('#e8b8a0'), hex('#f8d8c8'));
    g.circle(x + 18, y - 12, 13, hex('#f0c8b0'));
    // Vigour bar: the child's own vitals.
    g.rect(x - 30, y + 30, 60, 5, hex('#301010', 0.8));
    g.rect(x - 30, y + 30, (60 * this.vigour) / 100, 5, hex(this.vigour > 40 ? '#8fe0a0' : '#ff6040'));
    if (this.held && !this.moving) g.arc(x, y, 38, 3, hex(this.grip > 2.5 ? '#ff4030' : this.grip >= 0.6 ? '#9fd3a8' : '#f5d76e'), Math.min(1, this.grip / 2.5));
  }
}

// ============================================================ hexstone shot

/** The lead-lined dish at the table's edge: the only safe place for hexstone. */
export const LEAD_DISH: Vec = { x: FIELD.cx + FIELD.rx + 80, y: FIELD.cy - 120 };

/** Whisper marks: each time an instrument other than the tongs touches hexstone, the stone "whispers" (evidence). */
const whispers = new WeakMap<Operation, number>();
export const whisperCount = (op: Operation): number => whispers.get(op) ?? 0;

/**
 * A mutagenic hexstone ball. Only the tongs may touch it — any other
 * instrument laid on it makes it whisper — and it must be dropped into the
 * lead dish beside the table, nowhere else.
 */
export class HexBall extends Embedded {
  private budT: number;
  constructor(
    pos: Vec,
    public budEvery = 7,
    public maxBuds = 3,
  ) {
    super(pos, 'hexstone', 0, false);
    this.budT = budEvery * 0.6;
  }
  override update(op: Operation, dt: number): void {
    super.update(op, dt);
    if (this.grabbed) return;
    this.budT -= dt;
    if (this.budT <= 0) {
      this.budT = this.budEvery;
      if (op.entities.filter((e) => e instanceof Bud && e.alive).length < this.maxBuds) {
        const a = op.rng.range(0, TAU);
        const p = { x: this.origin.x + Math.cos(a) * op.rng.range(60, 110), y: this.origin.y + Math.sin(a) * op.rng.range(45, 80) };
        if (onBody(p)) {
          op.spawn(new Bud(p, op.rng.int(0, 2) as 0 | 1 | 2));
          op.sayOnce('bud', 'The flesh is budding — teeth, fingers… Cut them before they take root!');
        }
      }
    }
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' && tool !== 'lens' && dist(ptr.pos, this.pos) < 20) {
      whispers.set(op, whisperCount(op) + 1);
      op.rate('bad', this.pos, 'The stone whispers');
      op.sayOnce('hex-whisper', 'Don’t touch it with anything but the tongs! It… it whispered.');
      return true;
    }
    return super.onPress(op, ptr, tool);
  }
  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    if (dist(ptr.pos, LEAD_DISH) < 60) {
      this.pos = { ...LEAD_DISH };
      super.onRelease(op, ptr);
      if (!this.alive) op.popup('Into the lead', LEAD_DISH, '#c8c8d0');
      return;
    }
    this.grabbed = false;
    this.pos = { ...this.origin };
    op.sayOnce('hex-dish', 'Into the lead dish — nowhere else!');
  }
  override draw(g: Gfx, op: Operation): void {
    const d = LEAD_DISH;
    g.ellipse(d.x, d.y, 44, 20, 0, hex('#6a6a70'), hex('#9a9aa0'));
    g.text('lead dish', d.x, d.y + 38, { size: 14, font: 'italic', color: hex('#c8c8d0', 0.7), align: 'center' });
    super.draw(g, op);
  }
}

const BUD_KINDS = ['tooth', 'finger', 'eye'] as const;

/**
 * A mutagenic bud: a tooth, a finger or an eye pushing out of the flesh. Cut it
 * out with the lancet before it roots (8 s); a rooted bud must be seared out
 * with the brand.
 */
export class Bud extends Entity {
  rootT: number;
  heat = 0;
  constructor(
    pos: Vec,
    public kind: 0 | 1 | 2,
    rootIn = 8,
  ) {
    super(pos);
    this.layer = 4;
    this.rootT = rootIn;
  }
  get rooted(): boolean {
    return this.rootT <= 0;
  }
  override drain(): number {
    return this.rooted ? 0.3 : 0.15;
  }
  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
    if (this.rootT > 0) {
      this.rootT -= dt;
      if (this.rootT <= 0) {
        op.rate('miss', this.pos, 'Rooted');
        op.sayOnce('bud-root', 'That one has rooted — it’ll need the brand now.');
      }
    }
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > 18) return false;
    if (this.rooted) {
      op.rate('bad', this.pos, 'Rooted fast');
      return true;
    }
    this.kill();
    op.cues.push('cut');
    op.rate(this.rootT > 4 ? 'cool' : 'good', this.pos, 'Bud cut');
    return true;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || !this.rooted || dist(ptr.pos, this.pos) > 18) return;
    this.branded = true;
    this.heat += dt;
    if (this.heat >= 0.8) {
      this.kill();
      op.cues.push('burn');
      op.rate('good', this.pos, 'Seared out');
    }
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const s = 0.6 + 0.4 * Math.min(1, 1 - this.rootT / 8);
    const k = BUD_KINDS[this.kind];
    if (k === 'tooth') g.tri(x - 6 * s, y + 6, x + 6 * s, y + 6, x, y - 12 * s, hex('#f0ead8'));
    else if (k === 'finger') g.ellipse(x, y - 4 * s, 5 * s, 13 * s, 0.3, hex('#e0b8a0'), hex('#c89880'));
    else {
      g.circle(x, y, 9 * s, hex('#f0f0e8'));
      g.circle(x + Math.sin(op.elapsed * 2) * 2, y, 4 * s, hex('#304060'));
    }
    if (!this.rooted) g.arc(x, y, 16, 2, hex('#e05040', 0.6), this.rootT / 8);
    else g.arc(x, y, 16, 2, hex('#6a2030', 0.8));
    if (this.heat > 0) g.arc(x, y, 20, 3, hex('#ff9040'), this.heat / 0.8);
  }
}
