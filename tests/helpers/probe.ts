/** A scriptable test entity that records every call the operation makes on it. */
import type { Vec } from '../../src/core/math';
import type { Gfx } from '../../src/render/gfx';
import { Entity } from '../../src/surgery/entity';
import type { Operation } from '../../src/surgery/operation';
import type { Pointer, ToolId } from '../../src/surgery/types';

export interface ProbeOptions {
  layer?: number;
  required?: boolean;
  hidden?: boolean;
  /** Accept presses (capture the pointer) within this radius; 0 = never. */
  grabRadius?: number;
  /** Mark itself `branded` when swept by the brand within this radius (absorbs the brand). */
  absorbBrand?: number;
  drain?: number;
}

export class Probe extends Entity {
  presses: ToolId[] = [];
  drags = 0;
  releases = 0;
  sweeps: ToolId[] = [];
  updates: number[] = [];

  constructor(
    pos: Vec,
    private o: ProbeOptions = {},
  ) {
    super(pos);
    this.layer = o.layer ?? 0;
    this.required = o.required ?? true;
    this.hidden = o.hidden ?? false;
  }

  override drain(): number {
    return this.o.drain ?? 0;
  }

  override onPress(_op: Operation, ptr: Pointer, tool: ToolId): boolean {
    this.presses.push(tool);
    const r = this.o.grabRadius ?? 0;
    return r > 0 && Math.hypot(ptr.pos.x - this.pos.x, ptr.pos.y - this.pos.y) <= r;
  }

  override onDrag(): void {
    this.drags++;
  }

  override onRelease(): void {
    this.releases++;
  }

  override onSweep(_op: Operation, ptr: Pointer, tool: ToolId): void {
    this.sweeps.push(tool);
    const r = this.o.absorbBrand ?? 0;
    if (tool === 'brand' && r > 0 && Math.hypot(ptr.pos.x - this.pos.x, ptr.pos.y - this.pos.y) <= r) this.branded = true;
  }

  override update(_op: Operation, dt: number): void {
    this.branded = false;
    this.updates.push(dt);
  }

  draw(_g: Gfx): void {}
}
