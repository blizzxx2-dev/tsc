import { dist, type Vec } from '../core/math';
import type { Gfx } from '../render/gfx';
import type { Operation } from './operation';
import type { Pointer, ToolId } from './types';

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

  constructor(public pos: Vec) {}

  /** Vitals lost per second while this entity is alive. */
  drain(_op: Operation): number {
    return 0;
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
    if (dist(p, this.pos) > 60) return;
    this.revealT += dt;
    if (this.revealT > 0.4) {
      this.hidden = false;
      op.popup('Found!', this.pos, '#b9d7ff');
      op.cues.push('good');
    }
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
