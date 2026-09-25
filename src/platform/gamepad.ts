/**
 * Gamepad API backend (PLT-0153, PLT-0157): standard-mapping pads drive a virtual surgical cursor and
 * the game's existing mouse/keyboard input, polled once per frame, with hot-plug and disconnect
 * handling. Steam Input (when enabled by the player's Steam configuration) presents pads through the
 * same API, so this is also the fallback path when Steam Input is off.
 *
 * Standard mapping: left stick = cursor; A or RT = left button (incise/hold); LT = right button
 * (Litany star); LB/RB and D-pad left/right = previous/next tool (wheel); Y = quick-swap (Tab);
 * Start/B = pause (Escape); X = confirm (Enter).
 */

export interface PadButton {
  pressed: boolean;
  value: number;
}
export interface PadState {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly PadButton[];
}

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export const DEADZONE = 0.18;

/** Radial deadzone with rescale, then a response curve: `accel` 0 = linear … 3 = strongly eased. */
export function stickToVelocity(x: number, y: number, speed: number, accel: number): { vx: number; vy: number } {
  const mag = Math.hypot(x, y);
  if (mag < DEADZONE) return { vx: 0, vy: 0 };
  const m = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
  const curved = Math.pow(m, 1 + accel);
  return { vx: (x / mag) * curved * speed, vy: (y / mag) * curved * speed };
}

export interface PadFrame {
  /** Any input this frame (for last-used-device tracking). */
  active: boolean;
  dx: number;
  dy: number;
  left: boolean;
  right: boolean;
  wheel: number;
  /** Key codes pressed this frame (edges), mapped from buttons. */
  keys: string[];
}

const pressed = (p: PadState, i: number, threshold = 0.5) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > threshold);

/** Translates pad snapshots into cursor deltas and button edges. Pure: feed it states, read frames. */
export class PadMapper {
  private prev = new Map<number, boolean[]>();

  frame(pads: readonly (PadState | null)[], dt: number, speed: number, accel: number): PadFrame {
    const out: PadFrame = { active: false, dx: 0, dy: 0, left: false, right: false, wheel: 0, keys: [] };
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const now = Array.from({ length: 16 }, (_, i) => pressed(p, i));
      const before = this.prev.get(p.index) ?? now.map(() => false);
      const edge = (i: number) => now[i] && !before[i];
      const { vx, vy } = stickToVelocity(p.axes[0] ?? 0, p.axes[1] ?? 0, speed, accel);
      out.dx += vx * dt;
      out.dy += vy * dt;
      out.left ||= now[BTN.A] || now[BTN.RT];
      out.right ||= now[BTN.LT];
      if (edge(BTN.LB) || edge(BTN.LEFT)) out.wheel -= 1;
      if (edge(BTN.RB) || edge(BTN.RIGHT)) out.wheel += 1;
      if (edge(BTN.START) || edge(BTN.B)) out.keys.push('Escape');
      if (edge(BTN.Y)) out.keys.push('Tab');
      if (edge(BTN.X)) out.keys.push('Enter');
      out.active ||= vx !== 0 || vy !== 0 || now.some((b) => b);
      this.prev.set(p.index, now);
    }
    return out;
  }

  forget(index: number): void {
    this.prev.delete(index);
  }
}

/** Minimal view of the game's Input the gamepad writes into (public fields of core/input.ts). */
export interface InputSink {
  pos: { x: number; y: number };
  path: { x: number; y: number }[];
  down: boolean;
  pressed: boolean;
  released: boolean;
  rightDown: boolean;
  rightPressed: boolean;
  wheel: number;
}

export class GamepadController {
  readonly mapper = new PadMapper();
  lastDevice: 'mouse' | 'gamepad' = 'mouse';
  private wasLeft = false;
  private wasRight = false;
  connected = 0;

  constructor(
    private viewW: number,
    private viewH: number,
    private onDisconnect: () => void,
  ) {
    if (typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', () => this.connected++);
    window.addEventListener('gamepaddisconnected', (e) => {
      this.connected = Math.max(0, this.connected - 1);
      this.mapper.forget((e as GamepadEvent).gamepad.index);
      if (this.lastDevice === 'gamepad') this.onDisconnect();
    });
    const toMouse = () => (this.lastDevice = 'mouse');
    window.addEventListener('pointermove', toMouse);
    window.addEventListener('pointerdown', toMouse);
  }

  /** Call after `input.beginFrame()`: merges pad state into the frame's input. */
  poll(input: InputSink, dt: number, speed: number, accel: number): void {
    const nav = globalThis.navigator as Navigator | undefined;
    if (!nav?.getGamepads) return;
    const pads = nav.getGamepads().map((g) => (g ? { index: g.index, id: g.id, connected: g.connected, mapping: g.mapping, axes: g.axes, buttons: g.buttons } : null));
    const f = this.mapper.frame(pads, dt, speed, accel);
    if (f.active) this.lastDevice = 'gamepad';
    if (this.lastDevice !== 'gamepad') {
      this.wasLeft = this.wasRight = false;
      return;
    }
    if (f.dx || f.dy) {
      input.pos = { x: Math.min(this.viewW, Math.max(0, input.pos.x + f.dx)), y: Math.min(this.viewH, Math.max(0, input.pos.y + f.dy)) };
      input.path.push({ ...input.pos });
    }
    if (f.left !== this.wasLeft) {
      input.down = f.left;
      if (f.left) input.pressed = true;
      else input.released = true;
      this.wasLeft = f.left;
    }
    if (f.right !== this.wasRight) {
      input.rightDown = f.right;
      if (f.right) input.rightPressed = true;
      this.wasRight = f.right;
    }
    input.wheel += f.wheel;
    for (const code of f.keys) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
    }
  }
}
