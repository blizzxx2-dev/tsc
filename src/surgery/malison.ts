import { fxRandom } from './fxRandom';
import { TIMING } from './timing';
import { dist, pointSegment, type Vec } from '../core/math';
import { Entity } from './entity';
import { hex } from '../render/color';
import { presentation } from '../render/presentation';
import type { Gfx } from '../render/gfx';
import { Laceration, surfDisc } from './entities';
import { threadKnotArt } from '../art/ailmentArt';
import { FIELD, onBody, type Operation } from './operation';
import type { Pointer, ToolId } from './types';
import { BossWound, clampToField, MalisonBase, rateAdd, type BossPhase } from './bosses/base';
import { attack, bossSound, Cadence, leadFor, panOf, tell } from './bosses/signals';

const TAU = Math.PI * 2;
/** Cosmetic randomness only — never the simulation RNG, so effects can't change outcomes. */
const fxRange = (lo: number, hi: number): number => lo + fxRandom() * (hi - lo);

/**
 * The Malison: a living curse woven by the Hollow Choir. It takes root in a
 * patient's flesh as a shrouded, drifting mass. Its shroud parts on a rhythm
 * (the "eye opens"); only then will the brand bite. Each variant is named for a
 * canonical hour, and varies the rhythm and what the curse does to the flesh.
 */
export type Hour = 'matins';

export interface MatinsTuning {
  /** Brand damage per second while the shroud is open (×`eyeMult` on the third beat). */
  dps: number;
  /** Seconds veiled, and open in phase 1 "Vigil" and phase 2 "Watchfire". */
  veil: number;
  open1: number;
  open2: number;
  /** Seconds of veiled drifting between rends. */
  rend: number;
  /** Crawling shards shed on each veil close in phase 2. */
  shardsPerVeil: number;
  /** Phase 3 "The Eye": seconds per beat; the third beat stays open `beat3` s, then a `rest`. */
  beat: number;
  beat3: number;
  rest: number;
  eyeMult: number;
  /** A gaze lash every this many eye cycles. */
  gazeEvery: number;
  /** Echoes and the rejoined core: the Vigil rhythm only, no phases. */
  phased: boolean;
  /** X1 remix: the Eye opens from the start, alongside the shroud. */
  eyeFromStart?: boolean;
}

export const MATINS_DEFAULT: MatinsTuning = {
  dps: 2.6,
  veil: 4,
  open1: 2.5,
  open2: 2.0,
  rend: 4.5,
  shardsPerVeil: 2,
  beat: 1.0,
  beat3: 1.5,
  rest: 1.7,
  eyeMult: 2,
  gazeEvery: 2,
  phased: true,
};

/** Phase list (BOS-0011..0013): Vigil 100–60 %, Watchfire 60–25 %, The Eye 25–0 %. */
export const MATINS_PHASES: readonly BossPhase[] = [
  { key: 'vigil', from: 1, music: 1 },
  { key: 'watchfire', from: 0.6, music: 2 },
  { key: 'eye', from: 0.25, music: 3 },
];
const SINGLE_PHASE: readonly BossPhase[] = [{ key: 'vigil', from: 1, music: 1 }];

/** The eye's 3-beat pulse: which segment of the cycle it is in. */
export type EyeBeat = 1 | 2 | 3 | 0;

export class Malison extends MalisonBase {
  readonly bossId = 'matins';
  override boss = true;
  readonly phases: readonly BossPhase[];
  readonly tune: MatinsTuning;
  open = false;
  cycleT = 0;
  rendT = 0;
  private target: Vec;
  /** Veiled-branding feedback: one MISS, then none for 5 s. */
  private veiledMissT = 0;
  /** Phase 3: time within the eye's cycle and the count of cycles. */
  eyeT = 0;
  private eyeCycles = 0;
  private offBeat = -1;
  /** The gaze lash: locked direction and time left before it fires (null = none). */
  gaze: { dir: Vec; t: number; from: Vec } | null = null;
  private opening: Cadence;
  private ambT = 0;
  /** Shards shed by each veil close (for tests). */
  shedLog: number[] = [];

  constructor(
    pos: Vec,
    op: Operation,
    public hour: Hour = 'matins',
    hp = 100,
    tune: Partial<MatinsTuning> = {},
  ) {
    super(pos, op, hp);
    this.layer = 4;
    this.tune = { ...MATINS_DEFAULT, ...tune };
    this.phases = this.tune.phased ? MATINS_PHASES : SINGLE_PHASE;
    this.target = this.pickTarget(op);
    this.opening = new Cadence(this.tune.veil, leadFor(op, 'matins', 'open'));
    this.resume(op);
  }

  get radius(): number {
    return 34 + 16 * this.frac;
  }

  /** Phase 3 (or the X1 remix): the single eye is out. */
  get eyeOut(): boolean {
    return this.phase.key === 'eye' || !!this.tune.eyeFromStart;
  }

  /** Which beat the eye is on (0 = resting). */
  get beat(): EyeBeat {
    const b = this.tune.beat;
    if (this.eyeT < b) return 1;
    if (this.eyeT < 2 * b) return 2;
    if (this.eyeT < 2 * b + this.tune.beat3) return 3;
    return 0;
  }

  private get eyeCycle(): number {
    return 2 * this.tune.beat + this.tune.beat3 + this.tune.rest;
  }

  /** The brand bites: shroud open, or the eye on its third beat. */
  get vulnerable(): boolean {
    if (this.phase.key === 'eye') return this.beat === 3 || this.lateOnBeat;
    return this.open || (!!this.tune.eyeFromStart && (this.beat === 3 || this.lateOnBeat));
  }

  /** Latency set by the operation (INP-0111): a strike this late after the third beat still lands. */
  latency = 0;

  /** Just past the third beat, for a player who hears it late: within their latency plus the GOOD window. */
  private get lateOnBeat(): boolean {
    const late = this.eyeT - (2 * this.tune.beat + this.tune.beat3);
    return this.latency > 0 && late >= 0 && late <= TIMING.good + this.latency;
  }

  private get openSpan(): number {
    return this.phase.key === 'watchfire' ? this.tune.open2 : this.tune.open1;
  }

  /** Shroud rhythm knobs for remixes (X1): seconds veiled, and seconds open in the Vigil (Watchfire scales with it). */
  get veilTime(): number {
    return this.tune.veil;
  }
  set veilTime(s: number) {
    this.tune.veil = s;
    this.opening.period = s;
  }
  get openTime(): number {
    return this.tune.open1;
  }
  set openTime(s: number) {
    this.tune.open2 *= s / this.tune.open1;
    this.tune.open1 = s;
  }

  private pickTarget(op: Operation): Vec {
    for (let i = 0; i < 60; i++) {
      const p = { x: FIELD.cx + op.rng.range(-0.7, 0.7) * FIELD.rx, y: FIELD.cy + op.rng.range(-0.6, 0.6) * FIELD.ry };
      if (onBody(p)) return clampToField(p, 40 + 50);
    }
    return { x: FIELD.cx, y: FIELD.cy };
  }

  override drain(): number {
    return 0.45;
  }

  override update(op: Operation, dt: number): void {
    this.tickBase(op, dt);
    this.veiledMissT = Math.max(0, this.veiledMissT - dt);
    if (fxRandom() < dt * 12) op.emit('mote', { x: this.pos.x + fxRange(-30, 30), y: this.pos.y + fxRange(-30, 30) }, 1);
    // Ambience: the choir whisper follows the Malison across the stereo field.
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 0.25;
      op.events.emit('boss', { kind: 'ambience', id: 'matins-whisper', pan: panOf(this.pos.x), gain: 0.4 + 0.6 * (1 - this.frac) });
    }

    if (this.phase.key !== 'eye') this.shroud(op, dt);
    else this.open = false;
    if (this.eyeOut) this.eye(op, dt);

    // Drift toward a wandering target, never within 40 px of the field's edge.
    const d = dist(this.pos, this.target);
    if (d < 10) this.target = this.pickTarget(op);
    else {
      const sp = this.vulnerable ? 15 : this.phase.key === 'eye' ? 25 : 45;
      this.pos = { x: this.pos.x + ((this.target.x - this.pos.x) / d) * sp * dt, y: this.pos.y + ((this.target.y - this.pos.y) / d) * sp * dt };
    }
    this.pos = clampToField(this.pos, 40 + this.radius);
  }

  /** Phases 1–2: the shroud's rhythm, rends while veiled, shards on each close. */
  private shroud(op: Operation, dt: number): void {
    this.cycleT += dt;
    if (!this.open) {
      this.opening.period = this.tune.veil;
      const before = this.opening.t;
      const ev = this.opening.step(dt);
      // Audio lead 0.6 s (the visual tremor starts at the full lead).
      const tollAt = this.tune.veil - 0.6;
      if (before < tollAt && this.opening.t >= tollAt && this.opening.telling) bossSound(op, 'toll', this.pos);
      if (ev === 'tell') tell(op, 'matins', 'open', this.pos);
      if (ev === 'attack') {
        this.open = true;
        this.cycleT = 0;
        attack(op, 'matins', 'open', this.pos);
        op.sayOnce('malison-open', 'Its shroud has parted — sear it with the brand, now!');
      }
      // While veiled it rends the flesh it passes over.
      const rl = leadFor(op, 'matins', 'rend');
      const rb = this.rendT;
      this.rendT += dt;
      if (rb < this.rendEvery - rl && this.rendT >= this.rendEvery - rl) tell(op, 'matins', 'rend', this.pos);
      if (this.rendT > this.rendEvery) {
        this.rendT = 0;
        this.rend(op, { ...this.pos }, op.rng.range(0, TAU), op.rng.range(40, 60));
        op.sayOnce('malison-rend', 'It’s tearing the flesh as it moves! Stitch those wounds!');
      }
    } else if (this.cycleT >= this.openSpan) {
      this.open = false;
      this.cycleT = 0;
      this.opening.reset();
      if (this.phase.key === 'watchfire') this.shedShards(op);
    }
  }

  /** Seconds of veiled drifting between rends (slower in the Watchfire, where the shards are the threat). */
  get rendEvery(): number {
    return this.phase.key === 'watchfire' ? this.tune.rend * 2 : this.tune.rend;
  }

  /** True while the rend's hooks are showing. */
  get rendTelling(): boolean {
    return !this.open && this.phase.key !== 'eye' && this.rendT >= this.rendEvery - 0.8;
  }

  /** True while the opening tell shows (the shroud trembles). */
  get openTelling(): boolean {
    return !this.open && this.phase.key !== 'eye' && this.opening.telling;
  }

  private rend(op: Operation, at: Vec, angle: number, len: number): void {
    const lac = new BossWound(at, angle, len, 0.5);
    if (!this.spawnAdd(op, lac)) return;
    attack(op, 'matins', 'rend', at);
    op.cues.push('cut');
    op.shake = Math.max(op.shake, 6);
  }

  /** Phase 2: each veil close sheds crawling shards that seek the wounds. */
  private shedShards(op: Operation): void {
    let n = 0;
    for (let i = 0; i < this.tune.shardsPerVeil; i++) {
      const a = op.rng.range(0, TAU);
      const p = { x: this.pos.x + Math.cos(a) * (this.radius + 10), y: this.pos.y + Math.sin(a) * (this.radius + 10) };
      if (this.spawnAdd(op, new MalisonShard(onBody(p) ? p : { ...this.pos }, op, 'crawler'))) n++;
    }
    this.shedLog.push(n);
    if (n) op.sayOnce('matins-shards', 'It’s shedding shards — they’re crawling for the wounds! Tongs — cast them out!');
  }

  /** Phase 3 (and the X1 remix): the eye's 3-beat pulse and its gaze lash. */
  private eye(op: Operation, dt: number): void {
    this.latency = (op.opts.audioOffset ?? 0) / 1000;
    const before = this.beat;
    this.eyeT += dt;
    if (this.eyeT >= this.eyeCycle) {
      this.eyeT -= this.eyeCycle;
      this.eyeCycles++;
    }
    const now = this.beat;
    if (now !== before) {
      if (now === 1) tell(op, 'matins', 'beat', this.pos);
      if (now === 1 || now === 2) op.cues.push('heartbeat');
      if (now === 3) {
        op.cues.push('heartbeat');
        attack(op, 'matins', 'beat', this.pos);
      }
      // The gaze: at rest, on every `gazeEvery`-th cycle, the eye locks onto the instrument.
      if (now === 0 && this.eyeCycles % this.tune.gazeEvery === this.tune.gazeEvery - 1 && !this.gaze) {
        const dx = op.pointer.x - this.pos.x;
        const dy = op.pointer.y - this.pos.y;
        const l = Math.hypot(dx, dy);
        const a = l > 1 ? Math.atan2(dy, dx) : op.rng.range(0, TAU);
        this.gaze = { dir: { x: Math.cos(a), y: Math.sin(a) }, t: leadFor(op, 'matins', 'gaze'), from: { ...this.pos } };
        tell(op, 'matins', 'gaze', this.pos);
        op.sayOnce('matins-gaze', 'The eye has fixed on your hand — move off its line!');
      }
    }
    if (this.gaze) {
      this.gaze.from = { ...this.pos };
      this.gaze.t -= dt;
      if (this.gaze.t <= 0) this.lash(op);
    }
  }

  /** The end of the gaze line (it reaches across the field). */
  gazeEnd(): Vec | null {
    if (!this.gaze) return null;
    return { x: this.pos.x + this.gaze.dir.x * 520, y: this.pos.y + this.gaze.dir.y * 520 };
  }

  /** Is `p` on the gaze line? */
  onGaze(p: Vec): boolean {
    const end = this.gazeEnd();
    return !!end && pointSegment(p, this.pos, end).d < 28;
  }

  private lash(op: Operation): void {
    const g = this.gaze!;
    const p = op.pointer;
    const hit = this.onGaze(p);
    this.gaze = null;
    if (!hit) {
      op.popup('Dodged', { ...p }, '#b9d7ff');
      return;
    }
    const at = onBody(p) ? { ...p } : { x: this.pos.x + g.dir.x * 90, y: this.pos.y + g.dir.y * 90 };
    this.rend(op, at, Math.atan2(g.dir.y, g.dir.x), 64);
    op.hurt(4, at);
    attack(op, 'matins', 'gaze', at);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (!this.vulnerable) {
      // Searing a shard that crawls across it is not a strike at the shroud.
      if (op.entities.some((e) => e !== this && e.branded && e.layer > this.layer)) return;
      if (this.phase.key === 'eye') {
        // Off the beat, the eye lashes back.
        const seg = this.eyeCycles * 4 + this.beat;
        if (seg !== this.offBeat) {
          this.offBeat = seg;
          op.rate('miss', this.pos, 'Off the beat');
          const at = { x: this.pos.x + op.rng.range(-40, 40), y: this.pos.y + this.radius + 20 };
          this.rend(op, onBody(at) ? at : { ...this.pos }, op.rng.range(0, TAU), 50);
          op.sayOnce('matins-offbeat', 'Only on the third beat, Doctor — when the eye is wide!');
        }
        return;
      }
      if (this.veiledMissT <= 0) {
        this.veiledMissT = 5;
        op.rate('miss', this.pos, 'Veiled');
        op.say('Wait for it to open.');
      }
      return;
    }
    const mult = this.beat === 3 && this.eyeOut ? this.tune.eyeMult : 1;
    const before = this.phaseIx;
    this.damage(op, this.tune.dps * mult * dt, ptr.pos);
    if (fxRandom() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (this.alive && this.phaseIx !== before) op.rate('good', this.pos, 'Wounded');
  }

  protected override onPhase(op: Operation, ix: number): void {
    this.open = false;
    this.cycleT = 0;
    this.opening.reset();
    this.rendT = 0;
    const key = this.phases[ix].key;
    if (key === 'watchfire') {
      // The Litany tutorial: the rite is taught when the curse turns vicious.
      op.flags.add('tutorial-litany');
      op.events.emit('boss', { kind: 'hud', flag: 'litany-tutorial', on: true });
      op.say('It’s quickening! Doctor — the Litany. Draw the star with the right hand and still the hour.');
    } else if (key === 'eye') {
      this.eyeT = 0;
      op.say('The shroud has burned away — an eye! Brand it on the third beat, and only then!');
    }
  }

  protected override onDeath(op: Operation): void {
    op.rate('cool', this.pos, 'Malison unmade');
    op.emit('blood', this.pos, 30, undefined, undefined, 200);
    if (!this.tune.phased) return;
    op.spawn(...[0, 1, 2].map((i) => new MalisonShard({ x: this.pos.x + Math.cos((i * TAU) / 3) * 50, y: this.pos.y + Math.sin((i * TAU) / 3) * 40 }, op)));
    op.say('It’s splitting apart! Seize every shard with the tongs and cast it out — before they rejoin!');
  }

  protected override deathLook(): [number, number] {
    return [0, this.radius * 4.4];
  }

  override drawSurface(g: Gfx): void {
    // The curse's corruption spreads through the flesh as it is wounded (BOS-0019).
    surfDisc(g, this.pos, this.radius * 1.8 + (1 - this.frac) * 140, 0.1, 0.4, 0.15, 0.6);
  }

  /**
   * The watching rhythm (ART-0232), 0..1: the room darkens in a pulse on each beat of the eye while
   * it is out, holds dim while the shroud is open, and barely breathes otherwise. The operation
   * scene feeds it to the lamp's surround darkness.
   */
  watching(elapsed: number): number {
    if (this.eyeOut) return 0.35 + 0.65 * Math.exp(-(this.eyeT % this.tune.beat) * 5);
    if (this.open) return 0.4;
    return 0.1 * (0.5 + 0.5 * Math.sin(elapsed * 1.2));
  }

  draw(g: Gfx, op: Operation): void {
    const r = this.radius;
    // Opening tell: the shroud trembles, and peels to an inner red glow.
    const tellK = !this.open && this.opening.telling ? Math.min(1, (this.opening.t - (this.tune.veil - this.opening.lead)) / this.opening.lead) : 0;
    const x = this.pos.x + (tellK > 0 ? Math.sin(op.elapsed * 55) * 2.5 * tellK : 0);
    const y = this.pos.y + (tellK > 0 ? Math.cos(op.elapsed * 47) * 1.5 * tellK : 0);
    let openness = this.open ? Math.min(1, this.cycleT * 4) : tellK * 0.25;
    if (this.eyeOut) {
      const b = this.beat;
      const within = this.eyeT % this.tune.beat;
      openness = b === 3 ? 1 : b === 0 ? 0.1 : 0.3 + 0.3 * Math.exp(-within * 6) * b;
      if (this.gaze) openness *= 0.6 + 0.4 * (this.gaze.t / 1); // the iris contracts
    }
    // The opening flash follows the flash-intensity slider (GAM-0239); shakes go through op.shake × the shake slider.
    const fl = presentation.flash;
    g.glow(x, y, r * 2.6, hex(this.vulnerable ? '#ff6030' : '#8030c0', 0.22 * (this.vulnerable ? fl : 1)));
    if (tellK > 0) g.glow(x, y, r * 1.6, hex('#ff2010', 0.35 * tellK * fl));
    g.creature(0, x, y, r * 4.4, { seed: this.id * 1.3, open: openness, health: this.frac, flash: this.hurtFlash });
    // Rend tell: the shroud's edge sharpens into hooks.
    if (this.rendTelling) {
      const k = Math.min(1, (this.rendT - (this.rendEvery - 0.8)) / 0.3);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + op.elapsed * 0.6;
        const p0 = { x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 };
        const p1 = { x: x + Math.cos(a + 0.18) * (r + 16 * k), y: y + Math.sin(a + 0.18) * (r + 16 * k) };
        const p2 = { x: x + Math.cos(a + 0.34) * (r + 8 * k), y: y + Math.sin(a + 0.34) * (r + 8 * k) };
        g.polyline([p0, p1, p2], 2.5, hex('#1a0820', 0.9 * k));
      }
    }
    // The gaze line, tightening as it locks.
    if (this.gaze) {
      const end = this.gazeEnd()!;
      const k = 1 - this.gaze.t;
      g.dashed([this.pos, end], 2 + 3 * k, hex('#ff3020', 0.35 + 0.5 * k), 10, 8, op.elapsed * 60);
    }
    // Beats of the eye: three pips, the third gilt.
    if (this.eyeOut) {
      for (let i = 1; i <= 3; i++) {
        const lit = this.beat >= i || this.beat === 0 ? this.beat !== 0 && this.beat >= i : false;
        g.circle(x - 16 + (i - 1) * 16, y - r - 22, lit ? 5 : 3.5, hex(i === 3 ? '#ffd070' : '#e08060', lit ? 0.95 : 0.35));
      }
    }
    g.arc(x, y, r + 14, 3, this.vulnerable ? hex('#ff8040', 0.9) : hex('#b478ff', 0.5), this.frac);
  }
}

/**
 * A fragment of the Malison. Drag it off the body with tongs. A fragment of a
 * broken Malison rejoins if left; a crawler (shed in the Watchfire) seeks the
 * nearest wound and feeds on it.
 */
export class MalisonShard extends Entity {
  private grabbed = false;
  private life = 9;
  /** A crawler first worms about for a moment before it scents a wound. */
  emerge = 2.5;
  private vel: Vec;
  constructor(
    pos: Vec,
    op: Operation,
    public mode: 'fragment' | 'crawler' = 'fragment',
  ) {
    super(pos);
    this.layer = 7;
    const a = op.rng.range(0, TAU);
    this.vel = { x: Math.cos(a) * 60, y: Math.sin(a) * 60 };
  }

  override drain(): number {
    return this.mode === 'crawler' ? 0.2 : 0.5;
  }

  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
    if (this.grabbed) return;
    if (this.mode === 'crawler') return this.crawl(op, dt);
    this.life -= dt;
    const next = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };
    if (onBody(next)) this.pos = next;
    else this.vel = { x: -this.vel.x, y: -this.vel.y };
    if (this.life <= 0) {
      // The shards rejoin into a weakened Malison.
      const rest = op.entities.filter((e): e is MalisonShard => e instanceof MalisonShard && e.alive && e.mode === 'fragment');
      for (const s of rest) s.kill();
      op.spawn(new Malison({ ...this.pos }, op, 'matins', 20 + 15 * rest.length, { phased: false }));
      op.rate('miss', this.pos, 'It rejoined');
      op.hurt(10, this.pos);
    }
  }

  /** The wound this crawler is heading for. */
  prey(op: Operation): Laceration | null {
    let best: Laceration | null = null;
    let bd = Infinity;
    for (const e of op.entities) {
      if (!(e instanceof Laceration) || !e.alive) continue;
      const d = dist(e.pos, this.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private crawl(op: Operation, dt: number): void {
    this.emerge = Math.max(0, this.emerge - dt);
    const w = this.emerge > 0 ? null : this.prey(op);
    if (!w) {
      // No wound to feed on: wander.
      const next = { x: this.pos.x + this.vel.x * 0.4 * dt, y: this.pos.y + this.vel.y * 0.4 * dt };
      if (onBody(next)) this.pos = next;
      else this.vel = { x: -this.vel.x, y: -this.vel.y };
      return;
    }
    const d = dist(w.pos, this.pos);
    if (d < 10) {
      // It sinks into the wound and feeds.
      this.kill();
      op.hurt(4, w.pos);
      op.emit('blood', w.pos, 10);
      op.rate('miss', w.pos, 'It fed');
      return;
    }
    const sp = 22;
    this.pos = { x: this.pos.x + ((w.pos.x - this.pos.x) / d) * sp * dt, y: this.pos.y + ((w.pos.y - this.pos.y) / d) * sp * dt };
  }

  /** A crawler can also be seared where it creeps (brand held 0.3 s). */
  heat = 0;
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (this.mode !== 'crawler' || tool !== 'brand' || dist(ptr.pos, this.pos) > 22) return;
    this.branded = true;
    this.heat += dt;
    if (fxRandom() < dt * 20) op.emit('spark', this.pos, 2);
    if (this.heat >= 0.3) {
      this.kill();
      op.cues.push('burn');
      op.emit('smoke', this.pos, 3);
      rateAdd(op, 'cool', this.pos, 'Seared');
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
      if (this.mode === 'crawler') rateAdd(op, 'cool', ptr.pos, 'Cast out');
      else op.rate('cool', ptr.pos, 'Cast out');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const { x, y } = this.pos;
    const flick = 0.6 + 0.4 * Math.sin(op.elapsed * 15 + this.id);
    g.glow(x, y, 40, hex(this.mode === 'crawler' ? '#ff5060' : '#b060ff', 0.3 + 0.1 * flick));
    // A knot of curse-thread (ART-0228): three knot shapes, drifting; its burst plays in the scene's VanishFx.
    threadKnotArt(g, this.pos, 14, { shape: this.id % 3, crawler: this.mode === 'crawler', seed: this.id });
    if (this.mode === 'fragment') g.arc(x, y, 24, 3, hex('#ffc878', 0.7), this.life / 9);
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
