import { dist, type Vec } from '../../core/math';
import { angleDiff, Laceration } from '../entities';
import { Entity } from '../entity';
import { onBody, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const SPLINTER = {
  glassPerGrab: 3,
  glassReach: 12,
  glassReveal: 0.3,
  glassDrain: 0.04,
  /** Slivers show within this fraction of the lens radius. */
  lensFrac: 0.5,
  woodJudge: 12,
  woodDrain: 0.2,
  woodGrab: 20,
};

interface Sliver {
  pos: Vec;
  seen: boolean;
  seenT: number;
  taken: boolean;
}

/**
 * A spray of tiny glass: invisible until the lens has lingered on each sliver
 * (they sparkle). Drag the tongs through them to gather up to three at once,
 * then carry them off the body.
 */
export class GlassCluster extends Entity {
  slivers: Sliver[] = [];
  private held: Sliver[] = [];
  noun = 'the glass';

  constructor(pos: Vec, op: Operation, count = 8) {
    super(pos);
    this.layer = 3;
    const n = Math.max(6, Math.min(12, count));
    for (let i = 0; i < n; i++) {
      const a = op.rng.range(0, Math.PI * 2);
      const r = op.rng.range(8, 46);
      this.slivers.push({ pos: { x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r * 0.8 }, seen: false, seenT: 0, taken: false });
    }
  }

  get left(): Sliver[] {
    return this.slivers.filter((s) => !s.taken);
  }

  override wants(): readonly ToolId[] {
    return this.left.some((s) => s.seen) ? ['tongs'] : ['lens'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < 56 + pad;
  }

  override drain(): number {
    return this.left.length * SPLINTER.glassDrain;
  }

  override update(op: Operation, dt: number): void {
    if (op.tool !== 'lens') return;
    for (const s of this.slivers) {
      if (s.seen || dist(s.pos, op.cursor) > op.tuning.lens.radius * SPLINTER.lensFrac) continue;
      s.seenT += dt;
      if (s.seenT >= SPLINTER.glassReveal) s.seen = true;
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > 60 + op.hitPad) return false;
    this.held = [];
    this.gather(op, ptr.pos);
    return true;
  }

  private gather(op: Operation, p: Vec): void {
    for (const s of this.slivers) {
      if (this.held.length >= SPLINTER.glassPerGrab) return;
      if (s.taken || !s.seen || this.held.includes(s) || dist(s.pos, p) > SPLINTER.glassReach + op.hitPad) continue;
      this.held.push(s);
    }
  }

  override onDrag(op: Operation, ptr: Pointer): void {
    if (onBody(ptr.pos)) this.gather(op, ptr.pos);
    for (const s of this.held) s.pos = { ...ptr.pos };
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    const batch = this.held;
    this.held = [];
    if (!batch.length) return;
    if (onBody(ptr.pos)) {
      op.sayOnce('glass-tray', 'Off the body with them, into the tray.');
      return;
    }
    for (const s of batch) s.taken = true;
    op.rate(batch.length === SPLINTER.glassPerGrab ? 'cool' : 'good', ptr.pos, 'Glass cleared');
    if (!this.left.length) this.kill();
  }
}

/**
 * A wooden splinter with a visible grain. Pull it with the grain; pulled
 * against it, it breaks and leaves a shorter splinter behind (BAD).
 */
export class WoodSplinter extends Entity {
  private grabbed = false;
  private offset: Vec = { x: 0, y: 0 };
  readonly origin: Vec;
  private judged = false;
  private broke = false;
  noun = 'the splinter';

  constructor(
    pos: Vec,
    /** Direction the grain runs out of the flesh. */
    public grain: number,
    public len = 34,
  ) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 3;
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override drain(): number {
    return SPLINTER.woodDrain * (this.len / 34);
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > SPLINTER.woodGrab + op.hitPad) return false;
    this.grabbed = true;
    this.judged = false;
    this.broke = false;
    this.offset = { x: this.pos.x - ptr.pos.x, y: this.pos.y - ptr.pos.y };
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer): void {
    if (!this.grabbed || this.broke) return;
    this.pos = { x: ptr.pos.x + this.offset.x, y: ptr.pos.y + this.offset.y };
    if (this.judged || dist(this.pos, this.origin) < SPLINTER.woodJudge) return;
    this.judged = true;
    const dir = Math.atan2(this.pos.y - this.origin.y, this.pos.x - this.origin.x);
    if (angleDiff(dir, this.grain) > 90) {
      this.broke = true;
      this.grabbed = false;
      this.kill();
      op.rate('bad', this.origin, 'Snapped splinter');
      op.sayOnce('grain', 'With the grain! Against it, the wood splits.');
      const rest = new WoodSplinter({ ...this.origin }, this.grain, Math.max(14, this.len * 0.55));
      op.spawnPenalty(rest);
    }
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (!onBody(ptr.pos)) {
      this.kill();
      op.rate('cool', ptr.pos, 'Splinter');
      if (this.len > 30) op.spawn(new Laceration(this.origin, this.grain + Math.PI / 2, 22, 0.4));
    } else this.pos = { ...this.origin };
  }
}
