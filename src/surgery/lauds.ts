import { dist, pointSegment, segmentsIntersect, type Vec } from '../core/math';
import { drawBlotch, presentation } from '../render/presentation';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { settings } from '../core/settings';
import { Entity } from './entity';
import { Embedded, Laceration, Rot, surfDisc } from './entities';
import { FIELD, onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';
import { BossRot, BossWound, clampToField, MalisonBase, rateAdd, type BossPhase } from './bosses/base';
import { attack, bossSound, Cadence, difficultyOf, leadFor, tell } from './bosses/signals';

const TAU = Math.PI * 2;
/** Cosmetic randomness only — never the simulation RNG, so effects can't change outcomes. */
const fxRange = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

export interface LaudsTuning {
  hp: number;
  /** Brand damage per second on the bare heart (Call), a linked body (Response), the surfaced core (Dawn). */
  dps: number;
  dpsResponse: number;
  dpsDawn: number;
  voices: number;
  /** Voice orbit speed (rad/s). */
  orbit: number;
  /** Seconds the bare heart stays exposed before the choir is called back. */
  exposure: number;
  /** A silenced Voice rekindles after this long while others still sing. */
  rekindle: number;
  hymnEvery: number;
  /** Lacerations opened per verse (Surgeon 1, Master 2). */
  hymnPerVerse: number;
  ringRadius: number;
  ringSpeed: number;
  /** Phase 2: the other body must be struck within this window or the first heals 50 %. */
  response: number;
  /** The light-thread dims every `dimEvery` s for `dimFor` s; severing it unlinks for `unlink` s. */
  dimEvery: number;
  dimFor: number;
  unlink: number;
  /** Phase 3: dawn flare every `flareEvery` s blinds the Lens for `flareFor` s. */
  flareEvery: number;
  flareFor: number;
  /** Seconds the core stays surfaced once found. */
  surfaceFor: number;
  /** Echoes: the Call only, no phases. */
  phased: boolean;
}

export const LAUDS_DEFAULT: LaudsTuning = {
  hp: 100,
  dps: 2.0,
  dpsResponse: 1.3,
  dpsDawn: 1.3,
  voices: 4,
  orbit: 0.45,
  exposure: 5,
  rekindle: 11,
  hymnEvery: 9,
  hymnPerVerse: 1,
  ringRadius: 150,
  ringSpeed: 220,
  response: 1.5,
  dimEvery: 6,
  dimFor: 1,
  unlink: 8,
  flareEvery: 12,
  flareFor: 2,
  surfaceFor: 4.5,
  phased: true,
};

/** Phase list (BOS-0028/0029/0031): Call 100–65 %, Response 65–30 %, Dawn 30–0 %. */
export const LAUDS_PHASES: readonly BossPhase[] = [
  { key: 'call', from: 1, music: 1 },
  { key: 'response', from: 0.65, music: 2 },
  { key: 'dawn', from: 0.3, music: 3 },
];
const SINGLE_PHASE: readonly BossPhase[] = [{ key: 'call', from: 1, music: 1 }];

/** Live spiderlings never exceed this (BOS-0034). */
export const SPIDERLING_CAP = 6;

/**
 * The Malison of Lauds — "the Antiphon". Phase 1 "Call": a heart shielded by
 * orbiting Voices, each silenced by tracing its sigil with the brand. Phase 2
 * "Response": two bodies joined by a light-thread — a strike on one heals from
 * the other unless the other is struck within the response window; cutting the
 * thread on its dim beat unlinks them. Phase 3 "Dawn": it swims beneath the
 * skin, surfacing where the Lens finds its ripples, while dawn flares blind the
 * Lens. A Hymn — an expanding ring that tears the flesh — sounds throughout
 * the Call and the Response. Unmade, it shatters into hexstone.
 */
export class LaudsMalison extends MalisonBase {
  readonly bossId = 'lauds';
  override boss = true;
  readonly phases: readonly BossPhase[];
  readonly tune: LaudsTuning;
  voices: ChoirVoice[] = [];
  /** Seconds the bare heart has been exposed in the Call. */
  bareT = 0;
  submerged = false;
  hymnR = -1;
  private hymn: Cadence;
  private drift: Vec;
  private lensT = 0;
  private rekindleT = 0;
  /** Phase 2: the linked body, the thread, and an unanswered strike. */
  partner: LaudsBody | null = null;
  thread: LightThread | null = null;
  pending: { from: 'core' | 'partner'; amount: number; t: number } | null = null;
  /** Phase 3: the dawn flare and the surfaced window. */
  private flare: Cadence;
  flareT = 0;
  surfacedT = 0;
  private ambT = 0;
  private blindShown = false;
  /** Hymn lacerations opened, per verse (tests). */
  verseLog: number[] = [];

  constructor(pos: Vec, op: Operation, tune: Partial<LaudsTuning> = {}) {
    const t = { ...LAUDS_DEFAULT, ...tune };
    if (tune.hymnPerVerse === undefined && difficultyOf(op) === 'master') {
      // Master: two tears per verse, the verses spaced to match.
      t.hymnPerVerse = 2;
      if (tune.hymnEvery === undefined) t.hymnEvery *= 1.4;
    }
    // Novice: the choir draws breath longer between verses.
    if (tune.hymnEvery === undefined && difficultyOf(op) === 'novice') t.hymnEvery *= 1.3;
    super(pos, op, t.hp);
    this.tune = t;
    this.phases = t.phased ? LAUDS_PHASES : SINGLE_PHASE;
    this.layer = 4;
    this.drift = { ...pos };
    this.hymn = new Cadence(t.hymnEvery, leadFor(op, 'lauds', 'hymn'));
    this.flare = new Cadence(t.flareEvery, leadFor(op, 'lauds', 'flare'));
    this.resume(op);
    if (this.phase.key === 'call') this.spawnVoices(op, t.voices, false);
    else this.onPhase(op, this.phaseIx);
  }

  private spawnVoices(op: Operation, n: number, rekindled: boolean): void {
    for (let i = 0; i < n; i++) {
      const v = new ChoirVoice(this, (i / n) * TAU + op.rng.range(0, 0.4), rekindled);
      if (!rekindled || this.spawnAdd(op, v)) {
        if (!rekindled) op.spawn(v);
        this.voices.push(v);
      }
    }
  }

  get livingVoices(): ChoirVoice[] {
    return this.voices.filter((v) => v.alive);
  }

  get radius(): number {
    return 30 + 12 * this.frac;
  }

  /** The Lens is blinded by the dawn flare. */
  get blinded(): boolean {
    return this.flareT > 0;
  }

  override blinds(tool: ToolId): boolean {
    return tool === 'lens' && this.blinded;
  }

  /** True while the Lens-blinding flare is being foretold (horizon glow). */
  get flareTelling(): boolean {
    return this.phase.key === 'dawn' && this.flare.telling;
  }

  override drain(): number {
    return this.submerged ? 0.6 : 0.35;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    if (!this.submerged && Math.random() < dt * 10) op.emit('mote', { x: this.pos.x + fxRange(-30, 30), y: this.pos.y + fxRange(-30, 30) }, 1);
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 0.25;
      const layers = this.phase.key === 'call' ? this.livingVoices.length : 0;
      op.events.emit('boss', { kind: 'music', boss: 'lauds', intensity: this.phase.music, layers });
      // Each silenced Voice drops its note from the sung chord (BOS-0039).
      op.events.emit('boss', { kind: 'ambience', id: 'lauds-chord', pan: 0, gain: 1, layers });
    }

    const key = this.phase.key;
    if (key === 'dawn') return this.dawn(op, dt);

    this.moveToward(this.drift, 20, dt);
    if (dist(this.pos, this.drift) < 6) this.drift = this.region(op, key === 'response' ? -1 : 0);

    if (key === 'call') this.call(op, dt);
    else this.response(op, dt);
    this.hymnStep(op, dt);
  }

  /** A drift target: the centre (0), or the left (−1) / right (+1) region. */
  private region(op: Operation, side: number): Vec {
    const cx = FIELD.cx + side * FIELD.rx * 0.45;
    const p = { x: cx + op.rng.range(-0.18, 0.18) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.3, 0.3) * FIELD.ry };
    return clampToField(p, 40 + this.radius);
  }

  private call(op: Operation, dt: number): void {
    const shielded = this.livingVoices.length > 0;
    if (!shielded) {
      if (this.bareT === 0) {
        op.say('The choir is silenced — its heart is bare! Brand it, now!');
        op.shake = Math.max(op.shake, 6);
      }
      this.bareT += dt;
      if (this.bareT > this.tune.exposure) {
        // Too slow: the choir is rekindled — half-traced already (BOS-0033).
        this.bareT = 0;
        this.spawnVoices(op, 2, true);
        op.say('It’s calling its Voices back!');
      }
    } else {
      this.bareT = 0;
      if (this.livingVoices.length < this.tune.voices) {
        this.rekindleT += dt;
        if (this.rekindleT > this.tune.rekindle) {
          this.rekindleT = 0;
          this.spawnVoices(op, 1, true);
        }
      }
    }
  }

  private response(op: Operation, dt: number): void {
    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) {
        // Unanswered: the other body sings the wound half closed.
        const heal = this.pending.amount * 0.5;
        const at = this.pending.from === 'core' ? this.pos : (this.partner?.pos ?? this.pos);
        this.pending = null;
        this.hp = Math.min(this.maxHp * this.phases[this.phaseIx].from, this.hp + heal);
        op.popup('It answers itself', { ...at }, '#e0c0ff');
        op.sayOnce('lauds-response', 'It heals from the other body! Strike one, then the other — quickly!');
      }
    }
  }

  /** Is the light-thread cut (bodies unlinked)? */
  get unlinked(): boolean {
    return !!this.thread && this.thread.unlinkT > 0;
  }

  /** A strike on one of the linked bodies (phase 2). */
  strike(op: Operation, from: 'core' | 'partner', amount: number, at: Vec): void {
    const other = from === 'core' ? 'partner' : 'core';
    if (this.pending && this.pending.from === other) {
      // Answered in time: the earlier strike stands.
      this.pending = null;
      rateAdd(op, 'cool', at, 'Answered');
      bossSound(op, from === 'core' ? 'call' : 'response', at);
    }
    const dealt = this.damage(op, amount, at);
    if (!this.alive || this.phase.key !== 'response' || this.unlinked) return;
    if (this.pending && this.pending.from === from) this.pending.amount += dealt;
    else {
      this.pending = { from, amount: dealt, t: this.tune.response };
      bossSound(op, from === 'core' ? 'call' : 'response', at);
    }
  }

  private hymnStep(op: Operation, dt: number): void {
    if (this.hymnR < 0) {
      const ev = this.hymn.step(dt);
      if (ev === 'tell') {
        tell(op, 'lauds', 'hymn', this.pos);
        bossSound(op, 'inhale', this.pos);
      }
      if (ev === 'attack') {
        this.hymnR = 0;
        attack(op, 'lauds', 'hymn', this.pos);
        op.sayOnce('lauds-hymn', 'It’s singing — every verse tears him open! Stitch the cuts as they come!');
        op.cues.push('sfx.lauds.hymn');
      }
      return;
    }
    const prev = this.hymnR;
    this.hymnR += dt * this.tune.ringSpeed;
    const R = this.tune.ringRadius;
    if (prev < R && this.hymnR >= R) {
      let opened = 0;
      for (let i = 0; i < this.tune.hymnPerVerse; i++) {
        const a = op.rng.range(0, TAU);
        const p = { x: this.pos.x + Math.cos(a) * R, y: this.pos.y + Math.sin(a) * R * 0.8 };
        if (onBody(p) && this.spawnAdd(op, new BossWound(p, a + Math.PI / 2, op.rng.range(40, 60), 0.5))) opened++;
      }
      this.verseLog.push(opened);
      op.hurt(1, this.pos);
      op.shake = Math.max(op.shake, 5);
    }
    if (this.hymnR > R * 2.1) this.hymnR = -1;
  }

  /** True while the hymn's ring outline shimmers before a verse. */
  get hymnTelling(): boolean {
    return this.hymnR < 0 && this.hymn.telling;
  }

  private dawn(op: Operation, dt: number): void {
    // The dawn flare: horizon glow (tell), then the Lens is blind.
    if (this.flareT > 0) this.flareT = Math.max(0, this.flareT - dt);
    const ev = this.flare.step(dt);
    if (ev === 'tell') {
      tell(op, 'lauds', 'flare', { x: FIELD.cx, y: FIELD.cy - FIELD.ry });
      op.events.emit('boss', { kind: 'hud', flag: 'dawn-glow', on: true });
    }
    if (ev === 'attack') {
      this.flareT = this.tune.flareFor;
      this.lensT = 0;
      attack(op, 'lauds', 'flare', { x: FIELD.cx, y: FIELD.cy });
      bossSound(op, 'flare');
      op.events.emit('boss', { kind: 'hud', flag: 'lens-blind', on: true });
      op.sayOnce('lauds-flare', 'The dawn — I can’t see a thing through the Lens! Wait for the glare to pass!');
    }
    if (this.blindShown && this.flareT === 0) op.events.emit('boss', { kind: 'hud', flag: 'lens-blind', on: false });
    this.blindShown = this.flareT > 0;

    if (!this.submerged) {
      this.surfacedT -= dt;
      this.moveToward(this.drift, 12, dt);
      if (this.surfacedT <= 0) this.submerge(op);
      return;
    }
    // Swimming beneath the flesh, leaving a trail of rot (at most three patches).
    if (dist(this.pos, this.drift) < 8) {
      this.drift = clampToField({ x: FIELD.cx + op.rng.range(-0.6, 0.6) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.5, 0.5) * FIELD.ry }, 40 + this.radius);
      if (op.entities.filter((e) => e instanceof Rot && e.alive).length < 3) this.spawnAdd(op, new BossRot({ ...this.pos }, 26, 0.5));
    }
    this.moveToward(this.drift, 60, dt);
  }

  private submerge(op: Operation): void {
    this.submerged = true;
    this.hidden = true;
    this.lensT = 0;
    this.hymnR = -1;
    op.sayOnce('lauds-under', 'It’s gone under the skin! The Scrying Lens — hunt its ripples!');
  }

  private moveToward(t: Vec, speed: number, dt: number): void {
    const d = dist(this.pos, t);
    if (d < 1) return;
    this.pos = { x: this.pos.x + ((t.x - this.pos.x) / d) * speed * dt, y: this.pos.y + ((t.y - this.pos.y) / d) * speed * dt };
  }

  override onReveal(op: Operation, p: Vec, dt: number): void {
    if (!this.submerged || dist(p, this.pos) > 70) return;
    if (this.blinded) {
      this.lensT = 0;
      return;
    }
    this.lensT += dt;
    if (this.lensT > 0.5) {
      this.submerged = false;
      this.hidden = false;
      this.lensT = 0;
      this.surfacedT = this.tune.surfaceFor;
      op.popup('Found it!', this.pos, '#b9d7ff');
      op.cues.push('good');
      op.sayOnce('lauds-surface', 'There! It’s surfacing — brand it before it dives!');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.submerged || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    const key = this.phase.key;
    if (key === 'call' && this.livingVoices.length > 0) {
      op.sayOnce('lauds-shielded', 'The Voices shield it. Silence them first — trace each one’s sigil with the brand.');
      return;
    }
    if (Math.random() < dt * 20) op.emit('spark', ptr.pos, 2);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    const before = this.phaseIx;
    if (key === 'response') this.strike(op, 'core', this.tune.dpsResponse * dt, ptr.pos);
    else this.damage(op, (key === 'dawn' ? this.tune.dpsDawn : this.tune.dps) * dt, ptr.pos);
    if (this.alive && this.phaseIx !== before) op.rate('good', this.pos, 'Wounded');
  }

  protected override onPhase(op: Operation, ix: number): void {
    const key = this.phases[ix].key;
    this.bareT = 0;
    this.pending = null;
    if (key === 'response') {
      for (const v of this.voices) v.kill();
      this.hymn.reset();
      this.hymnR = -1;
      this.drift = this.region(op, -1);
      const b = new LaudsBody(clampToField({ x: FIELD.cx + FIELD.rx * 0.45, y: this.pos.y }, 40 + this.radius), this);
      const th = new LightThread(this, b, op);
      this.partner = b;
      this.thread = th;
      op.spawn(b, th);
      op.say('It has split in two — and the halves sing to each other! Strike one, then the other, before it answers!');
    } else if (key === 'dawn') {
      for (const v of this.voices) v.kill();
      this.partner?.kill();
      this.thread?.kill();
      this.partner = null;
      this.thread = null;
      this.flare.reset();
      this.submerge(op);
      op.spawn(new DawnOverlay(this));
      op.say('Dawn is breaking — and it has dived! Find it with the Lens between the flares!');
    }
  }

  protected override onDeath(op: Operation): void {
    this.partner?.kill();
    this.thread?.kill();
    for (const v of this.voices) v.kill();
    op.events.emit('boss', { kind: 'hud', flag: 'lens-blind', on: false });
    op.rate('cool', this.pos, 'Malison unmade');
    op.say('It shattered — hexstone, everywhere! Get every shard out before it spoils him!');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4;
      const p = { x: this.pos.x + Math.cos(a) * 70, y: this.pos.y + Math.sin(a) * 55 };
      op.spawn(new Embedded(onBody(p) ? p : { ...this.pos }, 'hexstone', a, false));
    }
  }

  protected override deathLook(): [number, number] {
    return [1, this.radius * 4];
  }

  override drawSurface(g: Gfx): void {
    if (!this.submerged) surfDisc(g, this.pos, this.radius * 1.9, 0.05, 0.35, 0.1, 0.7);
    else surfDisc(g, this.pos, 46, 0, 0.1, 0.05, 0.9);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    if (this.hymnTelling) {
      // Hymn tell: the ring's outline shimmers before it expands.
      const k = 0.5 + 0.5 * Math.sin(op.elapsed * 30);
      g.arc(x, y, this.tune.ringRadius * 0.35, 2, hex('#f0d8ff', 0.25 + 0.35 * k));
    }
    if (this.hymnR >= 0) {
      const a = Math.max(0, 1 - this.hymnR / (this.tune.ringRadius * 2.1));
      g.arc(x, y, this.hymnR, 14, hex('#d8b0ff', 0.1 * a));
      g.arc(x, y, this.hymnR, 3, hex('#f0d8ff', 0.7 * a));
    }
    const bare = this.phase.key !== 'call' || this.livingVoices.length === 0;
    g.glow(x, y, this.radius * 2.8, hex(bare ? '#ff9050' : '#c0a0ff', 0.25));
    g.creature(1, x, y, this.radius * 4, { seed: this.id, open: bare ? 1 : 0, health: this.frac, flash: this.hurtFlash });
    if (this.phase.key === 'call' && bare) g.arc(x, y, this.radius + 16, 3, hex('#ff8040'), 1 - this.bareT / this.tune.exposure);
    if (this.pending && this.pending.from === 'core') g.arc(x, y, this.radius + 20, 3, hex('#ffe0a0'), this.pending.t / this.tune.response);
    g.arc(x, y, this.radius + 10, 3, hex('#b478ff', 0.7), this.frac);
  }

  /** Dawn flare and its horizon glow (drawn even while the core is hidden, by the thread-less overlay). */
  drawDawn(g: Gfx, op: Operation): void {
    if (this.phase.key !== 'dawn') return;
    const soften = settings.reduceFlashing ? 0.35 : 1;
    if (this.flare.telling) {
      const k = Math.min(1, (this.flare.t - (this.tune.flareEvery - this.flare.lead)) / this.flare.lead);
      g.glow(FIELD.cx, FIELD.cy - FIELD.ry - 40, 520, hex('#ffc860', 0.35 * k * soften));
    }
    if (this.flareT > 0) {
      const k = this.flareT / this.tune.flareFor;
      g.glow(FIELD.cx, FIELD.cy, 900, hex('#fff0c0', 0.55 * k * soften));
    }
    // Ripples where it swims (the Lens finds them).
    if (this.submerged && op.tool === 'lens' && !this.blinded) {
      const r = 20 + ((op.elapsed * 30) % 30);
      g.arc(this.pos.x, this.pos.y, r, 1.5, hex('#b9d7ff', 0.25 * (1 - (r - 20) / 30)));
    }
  }
}

/** Draws Lauds's dawn overlay above everything (the core may be hidden). */
export class DawnOverlay extends Entity {
  constructor(private core: LaudsMalison) {
    super({ ...core.pos });
    this.required = false;
    this.layer = 9;
  }
  override update(): void {
    if (!this.core.alive) this.kill();
  }
  draw(g: Gfx, op: Operation): void {
    this.core.drawDawn(g, op);
  }
}

/** The second body of the Response: the other half of the antiphon. */
export class LaudsBody extends Entity {
  private drift: Vec;
  constructor(
    pos: Vec,
    public core: LaudsMalison,
  ) {
    super(pos);
    this.layer = 4;
    this.required = false;
    this.drift = { ...pos };
  }
  get radius(): number {
    return this.core.radius * 0.85;
  }
  override update(op: Operation, dt: number): void {
    this.branded = false;
    if (!this.core.alive || this.core.phase.key !== 'response') return this.kill();
    const d = dist(this.pos, this.drift);
    if (d < 6) this.drift = clampToField({ x: FIELD.cx + FIELD.rx * 0.45 + op.rng.range(-0.18, 0.18) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.3, 0.3) * FIELD.ry }, 40 + this.radius);
    else this.pos = { x: this.pos.x + ((this.drift.x - this.pos.x) / d) * 20 * dt, y: this.pos.y + ((this.drift.y - this.pos.y) / d) * 20 * dt };
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (Math.random() < dt * 20) op.emit('spark', ptr.pos, 2);
    this.core.strike(op, 'partner', this.core.tune.dpsResponse * dt, ptr.pos);
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    g.glow(x, y, this.radius * 2.6, hex('#ffb070', 0.22));
    g.creature(1, x, y, this.radius * 4, { seed: this.id + 7, open: 1, health: this.core.frac, flash: this.core.hurtFlash });
    const p = this.core.pending;
    if (p && p.from === 'partner') g.arc(x, y, this.radius + 20, 3, hex('#ffe0a0'), p.t / this.core.tune.response);
    void op;
  }
}

/**
 * The light-thread joining the Response's two bodies. It dims every few
 * seconds; a lancet drawn across it on the dim beat unlinks the bodies.
 */
export class LightThread extends Entity {
  private dim: Cadence;
  dimT = 0;
  unlinkT = 0;
  private stroke: Vec | null = null;
  constructor(
    public a: LaudsMalison,
    public b: LaudsBody,
    op: Operation,
  ) {
    super({ ...a.pos });
    this.layer = 3;
    this.required = false;
    this.dim = new Cadence(a.tune.dimEvery, leadFor(op, 'lauds', 'dim'));
  }
  get dimmed(): boolean {
    return this.dimT > 0;
  }
  get dimTelling(): boolean {
    return this.dim.telling;
  }
  override update(op: Operation, dt: number): void {
    if (!this.a.alive || !this.b.alive) return this.kill();
    this.pos = { x: (this.a.pos.x + this.b.pos.x) / 2, y: (this.a.pos.y + this.b.pos.y) / 2 };
    if (this.unlinkT > 0) {
      this.unlinkT = Math.max(0, this.unlinkT - dt);
      if (this.unlinkT === 0) op.say('The thread has rewoven — they’re linked again!');
      return;
    }
    if (this.dimT > 0) this.dimT = Math.max(0, this.dimT - dt);
    const ev = this.dim.step(dt);
    if (ev === 'tell') tell(op, 'lauds', 'dim', this.pos);
    if (ev === 'attack') {
      this.dimT = this.a.tune.dimFor;
      attack(op, 'lauds', 'dim', this.pos);
      op.sayOnce('lauds-dim', 'The thread between them dims — cut across it with the lancet, now!');
    }
  }
  private near(p: Vec): boolean {
    return pointSegment(p, this.a.pos, this.b.pos).d < 40;
  }
  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.unlinkT > 0 || !this.near(ptr.pos)) return false;
    this.stroke = { ...ptr.pos };
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || !this.stroke) return;
    if (!segmentsIntersect(ptr.prev, ptr.pos, this.a.pos, this.b.pos)) return;
    this.stroke = null;
    if (!this.dimmed) {
      op.popup('Too bright', { ...ptr.pos }, '#e0c0ff');
      op.sayOnce('lauds-bright', 'Not while it blazes — wait for the thread to dim.');
      return;
    }
    this.unlinkT = this.a.tune.unlink;
    this.dimT = 0;
    this.a.pending = null;
    op.cues.push('cut');
    op.rate('cool', ptr.pos, 'Severed');
    op.say('Severed! Strike freely while they’re apart!');
  }
  override onRelease(): void {
    this.stroke = null;
  }
  draw(g: Gfx, op: Operation): void {
    const pa = this.a.pos;
    const pb = this.b.pos;
    if (this.unlinkT > 0) {
      const k = this.unlinkT / this.a.tune.unlink;
      g.dashed([pa, pb], 1.5, hex('#e0c0ff', 0.25 * (1 - k) + 0.05), 6, 10);
      return;
    }
    const tellK = this.dim.telling ? 0.5 + 0.5 * Math.sin(op.elapsed * 20) : 0;
    const bright = this.dimmed ? 0.18 : 0.75 - 0.3 * tellK;
    g.setBlend('add');
    g.line(pa, pb, 9, hex('#ffd8a0', bright * 0.3));
    g.line(pa, pb, 3, hex('#fff0d0', bright));
    g.setBlend('alpha');
    // The response window, as an arc filling between the bodies.
    const p = this.a.pending;
    if (p) {
      const k = 1 - p.t / this.a.tune.response;
      const from = p.from === 'core' ? pa : pb;
      const to = p.from === 'core' ? pb : pa;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 60 };
      const pts: Vec[] = [];
      for (let i = 0; i <= 16 * k; i++) {
        const t = i / 16;
        pts.push({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y });
      }
      if (pts.length > 1) g.polyline(pts, 3, hex('#ffe0a0', 0.8));
    }
  }
}

/** The sigil each Voice wears: a closed triangle, traced with the brand (local coordinates). */
export const VOICE_SIGIL: readonly Vec[] = [0, 1, 2, 3].map((i) => {
  const a = -Math.PI / 2 + (i * TAU) / 3;
  return { x: Math.cos(a) * 20, y: Math.sin(a) * 20 };
});
const VOICE_SAMPLES: Vec[] = (() => {
  const out: Vec[] = [];
  for (let i = 1; i < VOICE_SIGIL.length; i++) {
    const a = VOICE_SIGIL[i - 1];
    const b = VOICE_SIGIL[i];
    for (let k = 0; k < 6; k++) out.push({ x: a.x + ((b.x - a.x) * k) / 6, y: a.y + ((b.y - a.y) * k) / 6 });
  }
  return out;
})();

/** One Voice of the Lauds choir: orbits the core; trace its sigil with the brand to silence it. */
export class ChoirVoice extends Entity {
  covered: boolean[];
  private orbitR: number;

  constructor(
    public core: LaudsMalison,
    public angle: number,
    /** Rekindled Voices return half-traced (BOS-0033). */
    public rekindled = false,
  ) {
    super({ ...core.pos });
    this.layer = 5;
    this.orbitR = 95;
    this.covered = VOICE_SAMPLES.map((_, i) => rekindled && i < VOICE_SAMPLES.length / 2);
    this.place();
  }

  /** Fraction of the sigil traced. */
  get traced(): number {
    return this.covered.filter(Boolean).length / this.covered.length;
  }

  private place(): void {
    this.pos = { x: this.core.pos.x + Math.cos(this.angle) * this.orbitR, y: this.core.pos.y + Math.sin(this.angle) * this.orbitR * 0.75 };
  }

  /** A Voice is a shield, not a wound: it drains nothing itself. */
  override drain(): number {
    return 0;
  }

  override update(_op: Operation, dt: number): void {
    this.branded = false;
    if (!this.core.alive || this.core.submerged || this.core.phase.key !== 'call') return this.kill();
    this.angle += dt * this.core.tune.orbit;
    this.place();
  }

  /** Seconds the brand has rested on the Voice without tracing anything new. */
  private idleBrandT = 0;

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 34) return;
    this.branded = true;
    const a = { x: ptr.prev.x - this.pos.x, y: ptr.prev.y - this.pos.y };
    const b = { x: ptr.pos.x - this.pos.x, y: ptr.pos.y - this.pos.y };
    const useA = dist(a, b) < 40 ? a : b;
    let fresh = false;
    for (let i = 0; i < VOICE_SAMPLES.length; i++) {
      if (!this.covered[i] && pointSegment(VOICE_SAMPLES[i], useA, b).d < 9) {
        this.covered[i] = true;
        fresh = true;
      }
    }
    // A brand simply held on a Voice does nothing: teach the trace.
    this.idleBrandT = fresh ? 0 : this.idleBrandT + dt;
    if (this.idleBrandT > 0.5) op.sayOnce('lauds-voice-trace', 'Holding it there won’t quiet it — trace the Voice’s sigil with the brand, line by line.');
    if (fresh && op.rng.next() < 0.3) op.cues.push('burn');
    if (fresh && Math.random() < 0.5) op.emit('spark', ptr.pos, 2);
    if (this.traced >= 0.8) {
      this.kill();
      op.emit('mote', this.pos, 16, undefined, undefined, 90);
      if (this.rekindled) rateAdd(op, 'cool', this.pos, 'Silenced');
      else op.rate('cool', this.pos, 'Silenced');
      bossSound(op, 'call', this.pos, 0.5, 0.5 + this.core.livingVoices.length * 0.25);
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const glow = 0.6 + 0.4 * Math.sin(op.elapsed * 8 + this.id);
    g.glow(x, y, 38, hex('#c890ff', 0.35 * glow));
    const pts = VOICE_SIGIL.map((p) => ({ x: x + p.x, y: y + p.y }));
    g.polyline(pts, 3, hex('#e0c0ff', glow));
    for (let i = 0; i < VOICE_SAMPLES.length; i++) if (this.covered[i]) g.circle(x + VOICE_SAMPLES[i].x, y + VOICE_SAMPLES[i].y, 2.5, hex('#ffb060', 0.95));
    g.circle(x, y, 3 + 2 * glow, hex('#20082a'));
  }
}

/** A spider's egg sac under the skin. Lance it and sear what spills out — or it hatches on its own. */
export class EggSac extends Entity {
  hatchT: number;
  private readonly hatchIn: number;
  constructor(
    pos: Vec,
    public brood = 3,
    hatchIn = 10,
  ) {
    super(pos);
    this.layer = 2;
    this.hatchT = this.hatchIn = hatchIn;
  }

  override drain(): number {
    return 0.2;
  }

  /** The swell tell: 0 → 1 over the last 3 s before hatching. */
  get swell(): number {
    return Math.max(0, Math.min(1, 1 - this.hatchT / 3));
  }

  override update(op: Operation, dt: number): void {
    const before = this.hatchT;
    this.hatchT -= dt;
    if (before > 3 && this.hatchT <= 3) {
      op.sayOnce('eggsac-' + this.id, 'That sac is swelling… it’s about to hatch!');
      bossSound(op, 'hum', this.pos, 0.6);
    }
    if (this.hatchT <= 0) this.burst(op, this.brood + 2, true);
  }

  private burst(op: Operation, n: number, hatched: boolean): void {
    this.kill();
    op.emit('pus', this.pos, 14, undefined, undefined, 140);
    const live = op.entities.filter((e) => e instanceof SpiderlingGrub && e.alive).length;
    const room = Math.max(0, SPIDERLING_CAP - live);
    for (let i = 0; i < Math.min(n, room); i++) {
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
    op.rate(this.hatchT > Math.min(8, this.hatchIn * 0.5) ? 'cool' : 'good', this.pos, 'Lanced');
    op.sayOnce('eggsac-lanced', 'Spiderlings! Brand them before they scatter!');
    this.burst(op, this.brood, false);
    return true;
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, 34 + 8 * this.swell, 0, 0.1, 0, 0.8 + 0.2 * this.swell);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const urgency = Math.max(0, 1 - this.hatchT / this.hatchIn);
    if (presentation.creatureFilter) return drawBlotch(g, x, y, 22);
    const s = 1 + 0.25 * this.swell;
    const wob = 1 + Math.sin(op.elapsed * (4 + urgency * 14)) * 0.05 * (1 + urgency * 2 + this.swell * 2);
    g.ellipse(x, y, 24 * wob * s, (20 / wob) * s, 0.3, hex('#d8d0b8', 0.95), hex('#8a8068', 0.9));
    for (let i = 0; i < this.brood + 2; i++) {
      const a = (i / (this.brood + 2)) * TAU + op.elapsed * (0.5 + this.swell * 3);
      g.circle(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 7 * s, 3.5, hex('#3a3020', 0.6));
    }
    g.arc(x, y, 30 * s, 2, hex('#e05040', 0.3 + 0.5 * urgency), Math.max(0, this.hatchT) / this.hatchIn);
  }
}

/** A hatchling: faster than a grub, same cure. It makes for the nearest open wound. */
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
    let wound: Entity | null = null;
    let bd = 260;
    for (const e of op.entities) {
      if (!(e instanceof Laceration) || !e.alive) continue;
      const d = dist(e.pos, this.pos);
      if (d < bd) {
        bd = d;
        wound = e;
      }
    }
    if (wound && bd > 14) {
      const want = Math.atan2(wound.pos.y - this.pos.y, wound.pos.x - this.pos.x);
      let da = want - this.heading;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      this.heading += Math.max(-4 * dt, Math.min(4 * dt, da)) + op.rng.range(-1, 1) * dt;
    } else this.heading += op.rng.range(-3, 3) * dt;
    const sp = wound && bd <= 14 ? 0 : 65;
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
    if (presentation.creatureFilter) return drawBlotch(g, x, y, 9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(op.elapsed * 20 + i) * 0.2;
      g.line({ x, y }, { x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }, 1.5, hex('#1a1410'));
    }
    g.circle(x, y, 6, hex('#2a2018'));
    g.circle(x, y - 2, 2, hex('#e04030', 0.8));
    if (this.heat > 0) g.arc(x, y, 15, 3, hex('#ff9040'), this.heat / 0.25);
  }
}

