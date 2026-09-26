import { dist, type Vec } from '../../core/math';
import { Entity } from '../entity';
import { SimpleBurn, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const FROST = {
  /** Thaw added per brand tap. */
  tapThaw: 0.2,
  /** Holding the brand longer than this scalds. */
  scaldAfter: 0.4,
  drain: 0.3,
  crystalDrain: 0.3,
  crystalHold: 1,
  /** Temperature drop per second per unthawed patch. */
  chill: 0.08,
};

/**
 * A frost-curse patch. Thaw it with the brand in quick taps — each tap warms
 * it; holding the brand more than 0.4 s scalds (a burn and a BAD). Frozen
 * flesh rejects the lancet and the thread: they skid off it, unrated.
 */
export class FrostPatch extends Entity {
  thaw = 0;
  private pressAt = -1;
  private pressT = 0;
  private scalded = false;
  noun = 'the frozen flesh';

  constructor(
    pos: Vec,
    public radius = 40,
  ) {
    super(pos);
    this.layer = -1;
  }

  get frozen(): boolean {
    return this.thaw < 1;
  }

  override wants(): readonly ToolId[] {
    return ['brand'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.radius + pad;
  }

  override drain(): number {
    return FROST.drain * (1 - this.thaw);
  }

  /** Unthawed frost chills the patient (when the op tracks temperature). */
  override update(op: Operation, dt: number): void {
    if (op.def.secondary?.temperature) op.temperature -= FROST.chill * (1 - this.thaw) * dt;
  }

  override blocksTool(_op: Operation, p: Vec, tool: ToolId): string | null {
    if (!this.frozen || (tool !== 'lancet' && tool !== 'thread') || dist(p, this.pos) > this.radius) return null;
    return tool === 'lancet' ? 'Frozen solid — the blade skids.' : 'Frozen — the needle won’t go in.';
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'brand' || dist(ptr.pos, this.pos) > this.radius + op.hitPad) return false;
    this.pressAt = op.pressId;
    this.pressT = 0;
    this.scalded = false;
    this.branded = true;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand' || this.pressAt !== op.pressId) return;
    this.branded = true;
    this.pressT += dt;
    if (this.pressT > FROST.scaldAfter && !this.scalded) {
      this.scalded = true;
      op.rate('bad', ptr.pos, 'Scalded');
      op.spawnPenalty(new SimpleBurn({ ...ptr.pos }));
      op.sayOnce('frost-tap', 'Tap the brand, don’t hold it — thaw it gently or it scalds!');
    }
  }

  override onRelease(op: Operation): void {
    if (this.scalded || this.pressT > FROST.scaldAfter) return;
    this.thaw = Math.min(1, this.thaw + FROST.tapThaw);
    op.cues.push('burn');
    op.emit('smoke', this.pos, 3);
    if (this.thaw >= 1) {
      this.required = false;
      op.rate('good', this.pos, 'Thawed');
      this.kill();
    }
  }
}

/**
 * Ice crystals lodged in a vessel: the frozen vessel starves the flesh (0.3/s).
 * The leech-pipe draws them out, but only once the frost around them is thawed.
 */
export class IceCrystal extends Entity {
  private suck = 0;
  noun = 'the ice crystals';

  constructor(pos: Vec) {
    super(pos);
    this.layer = 2;
  }

  override wants(): readonly ToolId[] {
    return ['leech'];
  }

  override drain(): number {
    return FROST.crystalDrain;
  }

  private frozenIn(op: Operation): boolean {
    return op.entities.some((e) => e instanceof FrostPatch && e.alive && e.frozen && dist(e.pos, this.pos) < e.radius);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > 22 + op.hitPad) return;
    if (this.frozenIn(op)) {
      op.sayOnce('ice-frozen', 'The vessel’s still frozen round it — thaw it first.');
      return;
    }
    this.suck += dt;
    if (this.suck >= FROST.crystalHold) {
      this.kill();
      op.cues.push('squelch');
      op.rate('good', this.pos, 'Crystals drawn');
    }
  }
}

/** Fraction of the field's frost still unthawed (drives the cold grade and breath-fog). */
export function frostLevel(op: Operation): number {
  const ps = op.entities.filter((e): e is FrostPatch => e instanceof FrostPatch && e.alive);
  return ps.length ? ps.reduce((a, p) => a + (1 - p.thaw), 0) / ps.length : 0;
}
