import { clamp, dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { surfDisc } from '../entities';
import { FIELD, MAX_VITALS, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { BrandNode, distortion, drawBossRing, InjectionWatch, TAU } from './common';
import { Voice } from './voices';
import { bossSound, type BossOpDef } from './signals';

export interface SextTuning {
  hp: number;
  /** Torpor: the instruments' lag grows from 0 to this (s) over `lagRamp` seconds unless a tincture is given. */
  lagMax: number;
  lagRamp: number;
  /** Lag while Sext holds its own Stillness (phase 3). */
  stillLag: number;
  /** Phase 2: the false reading the vitals settle toward, and the real drain beneath it (/s). */
  falseTarget: number;
  realDrain: number;
  /** Crust plates in phase 1 (phase 2 re-crusts with half as many). */
  plates: number;
  /** Brand damage per second while exposed. */
  dps: number;
  /** X5 remix: the torpor never falls below this lag (s), even just after a tincture. */
  lagFloor?: number;
  /** False vitals never clear, even under the lens (X-op "Noonday Demon"). */
  permanentFalse?: boolean;
}

/** Torpor cap under the reduced input-lag assist (s). */
export const REDUCED_LAG_CAP = 0.12;

export const SEXT_DEFAULT: SextTuning = { hp: 100, lagMax: 0.25, lagRamp: 20, stillLag: 0.4, falseTarget: 70, realDrain: 1.2, plates: 6, dps: 11 };

/** A plate of the stone crust over Sext. Two lancet taps crack it away. */
export class CrustPlate extends Entity {
  hits = 0;
  constructor(
    pos: Vec,
    public angle: number,
    public need = 2,
  ) {
    super(pos);
    this.layer = 5;
  }
  override drain(): number {
    return 0.04;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > 20) return false;
    this.hits++;
    op.cues.push('pluck');
    op.emit('dust', this.pos, 6);
    if (this.hits >= this.need) {
      this.kill();
      op.rate('good', this.pos, 'Chipped');
    }
    return true;
  }
  draw(g: Gfx): void {
    const { x, y } = this.pos;
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const a = this.angle + (i / 5) * TAU;
      const r = 17 - (i % 2) * 3;
      return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    });
    g.poly(pts, hex('#8c8478'), hex('#b8b0a0'));
    if (this.hits > 0) g.line({ x: x - 10, y: y - 6 }, { x: x + 8, y: y + 9 }, 2, hex('#2a2620'));
  }
}

/** Petrification (BOS-0080): px/s the stone front spreads from Sext while any crust plate stands. */
export const PETRIFY_SPEED = 3;
/** Each organ's drain resistance: the share of Sext's drain it shields. Stone halves it. */
export const ORGAN_RESIST = 0.12;

export type GlyphOrgan = 'heart' | 'lung' | 'liver';

/**
 * An organ glyph (BOS-0080): an engraved mark over an organ that resists Sext's drain. When the
 * spreading stone reaches it, the organ petrifies and its resistance is halved.
 */
export class OrganGlyph extends Entity {
  petrified = false;
  noun = 'the organ';
  constructor(
    pos: Vec,
    public organ: GlyphOrgan,
  ) {
    super(pos);
    this.layer = 1;
    this.required = false;
  }
  get resist(): number {
    return this.petrified ? ORGAN_RESIST / 2 : ORGAN_RESIST;
  }
  override hitTest(): boolean {
    return false;
  }
  draw(g: Gfx): void {
    const { x, y } = this.pos;
    const ink = hex(this.petrified ? '#8c8478' : '#d8b870', this.petrified ? 0.9 : 0.55);
    if (this.petrified) g.circle(x, y, 13, hex('#6c665c', 0.85));
    g.arc(x, y, 14, 1.6, ink);
    // The organ's sign: a heart's lobes, the lung's paired leaves, the liver's single wedge.
    if (this.organ === 'heart') {
      g.circle(x - 3.5, y - 2, 3.5, ink);
      g.circle(x + 3.5, y - 2, 3.5, ink);
      g.tri(x - 7, y - 1, x + 7, y - 1, x, y + 7, ink);
    } else if (this.organ === 'lung') {
      g.line({ x, y: y - 8 }, { x, y: y + 2 }, 1.4, ink);
      g.circle(x - 4, y + 2, 3.5, ink);
      g.circle(x + 4, y + 2, 3.5, ink);
    } else g.tri(x - 8, y - 4, x + 8, y - 4, x - 2, y + 7, ink);
    if (this.petrified) {
      g.line({ x: x - 9, y: y - 6 }, { x: x + 2, y: y + 1 }, 1.2, hex('#2a2620'));
      g.line({ x: x + 2, y: y + 1 }, { x: x + 8, y: y + 8 }, 1.2, hex('#2a2620'));
    }
  }
}

/** A sun-dial node holding Sext's Stillness together. Hold the brand on it to break it. */
export class SunDial extends BrandNode {
  constructor(
    pos: Vec,
    private owner: SextMalison,
  ) {
    super(pos, 0.8, 24);
  }
  override drain(): number {
    return 0.1;
  }
  protected broken(op: Operation): void {
    op.rate('cool', this.pos, 'Dial broken');
    this.owner.dialBroken(op);
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    g.glow(x, y, 40, hex('#ffe080', 0.3));
    g.circle(x, y, 16, hex('#d8c070'));
    g.line({ x, y }, { x: x + Math.cos(op.elapsed * 0.3) * 14, y: y + Math.sin(op.elapsed * 0.3) * 14 }, 2, hex('#3a2a10'));
    if (this.heat > 0) g.arc(x, y, 22, 3, hex('#ff9040'), this.heat / this.holdTime);
  }
}

/** A permanently hidden marker over the heart: the Scrying Lens held here shows the true vitals. */
export class HeartTruth extends Entity {
  constructor(
    pos: Vec,
    private owner: SextMalison,
  ) {
    super(pos);
    this.hidden = true;
    this.required = false;
  }
  override onReveal(op: Operation, p: Vec): void {
    if (dist(p, this.pos) < 60) this.owner.reveal(op);
  }
  /** Not a thing to be found: the heart's truth is a reading, and the Lens must keep reading it (so the auto-lens assist leaves it be). */
  override reveal(): void {}
  draw(): void {}
}

/**
 * The Malison of Sext — "the Noonday Demon". An acedia-curse: it lays torpor
 * on the surgeon's own hands (the instruments answer ever later until a
 * stimulant tincture is given), and hides beneath a stone crust. Phase 1
 * "Languor": chip the crust and brand what lies under it. Phase 2 "False Noon":
 * the vitals read a calm false value while the patient truly sinks — only the
 * Scrying Lens on the heart shows the truth. Phase 3 "Stillborn Hour": it casts
 * a Stillness of its own; break the three sun-dials with the brand, or clash
 * the Litany against it to stun it.
 */
export class SextMalison extends Entity {
  private voice = new Voice('sext', 9, '#f0d890');
  hp: number;
  readonly maxHp: number;
  stage: 1 | 2 | 3 = 1;
  plates: CrustPlate[] = [];
  dials: SunDial[] = [];
  torporT = 0;
  stillborn = false;
  stunT = 0;
  /** True vitals while the false reading holds (null otherwise). */
  trueVitals: number | null = null;
  private shown = 0;
  private truthT = 0;
  /** Last true reading the surgeon saw through the lens, and when. */
  lastSeen: number = MAX_VITALS;
  lastSeenAt = 0;
  private falseT = 0;
  private cycleStart = 0;
  private recast = 0;
  private hurtFlash = 0;
  private droneT = 0;
  private watch = new InjectionWatch();
  private truth: HeartTruth;
  readonly heart: Vec;
  /** The stone front's radius from Sext (BOS-0080), and the organ glyphs it can reach. */
  stone = 0;
  readonly glyphs: OrganGlyph[] = [];

  constructor(
    pos: Vec,
    op: Operation,
    public tune: SextTuning = SEXT_DEFAULT,
    heart?: Vec,
  ) {
    super(pos);
    this.layer = 2;
    this.hp = this.maxHp = tune.hp;
    if ((op.def as BossOpDef).assists?.reducedLag) this.lagCap = REDUCED_LAG_CAP;
    this.heart = heart ?? { x: FIELD.cx - 150, y: FIELD.cy - 60 };
    this.crust(op, tune.plates);
    this.truth = new HeartTruth(this.heart, this);
    op.spawn(this.truth);
    for (const [organ, at] of [
      ['heart', this.heart],
      ['lung', { x: FIELD.cx + 170, y: FIELD.cy - 80 }],
      ['liver', { x: FIELD.cx + 120, y: FIELD.cy + 90 }],
    ] as const) {
      const gl = new OrganGlyph({ ...at }, organ);
      this.glyphs.push(gl);
      op.spawn(gl);
    }
  }

  /** Drain multiplier from petrified organs: 1 while every glyph holds, up to +18 % with all three stone. */
  get stoneFactor(): number {
    let lost = 0;
    for (const gl of this.glyphs) lost += ORGAN_RESIST - gl.resist;
    return 1 + lost;
  }

  /** The false reading is on the monitors (not the truth under the Lens) — the ECG runs too smooth (BOS-0083). */
  get falseShown(): boolean {
    return this.trueVitals !== null && this.truthT <= 0;
  }

  get exposed(): boolean {
    return (this.plates.every((p) => !p.alive) && !this.stillborn) || this.stunT > 0;
  }

  /** The instruments' current lag in seconds. */
  get lag(): number {
    if (this.stillborn) return Math.min(this.lagCap, this.tune.stillLag);
    const floor = this.tune.lagFloor ?? 0;
    return Math.min(this.lagCap, floor + (this.tune.lagMax - floor) * clamp(this.torporT / this.tune.lagRamp, 0, 1));
  }

  /** The "reduced input-lag effects" assist caps the torpor at 120 ms (BOS-0085). */
  lagCap = Infinity;

  get radius(): number {
    return 30 + 8 * (this.hp / this.maxHp);
  }

  override drain(): number {
    return (this.stage === 2 ? this.tune.realDrain : 0.35) * this.stoneFactor;
  }

  private crust(op: Operation, n: number): void {
    const off = op.rng.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      const p = new CrustPlate({ x: this.pos.x + Math.cos(a) * 46, y: this.pos.y + Math.sin(a) * 36 }, a);
      this.plates.push(p);
      op.spawn(p);
    }
    this.cycleStart = this.hp;
  }

  reveal(op: Operation): void {
    if (this.trueVitals === null || this.tune.permanentFalse) return;
    this.truthT = 0.25;
    this.lastSeen = this.trueVitals;
    this.lastSeenAt = op.elapsed;
  }

  dialBroken(op: Operation): void {
    if (this.dials.some((d) => d.alive)) return;
    this.endStillness(op);
    op.say('The dials are broken — its stillness has cracked! Brand it!');
  }

  private endStillness(op: Operation): void {
    this.stillborn = false;
    for (const d of this.dials) d.kill();
    this.dials = [];
    this.torporT = 0;
    this.cycleStart = this.hp;
    op.cues.push('bell');
  }

  private castStillness(op: Operation): void {
    this.stillborn = true;
    this.recast++;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + op.rng.range(0, 1);
      const d = new SunDial({ x: FIELD.cx + Math.cos(a) * FIELD.rx * 0.5, y: FIELD.cy + Math.sin(a) * FIELD.ry * 0.45 }, this);
      this.dials.push(d);
      op.spawn(d);
    }
    op.say('It’s casting a stillness of its own — my hands are like lead! Break the sun-dials with the brand!');
    op.shake = 8;
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.stunT = Math.max(0, this.stunT - dt);

    // Petrification (BOS-0080): stone creeps out from the crust while any plate stands.
    if (this.plates.some((p) => p.alive)) this.stone += PETRIFY_SPEED * dt;
    for (const gl of this.glyphs) {
      if (gl.petrified || dist(gl.pos, this.pos) - 12 > this.stone) continue;
      gl.petrified = true;
      op.popup('Stone!', gl.pos, '#b8b0a0');
      op.sayOnce('sext-stone', 'The stone’s reached an organ — it drains faster now. Get that crust off!');
    }

    // False Noon: keep the true vitals beneath a calm false reading.
    if (this.trueVitals !== null) {
      this.trueVitals = clamp(this.trueVitals + (op.vitals - this.shown), 0, MAX_VITALS);
      this.truthT = Math.max(0, this.truthT - dt);
      this.falseT += dt;
      if (this.falseT > 10) op.sayOnce('sext-colour', 'His colour’s wrong, whatever the pulse says — check the heart with the lens!');
      if (this.trueVitals <= 0) {
        op.vitals = 0;
        return;
      }
      this.shown = this.truthT > 0 ? this.trueVitals : this.shown + (this.tune.falseTarget - this.shown) * Math.min(1, dt * 0.8);
      op.vitals = this.shown;
    }

    // Torpor ramps unless a stimulant tincture is given.
    if (this.watch.check(op)) {
      if (this.torporT > 2) op.popup('The torpor lifts', this.pos, '#8ab8ff');
      this.torporT = 0;
    }
    this.torporT += dt;
    // Noon bell audio (BOS-0084): a heat drone and cicada buzz that rise with the torpor.
    this.droneT -= dt;
    if (this.droneT <= 0) {
      this.droneT = 2;
      bossSound(op, 'drone', this.pos, 0.3 + 0.7 * clamp(this.lag / Math.max(this.tune.lagMax, 1e-6), 0, 1));
    }
    if (this.lag > 0.15) op.sayOnce('sext-torpor', 'Your hands are slowing, Doctor — it’s the curse! A tincture will quicken you.');
    // Clash: the Litany against its Stillness cancels both and stuns it.
    if (this.stillborn && op.litanyTime > 0) {
      op.litanyTime = 0;
      this.endStillness(op);
      this.stunT = 4;
      op.rate('cool', this.pos, 'Stillness against Stillness');
      op.say('Two stillnesses — they’ve broken each other! It’s stunned!');
      op.shake = 12;
    }
    distortion(op).lag = this.lag;

    if (this.exposed) op.sayOnce('sext-exposed', 'The crust is off — brand it while it lies bare!');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (!this.exposed) {
      op.sayOnce('sext-crusted', this.stillborn ? 'Its stillness shields it. Break the dials!' : 'Stone over it. Chip the crust away with the lancet first.');
      return;
    }
    this.hp -= this.tune.dps * (this.stunT > 0 ? 1.5 : 1) * dt;
    this.hurtFlash = 1;
    if (Math.random() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    const f = this.hp / this.maxHp;
    if (f <= 0) return this.die(op);
    if (this.stage === 1 && f <= 0.6) {
      this.stage = 2;
      this.trueVitals = op.vitals;
      this.shown = op.vitals;
      this.crust(op, Math.ceil(this.tune.plates / 2));
      op.rate('good', this.pos, 'Languor broken');
      op.say('It’s crusted over again — and his pulse has gone so calm… too calm.');
    } else if (this.stage === 2 && f <= 0.3) {
      this.stage = 3;
      if (this.trueVitals !== null) op.vitals = this.trueVitals;
      this.trueVitals = null;
      op.rate('good', this.pos, 'False noon ends');
      this.castStillness(op);
    } else if (this.stage === 2 && this.cycleStart - this.hp >= this.maxHp * 0.1 && this.stunT <= 0) {
      this.crust(op, Math.ceil(this.tune.plates / 2));
    } else if (this.stage === 3 && f <= 0.15 && this.recast < 2 && this.stunT <= 0) {
      this.castStillness(op);
    }
  }

  override kill(): void {
    super.kill();
    for (const p of this.plates) p.kill();
    for (const d of this.dials) d.kill();
    this.truth.kill();
  }

  private die(op: Operation): void {
    if (this.trueVitals !== null) op.vitals = this.trueVitals;
    this.trueVitals = null;
    this.kill();
    distortion(op).lag = 0;
    op.rate('cool', this.pos, 'Sext unmade');
    op.shake = 14;
    op.emit('dust', this.pos, 40);
    op.emit('mote', this.pos, 40, undefined, undefined, 120);
    op.say('Noon has passed. His breath is quickening again.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.radius * 2, 0, 0.1, 0.1, 0.6);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const t = op.elapsed;
    const r = this.radius;
    // The stone front (BOS-0080): a grey crust creeping out over the flesh.
    if (this.stone > r) {
      g.circleGrad(x, y, this.stone, hex('#6c665c', 0.28), hex('#6c665c', 0.12));
      g.arc(x, y, this.stone, 2, hex('#a8a090', 0.5));
    }
    g.glow(x, y, r * 2.4, hex(this.exposed ? '#ffd060' : '#a09070', 0.22));
    g.circleGrad(x, y, r, this.hurtFlash > 0 ? hex('#fff0c0') : hex('#c8a860'), hex('#504020', 0.6));
    // A heavy-lidded sun-face, dozing.
    const lid = this.stillborn ? 0.05 : 0.15 + 0.1 * Math.sin(t * 0.8);
    g.ellipse(x, y - 2, r * 0.5, r * lid, 0, hex('#2a1a08'));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.05;
      g.line({ x: x + Math.cos(a) * r * 1.05, y: y + Math.sin(a) * r * 1.05 }, { x: x + Math.cos(a) * r * 1.4, y: y + Math.sin(a) * r * 1.4 }, 3, hex('#d8b870', 0.6));
    }
    if (this.stillborn) g.arc(x, y, r + 20, 4, hex('#fff0a0', 0.5 + 0.3 * Math.sin(t * 3)));
    if (this.stunT > 0) g.arc(x, y, r + 14, 3, hex('#f5d76e'), this.stunT / 4);
    // Torpor tell: a slow ring that fills as the lag grows.
    const lagF = this.lag / Math.max(this.tune.lagMax, this.tune.stillLag);
    if (lagF > 0.05) g.arc(x, y, r + 26, 2, hex('#8ab8ff', 0.3 + 0.4 * lagF), lagF);
    if (this.truthT > 0 && this.trueVitals !== null) g.text(`true pulse ${Math.ceil(this.trueVitals)}`, this.heart.x, this.heart.y - 40, { size: 18, color: hex('#ff6050'), align: 'center' });
    drawBossRing(g, this.pos, r + 8, this.hp / this.maxHp, [0.6, 0.3], '#e0c060');
  }
}
