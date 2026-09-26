import { dist, type Vec } from '../../core/math';
import { Embedded, type EmbeddedKind } from '../entities';
import { Entity } from '../entity';
import type { Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const REGEN = {
  closeTime: 4,
  /** Rim bins (a full circle is every bin seared). */
  bins: 12,
  rimR: 30,
  rimBand: 12,
  drain: 0.3,
  cutLen: 40,
  sprayTools: 10,
  /** Close time scales with vitals: healthier trolls knit faster. */
  vitalsRef: 99,
};

/**
 * A troll's regenerating wound over lodged shrapnel. Opened, it closes over the
 * object again in ~4 s (faster the healthier the patient) unless its rim is
 * seared all the way round with the brand. Closed over the object, a lump forms
 * and the object is hidden: cut across the lump with the lancet to reopen it.
 * Troll gut sprays acid when opened: a random instrument is useless for 10 s.
 */
export class RegenWound extends Entity {
  open = true;
  closeT = 0;
  rim: boolean[] = new Array(REGEN.bins).fill(false);
  sealed = false;
  readonly shard: Embedded;
  private cutLen = 0;
  private cutPress = -1;
  noun = 'the regenerating wound';

  constructor(
    pos: Vec,
    kind: EmbeddedKind = 'shard',
    public gut = false,
  ) {
    super(pos);
    this.layer = 1;
    this.shard = new Embedded({ ...pos }, kind, 0.8, false);
  }

  /** Seconds the wound takes to close (vitals-scaled: a deliberate inversion). */
  closeTime(op: Operation): number {
    return REGEN.closeTime * (REGEN.vitalsRef / Math.max(20, op.vitals));
  }

  override wants(): readonly ToolId[] {
    if (!this.open) return ['lancet'];
    return this.sealed ? ['tongs'] : ['brand'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < REGEN.rimR + REGEN.rimBand + pad;
  }

  override drain(): number {
    return REGEN.drain;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    if (!this.shard.alive) {
      this.kill();
      return;
    }
    this.shard.hidden = !this.open;
    if (!this.open || this.sealed) return;
    this.closeT += dt;
    if (this.closeT >= this.closeTime(op)) {
      this.open = false;
      this.closeT = 0;
      this.rim.fill(false);
      op.popup('It knits shut!', this.pos, '#80a060');
      op.sayOnce('regen', 'It’s closing over the shard! Sear the rim all the way round before it heals.', 'danger');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (this.open || tool !== 'lancet' || dist(ptr.pos, this.pos) > REGEN.rimR + op.hitPad) return false;
    this.cutPress = op.pressId;
    this.cutLen = 0;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (this.open || tool !== 'lancet' || this.cutPress !== op.pressId) return;
    this.cutLen += Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    if (this.cutLen < REGEN.cutLen) return;
    this.open = true;
    this.closeT = 0;
    op.cues.push('cut');
    op.rate('good', this.pos, 'Reopened lump');
    if (this.gut) this.spray(op);
  }

  private spray(op: Operation): void {
    const pool = op.def.tools.filter((t) => t !== 'lancet');
    if (!pool.length) return;
    const t = pool[Math.floor(op.rng.next() * pool.length)];
    op.disableTool(t, REGEN.sprayTools);
    op.say('Acid from the gut — it’s eaten into one of the instruments!', 'danger');
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool !== 'brand' || !this.open || this.sealed) return;
    const d = dist(ptr.pos, this.pos);
    if (Math.abs(d - REGEN.rimR) > REGEN.rimBand + op.hitPad) return;
    this.branded = true;
    const a = Math.atan2(ptr.pos.y - this.pos.y, ptr.pos.x - this.pos.x);
    const bin = Math.floor(((a + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / REGEN.bins));
    this.rim[bin] = true;
    if (this.rim.every(Boolean)) {
      this.sealed = true;
      op.cues.push('burn');
      op.rate('cool', this.pos, 'Rim seared');
      op.sayOnce('regen-sealed', 'That’ll hold it open. Now the shard.');
    }
  }
}

/** A troll wound with its shard (spawn both). */
export function trollWound(pos: Vec, kind: EmbeddedKind = 'shard', gut = false): Entity[] {
  const w = new RegenWound(pos, kind, gut);
  return [w, w.shard];
}
