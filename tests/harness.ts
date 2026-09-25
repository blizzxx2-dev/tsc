/**
 * Tiny helpers for driving an Operation by hand in unit tests.
 */
import type { Vec } from '../src/core/math';
import type { Entity } from '../src/surgery/entity';
import { FIELD, Operation, type OperationDef } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';

export const DT = 1 / 60;
export const ALL: readonly ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];
export const C: Vec = { x: FIELD.cx, y: FIELD.cy };
export const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

/** A running operation whose first phase spawns `spawn` (plus a required anchor so it never auto-wins). */
export function start(spawn: (op: Operation) => Entity[] = () => [], opts: Partial<OperationDef> = {}): Operation {
  const def: OperationDef = {
    id: 'test',
    title: 'Test',
    patient: 'Test',
    diagnosis: 'Test',
    organ: 'flesh',
    timeLimit: 999,
    tools: ALL,
    ranks: { S: 1, A: 1, B: 1 },
    seed: 7,
    phases: [{ spawn }],
    ...opts,
  };
  const op = new Operation(def);
  while (op.status === 'intro') op.update(DT);
  return op;
}

/** Advance world time (no input). */
export function wait(op: Operation, seconds: number): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) op.update(DT);
}

/** A hand on the instruments: presses, drags and releases through the real pointer path. */
export class Hand {
  private prev: Vec = { ...C };
  private isDown = false;
  constructor(private op: Operation) {}

  private frame(pos: Vec, down: boolean): void {
    this.op.handlePointer({ pos, prev: this.prev, down, pressed: down && !this.isDown, released: !down && this.isDown }, DT);
    this.isDown = down;
    this.prev = pos;
    this.op.update(DT);
  }

  press(tool: ToolId, p: Vec): this {
    this.op.setTool(tool);
    this.frame(p, true);
    return this;
  }

  release(): this {
    this.frame(this.prev, false);
    return this;
  }

  tap(tool: ToolId, p: Vec): this {
    return this.press(tool, p).release();
  }

  /** Hold still (pressed) at p for `seconds`. */
  hold(tool: ToolId, p: Vec, seconds: number, release = true): this {
    this.press(tool, p);
    for (let t = DT; t < seconds; t += DT) this.frame(p, true);
    return release ? this.release() : this;
  }

  /** Drag along a polyline at `speed` px/s, pressing at the first point. */
  drag(tool: ToolId, pts: Vec[], speed = 300, release = true): this {
    this.press(tool, pts[0]);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (speed * DT)));
      for (let k = 1; k <= n; k++) this.frame({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, true);
    }
    return release ? this.release() : this;
  }

  /** One frame with the button up at p (the instrument hovers). */
  hover(p: Vec): this {
    this.frame(p, false);
    return this;
  }

  /** Trace a closed local path around a moving target for `seconds`, button held. */
  traceMoving(tool: ToolId, at: () => Vec, path: readonly Vec[], seconds: number, speed = 120): this {
    let per = 0;
    for (let i = 1; i < path.length; i++) per += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const along = (s: number): Vec => {
      s %= per;
      for (let i = 1; i < path.length; i++) {
        const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
        if (s <= l) return { x: path[i - 1].x + ((path[i].x - path[i - 1].x) * s) / l, y: path[i - 1].y + ((path[i].y - path[i - 1].y) * s) / l };
        s -= l;
      }
      return path[0];
    };
    this.op.setTool(tool);
    for (let t = 0, s = 0; t < seconds; t += DT, s += speed * DT) {
      const c = at();
      const l = along(s);
      this.frame({ x: c.x + l.x, y: c.y + l.y }, true);
    }
    return this.release();
  }
}

/** Every live entity of a class. */
export const all = <T extends Entity>(op: Operation, cls: abstract new (...a: never[]) => T): T[] => op.entities.filter((e): e is T => e instanceof cls && e.alive);
