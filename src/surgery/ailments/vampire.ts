
import { dist, type Vec } from '../../core/math';
import { Embedded } from '../entities';
import { Entity } from '../entity';
import { FIELD, type Operation } from '../operation';
import type { Pointer, ToolId } from '../types';

export const BITE = {
  ceiling: 70,
  volumeDrain: 1.5,
  sear: 0.8,
  reach: 16,
  drain: 0.25,
  transfuse: 8,
  bowlVolume: 60,
};

/**
 * A vampire's bite: two punctures joined by a thrall-thread under the skin,
 * with fang tips lodged beneath (the lens finds them). While the channel is
 * open, vitals cannot rise above 70 and blood volume drains. Cauterise it by
 * holding the brand on each puncture. Leaving it open is allowed — the patient
 * lives, bound — and is recorded as the story flag `thrallKept`.
 */
export class BiteChannel extends Entity {
  readonly punctures: [Vec, Vec];
  seared: [number, number] = [0, 0];
  noun = 'the bite';

  constructor(pos: Vec, angle = 0) {
    super(pos);
    this.layer = 1;
    this.required = false;
    const dx = Math.cos(angle) * 14;
    const dy = Math.sin(angle) * 14;
    this.punctures = [
      { x: pos.x - dx, y: pos.y - dy },
      { x: pos.x + dx, y: pos.y + dy },
    ];
  }

  get cauterised(): boolean {
    return this.seared.every((s) => s >= BITE.sear);
  }

  override wants(): readonly ToolId[] {
    return ['brand'];
  }

  override drain(): number {
    return BITE.drain;
  }

  override vitalsCeiling(): number {
    return BITE.ceiling;
  }

  override update(op: Operation, dt: number): void {
    this.branded = false;
    op.bloodVolume = Math.max(0, op.bloodVolume - BITE.volumeDrain * dt);
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'brand') return;
    this.punctures.forEach((p, i) => {
      if (dist(p, ptr.pos) > BITE.reach + op.hitPad || this.seared[i] >= BITE.sear) return;
      this.branded = true;
      this.seared[i] += dt;
      if (this.seared[i] >= BITE.sear) op.cues.push('burn');
    });
    if (this.cauterised) {
      this.kill();
      op.rate('good', this.pos, 'Channel seared');
      op.sayOnce('bite-sealed', 'The thread’s cut. Whatever called to him has lost its hold.');
    }
  }

  override onOperationEnd(op: Operation): void {
    op.setStoryFlag('thrallKept');
  }
}

/** Fang tips lodged under a bite (hidden: the lens finds them). */
export function biteSite(pos: Vec, angle = 0, fangs = 2): Entity[] {
  const ch = new BiteChannel(pos, angle);
  const out: Entity[] = [ch];
  for (let i = 0; i < fangs; i++) {
    const t = new Embedded(ch.punctures[i % 2], 'tooth', angle + Math.PI / 2, false);
    t.hidden = true;
    out.push(t);
  }
  return out;
}

/**
 * The donor bowl beside the table. With the leech-pipe reversed and held in
 * the bowl, blood flows into the patient: the tincture restores vitals, only
 * transfusion restores blood volume.
 */
export class DonorBowl extends Entity {
  volume = BITE.bowlVolume;
  noun = 'the donor bowl';

  constructor(pos: Vec = { x: FIELD.cx - FIELD.rx - 70, y: FIELD.cy + FIELD.ry - 20 }) {
    super(pos);
    this.required = false;
    this.layer = 8;
  }

  override wants(): readonly ToolId[] {
    return ['leech'];
  }

  override hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < 40 + pad;
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (tool !== 'leech' || dist(ptr.pos, this.pos) > 40 + op.hitPad || this.volume <= 0) return;
    if (!op.leechReverse) {
      op.sayOnce('transfuse', 'Reverse the pipe (R) to give him blood from the bowl.');
      return;
    }
    const amt = Math.min(this.volume, BITE.transfuse * dt);
    this.volume -= amt;
    op.bloodVolume = Math.min(100, op.bloodVolume + amt);
    if (this.volume <= 0) op.rate('good', this.pos, 'Transfused');
  }
}
