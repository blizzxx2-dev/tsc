/**
 * Headless input harness: a DOM-free `Input` fed with synthetic, timestamped device
 * events, the `OperationInput` controller and a live `Operation` — the same path
 * the operation scene uses, one frame at a time.
 */
import { Input } from '../src/core/input';
import type { Vec } from '../src/core/math';
import { Bindings } from '../src/input/bindings';
import { OperationInput, type HudHit } from '../src/input/opinput';
import type { InputEvent, InputEventBody } from '../src/input/types';
import type { Entity } from '../src/surgery/entity';
import { Operation, type OperationDef, type OperationOptions } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';

export const ALL_TOOLS: ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];

export function defWith(spawn: (op: Operation) => Entity[], tools: readonly ToolId[] = ALL_TOOLS, extra: Partial<OperationDef> = {}): OperationDef {
  return {
    id: 'test',
    title: 'Test',
    patient: 'Test',
    diagnosis: '',
    organ: 'flesh',
    timeLimit: 300,
    tools,
    phases: [{ spawn }],
    ranks: { S: 1000, A: 500, B: 100 },
    litany: true,
    ...extra,
  };
}

export class Harness {
  readonly b = new Bindings(null);
  readonly input = new Input(null, 1280, 720, this.b);
  readonly ctl = new OperationInput(this.b);
  readonly op: Operation;
  /** Sound cues the operation requested (from its event bus). */
  readonly cues: string[] = [];
  t = 1000;
  hud: HudHit | undefined;
  private pads: unknown[] = [];

  constructor(def: OperationDef, opts: OperationOptions = {}) {
    this.op = new Operation(def, opts);
    this.op.events.on('cue', (c) => this.cues.push(c));
    while (this.op.status === 'intro') this.op.update(0.25); // intro → running, first phase spawned
    this.input.setGamepadSource(() => this.pads as never);
    this.tick(); // establish frame timing
  }

  /** Queue a device event `ms` into the next frame. */
  at(ms: number, ev: InputEventBody): this {
    this.input.push({ ...ev, t: this.t + ms } as InputEvent);
    return this;
  }
  move(p: Vec, ms = 1): this {
    return this.at(ms, { type: 'move', x: p.x, y: p.y, src: 'kbm' } as never);
  }
  down(code = 'mouse:0', ms = 2): this {
    return this.at(ms, { type: 'down', code } as never);
  }
  up(code = 'mouse:0', ms = 3, cancel = false): this {
    return this.at(ms, { type: 'up', code, cancel } as never);
  }
  key(code: string, ms = 1): this {
    this.down(`key:${code}`, ms);
    return this.up(`key:${code}`, ms + 0.5);
  }
  setPads(p: unknown[]): this {
    this.pads = p;
    return this;
  }

  /** Advance one frame of `dt` seconds through Input → OperationInput → Operation. */
  tick(dt = 1 / 60, advanceOp = true): this {
    this.t += dt * 1000;
    this.input.beginFrame(this.t, dt);
    this.ctl.update(this.op, this.input, dt, this.hud);
    if (advanceOp) this.op.update(dt);
    this.input.endFrame();
    return this;
  }
  run(seconds: number, dt = 1 / 60): this {
    for (let s = 0; s < seconds - 1e-9; s += dt) this.tick(dt);
    return this;
  }

  /** Press at a point, drag through points (one frame each), release. */
  drag(pts: Vec[], code = 'mouse:0'): this {
    this.move(pts[0]).down(code).tick();
    for (const p of pts.slice(1)) this.move(p).tick();
    return this.up(code).tick();
  }

  captured(): unknown {
    return (this.op as unknown as { captured: unknown }).captured;
  }
}

export function line(a: Vec, b: Vec, n: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  return out;
}

export function fakePad(opts: { id?: string; index?: number; buttons?: Record<number, number>; axes?: number[] } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const v = opts.buttons?.[i] ?? 0;
    return { pressed: v > 0.5, value: v };
  });
  return {
    id: opts.id ?? 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
    index: opts.index ?? 0,
    connected: true,
    mapping: 'standard',
    buttons,
    axes: opts.axes ?? [0, 0, 0, 0],
  };
}
