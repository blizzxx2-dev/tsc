import { clamp, type Vec } from '../core/math';
import type { Deadzone } from './bindings';
import type { InputEvent, Sticks } from './types';

type Sink = (e: InputEvent) => void;

/** The subset of the Gamepad API the adapter reads (so tests can pass plain objects). */
export interface GamepadLike {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

/** Analogue buttons (triggers) count as pressed past this value. */
export const TRIGGER_THRESHOLD = 0.5;

/**
 * Radial deadzone with rescaling: magnitudes below `inner` read as zero, above
 * `outer` as one, and the band between is stretched to 0..1 so there is no jump
 * at the edge of the deadzone.
 */
export function radialDeadzone(x: number, y: number, dz: Deadzone): Vec {
  const m = Math.hypot(x, y);
  if (m <= dz.inner || m === 0) return { x: 0, y: 0 };
  const scaled = clamp((m - dz.inner) / Math.max(1e-6, dz.outer - dz.inner), 0, 1);
  return { x: (x / m) * scaled, y: (y / m) * scaled };
}

/**
 * Gamepad adapter: polls `navigator.getGamepads()` once per frame, turns button
 * transitions into `pad:<n>` events, dead-zones the sticks and reports hot-plug.
 * The most recently connected standard-mapping pad is the active one.
 */
export class GamepadAdapter {
  private prev: boolean[] = [];
  private activeIndex: number | null = null;
  activeId = '';
  sticks: Sticks = { lx: 0, ly: 0, rx: 0, ry: 0 };
  deadzones: { left: Deadzone; right: Deadzone } = { left: { inner: 0.15, outer: 0.95 }, right: { inner: 0.15, outer: 0.95 } };
  /** True if any button changed or a stick left its deadzone during the last poll. */
  active = false;

  constructor(private sink: Sink) {}

  get connected(): boolean {
    return this.activeIndex !== null;
  }

  poll(pads: readonly (GamepadLike | null)[], t: number): Sticks {
    this.active = false;
    const live = pads.filter((p): p is GamepadLike => !!p && p.connected);
    let pad = live.find((p) => p.index === this.activeIndex) ?? null;
    if (!pad && this.activeIndex !== null) {
      // The active pad vanished: release its buttons and report the disconnect.
      for (let i = 0; i < this.prev.length; i++) if (this.prev[i]) this.sink({ t, type: 'up', code: `pad:${i}`, cancel: true });
      this.prev = [];
      this.sink({ t, type: 'pad', state: 'disconnected', id: this.activeId });
      this.activeIndex = null;
      this.activeId = '';
    }
    if (!pad) {
      pad = live.find((p) => p.mapping === 'standard') ?? live[0] ?? null;
      if (pad) {
        this.activeIndex = pad.index;
        this.activeId = pad.id;
        this.prev = [];
        this.sink({ t, type: 'pad', state: 'connected', id: pad.id });
      }
    }
    if (!pad) {
      this.sticks = { lx: 0, ly: 0, rx: 0, ry: 0 };
      return this.sticks;
    }
    const button = (i: number) => {
      const b = pad!.buttons[i];
      return !!b && (b.pressed || b.value > TRIGGER_THRESHOLD);
    };
    const axis = (i: number) => pad!.axes[i] ?? 0;
    const n = Math.max(17, pad.buttons.length);
    for (let i = 0; i < n; i++) {
      const on = button(i);
      if (on !== !!this.prev[i]) {
        this.active = true;
        this.sink(on ? { t, type: 'down', code: `pad:${i}` } : { t, type: 'up', code: `pad:${i}` });
      }
      this.prev[i] = on;
    }
    const l = radialDeadzone(axis(0), axis(1), this.deadzones.left);
    const r = radialDeadzone(axis(2), axis(3), this.deadzones.right);
    this.sticks = { lx: l.x, ly: l.y, rx: r.x, ry: r.y };
    if (l.x || l.y || r.x || r.y) this.active = true;
    return this.sticks;
  }
}

export const CURSOR_MAX_SPEED = 900;
export const CURSOR_EXPONENT = 2;
export const CURSOR_RAMP = 0.08;
export const NUDGE_FRACTION = 0.25;

/**
 * The gamepad's virtual cursor. Left stick: response curve m^2, 900 px/s at full
 * deflection, reaching full speed over an 80 ms ramp. Right stick: a precision
 * nudge at 25 % speed. `slow` (aim assist) scales both. Clamped to the view.
 */
export class VirtualCursor {
  private heldFor = 0;

  constructor(
    public viewW: number,
    public viewH: number,
  ) {}

  step(pos: Vec, sticks: Sticks, dt: number, opts: { speed: number; slow: number; nudge: boolean }): Vec {
    const lm = Math.hypot(sticks.lx, sticks.ly);
    const rm = opts.nudge ? Math.hypot(sticks.rx, sticks.ry) : 0;
    if (lm === 0 && rm === 0) {
      this.heldFor = 0;
      return pos;
    }
    this.heldFor += dt;
    const ramp = Math.min(1, this.heldFor / CURSOR_RAMP);
    const base = CURSOR_MAX_SPEED * opts.speed * opts.slow * ramp;
    let vx = 0;
    let vy = 0;
    if (lm > 0) {
      const v = base * Math.pow(lm, CURSOR_EXPONENT);
      vx += (sticks.lx / lm) * v;
      vy += (sticks.ly / lm) * v;
    }
    if (rm > 0) {
      const v = base * NUDGE_FRACTION * Math.pow(rm, CURSOR_EXPONENT);
      vx += (sticks.rx / rm) * v;
      vy += (sticks.ry / rm) * v;
    }
    return { x: clamp(pos.x + vx * dt, 0, this.viewW), y: clamp(pos.y + vy * dt, 0, this.viewH) };
  }
}
