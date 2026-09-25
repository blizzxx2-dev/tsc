/**
 * Shared headless-simulation helpers for every sim test (bot, rule tests,
 * characterisation suites, fuzzers). Nothing here touches the DOM.
 */
import { dist, type Vec } from '../../src/core/math';
import type { Entity } from '../../src/surgery/entity';
import { Operation, type OperationDef, type PhaseDef } from '../../src/surgery/operation';
import { TOOL_INFO, type Pointer, type ToolId } from '../../src/surgery/types';

/** The fixed simulation step every test uses (one 60 Hz frame). */
export const DT = 1 / 60;

export const ALL_TOOLS: readonly ToolId[] = TOOL_INFO.map((t) => t.id);

export const makeOp = (def: OperationDef): Operation => new Operation(def);

/** Advance the simulation by `seconds` of wall time in fixed 60 Hz frames. */
export function step(op: Operation, seconds: number): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) op.update(DT);
}

/** Run the intro until the first phase has spawned (status `running`). */
export function start(op: Operation): Operation {
  for (let i = 0; i < 600 && op.status === 'intro'; i++) op.update(DT);
  return op;
}

// ------------------------------------------------------------------ pointer builders

export const press = (pos: Vec, prev: Vec = pos): Pointer => ({ pos: { ...pos }, prev: { ...prev }, down: true, pressed: true, released: false });
export const drag = (pos: Vec, prev: Vec): Pointer => ({ pos: { ...pos }, prev: { ...prev }, down: true, pressed: false, released: false });
export const release = (pos: Vec, prev: Vec = pos): Pointer => ({ pos: { ...pos }, prev: { ...prev }, down: false, pressed: false, released: true });
export const hover = (pos: Vec, prev: Vec = pos): Pointer => ({ pos: { ...pos }, prev: { ...prev }, down: false, pressed: false, released: false });

/**
 * The pointer the game builds for one frame, given this frame's position/button
 * and last frame's. Shared by the bot and the E2E mirror so both drive the sim identically.
 */
export const pointerFrame = (pos: Vec, prev: Vec, down: boolean, wasDown: boolean): Pointer => ({
  pos: { ...pos },
  prev: { ...prev },
  down,
  pressed: down && !wasDown,
  released: !down && wasDown,
});

/** Sample a polyline at roughly `speed` px/s, one point per frame (first point included). */
export function samplePath(points: Vec[], speed = 420): Vec[] {
  const out: Vec[] = [{ ...points[0] }];
  const stepLen = speed * DT;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(dist(a, b) / stepLen));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

export interface StrokeOptions {
  /** Pointer speed in virtual px per second (default 420). */
  speed?: number;
  /** Also run `op.update(DT)` each frame (default true), as the game loop does. */
  tick?: boolean;
  /** Keep the button held on the last point for this many extra seconds before releasing. */
  dwell?: number;
}

/**
 * Press at the first point, drag through the rest at a human-ish speed and release,
 * one `handlePointer` + `update` per frame — exactly how the operation scene feeds the sim.
 */
export function strokePath(op: Operation, tool: ToolId, points: Vec[], opts: StrokeOptions = {}): void {
  const tick = opts.tick ?? true;
  op.setTool(tool);
  const pts = samplePath(points, opts.speed);
  let prev = pts[0];
  op.handlePointer(press(pts[0]), DT);
  if (tick) op.update(DT);
  for (let i = 1; i < pts.length; i++) {
    op.handlePointer(drag(pts[i], prev), DT);
    if (tick) op.update(DT);
    prev = pts[i];
  }
  for (let t = 0; t < (opts.dwell ?? 0) - 1e-9; t += DT) {
    op.handlePointer(drag(prev, prev), DT);
    if (tick) op.update(DT);
  }
  op.handlePointer(release(prev, prev), DT);
  if (tick) op.update(DT);
}

/** Press and hold still at `pos` for `seconds`, then release. */
export function holdAt(op: Operation, tool: ToolId, pos: Vec, seconds: number, tick = true): void {
  op.setTool(tool);
  op.handlePointer(press(pos), DT);
  if (tick) op.update(DT);
  for (let t = DT; t < seconds - 1e-9; t += DT) {
    op.handlePointer(drag(pos, pos), DT);
    if (tick) op.update(DT);
  }
  op.handlePointer(release(pos), DT);
  if (tick) op.update(DT);
}

/** Hold with the pointer following a moving target (e.g. a wandering grub). */
export function holdOn(op: Operation, tool: ToolId, target: () => Vec | null, seconds: number): void {
  op.setTool(tool);
  let p = target();
  if (!p) return;
  let prev = p;
  op.handlePointer(press(p), DT);
  op.update(DT);
  for (let t = DT; t < seconds - 1e-9; t += DT) {
    const next = target();
    if (!next) break;
    p = next;
    op.handlePointer(drag(p, prev), DT);
    op.update(DT);
    prev = p;
  }
  op.handlePointer(release(prev), DT);
  op.update(DT);
}

/** A single click (press one frame, release the next). */
export function tap(op: Operation, tool: ToolId, pos: Vec, tick = true): void {
  op.setTool(tool);
  op.handlePointer(press(pos), DT);
  if (tick) op.update(DT);
  op.handlePointer(release(pos), DT);
  if (tick) op.update(DT);
}

/** Hover (button up) — the lens reveals while merely hovering. */
export function hoverAt(op: Operation, tool: ToolId, pos: Vec, seconds: number): void {
  op.setTool(tool);
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    op.handlePointer(hover(pos), DT);
    op.update(DT);
  }
}

// ------------------------------------------------------------------ gesture shapes

/** Zig-zag across the straight wound a→b, crossing it `crossings` times, `amplitude` px either side. */
export function zigzag(a: Vec, b: Vec, amplitude = 26, crossings = 6): Vec[] {
  return zigzagAlong([a, b], crossings, amplitude);
}

/** Zig-zag across a polyline, crossing it `crossings` times. */
export function zigzagAlong(line: Vec[], crossings: number, amp = 26): Vec[] {
  const lens: number[] = [0];
  for (let i = 1; i < line.length; i++) lens.push(lens[i - 1] + dist(line[i - 1], line[i]));
  const total = lens[lens.length - 1];
  const at = (s: number): { p: Vec; n: Vec } => {
    let i = 1;
    while (i < line.length - 1 && lens[i] < s) i++;
    const a = line[i - 1];
    const b = line[i];
    const seg = lens[i] - lens[i - 1] || 1;
    const t = (s - lens[i - 1]) / seg;
    const d = { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg };
    return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, n: { x: -d.y, y: d.x } };
  };
  const pts: Vec[] = [];
  for (let i = 0; i <= crossings; i++) {
    const s = total * (0.04 + (0.92 * i) / crossings);
    const { p, n } = at(s);
    const side = i % 2 ? -amp : amp;
    pts.push({ x: p.x + n.x * side, y: p.y + n.y * side });
  }
  return pts;
}

/** Boustrophedon brush raster over a disc (for salve). */
export function raster(c: Vec, r: number): Vec[] {
  const pts: Vec[] = [];
  let flip = false;
  for (let y = -r; y <= r; y += 16) {
    const w = Math.sqrt(Math.max(0, r * r - y * y)) + 6;
    const row = [
      { x: c.x - w, y: c.y + y },
      { x: c.x + w, y: c.y + y },
    ];
    pts.push(...(flip ? row.reverse() : row));
    flip = !flip;
  }
  return pts;
}

// ------------------------------------------------------------------ isolated-entity definitions

/**
 * A single-phase operation holding only the entities `spawn` returns: no passive drain,
 * a 999 s clock and all eight tools, so one entity can be exercised without neighbours.
 */
export function defWith(spawn: (op: Operation) => Entity[], overrides: Partial<OperationDef> = {}): OperationDef {
  const phase: PhaseDef = { spawn };
  return {
    id: 'test',
    title: 'Test',
    patient: 'Test subject',
    diagnosis: 'Isolated entity under test.',
    organ: 'flesh',
    timeLimit: 999,
    baseDrain: 0,
    tools: ALL_TOOLS,
    phases: [phase],
    ranks: { S: 1000, A: 800, B: 600 },
    seed: 7,
    ...overrides,
  };
}

/** Build an op from `defWith`, run the intro and return the op plus the spawned entities. */
export function isolate<T extends Entity>(spawn: (op: Operation) => T[], overrides: Partial<OperationDef> = {}): { op: Operation; ents: T[] } {
  let spawned: T[] = [];
  const op = start(
    makeOp(
      defWith((o) => {
        spawned = spawn(o);
        return spawned;
      }, overrides),
    ),
  );
  return { op, ents: spawned };
}

/** Live entities of a class. */
export const live = <T extends Entity>(op: Operation, cls: abstract new (...a: never[]) => T): T[] =>
  op.entities.filter((e): e is T => e.alive && e instanceof cls);
