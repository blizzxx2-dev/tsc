import type { Vec } from '../core/math';

/**
 * Physical input codes. Every device adapter reports its inputs as plain strings so
 * bindings, recordings and the rebinding screen can treat them uniformly:
 *
 * - `key:<KeyboardEvent.code>`   e.g. `key:KeyQ`, `key:Digit1`, `key:Space`
 * - `mouse:<button>`             0 left, 1 middle, 2 right, 3 back (X1), 4 forward (X2)
 * - `wheel:up` / `wheel:down`    one normalised wheel step (instantaneous)
 * - `pad:<button>`               W3C standard-mapping button index (0 A/Cross … 16 Guide)
 * - `pad:<a>+pad:<b>`            a chord: satisfied while every part is held
 */
export type InputCode = string;

export type Device = 'kbm' | 'pad';

/** One timestamped event, in the order it happened. `t` is `event.timeStamp` (ms, performance clock). */
export type InputEvent =
  | { t: number; type: 'down'; code: InputCode }
  | { t: number; type: 'up'; code: InputCode; cancel?: boolean }
  | { t: number; type: 'move'; x: number; y: number; src: Device }
  | { t: number; type: 'wheel'; code: 'wheel:up' | 'wheel:down' }
  | { t: number; type: 'focus'; state: 'lost' | 'gained' }
  | { t: number; type: 'pad'; state: 'connected' | 'disconnected'; id: string };

export interface Sticks {
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

/**
 * Everything the game needs to know about input for one tick. Built by the device
 * adapters (or read back from a recording) and consumed in order by the scenes.
 * Plain data so it can be serialised for record/replay.
 */
export interface InputFrame {
  /** Frame time (ms, performance clock) and the previous frame's time. */
  t: number;
  t0: number;
  /** Simulation step for this frame in seconds (already clamped by the game loop). */
  dt: number;
  /** Cursor position at the start of the frame (virtual 1280×720 space). */
  start: Vec;
  events: InputEvent[];
  /** Dead-zoned gamepad sticks at the end of the frame. */
  sticks: Sticks;
  /** Device the player used most recently (drives glyphs). */
  device: Device;
}

export const ZERO_STICKS: Sticks = { lx: 0, ly: 0, rx: 0, ry: 0 };

/** An event without its timestamp (for building synthetic streams). */
export type InputEventBody = InputEvent extends infer E ? (E extends unknown ? Omit<E, 't'> : never) : never;
