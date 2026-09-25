import type { Vec } from './math';
import { ActionState, type Edge } from '../input/actionState';
import type { ActionId } from '../input/actions';
import { bindings as defaultBindings, type Bindings } from '../input/bindings';
import { GamepadAdapter, VirtualCursor, type GamepadLike } from '../input/gamepad';
import { detectGlyphSet, setGlyphContext } from '../input/glyphs';
import { KeyboardAdapter } from '../input/keyboard';
import { MouseAdapter } from '../input/mouse';
import type { Device, InputCode, InputEvent, InputFrame, Sticks } from '../input/types';

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

/**
 * Input facade. Device adapters (mouse, keyboard, gamepad) push timestamped events
 * into one queue; once per tick `beginFrame` builds an `InputFrame` snapshot, runs
 * it through the action map and exposes both the ordered timeline (for the
 * operation, which replays it event by event) and simple per-frame state (for
 * menus). Pointer coordinates are in the game's virtual resolution.
 */
export class Input {
  // ---- per-frame pointer state (primary = the `primary` action: left mouse / RT)
  pos: Vec = { x: 0, y: 0 };
  prev: Vec = { x: 0, y: 0 };
  /** Every pointer sample since the previous frame (oldest first). */
  path: Vec[] = [];
  down = false;
  pressed = false;
  released = false;
  /** The Litany draw button (right mouse / LT). */
  rightDown = false;
  rightPressed = false;
  /** Net normalised wheel steps this frame (+ = down/next). */
  wheel = 0;

  // ---- frame data
  frame: InputFrame;
  timeline: TimelineEntry[] = [];
  /** Edges raised at the end of the frame (chord hold-times, stick directions). */
  tailEdges: Edge[] = [];
  readonly actions: ActionState;
  device: Device = 'kbm';
  /** A focus-loss event (blur, hidden tab, Steam overlay) happened this frame. */
  focusLost = false;
  padConnected = false;
  padDisconnected = false;

  // ---- adapters
  readonly mouse: MouseAdapter;
  readonly keyboard: KeyboardAdapter;
  readonly gamepad: GamepadAdapter;
  readonly cursor: VirtualCursor;
  /** Aim-assist hook: gamepad cursor speed factor at a point (set by the operation each frame). */
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
  private getPads: () => readonly (GamepadLike | null)[] = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? (navigator.getGamepads() as unknown as (GamepadLike | null)[]) : []);

  constructor(
    el: HTMLCanvasElement | null,
    private viewW: number,
    private viewH: number,
    readonly bindings: Bindings = defaultBindings,
  ) {
    const sink = (e: InputEvent) => this.queue.push(e);
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
      const r = el.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * this.viewW, y: ((cy - r.top) / r.height) * this.viewH };
    };
    this.mouse.attach(el, toView);
    this.keyboard.attach(window);
    window.addEventListener('blur', (e) => this.focusChange(true, e.timeStamp));
    window.addEventListener('focus', (e) => this.focusChange(false, e.timeStamp));
    document.addEventListener('visibilitychange', (e) => this.focusChange(document.visibilityState === 'hidden', e.timeStamp));
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
    this.queue.push(ev);
  }

  /** Swap the gamepad source (tests). */
  setGamepadSource(f: () => readonly (GamepadLike | null)[]): void {
    this.getPads = f;
  }

  /** Move the cursor without a device (aim-assist snap). */
  warp(p: Vec): void {
    this.pos = { ...p };
  }

  /** Latch events that happened since the last frame. Call at the start of each update. */
  beginFrame(now: number = typeof performance !== 'undefined' ? performance.now() : 0, dt?: number): void {
    const frame = this.replay ? this.replay.next() : this.capture(now, dt);
    if (!frame) {
      this.replayEnded = true;
      this.replay = null;
      this.process(this.capture(now, dt));
      return;
    }
    this.process(frame);
    this.recorder?.(frame);
  }

  private capture(now: number, dt?: number): InputFrame {
    const t0 = this.lastT || now - 16.7;
    const prefs = this.bindings.prefs;
    this.mouse.invertWheel = prefs.invertWheel;
    this.gamepad.deadzones = prefs.deadzones;
    this.mouse.beginFrame();
    const sticks = this.gamepad.poll(this.getPads(), now);
    if (this.gamepad.connected) setGlyphContext({ device: this.device, glyphs: prefs.glyphs === 'auto' ? detectGlyphSet(this.gamepad.activeId) : prefs.glyphs });
    // The virtual cursor moves from wherever the pointer is now.
    const events = this.queue.sort((a, b) => a.t - b.t);
    this.queue = [];
    let cur = this.pos;
    for (const e of events) if (e.type === 'move') cur = { x: e.x, y: e.y };
    const step = dt ?? Math.min(0.05, (now - t0) / 1000);
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

  /** Run a frame through the action map and derive the simple per-frame state. */
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
        if (this.path.length < 64) this.path.push(this.pos);
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
    this.down = this.actions.down('primary');
    this.rightDown = this.actions.down('litany.draw');
    // With a gamepad, the confirm button clicks whatever the virtual cursor is over.
    if (this.device === 'pad' && this.actions.pressed('ui.confirm')) this.pressed = true;
  }

  private noteEdge(e: Edge): void {
    if (e.action === 'primary') {
      if (e.kind === 'press') this.pressed = true;
      else this.released = true;
    } else if (e.action === 'litany.draw' && e.kind === 'press') this.rightPressed = true;
  }

  endFrame(): void {
    this.prev = { ...this.pos };
  }

  // ---- actions
  act(id: ActionId): boolean {
    return this.actions.down(id);
  }
  actPressed(id: ActionId): boolean {
    return this.actions.pressed(id);
  }
  actReleased(id: ActionId): boolean {
    return this.actions.released(id);
  }
  /** Pressed, or auto-repeating (menu directions). */
  actRepeated(id: ActionId): boolean {
    return this.actions.repeated(id);
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
    return this.actions.codesPressed().includes(`key:${code}`);
  }
  /** Raw physical inputs pressed this frame (for the rebinding capture). */
  codesPressed(): readonly InputCode[] {
    return this.actions.codesPressed();
  }
}
