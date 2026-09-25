import type { Vec } from './math';
import { ActionState, type Edge } from '../input/actionState';
import type { ActionId } from '../input/actions';
import { bindings as defaultBindings, type Bindings } from '../input/bindings';
import { GamepadAdapter, VirtualCursor, type GamepadLike } from '../input/gamepad';
import { detectGlyphSet, setGlyphContext } from '../input/glyphs';
import { KeyboardAdapter } from '../input/keyboard';
import { MouseAdapter } from '../input/mouse';
import type { Device, InputCode, InputEvent, InputFrame, Sticks } from '../input/types';

/**
 * The visible virtual view: the 1280×720 safe area plus any extra width/height
 * the window's aspect ratio reveals (ENG-0182/0183). `ox`/`oy` are the size of
 * the extra margin on the left/top, so safe-area coords = view coords − (ox, oy).
 */
export interface ViewMapping {
  /** Visible view size in virtual units. */
  w: number;
  h: number;
  /** Margin left of / above the safe area, in virtual units. */
  ox: number;
  oy: number;
}

export interface ClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Map a client-space (CSS px) pointer position into safe-area virtual coords
 * (ENG-0185). Correct for any window aspect, letterbox and render scale — the
 * canvas CSS box always shows exactly the view `m`, whatever its backbuffer size.
 */
export function mapPointer(clientX: number, clientY: number, r: ClientRect, m: ViewMapping, out: Vec = { x: 0, y: 0 }): Vec {
  out.x = ((clientX - r.left) / (r.width || 1)) * m.w - m.ox;
  out.y = ((clientY - r.top) / (r.height || 1)) * m.h - m.oy;
  return out;
}

/** One processed event and the action edges it caused, in order. */
export interface TimelineEntry {
  ev: InputEvent;
  edges: Edge[];
}

/** A source of pre-recorded frames (see src/input/record.ts). */
export interface FrameSource {
  next(): InputFrame | null;
}

/** Mouse travel (px) needed to switch prompts back from gamepad to mouse, so resting hands don't flicker. */
export const DEVICE_SWITCH_MOUSE_PX = 4;
const MAX_PATH = 64;
const MAX_QUEUE = 4096;

/**
 * Input facade. Device adapters (mouse, keyboard, gamepad) push timestamped events
 * into one queue. Each fixed simulation tick (`beginStep`) consumes the events
 * stamped before the tick's end into an `InputFrame` snapshot, runs it through the
 * action map, and exposes both the ordered timeline (for the operation, which
 * replays it event by event) and simple per-tick state (for menus). Rendering sees
 * the edges of the whole frame (`beginRender`), so immediate-mode buttons fire once.
 * Pointer coordinates are in the game's virtual safe-area space.
 */
export class Input {
  // ---- per-tick pointer state (primary = the `primary` action: left mouse / RT)
  pos: Vec = { x: 0, y: 0 };
  prev: Vec = { x: 0, y: 0 };
  /** Every pointer sample in the current tick (oldest first). */
  path: Vec[] = [];
  down = false;
  pressed = false;
  released = false;
  /** The Litany draw button (right mouse / LT). */
  rightDown = false;
  rightPressed = false;
  /** Net normalised wheel steps this tick (+ = down/next). */
  wheel = 0;
  /** Latest pointer position, updated as soon as the browser reports it (cursor drawing). */
  readonly latest: Vec = { x: 0, y: 0 };
  readonly view: ViewMapping = { w: 1280, h: 720, ox: 0, oy: 0 };

  // ---- tick data
  frame: InputFrame;
  timeline: TimelineEntry[] = [];
  /** Edges raised at the end of the tick (chord hold-times, stick directions). */
  tailEdges: Edge[] = [];
  readonly actions: ActionState;
  device: Device = 'kbm';
  /** A focus-loss event (blur, hidden tab, Steam overlay) happened this tick. */
  focusLost = false;
  padConnected = false;
  padDisconnected = false;

  // ---- adapters
  readonly mouse: MouseAdapter;
  readonly keyboard: KeyboardAdapter;
  readonly gamepad: GamepadAdapter;
  readonly cursor: VirtualCursor;
  /** Aim-assist hook: gamepad cursor speed factor at a point (set by the operation each tick). */
  cursorSlow: (p: Vec) => number = () => 1;
  /** When false the right stick does not nudge the cursor (radial menu uses it). */
  nudge = true;
  /** Frames are pushed here while recording. */
  recorder: ((f: InputFrame) => void) | null = null;
  /** When set, frames come from here instead of the devices (replay). */
  replay: FrameSource | null = null;
  replayEnded = false;

  private queue: InputEvent[] = [];
  private lastT = 0;
  private mouseTravel = 0;
  private rect: ClientRect | null = null;
  private suppressed = false;
  /** Frame-level accumulation of per-tick edges, shown to render. */
  private acc = { pressed: false, released: false, rightPressed: false, wheel: 0 };
  private getPads: () => readonly (GamepadLike | null)[] = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? (navigator.getGamepads() as unknown as (GamepadLike | null)[]) : []);

  constructor(
    el: HTMLCanvasElement | null,
    viewW: number,
    viewH: number,
    readonly bindings: Bindings = defaultBindings,
  ) {
    this.view.w = viewW;
    this.view.h = viewH;
    const sink = (e: InputEvent) => {
      if (this.queue.length < MAX_QUEUE) this.queue.push(e);
    };
    this.mouse = new MouseAdapter(sink);
    this.keyboard = new KeyboardAdapter(sink);
    this.gamepad = new GamepadAdapter(sink);
    this.cursor = new VirtualCursor(viewW, viewH);
    this.actions = new ActionState((id) => this.bindings.effective(id));
    this.frame = { t: 0, t0: 0, dt: 0, start: { x: 0, y: 0 }, events: [], sticks: { lx: 0, ly: 0, rx: 0, ry: 0 }, device: 'kbm' };
    if (el) this.attach(el);
  }

  private attach(el: HTMLCanvasElement): void {
    const toView = (cx: number, cy: number): Vec => {
      if (!this.rect) this.rect = el.getBoundingClientRect();
      return mapPointer(cx, cy, this.rect, this.view);
    };
    this.mouse.attach(el, toView);
    el.addEventListener('pointermove', (e) => {
      const p = toView(e.clientX, e.clientY);
      this.latest.x = p.x;
      this.latest.y = p.y;
    });
    this.keyboard.attach(window);
    window.addEventListener('blur', (e) => this.focusChange(true, e.timeStamp));
    window.addEventListener('focus', (e) => this.focusChange(false, e.timeStamp));
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', (e) => this.focusChange(document.visibilityState === 'hidden', e.timeStamp));
  }

  /** Invalidate the cached canvas rect (call on resize). */
  resized(): void {
    this.rect = null;
  }

  /** Focus left the game (blur, hidden tab) or came back. Held inputs are released as cancels. */
  focusChange(lost: boolean, t: number): void {
    if (lost) {
      this.keyboard.releaseAll(t);
      this.mouse.cancel(t);
    }
    this.queue.push({ t, type: 'focus', state: lost ? 'lost' : 'gained' });
  }

  /** Steam overlay activation (from steamworks.js `GameOverlayActivated`) counts as focus loss. */
  notifyOverlay(active: boolean, t = performance.now()): void {
    this.focusChange(active, t);
  }

  /** Inject an event (tests, synthetic input). */
  push(ev: InputEvent): void {
    if (this.queue.length < MAX_QUEUE) this.queue.push(ev);
  }

  /** Swap the gamepad source (tests). */
  setGamepadSource(f: () => readonly (GamepadLike | null)[]): void {
    this.getPads = f;
  }

  /** Move the cursor without a device (aim-assist snap). */
  warp(p: Vec): void {
    this.pos = { ...p };
    this.latest.x = p.x;
    this.latest.y = p.y;
  }

  /**
   * Start one simulation tick: consume every queued event stamped at or before
   * `tEnd` (ms, same clock as event timestamps; Infinity = everything).
   * `dt` is the tick's simulation step in seconds (defaults to the time since the last tick).
   */
  beginStep(tEnd = Infinity, dt?: number): void {
    this.prev = { ...this.pos };
    const now = Number.isFinite(tEnd) ? tEnd : typeof performance !== 'undefined' ? performance.now() : this.lastT + 16.7;
    let frame = this.replay ? this.replay.next() : null;
    if (this.replay && !frame) {
      this.replayEnded = true;
      this.replay = null;
    }
    frame ??= this.capture(now, dt);
    this.process(frame);
    this.recorder?.(frame);
  }

  /** Legacy single-step frame: consume everything up to `now`. */
  beginFrame(now?: number, dt?: number): void {
    this.beginStep(now ?? Infinity, dt);
  }

  private capture(now: number, dt?: number): InputFrame {
    const t0 = this.lastT || now - 1000 / 60;
    const prefs = this.bindings.prefs;
    this.mouse.invertWheel = prefs.invertWheel;
    this.gamepad.deadzones = prefs.deadzones;
    const sticks = this.gamepad.poll(this.getPads(), now);
    // Take the events that happened up to the end of this tick; later ones wait for the next.
    this.queue.sort((a, b) => a.t - b.t);
    let n = 0;
    while (n < this.queue.length && this.queue[n].t <= now) n++;
    const events = this.queue.splice(0, n);
    let cur = this.pos;
    for (const e of events) if (e.type === 'move') cur = { x: e.x, y: e.y };
    const step = dt ?? Math.min(0.05, Math.max(0, now - t0) / 1000);
    // The virtual cursor moves from wherever the pointer is now.
    const moved = this.cursor.step(cur, sticks, step, { speed: prefs.cursorSpeed, slow: this.cursorSlow(cur), nudge: this.nudge });
    if (moved.x !== cur.x || moved.y !== cur.y) events.push({ t: now, type: 'move', x: moved.x, y: moved.y, src: 'pad' });
    for (const e of events) e.t = Math.min(now, Math.max(t0, e.t));
    const device = this.trackDevice(events, sticks);
    this.lastT = now;
    return { t: now, t0, dt: step, start: { ...this.pos }, events, sticks, device };
  }

  /** Last-used device, with hysteresis on mouse motion. */
  private trackDevice(events: InputEvent[], sticks: Sticks): Device {
    let d = this.device;
    let last = this.pos;
    for (const e of events) {
      if (e.type === 'down' || e.type === 'wheel') {
        d = e.code.startsWith('pad:') ? 'pad' : 'kbm';
        this.mouseTravel = 0;
      } else if (e.type === 'move') {
        if (e.src === 'pad') {
          d = 'pad';
          this.mouseTravel = 0;
        } else if (d === 'pad') {
          this.mouseTravel += Math.hypot(e.x - last.x, e.y - last.y);
          if (this.mouseTravel > DEVICE_SWITCH_MOUSE_PX) {
            d = 'kbm';
            this.mouseTravel = 0;
          }
        }
        last = { x: e.x, y: e.y };
      }
    }
    if (sticks.lx || sticks.ly || sticks.rx || sticks.ry) d = 'pad';
    return d;
  }

  /** Run a frame through the action map and derive the simple per-tick state. */
  process(frame: InputFrame): void {
    this.frame = frame;
    this.device = frame.device;
    setGlyphContext({ device: this.device, glyphs: this.bindings.prefs.glyphs === 'auto' ? detectGlyphSet(this.gamepad.activeId) : this.bindings.prefs.glyphs });
    this.actions.beginFrame();
    this.timeline = [];
    this.path = [];
    this.focusLost = false;
    this.padConnected = false;
    this.padDisconnected = false;
    this.pressed = false;
    this.released = false;
    this.rightPressed = false;
    this.wheel = 0;
    this.pos = { ...frame.start };
    for (const ev of frame.events) {
      let edges: Edge[];
      if (ev.type === 'move') {
        this.pos = { x: ev.x, y: ev.y };
        if (this.path.length < MAX_PATH) this.path.push(this.pos);
        edges = [];
      } else if (ev.type === 'focus') {
        if (ev.state === 'lost') this.focusLost = true;
        edges = ev.state === 'lost' ? this.actions.releaseAll(ev.t) : [];
      } else if (ev.type === 'pad') {
        if (ev.state === 'connected') this.padConnected = true;
        else this.padDisconnected = true;
        edges = [];
      } else {
        if (ev.type === 'wheel') this.wheel += ev.code === 'wheel:down' ? 1 : -1;
        edges = this.actions.feed(ev);
      }
      for (const e of edges) this.noteEdge(e);
      this.timeline.push({ ev, edges });
    }
    this.tailEdges = this.actions.endFrame(frame.t, frame.sticks);
    for (const e of this.tailEdges) this.noteEdge(e);
    if (!this.path.length) this.path = [this.pos];
    if (frame.device === 'pad' || this.path.length) {
      this.latest.x = this.pos.x;
      this.latest.y = this.pos.y;
    }
    this.down = this.actions.down('primary');
    this.rightDown = this.actions.down('litany.draw');
    // With a gamepad, the confirm button clicks whatever the virtual cursor is over.
    if (this.device === 'pad' && this.actions.pressed('ui.confirm')) this.pressed = true;
    const a = this.acc;
    a.pressed ||= this.pressed;
    a.released ||= this.released;
    a.rightPressed ||= this.rightPressed;
    a.wheel += this.wheel;
  }

  private noteEdge(e: Edge): void {
    if (e.action === 'primary') {
      if (e.kind === 'press') this.pressed = true;
      else this.released = true;
    } else if (e.action === 'litany.draw' && e.kind === 'press') this.rightPressed = true;
  }

  /** Before rendering: expose the whole frame's edges to immediate-mode UI. */
  beginRender(): void {
    this.pressed = this.acc.pressed;
    this.released = this.acc.released;
    this.rightPressed = this.acc.rightPressed;
    this.wheel = this.acc.wheel;
  }

  endFrame(): void {
    this.acc = { pressed: false, released: false, rightPressed: false, wheel: 0 };
    this.pressed = this.released = this.rightPressed = false;
    this.wheel = 0;
  }

  /**
   * Run `fn` with input edges hidden and the pointer parked off-screen — used to
   * render scenes underneath an overlay without them reacting to clicks.
   */
  suppress(fn: () => void): void {
    if (this.suppressed) return fn();
    const saved = { pressed: this.pressed, released: this.released, rightPressed: this.rightPressed, wheel: this.wheel, pos: this.pos };
    this.pressed = this.released = this.rightPressed = false;
    this.wheel = 0;
    this.pos = { x: -1e5, y: -1e5 };
    this.suppressed = true;
    try {
      fn();
    } finally {
      this.suppressed = false;
      this.pressed = saved.pressed;
      this.released = saved.released;
      this.rightPressed = saved.rightPressed;
      this.wheel = saved.wheel;
      this.pos = saved.pos;
    }
  }

  // ---- actions
  act(id: ActionId): boolean {
    return this.actions.down(id);
  }
  actPressed(id: ActionId): boolean {
    return !this.suppressed && this.actions.pressed(id);
  }
  actReleased(id: ActionId): boolean {
    return !this.suppressed && this.actions.released(id);
  }
  /** Pressed, or auto-repeating (menu directions). */
  actRepeated(id: ActionId): boolean {
    return !this.suppressed && this.actions.repeated(id);
  }
  /**
   * @deprecated Scenes read actions (`actPressed`), never physical keys; kept so code
   * written against the old API still compiles. `code` is a `KeyboardEvent.code`.
   */
  key(code: string): boolean {
    return this.actions.codeDown(`key:${code}`);
  }
  /** @deprecated See `key`. */
  keyPressed(code: string): boolean {
    return !this.suppressed && this.actions.codesPressed().includes(`key:${code}`);
  }
  /** Raw physical inputs pressed this tick (for the rebinding capture). */
  codesPressed(): readonly InputCode[] {
    return this.actions.codesPressed();
  }
}
