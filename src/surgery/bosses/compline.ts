import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { Embedded, Grub, surfDisc } from '../entities';
import { LaudsMalison } from '../lauds';
import { Malison, MalisonShard } from '../malison';
import { FIELD, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { BrandNode, distortion, drawBossRing, Muffler, randomOnBody, stepToward, TAU } from './common';
import { Voice } from './voices';
import { burrowPath, BurrowSegment } from './none';
import { NameSigil, PRIME_NAMES } from './prime';
import { CrustPlate } from './sext';
import { FlameTongue } from './terce';
import { TallowClot } from './vespers';

export interface ComplineTuning {
  hp: number;
  /** Phase 1: seconds each echoed Hour lasts before it withdraws unbeaten. */
  echoTime: number;
  /** Phase 2: the stolen Litany is cast against the surgeon every `stolenEvery` s, for `stolenFor` s. */
  stolenEvery: number;
  stolenFor: number;
  /** Instrument lag while the stolen Litany holds (s). */
  stolenLag: number;
  nodes: number;
  /** Silence windows: every `muteEvery` s all cues are muted for `muteFor` s (1 s tell first). */
  muteEvery: number;
  muteFor: number;
  /** Phase 3: lancet-open then brand within this window (s) for `comboDmg` % damage. */
  comboWindow: number;
  comboDmg: number;
  /** Phase 3: an echo of another Hour interrupts every this many seconds. */
  interruptEvery: number;
  /** The "peaceful" drift of the vitals toward nothing (/s). */
  drift: number;
  /** X-op: no silence nodes; the Litany stays stolen and phase 2 is won by combos. */
  noNodes?: boolean;
}

export const COMPLINE_DEFAULT: ComplineTuning = {
  hp: 100,
  echoTime: 25,
  stolenEvery: 12,
  stolenFor: 5,
  stolenLag: 0.3,
  nodes: 4,
  muteEvery: 20,
  muteFor: 8,
  comboWindow: 0.6,
  comboDmg: 8,
  interruptEvery: 20,
  drift: 0.25,
};

export type EchoKind = 'matins' | 'lauds' | 'prime';

/** Matins as Compline remembers it: the same shroud and rhythm, but it sheds at most two hexlings and no shards. */
export class MatinsEcho extends Malison {
  private shed = 0;
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    const before = op.entities.length;
    super.onSweep(op, ptr, tool, dt);
    for (const e of op.entities.slice(before)) if ((e instanceof Grub && this.shed++ >= 2) || e instanceof MalisonShard) e.kill();
  }
}

/** Lauds as Compline remembers it: a thinner choir (two Voices), shattering into at most one hexstone. */
export class LaudsEcho extends LaudsMalison {
  private shards = 0;
  constructor(
    pos: Vec,
    op: Operation,
    hp = 30,
    private maxShards = 1,
    /** A hushed echo never raises its Hymn (the Office's Lauds trial is about the Voices). */
    private hushed = false,
  ) {
    super(pos, op);
    this.hp = hp;
    for (const v of this.voices.slice(2)) v.kill();
  }
  override update(op: Operation, dt: number): void {
    super.update(op, dt);
    if (this.hushed) this.hymnR = -1;
    // Never more than two Voices, however often it calls them back.
    for (const v of this.livingVoices.slice(2)) v.kill();
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    const before = op.entities.length;
    super.onSweep(op, ptr, tool, dt);
    for (const e of op.entities.slice(before)) if (e instanceof Embedded && this.shards++ >= this.maxShards) e.kill();
  }
}

/** A silence-node of Compline. Brand all of them to take the Litany back. */
export class SilenceNode extends BrandNode {
  constructor(
    pos: Vec,
    private owner: ComplineMalison | null,
  ) {
    super(pos, 0.8, 24);
  }
  override drain(): number {
    return 0.1;
  }
  protected broken(op: Operation): void {
    op.rate('cool', this.pos, 'Silence broken');
    this.owner?.nodeBroken(op);
  }
  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    g.glow(x, y, 44, hex('#8090c0', 0.25 + 0.1 * Math.sin(op.elapsed * 2 + this.id)));
    g.circle(x, y, 15, hex('#202438'));
    g.arc(x, y, 15, 2, hex('#c0c8f0', 0.8));
    g.line({ x: x - 8, y }, { x: x + 8, y }, 2, hex('#c0c8f0', 0.8));
    if (this.heat > 0) g.arc(x, y, 22, 3, hex('#ff9040'), this.heat / this.holdTime);
  }
}

/**
 * The Malison of Compline — "the Great Silence". It would give the patient a
 * quiet night and a perfect end: the vitals drift gently toward nothing.
 * Phase 1 "Examen": it wears the earlier Hours in turn — Matins, Lauds, Prime —
 * each echo reusing that Hour's own module; beating an echo wounds Compline.
 * Phase 2 "Nunc Dimittis": it steals the Litany and turns it on the surgeon
 * (the instruments lag while it holds); break the silence-nodes with the brand
 * to take the Litany back. Phase 3 "Great Silence": the core yields only to a
 * two-instrument combination — the lancet opens it, the brand must follow
 * within a breath — while echoes of Terce, Sext, None and Vespers interrupt.
 * Throughout, windows of silence mute every sound cue.
 */
export class ComplineMalison extends Entity {
  private voice = new Voice('compline', 9, '#c0c8f0');
  hp: number;
  readonly maxHp: number;
  stage: 1 | 2 | 3 = 1;
  echo: Entity | null = null;
  echoKind: EchoKind | null = null;
  private echoIx = 0;
  echoT = 0;
  private echoBeaten = false;
  nodes: SilenceNode[] = [];
  litanyStolen = false;
  private stealT = 0;
  stolenT = 0;
  private muteCycle = 0;
  muteT = 0;
  comboOpenAt = -Infinity;
  private interruptT = 0;
  private interruptIx = 0;
  private target: Vec;
  private hurtFlash = 0;
  readonly echoes: readonly EchoKind[] = ['matins', 'lauds', 'prime'];

  constructor(
    pos: Vec,
    op: Operation,
    public tune: ComplineTuning = COMPLINE_DEFAULT,
  ) {
    super(pos);
    this.layer = 3;
    this.hp = this.maxHp = tune.hp;
    this.target = { ...pos };
    this.echoT = 2;
    void op;
  }

  get radius(): number {
    return 28 + 10 * (this.hp / this.maxHp);
  }

  get muted(): boolean {
    return this.muteT > 0;
  }

  get comboOpen(): boolean {
    return this.comboOpenAt > -Infinity;
  }

  override drain(): number {
    // While it wears another Hour, that Hour does the harm.
    return this.stage === 1 && this.echo ? 0 : this.tune.drift;
  }

  // -------------------------------------------------------------- phase 1: the echoes

  private beginEcho(op: Operation): void {
    const kind = this.echoes[this.echoIx % this.echoes.length];
    this.echoIx++;
    this.echoKind = kind;
    this.echoT = this.tune.echoTime;
    this.echoBeaten = false;
    const at = randomOnBody(op, 0.35, 0.3);
    if (kind === 'matins') {
      this.echo = new MatinsEcho(at, op, 'matins', 30);
      op.say('It’s wearing Matins — the shroud, the eye! Brand it when it opens!');
    } else if (kind === 'lauds') {
      this.echo = new LaudsEcho(at, op, 30);
      op.say('Now it sings as Lauds — silence the Voices!');
    } else {
      const n = new NameSigil({ x: FIELD.cx, y: FIELD.cy + 90 }, PRIME_NAMES[(this.echoIx * 11) % PRIME_NAMES.length], op, 1.5);
      n.onErased = () => (this.echoBeaten = true);
      this.echo = n;
      op.say('Prime’s quill — it’s writing a name. Strike it out, newest stroke first!');
    }
    op.spawn(this.echo);
  }

  private endEcho(op: Operation): void {
    const beaten = this.echoBeaten || (this.echo !== null && !this.echo.alive && this.echoKind !== 'prime');
    if (this.echo?.alive) this.echo.kill();
    this.echo = null;
    if (beaten) {
      this.hp -= this.maxHp * 0.1;
      this.hurtFlash = 1;
      op.rate('cool', this.pos, 'Echo silenced');
      if (this.hp <= this.maxHp * 0.7 + 0.01) return this.enterNunc(op);
    } else op.say('The echo has withdrawn. It will come again.');
    this.echoT = 2;
  }

  // -------------------------------------------------------------- phase 2: the stolen Litany

  private enterNunc(op: Operation): void {
    this.stage = 2;
    this.hp = this.maxHp * 0.7;
    this.litanyStolen = true;
    op.litanyLocked = true;
    op.litanyTime = 0;
    this.stealT = this.tune.stolenEvery;
    op.popup('THE LITANY IS TAKEN', { x: FIELD.cx, y: FIELD.cy - 150 }, '#8090c0');
    op.say('Doctor — the stillness, it’s taken your stillness! It will turn it on your own hands!');
    op.cues.push('bell');
    op.shake = 10;
    if (this.tune.noNodes) return;
    for (let i = 0; i < this.tune.nodes; i++) {
      const a = (i / this.tune.nodes) * TAU + 0.4;
      const n = new SilenceNode({ x: FIELD.cx + Math.cos(a) * FIELD.rx * 0.55, y: FIELD.cy + Math.sin(a) * FIELD.ry * 0.55 }, this);
      this.nodes.push(n);
      op.spawn(n);
    }
    op.say('Those grey knots — silence-nodes. Break them all with the brand and the Litany comes back!');
  }

  nodeBroken(op: Operation): void {
    this.hp -= (this.maxHp * 0.35) / this.tune.nodes;
    this.hurtFlash = 1;
    if (this.nodes.some((n) => n.alive)) return;
    this.restoreLitany(op);
    this.enterSilence(op);
  }

  /** The Litany returns — usable once more even if it was already spent. */
  restoreLitany(op: Operation): void {
    if (!this.litanyStolen) return;
    this.litanyStolen = false;
    this.stolenT = 0;
    op.litanyLocked = false;
    // Usable once more even if it was already spent.
    if (!op.canInvokeLitany()) op.grantLitany();
    op.popup('THE LITANY RETURNS', { x: FIELD.cx, y: FIELD.cy - 150 }, '#f5d76e');
    op.cues.push('litany');
  }

  // -------------------------------------------------------------- phase 3: the Great Silence

  private enterSilence(op: Operation): void {
    this.stage = 3;
    this.hp = this.maxHp * 0.35;
    this.interruptT = this.tune.interruptEvery * 0.5;
    op.say('It will not bleed for one instrument. Open it with the lancet, then brand it — at once!');
    op.cues.push('bell');
  }

  private interrupt(op: Operation): void {
    const kinds = ['terce', 'none', 'vespers', 'sext'] as const;
    const kind = kinds[this.interruptIx++ % kinds.length];
    const p = randomOnBody(op, 0.55, 0.45);
    if (kind === 'terce') op.spawn(new FlameTongue(p, null, 22));
    else if (kind === 'none') op.spawn(new BurrowSegment(burrowPath(op, p, 1, 18 * 0.8, 10), 18 * 0.8, null, 24));
    else if (kind === 'vespers') op.spawn(new TallowClot(p, 18));
    else for (let i = 0; i < 2; i++) op.spawn(new CrustPlate({ x: p.x + (i ? 30 : -30), y: p.y }, i));
    op.say(kind === 'terce' ? 'Terce’s fire!' : kind === 'none' ? 'A burrower — racing for the heart!' : kind === 'vespers' ? 'Tallow in the blood again!' : 'Stone, crusting over him!');
  }

  // -------------------------------------------------------------- frame

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (dist(this.pos, this.target) < 6) this.target = randomOnBody(op, 0.35, 0.3);
    this.pos = stepToward(this.pos, this.target, this.stage === 3 ? 14 : 20, dt);

    // Windows of silence (with a one-second tell), in every phase.
    this.muteCycle += dt;
    if (this.muteT > 0) {
      this.muteT -= dt;
      op.spawn(new Muffler());
    } else if (this.muteCycle >= this.tune.muteEvery) {
      this.muteCycle = 0;
      this.muteT = this.tune.muteFor;
      op.spawn(new Muffler());
    } else if (this.muteCycle >= this.tune.muteEvery - 1) op.popup('[silence]', { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 10 }, '#8090c0');

    if (this.comboOpen && op.elapsed - this.comboOpenAt > this.tune.comboWindow) this.comboOpenAt = -Infinity;

    if (this.stage === 1) {
      if (this.echo) {
        this.echoT -= dt;
        if (!this.echo.alive || this.echoBeaten || this.echoT <= 0) this.endEcho(op);
      } else {
        this.echoT -= dt;
        if (this.echoT <= 0) this.beginEcho(op);
      }
    } else if (this.stage === 2) {
      // Hold the Litany stolen, and cast it against the surgeon.
      if (this.litanyStolen) op.litanyLocked = true;
      this.stealT -= dt;
      if (this.stolenT > 0) this.stolenT -= dt;
      if (this.stealT <= 0 && this.litanyStolen) {
        this.stealT = this.tune.stolenEvery;
        this.stolenT = this.tune.stolenFor;
        op.popup('Stillness — against you', this.pos, '#8090c0');
        op.sayOnce('compline-stolen', 'It’s using your Litany on you — your hands are slowing!');
      }
    } else {
      this.interruptT -= dt;
      if (this.interruptT <= 0) {
        this.interruptT = this.tune.interruptEvery;
        this.interrupt(op);
      }
    }
    distortion(op).lag = this.stolenT > 0 ? this.tune.stolenLag : 0;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > this.radius) return false;
    if (this.stage !== 3 && !(this.stage === 2 && this.tune.noNodes)) {
      op.sayOnce('compline-untouched', this.stage === 1 ? 'The core won’t open — beat the Hour it is wearing!' : 'Break the silence-nodes first!');
      return true;
    }
    this.comboOpenAt = op.elapsed;
    op.cues.push('cut');
    op.popup('Opened!', this.pos, '#ffd080');
    return true;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    const comboPhase = this.stage === 3 || (this.stage === 2 && this.tune.noNodes);
    if (!comboPhase) return;
    if (!this.comboOpen) {
      op.sayOnce('compline-closed', 'The brand slides off. Lancet first — then the brand, quick!');
      return;
    }
    this.comboOpenAt = -Infinity;
    this.hp -= this.maxHp * (this.tune.comboDmg / 100);
    this.hurtFlash = 1;
    op.emit('spark', this.pos, 16);
    op.cues.push('burn');
    op.rate('cool', this.pos, 'Lancet and brand');
    op.shake = Math.max(op.shake, 5);
    if (this.stage === 2 && this.hp <= this.maxHp * 0.35) this.enterSilence(op);
    else if (this.hp <= 0) this.die(op);
  }

  override kill(): void {
    super.kill();
    this.echo?.kill();
    for (const n of this.nodes) n.kill();
  }

  private die(op: Operation): void {
    this.kill();
    this.restoreLitany(op);
    distortion(op).lag = 0;
    this.muteT = 0;
    op.rate('cool', this.pos, 'Compline unmade');
    op.shake = 16;
    op.emit('mote', this.pos, 70, undefined, undefined, 160);
    op.say('…Listen. He’s breathing. It isn’t quiet any more.');
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, this.radius * 2, 0, 0.1, 0.25, 0.6);
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const t = op.elapsed;
    const r = this.radius;
    g.glow(x, y, r * 2.6, hex(this.comboOpen ? '#ffd080' : '#6070a0', 0.25));
    g.circleGrad(x, y, r, this.hurtFlash > 0 ? hex('#e0e8ff') : hex('#303a58'), hex('#080a14', 0.6));
    // A closed, sleeping eye, and a shroud of still air.
    g.line({ x: x - r * 0.5, y }, { x: x + r * 0.5, y }, 3, hex('#c0c8f0', 0.8));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.1;
      g.arc(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, r * (1.3 + 0.1 * i), 1, hex('#8090c0', 0.08));
    }
    if (this.comboOpen) g.arc(x, y, r + 14, 3, hex('#ffd080'), 1 - (op.elapsed - this.comboOpenAt) / this.tune.comboWindow);
    if (this.stage === 1 && this.echo) g.arc(x, y, r + 20, 2, hex('#b478ff', 0.6), this.echoT / this.tune.echoTime);
    if (this.litanyStolen) {
      // The stolen star, cracked and black.
      const pts = [0, 2, 4, 1, 3, 0].map((i) => ({ x: x + Math.cos(-Math.PI / 2 + (i * TAU) / 5) * (r + 32), y: y + Math.sin(-Math.PI / 2 + (i * TAU) / 5) * (r + 32) }));
      g.polyline(pts, 2, hex(this.stolenT > 0 ? '#f5d76e' : '#202020', 0.6));
    }
    if (this.muted) g.text('[silence]', x, y - r - 40, { size: 18, font: 'italic', color: hex('#c0c8f0', 0.8), align: 'center' });
    drawBossRing(g, this.pos, r + 8, this.hp / this.maxHp, [0.7, 0.35], '#a0b0e0');
  }
}
