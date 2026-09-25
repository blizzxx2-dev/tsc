import { spurtArt } from '../../art/ailmentArt';
import { presentation } from '../../render/presentation';
import { dist, pointSegment, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Embedded, feedPool, surfDisc } from '../entities';
import { Entity } from '../entity';
import { onBody, strokeCrosses, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const ORGAN = {
  // Heart rhythm
  heartR: 90,
  beatOpen: 0.25,
  beatClose: 0.65,
  arrhythmiaDrain: 0.3,
  // Lung
  lungCeiling: 60,
  lungSuck: 1.5,
  lungStitches: 3,
  lungDrain: 0.3,
  // Trepanation
  drillInner: 12,
  drillOuter: 42,
  drillTurns: 3,
  drillMaxRevPerS: 2.5,
  drillHurt: 5,
  // Larynx
  verse: 3,
  silence: 1.2,
  foldCut: 30,
  foldHurt: 3,
  // Stomach
  tumblerStep: 15,
  tumblerTol: 7.5,
  acidBase: 0.3,
  acidRise: 0.02,
  // Wax clot
  waxTaps: 3,
  waxTap: 0.4,
  waxSuck: 1,
  clog: 2,
  // Artery
  arteryPool: 1,
  arteryClamp: 0.5,
  arteryNear: 70,
  arteryHurt: 10,
  arteryPoolOffset: 35,
  arteryPoolGrow: 7,
};

const TAU = Math.PI * 2;

/** Is the heart between beats right now (the rhythm assist doubles the window)? */
export function betweenBeats(op: Operation): boolean {
  const w = op.assists.noRhythm ? 2 : 1;
  const mid = (ORGAN.beatOpen + ORGAN.beatClose) / 2;
  const half = ((ORGAN.beatClose - ORGAN.beatOpen) / 2) * w;
  return op.sinceBeat >= mid - half && op.sinceBeat <= mid + half;
}

/**
 * Arrhythmia: while it lasts, the lancet only bites near the heart between
 * beats (0.4 s windows synced to the ECG); during a beat it skids.
 */
export class Arrhythmia extends Entity {
  noun = 'the heart';
  constructor(
    public heart: Vec,
    public duration = 30,
  ) {
    super(heart);
    this.required = false;
    this.layer = -3;
  }
  override hitTest(): boolean {
    return false;
  }
  override drain(): number {
    return ORGAN.arrhythmiaDrain;
  }
  override update(): void {
    if (this.age >= this.duration) this.kill();
  }
  override blocksTool(op: Operation, p: Vec, tool: ToolId): string | null {
    if (tool !== 'lancet' || dist(p, this.heart) > ORGAN.heartR || betweenBeats(op)) return null;
    return 'Between beats!';
  }
  draw(g: Gfx, op: Operation): void {
    g.arc(this.heart.x, this.heart.y, ORGAN.heartR, 2, hex(betweenBeats(op) ? '#9fd3a8' : '#ff5040', 0.35));
  }
}

/**
 * A collapsed lung: draw the trapped air off with the leech-pipe (1.5 s), then
 * seal the tear with three stitches. While collapsed, vitals cannot rise above 60.
 */
export class CollapsedLung extends Entity {
  suck = 0;
  stitches = 0;
  readonly a: Vec;
  readonly b: Vec;
  noun = 'the lung';

  constructor(pos: Vec) {
    super(pos);
    this.layer = -1;
    this.a = { x: pos.x - 24, y: pos.y };
    this.b = { x: pos.x + 24, y: pos.y };
  }

  get drawn(): boolean {
    return this.suck >= ORGAN.lungSuck;
  }

  override wants(): readonly ToolId[] {
    return this.drawn ? ['thread'] : ['leech'];
  }

  override drain(): number {
    return ORGAN.lungDrain;
  }

  override vitalsCeiling(): number {
    return ORGAN.lungCeiling;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'leech' && !this.drawn && dist(ptr.pos, this.pos) < 34 + op.hitPad) {
      this.suck += dt;
      if (this.drawn) op.rate('good', this.pos, 'Air drawn');
    } else if (tool === 'thread' && this.drawn && !ptr.pressed && strokeCrosses(ptr.prev, ptr.pos, this.a, this.b)) {
      this.stitches++;
      op.cues.push('stitch');
      if (this.stitches >= ORGAN.lungStitches) {
        this.kill();
        op.rate('cool', this.pos, 'Lung sealed');
      }
    } else if (tool === 'thread' && !this.drawn && pointSegment(ptr.pos, this.a, this.b).d < 20) op.sayOnce('lung-air', 'Draw the air off first, or the seal won’t hold.');
  }

  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, 34, hex(this.drawn ? '#c07070' : '#e0c0c0', 0.6), hex('#a05050', 0));
    g.line(this.a, this.b, 2, hex('#6a1010'));
  }
}

/**
 * Trepanation: three steady circles with the lancet (as an awl) round the
 * drill point cut a disc of bone; then lift it off with the tongs. Circles
 * faster than 2.5 turns a second nick the dura beneath (BAD).
 */
export class Trepanation extends Entity {
  turns = 0;
  loose = false;
  private lastAng: number | null = null;
  private turnT = 0;
  private acc = 0;
  private grabbed = false;
  private nicked = -1;
  noun = 'the skull';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 2;
  }

  override wants(): readonly ToolId[] {
    return this.loose ? ['tongs'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < ORGAN.drillOuter + pad;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'tongs' && this.loose && dist(ptr.pos, this.pos) < ORGAN.drillOuter + op.hitPad) {
      this.grabbed = true;
      return true;
    }
    if (tool !== 'lancet' || this.loose || dist(ptr.pos, this.pos) > ORGAN.drillOuter + op.hitPad) return false;
    this.lastAng = null;
    this.turnT = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool === 'tongs' && this.grabbed) {
      this.pos = { ...ptr.pos };
      return;
    }
    if (tool !== 'lancet' || this.loose) return;
    const d = dist(ptr.pos, this.pos);
    if (d < ORGAN.drillInner || d > ORGAN.drillOuter) return;
    const ang = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
    this.turnT += dt;
    if (this.lastAng !== null) {
      let da = ang - this.lastAng;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      this.acc += Math.abs(da);
      const revPerS = dt > 0 ? Math.abs(da) / TAU / dt : 0;
      if (revPerS > ORGAN.drillMaxRevPerS && this.nicked !== op.pressId) {
        this.nicked = op.pressId;
        op.rate('bad', ptr.pos, 'Dura nicked');
        op.harm(ORGAN.drillHurt, ptr.pos);
        op.sayOnce('drill', 'Slowly! Steady circles — you’re through to the dura.', 'danger');
      }
      if (this.acc >= TAU) {
        this.acc -= TAU;
        this.turns++;
        op.cues.push('cut');
        if (this.turns >= ORGAN.drillTurns) {
          this.loose = true;
          op.rate(this.nicked < 0 ? 'cool' : 'good', this.pos, 'Disc cut');
        }
      }
    }
    this.lastAng = ang;
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('good', ptr.pos, 'Disc lifted');
    }
  }

  draw(g: Gfx, op: Operation): void {
    g.circle(this.pos.x, this.pos.y, ORGAN.drillOuter - 10, hex(this.loose ? '#d8d0c0' : '#c8bca8'));
    g.arc(this.pos.x, this.pos.y, ORGAN.drillOuter - 10, 3, hex('#6a4a30'), (this.turns + this.acc / TAU) / ORGAN.drillTurns);
    if (op.guides && !this.loose) g.arc(this.pos.x, this.pos.y, (ORGAN.drillInner + ORGAN.drillOuter) / 2, 1, hex('#ffebbe', 0.4));
  }
}

/** Is the Choir-throat humming a verse right now (vs a silent gap)? */
export function humming(op: Operation): boolean {
  const cycle = ORGAN.verse + ORGAN.silence;
  return op.elapsed % cycle < ORGAN.verse;
}

/**
 * A Choir-throat vocal fold: cut across it with the lancet only in the silent
 * gaps between hummed verses (heard, and shown as a waveform on the HUD).
 * Cutting mid-verse is BAD.
 */
export class LarynxFold extends Entity {
  private cut = 0;
  private startPress = -1;
  readonly a: Vec;
  readonly b: Vec;
  noun = 'the vocal fold';

  constructor(pos: Vec, angle = 0) {
    super(pos);
    this.layer = 1;
    this.a = { x: pos.x - Math.cos(angle) * 22, y: pos.y - Math.sin(angle) * 22 };
    this.b = { x: pos.x + Math.cos(angle) * 22, y: pos.y + Math.sin(angle) * 22 };
  }

  override wants(): readonly ToolId[] {
    return ['lancet'];
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || pointSegment(ptr.pos, this.a, this.b).d > 30 + op.hitPad) return false;
    this.startPress = op.pressId;
    this.cut = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || this.startPress !== op.pressId) return;
    if (humming(op)) {
      this.startPress = -1;
      op.rate('bad', ptr.pos, 'Mid-verse');
      op.harm(ORGAN.foldHurt, ptr.pos);
      op.sayOnce('larynx', 'Wait for the silence between verses — then cut.');
      return;
    }
    this.cut += Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    if (this.cut >= ORGAN.foldCut) {
      this.kill();
      op.rate('cool', this.pos, 'Fold cut');
    }
  }

  draw(g: Gfx, op: Operation): void {
    const h = humming(op);
    g.line(this.a, this.b, 8, hex(h ? '#c07080' : '#a05060'));
    if (h) for (let i = 0; i < 3; i++) g.arc(this.pos.x, this.pos.y, 16 + i * 8 + ((op.elapsed * 30) % 8), 1, hex('#e0c0ff', 0.4));
  }
}

interface Tumbler {
  pos: Vec;
  angle: number;
  target: number;
  locked: boolean;
}

/**
 * A swallowed lock-box in the stomach: turn each of three tumblers (tongs to
 * hold, mouse wheel to turn in 15° steps) to its mark while the stomach acid
 * rises. When all three lock, the object comes free — draw it out.
 */
export class StomachLock extends Entity {
  tumblers: Tumbler[] = [];
  private held: Tumbler | null = null;
  freed = false;
  noun = 'the lock';

  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 3;
    for (let i = 0; i < 3; i++) {
      const target = Math.round(op.rng.range(0, 360) / ORGAN.tumblerStep) * ORGAN.tumblerStep;
      const start = (target + ORGAN.tumblerStep * op.rng.int(2, 8)) % 360;
      this.tumblers.push({ pos: { x: pos.x + (i - 1) * 40, y: pos.y }, angle: start, target, locked: false });
    }
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return this.tumblers.some((t) => dist(t.pos, p) < 16 + pad);
  }

  override drain(): number {
    return ORGAN.acidBase + this.age * ORGAN.acidRise;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs') return false;
    const t = this.tumblers.find((tt) => !tt.locked && dist(tt.pos, ptr.pos) < 16 + op.hitPad);
    if (!t) return false;
    this.held = t;
    return true;
  }

  override onWheel(op: Operation, dir: number): boolean {
    const t = this.held;
    if (!t) return false;
    t.angle = (t.angle + dir * ORGAN.tumblerStep + 360) % 360;
    op.cues.push('select');
    const off = Math.abs(((t.angle - t.target + 540) % 360) - 180);
    if (off <= ORGAN.tumblerTol) {
      t.locked = true;
      this.held = null;
      op.cues.push('pluck');
      op.rate('good', t.pos, 'Tumbler set');
      if (this.tumblers.every((x) => x.locked)) this.free(op);
    }
    return true;
  }

  override onRelease(): void {
    this.held = null;
  }

  private free(op: Operation): void {
    this.freed = true;
    this.kill();
    op.spawn(new Embedded({ ...this.pos }, 'shard', -Math.PI / 2, false));
    op.say('It’s open — draw it out!');
  }

  draw(g: Gfx): void {
    g.rect(this.pos.x - 64, this.pos.y - 22, 128, 44, hex('#5a4a30'));
    for (const t of this.tumblers) {
      g.circle(t.pos.x, t.pos.y, 14, hex(t.locked ? '#c8a040' : '#8a7a60'));
      const a = (t.angle * Math.PI) / 180;
      g.line(t.pos, { x: t.pos.x + Math.cos(a) * 12, y: t.pos.y + Math.sin(a) * 12 }, 2, hex('#1a1008'));
      const m = (t.target * Math.PI) / 180;
      g.circle(t.pos.x + Math.cos(m) * 17, t.pos.y + Math.sin(m) * 17, 2, hex('#ffebbe'));
    }
  }
}

/**
 * A clot of wax-blood (Blood of Tallow). Soften it with three quick taps of
 * the brand, then draw it off with the leech-pipe; an unsoftened clot clogs
 * the pipe for 2 s.
 */
export class WaxClot extends Entity {
  taps = 0;
  private pressT = 0;
  private pressId = -1;
  private suck = 0;
  noun = 'the wax clot';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 3;
  }

  get soft(): boolean {
    return this.taps >= ORGAN.waxTaps;
  }

  override wants(): readonly ToolId[] {
    return this.soft ? ['leech'] : ['brand'];
  }

  override drain(): number {
    return ORGAN.acidBase;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'brand' || this.soft || dist(ptr.pos, this.pos) > 22 + op.hitPad) return false;
    this.pressId = op.pressId;
    this.pressT = 0;
    this.branded = true;
    return true;
  }

  override onDrag(_op: Operation, _ptr: Pointer, _tool: ToolId, dt: number): void {
    this.pressT += dt;
    this.branded = true;
  }

  override onRelease(op: Operation): void {
    if (this.pressId !== op.pressId || this.pressT > ORGAN.waxTap) return;
    this.taps++;
    op.cues.push('burn');
    if (this.soft) op.popup('Softened', this.pos, '#f0d0a0');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > 24 + op.hitPad) return;
    if (!this.soft) {
      op.disableTool('leech', ORGAN.clog);
      op.rate('bad', this.pos, 'Clogged');
      op.sayOnce('wax', 'It’s set hard — soften it with the brand, a few quick taps.');
      return;
    }
    this.suck += dt;
    if (this.suck >= ORGAN.waxSuck) {
      this.kill();
      op.rate('good', this.pos, 'Clot drawn');
    }
  }

  draw(g: Gfx): void {
    g.circleGrad(this.pos.x, this.pos.y, 18, hex(this.soft ? '#e0b080' : '#f0e0c0'), hex('#8a6a40'));
  }
}

/**
 * An unclamped artery: it fills a pool every second. Clamp it with the tongs
 * (hold 0.5 s) before pulling anything lodged near it — extracting beside a
 * live artery tears it (−10, BAD).
 */
export class Artery extends Entity {
  clamped = false;
  private poolT = 0;
  private clampT = 0;
  private pressId = -1;
  private near = new Set<Entity>();
  noun = 'the artery';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 4;
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override drain(): number {
    return this.clamped ? 0 : ORGAN.lungDrain;
  }

  override update(op: Operation, dt: number): void {
    const near = op.entities.filter((e) => e instanceof Embedded && e.alive && dist(e.origin, this.pos) < ORGAN.arteryNear);
    for (const e of this.near) {
      if (!e.alive && !this.clamped) {
        op.rate('bad', this.pos, 'Artery torn');
        op.harm(ORGAN.arteryHurt, this.pos);
        op.sayOnce('artery', 'Clamp the artery before you pull anything near it!', 'danger');
      }
    }
    this.near = new Set(near);
    if (this.clamped) return;
    this.poolT += dt;
    if (this.poolT >= ORGAN.arteryPool) {
      this.poolT = 0;
      feedPool(op, { x: this.pos.x, y: this.pos.y + ORGAN.arteryPoolOffset }, ORGAN.arteryPoolGrow);
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.clamped || dist(ptr.pos, this.pos) > 18 + op.hitPad) return false;
    this.pressId = op.pressId;
    this.clampT = 0;
    return true;
  }

  override onDrag(op: Operation, _ptr: Pointer, _tool: ToolId, dt: number): void {
    if (this.pressId !== op.pressId || this.clamped) return;
    this.clampT += dt;
    if (this.clampT >= ORGAN.arteryClamp) {
      this.clamped = true;
      this.required = false;
      op.cues.push('pluck');
      op.rate('good', this.pos, 'Clamped');
    }
  }

  override drawSurface(g: Gfx): void {
    surfDisc(g, this.pos, 20, 0.6, 0.2);
  }

  draw(g: Gfx, op: Operation): void {
    g.circle(this.pos.x, this.pos.y, 9, hex(this.clamped ? '#6a3030' : '#d02030'));
    if (this.clamped) g.rect(this.pos.x - 12, this.pos.y - 2, 24, 4, hex('#9aa0a6'));
    else {
      g.arc(this.pos.x, this.pos.y, 14, 2, hex('#ff5050', 0.5 + 0.4 * Math.sin(op.elapsed * 8)));
      // The severed vessel spurts on every heartbeat (ART-0192): 6 frames, one of three directions.
      if (presentation.gore < 2) spurtArt(g, this.pos, -Math.PI / 2 + ((this.id % 3) - 1) * 0.75, 70, op.beatPhase, this.id);
    }
  }
}
