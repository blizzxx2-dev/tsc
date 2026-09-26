
import { fxRandom } from '../fxRandom';
import { dist, pointSegment, segmentsIntersect, type Vec } from '../../core/math';
import { Entity } from '../entity';
import { FIELD, onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';
import { InjectionWatch, randomOnBody, samplePath, stepToward, TAU } from './common';
import { Voice } from './voices';
import { attack, bossSound, leadFor, tell } from './signals';

export interface VespersTuning {
  hp: number;
  lamps: number;
  /** Seconds for a lamp to burn down from full to out. */
  dimTime: number;
  /** Seconds of brand to relight a lamp. */
  relight: number;
  /** Phase 2: seconds between snuffings (two lamps at once), and the gutter tell before. */
  snuffEvery: number;
  snuffTell: number;
  /** Brand damage per second on the body (phase 2). */
  dps: number;
  filaments: number;
  /** Lamps lit at the start (X-op "Every Lamp Out" starts at 1). */
  startLit?: number;
}

export const VESPERS_DEFAULT: VespersTuning = { hp: 100, lamps: 4, dimTime: 15, relight: 0.3, snuffEvery: 12, snuffTell: 1, dps: 10, filaments: 6 };

/** Which quadrant of the field a point lies in (0 TL, 1 TR, 2 BL, 3 BR). */
export const quadrantOf = (p: Vec): number => (p.x < FIELD.cx ? 0 : 1) + (p.y < FIELD.cy ? 0 : 2);

/** A lamp-node of the ward, lighting one quadrant of the field. It burns down; the brand relights it. */
export class LampNode extends Entity {
  light = 1;
  heat = 0;
  /** Seconds of gutter before a snuffing (the tell). */
  gutterT = 0;
  wander: Vec | null = null;
  constructor(
    pos: Vec,
    public quadrant: number,
    public dimTime: number,
    private relight: number,
  ) {
    super(pos);
    this.required = false;
    this.layer = 7;
  }
  get lit(): boolean {
    return this.light > 0;
  }
  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
    this.light = Math.max(0, this.light - dt / this.dimTime);
    if (this.gutterT > 0) {
      this.gutterT -= dt;
      if (this.gutterT <= 0) {
        this.light = 0;
        op.emit('smoke', this.pos, 5);
        attack(op, 'vespers', 'snuff', this.pos);
      }
    }
    if (this.wander) {
      if (dist(this.pos, this.wander) < 8) this.wander = randomOnBody(op, 0.55, 0.45);
      this.pos = stepToward(this.pos, this.wander, 30, dt);
      this.quadrant = quadrantOf(this.pos);
    }
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > 26) return;
    this.branded = true;
    this.heat += dt;
    if (this.heat >= this.relight && this.light < 0.97) {
      const wasOut = this.light < 0.35;
      this.light = 1;
      this.gutterT = 0;
      this.heat = 0;
      op.emit('spark', this.pos, 8);
      if (wasOut) op.rate('good', this.pos, 'Relit');
      else op.popup('Trimmed', this.pos, '#f5d76e');
    }
  }
}

/** A wick-filament threaded through a vessel. Sever it with a lancet stroke across; it bleeds tallow. */
export class WickFilament extends Entity {
  constructor(
    public a: Vec,
    public b: Vec,
    private owner: VespersMalison | null,
  ) {
    super({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    this.layer = 2;
  }
  override drain(): number {
    return 0.15;
  }
  override onReveal(): void {
    // The lens cannot see through the dark; only lamplight shows the wicks.
  }
  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    return tool === 'lancet' && pointSegment(ptr.pos, this.a, this.b).d < 22;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || !segmentsIntersect(ptr.prev, ptr.pos, this.a, this.b)) return;
    this.kill();
    op.cues.push('cut');
    op.rate('cool', this.pos, 'Wick severed');
    op.spawn(new TallowClot({ ...this.pos }));
    this.owner?.severed(op);
  }
}

/** Blood set like tallow. Soften it with a quick touch of the brand, then draw it off with the leech-pipe. */
export class TallowClot extends Entity {
  softened = false;
  heat = 0;
  draw_ = 0;
  scorched = false;
  constructor(
    pos: Vec,
    public r = 20,
  ) {
    super(pos);
    this.layer = 4;
  }
  override drain(): number {
    return 0.1;
  }
  override update(_op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt * 0.5);
    this.branded = false;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (dist(ptr.pos, this.pos) > this.r + 8) return;
    if (tool === 'brand') {
      this.branded = true;
      this.heat += dt;
      if (!this.softened && this.heat >= 0.3) {
        this.softened = true;
        op.popup('Softened', this.pos, '#ffd080');
      }
      if (this.heat > 1.2 && !this.scorched) {
        this.scorched = true;
        op.rate('bad', this.pos, 'Scorched');
        op.hurt(3, this.pos);
        op.sayOnce('tallow-scorch', 'Gently! A touch of heat, not a searing!');
      }
    } else if (tool === 'leech') {
      if (!this.softened) {
        op.sayOnce('tallow-hard', 'It’s set hard as a candle — warm it with the brand first.');
        return;
      }
      this.draw_ += dt;
      if (this.draw_ >= 0.9) {
        this.kill();
        op.cues.push('squelch');
        op.rate(this.scorched ? 'good' : 'cool', this.pos, 'Tallow drawn');
      }
    }
  }
}

/**
 * The Malison of Vespers — "the Lamp-Lighting". Wick-filaments threaded
 * through the host's vessels turn her blood to tallow, and the ward's light
 * dies with her. Four lamp-nodes light the four quadrants of the field; each
 * burns down and must be relit with the brand, and the dark hides the wicks.
 * Phase 1 "Lucernarium": sever the filaments and draw off the tallow. Phase 2
 * "Magnificat": its body wanders the field and snuffs two lamps at once; it can
 * only be branded where lamplight falls on it. Phase 3 "Last Light": one lamp
 * remains and wanders; trace the wick back to its root and excise it.
 */
export class VespersMalison extends Entity {
  // An Hour: the operation treats it as a boss (banner, time bonus, checkpoints, phase hints).
  override boss = true;
  private voice = new Voice('vespers', 9, '#ffe0a0');
  hp: number;
  readonly maxHp: number;
  stage: 1 | 2 | 3 = 1;
  lamps: LampNode[] = [];
  filaments: WickFilament[] = [];
  private snuffT = 0;
  private hymnT = 0;
  private target: Vec;
  hurtFlash = 0;
  private watch = new InjectionWatch();
  /** Phase 3: the wick back to the root, and how much of it has been traced. */
  wick: Vec[] = [];
  wickSamples: Vec[] = [];
  traced: boolean[] = [];
  private tracing = false;
  rootBare = false;

  constructor(
    pos: Vec,
    op: Operation,
    public tune: VespersTuning = VESPERS_DEFAULT,
  ) {
    super(pos);
    this.layer = 3;
    this.hp = this.maxHp = tune.hp;
    this.target = { ...pos };
    const corners = [
      { x: -0.45, y: -0.5 },
      { x: 0.45, y: -0.5 },
      { x: -0.45, y: 0.5 },
      { x: 0.45, y: 0.5 },
    ];
    for (let q = 0; q < tune.lamps; q++) {
      const c = corners[q % 4];
      const l = new LampNode({ x: FIELD.cx + c.x * FIELD.rx, y: FIELD.cy + c.y * FIELD.ry }, q % 4, tune.dimTime, tune.relight);
      if (tune.startLit !== undefined && q >= tune.startLit) l.light = 0;
      else l.light = 1 - q * 0.18;
      this.lamps.push(l);
      op.spawn(l);
    }
    // Filaments hide only where a lamp can light them (the X7 remix has three lamps, so one quadrant stays empty).
    const lampQuadrants = [...new Set(this.lamps.map((l) => l.quadrant))];
    for (let i = 0; i < tune.filaments; i++) this.addFilament(op, lampQuadrants[i % lampQuadrants.length]);
  }

  get radius(): number {
    return 24 + 10 * (this.hp / this.maxHp);
  }

  get living(): WickFilament[] {
    return this.filaments.filter((f) => f.alive);
  }

  /** Is this point lit by any lamp? */
  litAt(p: Vec): boolean {
    const q = quadrantOf(p);
    if (this.stage === 3) return this.lamps.some((l) => l.alive && l.lit && dist(l.pos, p) < 200);
    return this.lamps.some((l) => l.alive && l.lit && l.quadrant === q);
  }

  get bodyLit(): boolean {
    return this.litAt(this.pos);
  }

  override drain(): number {
    return 0.3;
  }

  private addFilament(op: Operation, q: number): void {
    const sx = q % 2 === 0 ? -1 : 1;
    const sy = q < 2 ? -1 : 1;
    for (let i = 0; i < 20; i++) {
      const c = { x: FIELD.cx + sx * op.rng.range(0.12, 0.62) * FIELD.rx, y: FIELD.cy + sy * op.rng.range(0.12, 0.6) * FIELD.ry };
      const a = op.rng.range(0, TAU);
      const h = { x: Math.cos(a) * 34, y: Math.sin(a) * 34 };
      const f = new WickFilament({ x: c.x - h.x, y: c.y - h.y }, { x: c.x + h.x, y: c.y + h.y }, this);
      if (!onBody(f.a) || !onBody(f.b) || quadrantOf(f.a) !== q || quadrantOf(f.b) !== q) continue;
      if (this.lamps.some((l) => dist(l.pos, c) < 50) || this.living.some((o) => dist(o.pos, c) < 70)) continue;
      this.filaments.push(f);
      op.spawn(f);
      return;
    }
  }

  severed(op: Operation): void {
    if (this.stage !== 1) return;
    this.hp -= (this.maxHp * 0.4) / this.tune.filaments;
    this.hurtFlash = 1;
    if (this.hp <= this.maxHp * 0.6 + 0.01) this.enterMagnificat(op);
  }

  private enterMagnificat(op: Operation): void {
    this.stage = 2;
    this.hp = this.maxHp * 0.6;
    this.snuffT = this.tune.snuffEvery;
    this.target = randomOnBody(op, 0.5, 0.4);
    op.say('Its body is out of the dark — brand it only where the lamplight falls on it!');
    op.cues.push('bell');
  }

  private enterLastLight(op: Operation): void {
    this.stage = 3;
    this.hp = this.maxHp * 0.25;
    // All but one lamp gutter out; the last one wanders.
    const keep = this.lamps.find((l) => l.alive) ?? this.lamps[0];
    for (const l of this.lamps) if (l !== keep) l.kill();
    keep.light = 1;
    keep.dimTime = this.tune.dimTime * 0.66;
    keep.wander = randomOnBody(op, 0.5, 0.4);
    for (const f of this.filaments) f.kill();
    // The wick runs from the body back to its root.
    const root = { x: FIELD.cx + (this.pos.x < FIELD.cx ? 1 : -1) * 0.5 * FIELD.rx, y: FIELD.cy + op.rng.range(-0.3, 0.3) * FIELD.ry };
    const mid = { x: (this.pos.x + root.x) / 2 + op.rng.range(-30, 30), y: (this.pos.y + root.y) / 2 + op.rng.range(-60, 60) };
    this.wick = [{ ...this.pos }, mid, root];
    this.wickSamples = samplePath(this.wick, 10);
    this.traced = this.wickSamples.map(() => false);
    op.say('One light left… Trace its wick back to the root with the lancet — keep that lamp burning!');
    op.cues.push('bell');
  }

  get root(): Vec {
    return this.wick[this.wick.length - 1];
  }

  get traceFraction(): number {
    return this.traced.length ? this.traced.filter(Boolean).length / this.traced.length : 0;
  }

  override update(op: Operation, dt: number): void {
    this.voice.tick(op, dt, this.pos);
    this.branded = false;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    // Evening hymn (BOS-0113): each lit lamp adds a harmonic to the music.
    this.hymnT -= dt;
    if (this.hymnT <= 0) {
      this.hymnT = 0.5;
      const lit = this.lamps.filter((l) => l.alive && l.lit).length;
      op.events.emit('boss', { kind: 'music', boss: 'vespers', intensity: this.stage as 1 | 2 | 3, layers: lit });
      op.events.emit('boss', { kind: 'ambience', id: 'vespers-hymn', pan: 0, gain: 1, layers: lit });
    }
    // The dark hides the wicks.
    for (const f of this.living) f.hidden = !this.litAt(f.pos);
    // Tallow blood: the tincture is only half as strong while three or more clots remain.
    if (this.watch.check(op) && op.entities.filter((e) => e instanceof TallowClot && e.alive).length >= 3) {
      op.vitals = Math.max(1, op.vitals - 12.5);
      op.sayOnce('tallow-tincture', 'The tincture barely takes — the tallow is thickening the blood. Draw the clots!');
    }
    if (this.stage === 1) {
      if (this.lamps.some((l) => !l.lit)) op.sayOnce('vespers-dark', 'A lamp is out — the wicks hide in the dark. Relight it with the brand!');
      return;
    }
    if (this.stage === 2) {
      if (dist(this.pos, this.target) < 8) this.target = randomOnBody(op, 0.55, 0.45);
      this.pos = stepToward(this.pos, this.target, 26, dt);
      this.snuffT -= dt;
      const lead = Math.max(this.tune.snuffTell, leadFor(op, 'vespers', 'snuff'));
      if (this.snuffT <= lead && !this.lamps.some((l) => l.gutterT > 0)) {
        const lit = this.lamps.filter((l) => l.lit);
        for (let i = 0; i < 2 && lit.length; i++) {
          const l = lit.splice(Math.floor(op.rng.next() * lit.length), 1)[0];
          // Snuff tell (BOS-0111): the flame gutters and leans, and hisses.
          l.gutterT = lead;
          tell(op, 'vespers', 'snuff', l.pos);
          bossSound(op, 'hiss', l.pos);
        }
        op.sayOnce('vespers-snuff', 'The lamps are guttering — it’s snuffing them!');
      }
      if (this.snuffT <= 0) this.snuffT = this.tune.snuffEvery;
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.stage !== 2 || dist(ptr.pos, this.pos) > this.radius) return;
    this.branded = true;
    if (!this.bodyLit) {
      op.sayOnce('vespers-shadow', 'You can’t see it to burn it — light the lamp in that quarter!');
      return;
    }
    this.hp -= this.tune.dps * dt;
    this.hurtFlash = 1;
    if (fxRandom() < dt * 25) op.emit('spark', ptr.pos, 3);
    if (op.rng.next() < dt * 6) op.cues.push('burn');
    if (this.hp <= this.maxHp * 0.25) this.enterLastLight(op);
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.stage !== 3 || tool !== 'lancet') return false;
    if (this.rootBare && dist(ptr.pos, this.root) < 24) {
      this.die(op);
      return true;
    }
    if (dist(ptr.pos, this.wick[0]) < 30 && this.litAt(ptr.pos)) {
      this.tracing = true;
      return true;
    }
    return false;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (!this.tracing || tool !== 'lancet') return;
    for (let k = 0; k < this.wickSamples.length; k++) if (!this.traced[k] && pointSegment(this.wickSamples[k], ptr.prev, ptr.pos).d < 16) this.traced[k] = true;
    if (!this.rootBare && this.traceFraction >= 0.75) {
      this.rootBare = true;
      this.tracing = false;
      op.rate('cool', this.root, 'Wick traced');
      op.say('There’s the root — excise it!');
    }
  }

  override onRelease(): void {
    this.tracing = false;
  }

  override kill(): void {
    super.kill();
    for (const l of this.lamps) l.kill();
    for (const f of this.filaments) f.kill();
  }

  private die(op: Operation): void {
    this.kill();
    op.cues.push('cut');
    op.rate('cool', this.root, 'Vespers unmade');
    op.shake = 14;
    op.emit('smoke', this.root, 20);
    op.emit('mote', this.pos, 40, undefined, undefined, 120);
    op.say('The root is out. The lamps… the ward’s own lamps are catching again.');
  }
}
