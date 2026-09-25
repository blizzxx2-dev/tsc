import { dist, type Vec } from '../core/math';
import type { Gfx } from '../render/gfx';
import type { Operation } from './operation';
import type { Pointer, ToolId } from './types';

/**
 * Where an entity came from, for scoring:
 * - `content`: placed by the operation's phases (full points);
 * - `boss`: spawned by a Malison or by another boss add (reduced, capped points);
 * - `penalty`: created by the surgeon's own mistake — torn barbs, burst buboes, split grubs (no points);
 * - `self`: spawned by an ordinary ailment as it runs its course (full points).
 */
export type Origin = 'content' | 'boss' | 'penalty' | 'self';

/**
 * Anything on the operating field the surgeon can act upon. Entities are pure
 * simulation plus a draw method; they never read the DOM or the input device
 * directly, so the whole operation can be driven headlessly in tests.
 */
export abstract class Entity {
  /** Assigned by `Operation.spawn` from a per-operation counter (ENG-0242); 0 until spawned. */
  id = 0;
  alive = true;
  /** The phase cannot end while a required entity lives. */
  required = true;
  /** Hidden entities are invisible and inert until revealed by the lens. */
  hidden = false;
  /** Higher layers draw on top and receive clicks first. */
  layer = 0;
  /** Set during a frame when the brand is on this entity (so it isn't searing healthy flesh). */
  branded = false;
  /** True for a Malison (or any boss core): its spawns are tagged as boss adds. */
  boss = false;
  spawnedBy: Origin = 'content';
  /** Left inside when the patient is closed, it causes wound-fever (lead-shot wadding, bone splinters…). */
  feverOnClose = false;
  /** Wound-fever drain this contributes if left inside at closing. */
  feverDrain = 0.4;
  /** While > 0, lacerations within this radius cannot be stitched (compound fractures). */
  stitchBlockRadius = 0;
  /** Seconds this entity has existed (world time). */
  age = 0;

  /** Mouse wheel while this entity holds the pointer (e.g. rotating a bone fragment). Return true if used. */
  onWheel(_op: Operation, _dir: number): boolean {
    return false;
  }

  /** Does this entity stop a tool working at a point (frozen flesh rejects the lancet)? */
  blocksTool(_op: Operation, _p: Vec, _tool: ToolId): string | null {
    return null;
  }

  /** Called once when the operation is won (story flags, end-bonus adjustments). */
  onOperationEnd(_op: Operation): void {}

  /** Vitals ceiling this entity imposes while alive (bites, collapsed lungs). */
  vitalsCeiling(_op: Operation): number {
    return Infinity;
  }

  constructor(public pos: Vec) {}

  /** Vitals lost per second while this entity is alive. */
  drain(_op: Operation): number {
    return 0;
  }

  /** Instruments that act on this entity (for wrong-tool hints and the assist tool suggestion). */
  wants(_op: Operation): readonly ToolId[] {
    return [];
  }

  /** What the surgeon would call it in a hint ("a grub", "the arrow"). */
  noun = 'that';

  /** Is the point over this entity (for "nothing there" MISS checks and hints)? */
  hitTest(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < 28 + pad;
  }

  /** A press landed; return true to capture the pointer until release. */
  onPress(_op: Operation, _ptr: Pointer, _tool: ToolId): boolean {
    return false;
  }
  onDrag(_op: Operation, _ptr: Pointer, _tool: ToolId, _dt: number): void {}
  onRelease(_op: Operation, _ptr: Pointer, _tool: ToolId): void {}
  /** Called every frame the button is held and nothing is captured (continuous tools). */
  onSweep(_op: Operation, _ptr: Pointer, _tool: ToolId, _dt: number): void {}
  private revealT = 0;

  /** Lens hovering nearby: by default a hidden entity surfaces once the lens lingers over it. */
  onReveal(op: Operation, p: Vec, dt: number): void {
    if (dist(p, this.pos) > op.tuning.lens.radius) return;
    this.revealT += dt;
    if (this.revealT > op.tuning.lens.reveal) this.reveal(op);
  }

  /** Bring a hidden entity to light (lens, Vigil, auto-lens assist). It stays visible. */
  reveal(op: Operation): void {
    if (!this.hidden) return;
    this.hidden = false;
    op.popup('Found!', this.pos, '#b9d7ff');
    op.cues.push('good');
  }

  /** World time: slowed by the Litany. */
  update(_op: Operation, _dt: number): void {}
  abstract draw(g: Gfx, op: Operation): void;
  /** Write into the surface layer (R cut depth, G stain, B scorch, A swelling), additively. */
  drawSurface(_g: Gfx, _op: Operation): void {}
  /** Write liquid density into the fluid layer (R blood, G pus, B bile). */
  drawFluid(_g: Gfx, _op: Operation): void {}

  kill(): void {
    this.alive = false;
  }
}
