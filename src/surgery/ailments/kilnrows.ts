/**
 * Ailments of Chapter III (the Kilnrows, the quarantine, the guildhall):
 * horn-buds, doublet wadding and wound-fever, lead in the blood, the saw,
 * gut-worms, a thrashing penitent and an Inquisitor's rotten molar.
 */
import type { TinctureColor } from '../progress';
import { dist, pointSegment, type Vec } from '../../core/math';
import { Entity } from '../entity';
import { BloodPool, Embedded, Laceration, Sigil, SIGILS, StitchLine } from '../entities';
import { onBody, type Operation, type PhaseDef } from '../operation';
import type { Pointer, ToolId } from '../types';

export const TAU = Math.PI * 2;

// ============================================================ tincture sites

/**
 * Anything cured by holding the tincture on it: lead deposits (a chelating
 * draught), a worm-fever (an anthelmintic), wound-fever. Optionally hidden
 * until the Scrying Lens finds it; optionally leaves bile to draw off.
 */
export class TinctureSite extends Entity {
  holdT = 0;
  constructor(
    pos: Vec,
    public label: string,
    public holdTime = 1.0,
    public drainRate = 0.3,
    public color = '#8a8a90',
    public leaves: 'blackbile' | 'pus' | null = null,
    /** The tincture colour it answers to (CON-0109); any colour when unset. */
    public needs: TinctureColor | null = null,
  ) {
    super(pos);
    this.layer = 1;
  }
  override drain(): number {
    return this.drainRate;
  }
  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 28) return false;
    this.holdT = 0;
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 32) return;
    if (this.needs && op.tinctureColor !== this.needs) {
      op.sayOnce(`tincture-${this.needs}`, `Not that draught — the ${this.needs} one. Turn the wheel with the tincture held to change it.`);
      return;
    }
    this.holdT += dt;
    if (this.holdT >= this.holdTime) {
      this.kill();
      op.cues.push('inject');
      op.rate('good', this.pos, this.label);
      if (this.leaves) op.spawn(new BloodPool({ ...this.pos }, 24, this.leaves));
    }
  }
  override onRelease(): void {
    this.holdT = 0;
  }
}

/** Lead laid down in the flesh of a bell-founder: grey veins seen only through the lens. The green (chelating) tincture lifts it as grey bile (CON-0108). */
export const leadDeposit = (pos: Vec): TinctureSite => {
  const s = new TinctureSite(pos, 'Lead lifted', 1.0, 0.3, '#9098a4', 'blackbile', 'green');
  s.hidden = true;
  return s;
};

// ============================================================ horn-bud (trepanation)

/**
 * A horn-bud on a child's skull. Drill the bone with the lancet held in place
 * (1.5 s; past 3 s the bone overheats), lift the bone disc with the tongs,
 * then excise the bud. A Choir sigil lies beneath it and must be seared out.
 */
/**
 * A horn-bud certified natural (CON-0103): not cut, only dressed. Hold the salve on it to soothe the
 * scalp around it; the lancet has no business here. Scored on care alone — as much as the excision.
 */
export class DressedBud extends Entity {
  holdT = 0;
  private soothed = false;
  readonly need = 1.6;

  constructor(pos: Vec) {
    super(pos);
    this.layer = 3;
  }

  override drain(): number {
    return 0.08;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (dist(ptr.pos, this.pos) > 30) return false;
    if (tool === 'lancet') {
      op.rate('bad', this.pos, 'Cut a natural growth');
      op.sayOnce('bud-natural', 'Doctor — the certificate says natural. We leave it. Dress it, don’t cut it.');
      return true;
    }
    return tool === 'salve';
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'salve') return;
    if (dist(ptr.pos, this.pos) > 34) {
      this.holdT = Math.max(0, this.holdT - dt * 2);
      return;
    }
    this.holdT += dt;
    if (!this.soothed && this.holdT >= this.need / 2) {
      this.soothed = true;
      op.rate('good', this.pos, 'Scalp soothed');
    }
    if (this.holdT >= this.need) {
      this.kill();
      op.rate('cool', this.pos, 'Bud dressed');
      op.rate('cool', this.pos, 'Left in peace');
    }
  }
}

export class HornBud extends Entity {
  state: 'drill' | 'disc' | 'bud' = 'drill';
  drillT = 0;
  private drilling = false;
  discPos: Vec;
  private lifting = false;
  private overheated = false;

  constructor(
    pos: Vec,
    public withSigil = true,
  ) {
    super(pos);
    this.layer = 3;
    this.discPos = { ...pos };
  }

  override drain(): number {
    return 0.15;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    const d = dist(ptr.pos, this.pos);
    if (this.state === 'drill' && tool === 'lancet' && d < 26) {
      this.drilling = true;
      op.cues.push('cut');
      return true;
    }
    if (this.state === 'disc' && tool === 'tongs' && dist(ptr.pos, this.discPos) < 24) {
      this.lifting = true;
      op.cues.push('pluck');
      return true;
    }
    if (this.state === 'bud' && tool === 'lancet' && d < 20) {
      this.kill();
      op.cues.push('cut');
      op.emit('blood', this.pos, 8);
      op.rate('cool', this.pos, 'Bud excised');
      if (this.withSigil) {
        op.spawn(new Sigil({ ...this.pos }, SIGILS.eye, 26, 6));
        op.sayOnce('hornbud-sigil', 'There’s a sigil beneath the bud — the Choir’s mark. Sear it out.');
      }
      op.spawn(new Laceration({ ...this.pos }, 0.3, 34, 0.4));
      return true;
    }
    return false;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (this.drilling && tool === 'lancet' && dist(ptr.pos, this.pos) < 30) {
      this.drillT += dt;
      if (op.rng.next() < dt * 8) op.emit('dust', this.pos, 2);
      if (this.drillT > 3 && !this.overheated) {
        this.overheated = true;
        op.rate('bad', this.pos, 'Overheated');
        op.hurt(4, this.pos);
        // The sigil beneath shudders at the drill and splits the scalp.
        op.spawn(new Laceration({ x: this.pos.x + 30, y: this.pos.y + 10 }, 1.2, 40, 0.6));
        op.sayOnce('hornbud-hot', 'Too long — the bone is scorching! Ease off the drill!');
      }
    } else if (this.lifting && tool === 'tongs') this.discPos = { ...ptr.pos };
  }

  override onRelease(op: Operation): void {
    if (this.drilling) {
      this.drilling = false;
      if (this.drillT >= 1.5) {
        this.state = 'disc';
        if (!this.overheated) op.rate('cool', this.pos, 'Bone cut');
        op.sayOnce('hornbud-disc', 'The disc is loose. Lift it out with the tongs.');
      }
    }
    if (this.lifting) {
      this.lifting = false;
      if (dist(this.discPos, this.pos) > 60) {
        this.state = 'bud';
        op.rate('good', this.discPos, 'Bone lifted');
      } else this.discPos = { ...this.pos };
    }
  }
}

// ============================================================ wadding and wound-fever

/** A scrap of doublet cloth carried in with the ball. Seen only through the lens; pull it with the tongs. Left behind, it festers. */
export class ClothFragment extends Entity {
  private grabbed = false;
  private origin: Vec;
  constructor(pos: Vec) {
    super(pos);
    this.origin = { ...pos };
    this.hidden = true;
    this.required = false;
    this.layer = 3;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 18) return false;
    this.grabbed = true;
    op.cues.push('pluck');
    return true;
  }
  override onDrag(_op: Operation, ptr: Pointer): void {
    if (this.grabbed) this.pos = { ...ptr.pos };
  }
  override onRelease(op: Operation): void {
    this.grabbed = false;
    if (dist(this.pos, this.origin) > 50) {
      this.kill();
      op.rate('cool', this.pos, 'Wadding out');
    } else this.pos = { ...this.origin };
  }
}

/** Wound-fever from cloth left in a wound: a heavy drain until broken with two draughts of tincture. */
export class WoundFever extends TinctureSite {
  doses = 0;
  constructor(pos: Vec) {
    super(pos, 'Fever breaking', 1.0, 0.8, '#d07040');
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 32) return;
    if (this.needs && op.tinctureColor !== this.needs) {
      op.sayOnce(`tincture-${this.needs}`, `Not that draught — the ${this.needs} one. Turn the wheel with the tincture held to change it.`);
      return;
    }
    this.holdT += dt;
    if (this.holdT >= this.holdTime) {
      this.holdT = 0;
      this.doses++;
      op.cues.push('inject');
      if (this.doses >= 2) {
        this.kill();
        op.rate('good', this.pos, 'Fever broken');
      } else op.popup('One more draught', this.pos, '#9fd3a8');
    }
  }
}

/**
 * The phase after closing: any cloth left in the wound festers into a fever.
 * (If none was left, this phase is empty and the operation completes.)
 */
export const woundFeverPhase = (): PhaseDef => ({
  spawn(op: Operation) {
    const left = op.entities.filter((e): e is ClothFragment => e instanceof ClothFragment && e.alive);
    if (!left.length) return [];
    for (const c of left) c.kill();
    op.say('He’s burning up — there was cloth left in that wound. Tincture, twice, to break the fever!');
    op.rate('miss', left[0].pos, 'Wadding left in');
    return [new WoundFever({ ...left[0].pos })];
  },
});

// ============================================================ amputation

/** A bleeding vessel on a fresh stump: sear it with the brand (quick, costly) or ligate it with thread (slow, clean). */
export class Vessel extends Entity {
  readonly stitch: StitchLine;
  heat = 0;
  constructor(
    pos: Vec,
    public angle: number,
  ) {
    super(pos);
    this.layer = 4;
    const dx = Math.cos(angle) * 14;
    const dy = Math.sin(angle) * 14;
    this.stitch = new StitchLine(
      [
        { x: pos.x - dx, y: pos.y - dy },
        { x: pos.x + dx, y: pos.y + dy },
      ],
      2,
    );
  }
  override drain(): number {
    return 0.35;
  }
  override update(op: Operation, dt: number): void {
    if (!this.branded) this.heat = Math.max(0, this.heat - dt);
    this.branded = false;
    if (op.rng.next() < dt * 0.4) op.emit('blood', this.pos, 2, undefined, undefined, 50);
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'thread') {
      if (pointSegment(ptr.pos, this.stitch.points[0], this.stitch.points[1]).d > 30) return;
      if (this.stitch.sweep(op, ptr)) {
        this.kill();
        op.rate('cool', this.pos, 'Ligated');
      }
    } else if (tool === 'brand' && dist(ptr.pos, this.pos) < 18) {
      this.branded = true;
      this.heat += dt;
      if (this.heat >= 0.5) {
        this.kill();
        op.cues.push('burn');
        op.emit('smoke', this.pos, 4);
        op.hurt(5, this.pos);
        op.rate('good', this.pos, 'Seared shut');
        op.sayOnce('vessel-sear', 'Quick — but the brand costs him. A ligature is kinder, if you have the time.');
      }
    }
  }
}

/**
 * A shattered limb that must come off. Saw across the marked line with the
 * lancet, back and forth (six strokes); then tie off or sear the vessels.
 */
export class Amputation extends Entity {
  strokes = 0;
  private sawing = false;
  private lastDir = 0;
  private run = 0;
  private lastT = 0;
  constructor(
    public a: Vec,
    public b: Vec,
    public vessels = 3,
    public need = 6,
  ) {
    super({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    this.layer = 1;
  }
  override drain(): number {
    return 0.3;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || pointSegment(ptr.pos, this.a, this.b).d > 20) return false;
    this.sawing = true;
    this.lastDir = 0;
    this.run = 0;
    this.lastT = pointSegment(ptr.pos, this.a, this.b).t;
    op.cues.push('cut');
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (!this.sawing || tool !== 'lancet') return;
    const ps = pointSegment(ptr.pos, this.a, this.b);
    if (ps.d > 34) return;
    const len = dist(this.a, this.b);
    const dt = ps.t - this.lastT;
    this.lastT = ps.t;
    if (Math.abs(dt) < 1e-4) return;
    const dir = Math.sign(dt);
    if (dir !== this.lastDir && this.lastDir !== 0) this.run = 0;
    this.lastDir = dir;
    this.run += Math.abs(dt) * len;
    if (this.run >= 40) {
      this.run = -1e9; // one stroke per direction
      this.strokes++;
      op.cues.push('cut');
      op.emit('dust', ptr.pos, 3);
      op.hurt(1);
      if (this.strokes >= this.need) this.finish(op);
    }
  }
  override onRelease(): void {
    this.sawing = false;
  }
  private finish(op: Operation): void {
    this.kill();
    op.rate('good', this.pos, 'Limb off');
    op.shake = 8;
    op.emit('blood', this.pos, 20);
    const n = this.vessels;
    const ang = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x);
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      op.spawn(new Vessel({ x: this.a.x + (this.b.x - this.a.x) * f, y: this.a.y + (this.b.y - this.a.y) * f + (i % 2 ? 14 : -14) }, ang + Math.PI / 2));
    }
    op.say('It’s off. Now the vessels — tie them with thread, or sear them if he can bear it.');
  }
}

// ============================================================ gut-worms

/**
 * A gut-worm with its head showing. Seize the head with the tongs and draw it
 * out slowly (140 px); pull faster than 260 px/s and it tears — the torn worm
 * slips back and regrows its length in 8 s.
 */
export class Worm extends Entity {
  private grabbed = false;
  readonly origin: Vec;
  readonly dir: Vec;
  pulled = 0;
  tension = 0;
  regrowT = 0;
  private lastPos: Vec;
  constructor(
    pos: Vec,
    angle: number,
    public length = 140,
    public regrow = 8,
    public tearSpeed = 260,
  ) {
    super(pos);
    this.origin = { ...pos };
    this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
    this.lastPos = { ...pos };
    this.layer = 5;
  }
  get torn(): boolean {
    return this.regrowT > 0;
  }
  override drain(): number {
    return 0.25;
  }
  override update(_op: Operation, dt: number): void {
    if (this.regrowT > 0) this.regrowT = Math.max(0, this.regrowT - dt);
    if (!this.grabbed) this.tension = Math.max(0, this.tension - dt * 2);
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.torn || dist(ptr.pos, this.pos) > 18) return false;
    this.grabbed = true;
    this.lastPos = { ...ptr.pos };
    op.cues.push('pluck');
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, _tool: ToolId, dt: number): void {
    if (!this.grabbed) return;
    const moved = dist(ptr.pos, this.lastPos);
    this.lastPos = { ...ptr.pos };
    const speed = dt > 0 ? moved / dt : 0;
    this.tension += (speed / this.tearSpeed - this.tension) * Math.min(1, dt * 10);
    this.pos = { ...ptr.pos };
    this.pulled = Math.max(this.pulled, dist(this.pos, this.origin));
    if (this.tension > 1) {
      this.grabbed = false;
      this.tension = 0;
      this.pulled = 0;
      this.pos = { ...this.origin };
      this.regrowT = this.regrow;
      op.rate('bad', this.origin, 'Torn');
      op.hurt(3, this.origin);
      op.sayOnce('worm-torn', 'It tore! The head’s gone back in — it will grow its length again. Slowly, next time.');
      return;
    }
    if (this.pulled >= this.length) {
      this.kill();
      op.rate('cool', this.pos, 'Drawn out whole');
      op.emit('blood', this.origin, 4);
    }
  }
  override onRelease(): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.pos = { ...this.origin };
    this.pulled = 0;
  }
}

// ============================================================ agitation

/**
 * A penitent who will not lie still. Agitation climbs over time and with
 * every extraction; past 70 % he thrashes — the field shakes and the jolts
 * open new cuts. Hold the tincture on him (his brow) to calm him.
 */
export class Agitation extends Entity {
  level = 0.2;
  calmT = 0;
  private joltT = 0;
  private lastCount = -1;
  constructor(
    pos: Vec,
    public rise = 0.035,
    public perExtraction = 0.25,
  ) {
    super(pos);
    this.required = false;
    this.layer = 8;
  }
  get thrashing(): boolean {
    return this.level > 0.7;
  }
  override update(op: Operation, dt: number): void {
    const count = op.entities.filter((e) => e instanceof Embedded && e.alive).length;
    if (this.lastCount >= 0 && count < this.lastCount) this.level = Math.min(1, this.level + this.perExtraction * (this.lastCount - count));
    this.lastCount = count;
    // Nothing left to do on the table: he quiets.
    if (!op.entities.some((e) => e.alive && e.required)) return;
    this.level = Math.min(1, this.level + this.rise * dt);
    if (this.thrashing) {
      op.shake = Math.max(op.shake, 4 + 8 * (this.level - 0.7) / 0.3);
      op.sayOnce('agitation', 'He’s thrashing — calm him with the tincture before you go on!');
      this.joltT += dt;
      if (this.joltT > 3) {
        this.joltT = 0;
        const a = op.rng.range(0, TAU);
        const p = { x: this.pos.x + Math.cos(a) * op.rng.range(80, 200), y: this.pos.y + 60 + Math.sin(a) * op.rng.range(40, 120) };
        if (onBody(p)) op.spawn(new Laceration(p, a, 36, 0.5));
        op.hurt(2, p);
      }
    } else this.joltT = 0;
  }
  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 30) return false;
    this.calmT = 0;
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'tincture' || dist(ptr.pos, this.pos) > 34) return;
    this.calmT += dt;
    if (this.calmT >= 0.6) {
      this.calmT = 0;
      const was = this.level;
      this.level = 0;
      op.cues.push('inject');
      if (was > 0.3) op.rate('good', this.pos, 'Calmed');
      else op.popup('Calm', this.pos, '#9fd3a8');
    }
  }
  override onRelease(): void {
    this.calmT = 0;
  }
}

// ============================================================ the molar

/**
 * A rotten molar. Seize it with the tongs and rock it side to side (three
 * rocks) before drawing it; pulled too soon, the root snaps off in the socket
 * and must be dug out as a fragment.
 */
export class Molar extends Entity {
  rocks = 0;
  private grabbed = false;
  private side = 0;
  readonly origin: Vec;
  constructor(pos: Vec) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 4;
  }
  override drain(): number {
    return 0.3;
  }
  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 22) return false;
    this.grabbed = true;
    this.side = 0;
    op.cues.push('pluck');
    return true;
  }
  override onDrag(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    const dx = ptr.pos.x - this.origin.x;
    const dy = ptr.pos.y - this.origin.y;
    // Rocking: swings past ±12 px sideways, alternating.
    const s = dx > 12 ? 1 : dx < -12 ? -1 : 0;
    if (s !== 0 && s !== this.side && Math.abs(dy) < 30) {
      if (this.side !== 0) {
        this.rocks++;
        op.cues.push('pluck');
        if (this.rocks === 3) op.popup('Loose', this.pos, '#9fd3a8');
      }
      this.side = s;
    }
    this.pos = { x: this.origin.x + Math.max(-14, Math.min(14, dx)) * 0.4, y: this.origin.y + Math.min(0, dy) };
    if (-dy > 60) {
      this.grabbed = false;
      this.kill();
      op.emit('blood', this.origin, 10);
      if (this.rocks >= 3) {
        op.rate('cool', this.origin, 'Drawn clean');
        op.spawn(new BloodPool({ ...this.origin }, 16));
      } else {
        op.rate('bad', this.origin, 'Root snapped');
        op.hurt(5, this.origin);
        op.say('The root’s snapped off in the socket — get the fragment out!');
        const root = new Embedded({ x: this.origin.x, y: this.origin.y + 4 }, 'tooth', Math.PI / 2, false);
        op.spawn(root);
      }
    }
  }
  override onRelease(): void {
    this.grabbed = false;
    this.pos = { ...this.origin };
  }
}

/**
 * The patient's jaw. Leave the lancet pressed down in his mouth doing nothing
 * for more than a second and he bites.
 */
export class Jaw extends Entity {
  private lingerT = 0;
  private lastPress = -1;
  constructor(
    pos: Vec,
    public radius = 150,
  ) {
    super(pos);
    this.required = false;
    this.layer = -3;
  }
  override update(): void {
    if (!this.branded) this.lingerT = 0;
    this.branded = false;
  }
  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'lancet' || dist(ptr.pos, this.pos) > this.radius) return;
    // Not really a brand — the flag just tells the next update the lancet is still lingering.
    this.branded = true;
    if (this.lastPress !== op.pressId) {
      this.lastPress = op.pressId;
      this.lingerT = 0;
    }
    this.lingerT += dt;
    if (this.lingerT > 1.0) {
      this.lingerT = -2;
      op.rate('bad', ptr.pos, 'Bitten');
      op.hurt(4, ptr.pos);
      op.shake = 10;
      op.say('He bit down! Don’t leave the blade idling in his mouth!');
    }
  }
}
