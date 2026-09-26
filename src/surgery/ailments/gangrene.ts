
import { dist, pointSegment, type Vec } from '../../core/math';
import { Coverage } from '../coverage';
import { Entity } from '../entity';
import { strokeCrosses, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const GANGRENE = {
  creep: 2,
  width: 34,
  debrideLen: 80,
  salveCoverage: 0.85,
  drainPerPx: 0.004,
  // Amputation
  strokes: 8,
  rhythmMin: 0.3,
  rhythmMax: 0.7,
  minStroke: 30,
  brandHold: 1,
  brandHurt: 15,
  ligatureWindow: 20,
  ligatureBonus: 400,
  vessels: 3,
  vesselLen: 16,
  stumpDrain: 0.6,
};

/**
 * Gangrene creeping up a limb (from `tip` toward `root`) at 2 px/s. The lens
 * shows the demarcation line. Caught below the line, debride it with the lancet
 * (drag across the black) and salve it. Once it passes the line, the limb must
 * come off: an Amputation takes its place.
 */
export class Gangrene extends Entity {
  /** How far up the limb the black has crept (px from the tip). */
  front: number;
  debrided = false;
  private cut = 0;
  cov: Coverage | null = null;
  readonly limbLen: number;
  noun = 'the gangrene';

  constructor(
    public tip: Vec,
    public root: Vec,
    start = 40,
    /** Demarcation: past this distance from the tip, only amputation will do. */
    public line = 150,
  ) {
    super(tip);
    this.layer = -2;
    this.front = start;
    this.limbLen = dist(tip, root);
  }

  along(d: number): Vec {
    const t = Math.min(1, d / this.limbLen);
    return { x: this.tip.x + (this.root.x - this.tip.x) * t, y: this.tip.y + (this.root.y - this.tip.y) * t };
  }

  /** The saw runs across the limb. */
  get sawAngle(): number {
    return Math.atan2(this.root.y - this.tip.y, this.root.x - this.tip.x) + Math.PI / 2;
  }

  get frontPos(): Vec {
    return this.along(this.front);
  }

  override wants(): readonly ToolId[] {
    return this.debrided ? ['salve'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return pointSegment(p, this.tip, this.frontPos).d < GANGRENE.width + pad;
  }

  override drain(): number {
    return this.front * GANGRENE.drainPerPx;
  }

  override update(op: Operation, dt: number): void {
    if (this.debrided) return;
    this.front += GANGRENE.creep * dt;
    if (this.front > this.line) {
      this.kill();
      op.say('It’s past the line — the limb must come off. The saw, Doctor.', 'danger');
      op.spawn(new Amputation(this.along(this.line + GANGRENE.width), this.sawAngle));
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    return tool === 'lancet' && !this.debrided && this.hitTest(ptr.pos, op.hitPad);
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || this.debrided || !this.hitTest(ptr.pos, op.hitPad)) return;
    this.cut += Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    if (this.cut >= GANGRENE.debrideLen) {
      this.debrided = true;
      const mid = this.along(this.front / 2);
      this.cov = new Coverage(mid, Math.max(GANGRENE.width, this.front / 2), 12);
      op.cues.push('cut');
      op.rate('good', mid, 'Debrided');
      op.sayOnce('gangrene-salve', 'The dead flesh is off. Salve the living edge.');
    }
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'salve' || !this.cov || !this.cov.contains(ptr.pos, 16) || !op.canSalve()) return;
    op.useSalve(this.cov.brush(ptr.pos, op.tuning.salve.brush));
    if (this.cov.fraction >= GANGRENE.salveCoverage) {
      this.kill();
      op.rate('good', this.pos, 'Limb saved');
    }
  }
}

/**
 * An amputation. Saw along the line with the lancet: eight back-and-forth
 * strokes in rhythm (each 0.3–0.7 s; the no-rhythm assist doubles the window).
 * Then seal the stump: the brand (1 s, fast, −15 vitals) or three ligatures
 * with the thread inside 20 s for a +400 bonus.
 */
export class Amputation extends Entity {
  strokes = 0;
  sawn = false;
  sealed = false;
  vessels: { a: Vec; b: Vec; tied: boolean }[] = [];
  private lastDir = 0;
  private lastTurn = -1;
  private strokeLen = 0;
  sealT = 0;
  private brandT = 0;
  noun = 'the limb';

  constructor(
    pos: Vec,
    /** Direction of the saw line. */
    public angle: number,
  ) {
    super(pos);
    this.layer = 2;
  }

  get sawA(): Vec {
    return { x: this.pos.x - Math.cos(this.angle) * 50, y: this.pos.y - Math.sin(this.angle) * 50 };
  }
  get sawB(): Vec {
    return { x: this.pos.x + Math.cos(this.angle) * 50, y: this.pos.y + Math.sin(this.angle) * 50 };
  }

  override wants(): readonly ToolId[] {
    return this.sawn ? ['brand', 'thread'] : ['lancet'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return pointSegment(p, this.sawA, this.sawB).d < 30 + pad;
  }

  override drain(): number {
    return this.sawn ? GANGRENE.stumpDrain : GANGRENE.stumpDrain / 2;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    if (this.sawn && !this.sealed) {
      this.sealT += dt;
      if (this.sealT > GANGRENE.ligatureWindow && this.vessels.some((v) => v.tied) && this.vessels.some((v) => !v.tied))
        op.sayOnce('ligature-slow', 'Too slow for ligatures — sear the stump!', 'danger');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'lancet' || this.sawn || !this.hitTest(ptr.pos, op.hitPad)) return false;
    this.lastDir = 0;
    this.strokeLen = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'lancet' || this.sawn) return;
    const along = (ptr.pos.x - ptr.prev.x) * Math.cos(this.angle) + (ptr.pos.y - ptr.prev.y) * Math.sin(this.angle);
    if (Math.abs(along) < 0.5) return;
    const dir = Math.sign(along);
    this.strokeLen += Math.abs(along);
    if (dir === this.lastDir || this.lastDir === 0) {
      this.lastDir = dir;
      return;
    }
    // A reversal ends a stroke: it counts if long enough and on the beat.
    const since = this.lastTurn < 0 ? GANGRENE.rhythmMin : op.elapsed - this.lastTurn;
    const widen = op.assists.noRhythm ? 2 : 1;
    const onBeat = since >= GANGRENE.rhythmMin / widen && since <= GANGRENE.rhythmMax * widen;
    if (this.strokeLen >= GANGRENE.minStroke && onBeat) {
      this.strokes++;
      op.cues.push('cut');
      op.emit('dust', ptr.pos, 4);
    } else if (this.strokeLen >= GANGRENE.minStroke) op.sayOnce('saw-rhythm', 'Steady strokes, Doctor — even, like a carpenter.');
    this.lastTurn = op.elapsed;
    this.lastDir = dir;
    this.strokeLen = 0;
    if (this.strokes >= GANGRENE.strokes) this.finishSaw(op);
  }

  private finishSaw(op: Operation): void {
    this.sawn = true;
    this.sealT = 0;
    op.rate('good', this.pos, 'Sawn through');
    for (let i = 0; i < GANGRENE.vessels; i++) {
      const t = (i + 1) / (GANGRENE.vessels + 1);
      const c = { x: this.sawA.x + (this.sawB.x - this.sawA.x) * t, y: this.sawA.y + (this.sawB.y - this.sawA.y) * t };
      const h = GANGRENE.vesselLen / 2;
      this.vessels.push({ a: { x: c.x - Math.cos(this.angle) * h, y: c.y - Math.sin(this.angle) * h }, b: { x: c.x + Math.cos(this.angle) * h, y: c.y + Math.sin(this.angle) * h }, tied: false });
    }
    op.say('Now seal it — sear the stump, or tie the three vessels for a cleaner job.');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.sawn || this.sealed) return;
    if (tool === 'thread' && !ptr.pressed && this.sealT <= GANGRENE.ligatureWindow) {
      for (const v of this.vessels) {
        if (v.tied || !strokeCrosses(ptr.prev, ptr.pos, v.a, v.b)) continue;
        v.tied = true;
        op.cues.push('stitch');
      }
      if (this.vessels.every((v) => v.tied)) {
        this.sealed = true;
        this.kill();
        op.rate('cool', this.pos, 'Ligatures');
        op.score += GANGRENE.ligatureBonus;
        op.popup(`Clean ligatures +${GANGRENE.ligatureBonus}`, this.pos, '#f5d76e');
      }
    } else if (tool === 'brand' && this.hitTest(ptr.pos, op.hitPad)) {
      this.branded = true;
      this.brandT += dt;
      if (this.brandT >= GANGRENE.brandHold) {
        this.sealed = true;
        this.kill();
        op.hurt(GANGRENE.brandHurt, this.pos);
        op.rate('good', this.pos, 'Stump seared');
      }
    }
  }
}
