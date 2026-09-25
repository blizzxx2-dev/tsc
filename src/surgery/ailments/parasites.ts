import { dist, type Vec } from '../../core/math';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import { Entity } from '../entity';
import { isOpenWound, onBody, type Operation } from '../operation';
import type { TinctureColor } from '../progress';
import type { Pointer, ToolId } from '../types';

export const PARASITE = {
  wormLen: 140,
  wormSpeed: 300,
  wormRegrow: 6,
  wormDrain: 0.3,
  tickBurrow: 4,
  tickDrain: 0.15,
  tickHidden: 0.1,
  tickSpeed: 25,
  tickWander: 3,
  finishPenalty: 0.9,
  grab: 18,
};

/**
 * A gut worm. Seize the head with the tongs and draw it out whole with a
 * steady pull — slower than 300 px/s. Yank it and it tears: the body stays in
 * and grows a new head in 6 s.
 */
export class GutWorm extends Entity {
  private grabbed = false;
  /** Length drawn out so far. */
  pulled = 0;
  private regrowT = -1;
  readonly origin: Vec;
  noun = 'the worm';

  constructor(pos: Vec) {
    super(pos);
    this.origin = { ...pos };
    this.layer = 4;
  }

  get headless(): boolean {
    return this.regrowT >= 0;
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override drain(): number {
    return PARASITE.wormDrain;
  }

  override update(op: Operation, dt: number): void {
    if (this.regrowT < 0) return;
    this.regrowT += dt;
    if (this.regrowT >= PARASITE.wormRegrow) {
      this.regrowT = -1;
      this.pulled = 0;
      this.pos = { ...this.origin };
      op.popup('A new head!', this.pos, '#c8c050');
    }
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || this.headless || dist(ptr.pos, this.pos) > PARASITE.grab + op.hitPad) return false;
    this.grabbed = true;
    return true;
  }

  override onDrag(op: Operation, ptr: Pointer, tool: ToolId, dt: number): void {
    if (!this.grabbed || tool !== 'tongs') return;
    const step = Math.hypot(ptr.pos.x - ptr.prev.x, ptr.pos.y - ptr.prev.y);
    if (!ptr.pressed && dt > 0 && step / dt > PARASITE.wormSpeed) {
      this.grabbed = false;
      this.regrowT = 0;
      this.pos = { ...this.origin };
      op.rate('bad', ptr.pos, 'Torn worm');
      op.sayOnce('worm', 'Gently! Tear it and the body grows a new head.');
      return;
    }
    this.pos = { ...ptr.pos };
    this.pulled = dist(this.pos, this.origin);
  }

  override onRelease(op: Operation, ptr: Pointer): void {
    if (!this.grabbed) return;
    this.grabbed = false;
    if (!onBody(ptr.pos) && this.pulled >= PARASITE.wormLen) {
      this.kill();
      op.rate('cool', ptr.pos, 'Worm drawn');
    } else this.pos = { ...this.origin };
  }

  draw(g: Gfx, op: Operation): void {
    const pts: Vec[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: this.origin.x + (this.pos.x - this.origin.x) * t + Math.sin(op.elapsed * 6 + i) * 3, y: this.origin.y + (this.pos.y - this.origin.y) * t + Math.cos(op.elapsed * 5 + i) * 3 });
    }
    if (this.headless) pts.splice(1);
    g.polyline(pts.length > 1 ? pts : [this.origin, { x: this.origin.x + 8, y: this.origin.y }], 6, hex('#e0c8a0'));
    if (!this.headless) g.circle(this.pos.x, this.pos.y, 6, hex('#a06a50'));
    else g.arc(this.origin.x, this.origin.y, 12, 2, hex('#c8c050'), this.regrowT / PARASITE.wormRegrow);
  }
}

/**
 * A tick crawling out of a wound. Pluck it with the tongs; left for 4 s it
 * burrows in (hidden, a slow drain the lens can find).
 */
export class Tick extends Entity {
  private heading: number;
  burrowed = false;
  noun = 'the tick';

  constructor(pos: Vec, op: Operation) {
    super(pos);
    this.layer = 6;
    this.heading = op.rng.range(0, Math.PI * 2);
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override drain(): number {
    return this.hidden ? PARASITE.tickHidden : PARASITE.tickDrain;
  }

  override reveal(op: Operation): void {
    super.reveal(op);
    this.age = 0;
  }

  override update(op: Operation, dt: number): void {
    if (this.hidden) return;
    if (this.age >= PARASITE.tickBurrow) {
      this.hidden = true;
      this.burrowed = true;
      op.sayOnce('tick-burrow', 'A tick’s burrowed in — the lens will find it.');
      return;
    }
    this.heading += op.rng.range(-PARASITE.tickWander, PARASITE.tickWander) * dt;
    const next = { x: this.pos.x + Math.cos(this.heading) * PARASITE.tickSpeed * dt, y: this.pos.y + Math.sin(this.heading) * PARASITE.tickSpeed * dt };
    if (onBody(next)) this.pos = next;
    else this.heading += Math.PI;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool !== 'tongs' || dist(ptr.pos, this.pos) > PARASITE.grab + op.hitPad) return false;
    this.kill();
    op.cues.push('pluck');
    op.rate(this.burrowed ? 'good' : 'cool', this.pos, 'Tick plucked');
    return true;
  }

  draw(g: Gfx): void {
    g.circle(this.pos.x, this.pos.y, 5, hex('#3a2014'));
    for (let i = 0; i < 4; i++) g.line(this.pos, { x: this.pos.x + (i < 2 ? -7 : 7), y: this.pos.y + ((i % 2) * 2 - 1) * 5 }, 1, hex('#1a0e08'));
  }
}

/** Ticks emerge from an open wound over time. */
export class TickNest extends Entity {
  private t = 0;
  noun = 'the nest';

  constructor(
    pos: Vec,
    public count = 3,
    public every = 5,
  ) {
    super(pos);
    this.required = true;
    this.layer = -1;
  }

  override hitTest(): boolean {
    return false;
  }

  override update(op: Operation, dt: number): void {
    this.t += dt;
    if (this.count > 0 && this.t >= this.every) {
      this.t = 0;
      this.count--;
      const wound = op.entities.find((e) => e.alive && isOpenWound(e));
      op.spawn(new Tick({ ...(wound?.pos ?? this.pos) }, op));
    }
    if (this.count === 0) this.kill();
  }

  draw(): void {}
}

/**
 * Larvae too small to see. Only a dose of green tincture (antiparasitic) at
 * the end clears them; closing with them inside costs 10 % of the end bonus.
 */
export class Larvae extends Entity {
  noun = 'the larvae';

  constructor(pos: Vec) {
    super(pos);
    this.required = false;
    this.hidden = true;
  }

  override hitTest(): boolean {
    return false;
  }

  /** Revealed by nothing: only the antiparasitic tincture reaches them. */
  override onReveal(): void {}

  onTincture(op: Operation, c: TinctureColor): void {
    if (c !== 'green') return;
    this.kill();
    op.rate('good', this.pos, 'Antiparasitic');
  }

  override onOperationEnd(op: Operation): void {
    op.endBonusMult *= PARASITE.finishPenalty;
    op.say('Larvae left in him… he’ll be back with a fever. The green tincture clears them.');
  }

  draw(): void {}
}
