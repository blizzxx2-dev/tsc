/** Helpers for driving an Operation by hand in unit tests. */
import type { Vec } from '../src/core/math';
import { Entity } from '../src/surgery/entity';
import { FIELD, Operation, type OperationDef, type OperationOptions, type PhaseDef } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { tapeOp } from './helpers/sim';

export const DT = 1 / 60;
export const ALL_TOOLS: readonly ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];
export const C: Vec = { x: FIELD.cx, y: FIELD.cy };
export const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });
export const OFF: Vec = { x: FIELD.cx, y: FIELD.cy - FIELD.ry - 80 };

/** A required, inert entity that keeps the phase open while a test runs. */
export class Anchor extends Entity {
  constructor() {
    super({ x: 20, y: 20 });
  }
  override hitTest(): boolean {
    return false;
  }
  draw(): void {}
}

export function testDef(spawn: (op: Operation) => Entity[], extra: Partial<OperationDef> = {}, phases?: PhaseDef[]): OperationDef {
  return {
    id: 'test',
    title: 'Test',
    patient: 'Dummy',
    diagnosis: 'Test',
    organ: 'flesh',
    timeLimit: 300,
    tools: ALL_TOOLS,
    ranks: { S: 5000, A: 4000, B: 3000 },
    seed: 5,
    noClose: true,
    phases: phases ?? [{ spawn }],
    ...extra,
  };
}

/** An operation already running its first phase. A trailing dummy phase keeps it from winning at once. */
export function running(spawn: (op: Operation) => Entity[], extra: Partial<OperationDef> = {}, opts: OperationOptions = {}): Operation {
  const def = testDef(spawn, extra, extra.phases ? [...extra.phases] : [{ spawn }, { spawn: () => [] }]);
  const op = tapeOp(new Operation(def, opts));
  while (op.status === 'intro') op.update(DT);
  return op;
}

/** Pointer driver that remembers the previous position and button state. */
export class Hand {
  prev: Vec;
  down = false;
  constructor(
    public op: Operation,
    start: Vec = C,
  ) {
    this.prev = { ...start };
  }

  frame(tool: ToolId, pos: Vec, down: boolean, dt = DT, update = true): void {
    this.op.setTool(tool);
    this.op.handlePointer({ pos, prev: this.prev, down, pressed: down && !this.down, released: !down && this.down }, dt);
    this.down = down;
    this.prev = { ...pos };
    if (update) this.op.update(dt);
  }

  press(tool: ToolId, p: Vec): void {
    this.frame(tool, p, true);
  }

  release(tool?: ToolId): void {
    this.frame(tool ?? this.op.tool, this.prev, false);
  }

  /** Hold still for `s` seconds. */
  hold(tool: ToolId, p: Vec, s: number): void {
    for (let t = 0; t < s - 1e-9; t += DT) this.frame(tool, p, true);
  }

  /** Drag through points at `speed` px/s (button down throughout), then optionally release. */
  drag(tool: ToolId, pts: Vec[], speed = 400, release = true): void {
    this.frame(tool, pts[0], true);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (speed * DT)));
      for (let k = 1; k <= n; k++) this.frame(tool, { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, true);
    }
    if (release) this.release(tool);
  }

  tap(tool: ToolId, p: Vec): void {
    this.frame(tool, p, true);
    this.frame(tool, p, false);
  }

  idle(s: number): void {
    for (let t = 0; t < s - 1e-9; t += DT) this.frame(this.op.tool, this.prev, false);
  }
}

/** Advance world time without input. */
export function wait(op: Operation, s: number): void {
  for (let t = 0; t < s - 1e-9; t += DT) op.update(DT);
}

export const zig = (a: Vec, b: Vec, n: number, amp = 24): Vec[] => {
  const pts: Vec[] = [];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / L;
  const ny = (b.x - a.x) / L;
  for (let i = 0; i <= n; i++) {
    const t = 0.04 + (0.92 * i) / n;
    const s = i % 2 ? -amp : amp;
    pts.push({ x: a.x + (b.x - a.x) * t + nx * s, y: a.y + (b.y - a.y) * t + ny * s });
  }
  return pts;
};

export const ratings = (op: Operation) => op.counts;
