import type { Vec } from './math';

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

type InputEvent =
  | { t: number; kind: 'move'; x: number; y: number }
  | { t: number; kind: 'down'; button: number; x: number; y: number }
  | { t: number; kind: 'up'; button: number; x: number; y: number }
  | { t: number; kind: 'wheel'; delta: number }
  | { t: number; kind: 'key'; code: string };

const MAX_PATH = 64;
const MAX_QUEUE = 1024;

/**
 * Mouse + keyboard state. Pointer coordinates are in the game's virtual
 * safe-area space (see VIEW_W/VIEW_H), not CSS pixels.
 *
 * DOM events are queued with their timestamps. Each fixed simulation tick
 * consumes the events that happened before its end time (`beginStep`), so a
 * press, a key or a lancet stroke lands in the same tick at any frame rate
 * (ENG-0053/0055). Rendering then sees the edges of the whole frame
 * (`beginRender`), so immediate-mode buttons fire exactly once.
 */
export class Input {
  pos: Vec = { x: 0, y: 0 };
  prev: Vec = { x: 0, y: 0 };
  /** Every pointer sample in the current tick (oldest first), so fast gestures survive low frame rates. */
  path: Vec[] = [];
  down = false;
  pressed = false;
  released = false;
  rightDown = false;
  rightPressed = false;
  wheel = 0;
  /** Latest pointer position, updated as soon as the browser reports it (cursor drawing). */
  readonly latest: Vec = { x: 0, y: 0 };
  readonly view: ViewMapping = { w: 1280, h: 720, ox: 0, oy: 0 };
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private queue: InputEvent[] = [];
  // Frame-level accumulation of per-tick edges, shown to render.
  private frame = { pressed: false, released: false, rightPressed: false, wheel: 0, keys: new Set<string>() };
  // Reused buffers (no per-event allocation in steady state).
  private pathBuf: Vec[] = [];
  private pathPool: Vec[] = [];
  private stepKeys = new Set<string>();
  private suppressed = false;

  constructor(
    private el: HTMLCanvasElement,
    viewW: number,
    viewH: number,
  ) {
    this.view.w = viewW;
    this.view.h = viewH;
    for (let i = 0; i < MAX_PATH; i++) this.pathPool.push({ x: 0, y: 0 });
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerdown', (e) => {
      this.move(e);
      el.setPointerCapture?.(e.pointerId);
      const p = this.map(e.clientX, e.clientY);
      this.push({ t: e.timeStamp, kind: 'down', button: e.button, x: p.x, y: p.y });
    });
    el.addEventListener('pointerup', (e) => {
      this.move(e);
      const p = this.map(e.clientX, e.clientY);
      this.push({ t: e.timeStamp, kind: 'up', button: e.button, x: p.x, y: p.y });
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.push({ t: e.timeStamp, kind: 'wheel', delta: Math.sign(e.deltaY) });
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.push({ t: e.timeStamp, kind: 'key', code: e.code });
      this.keysDown.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.down = false;
      this.rightDown = false;
    });
  }

  private rect: ClientRect | null = null;

  /** Invalidate the cached canvas rect (call on resize). */
  resized(): void {
    this.rect = null;
  }

  private map(cx: number, cy: number, out?: Vec): Vec {
    if (!this.rect) this.rect = this.el.getBoundingClientRect();
    return mapPointer(cx, cy, this.rect, this.view, out);
  }

  private push(e: InputEvent): void {
    if (this.queue.length < MAX_QUEUE) this.queue.push(e);
  }

  private move(e: PointerEvent): void {
    // Coalesced events carry the high-rate samples the browser merged into this one.
    const co = e.getCoalescedEvents?.();
    const samples = co && co.length ? co : [e];
    for (const s of samples) {
      const p = this.map(s.clientX, s.clientY);
      this.push({ t: s.timeStamp, kind: 'move', x: p.x, y: p.y });
    }
    this.map(e.clientX, e.clientY, this.latest);
  }

  /**
   * Start one simulation tick: consume every queued event stamped before
   * `tEnd` (ms, same clock as event timestamps; Infinity = everything).
   */
  beginStep(tEnd = Infinity): void {
    this.prev.x = this.pos.x;
    this.prev.y = this.pos.y;
    this.pressed = this.released = this.rightPressed = false;
    this.wheel = 0;
    this.stepKeys.clear();
    this.pathBuf.length = 0;
    let used = 0;
    const q = this.queue;
    while (used < q.length && q[used].t <= tEnd) {
      const e = q[used++];
      if (e.kind === 'move') this.sample(e.x, e.y);
      else if (e.kind === 'down') {
        this.sample(e.x, e.y);
        if (e.button === 0) {
          this.down = true;
          this.pressed = true;
        } else if (e.button === 2) {
          this.rightDown = true;
          this.rightPressed = true;
        }
      } else if (e.kind === 'up') {
        this.sample(e.x, e.y);
        if (e.button === 0) {
          this.down = false;
          this.released = true;
        } else if (e.button === 2) this.rightDown = false;
      } else if (e.kind === 'wheel') this.wheel += e.delta;
      else this.stepKeys.add(e.code);
    }
    if (used) q.splice(0, used);
    if (this.pathBuf.length === 0) {
      const p = this.pathPool[0];
      p.x = this.pos.x;
      p.y = this.pos.y;
      this.pathBuf.push(p);
    }
    this.path = this.pathBuf;
    this.keysPressed = this.stepKeys;
    const f = this.frame;
    f.pressed ||= this.pressed;
    f.released ||= this.released;
    f.rightPressed ||= this.rightPressed;
    f.wheel += this.wheel;
    for (const k of this.stepKeys) f.keys.add(k);
  }

  private sample(x: number, y: number): void {
    this.pos.x = x;
    this.pos.y = y;
    if (this.pathBuf.length < MAX_PATH) {
      const p = this.pathPool[this.pathBuf.length];
      p.x = x;
      p.y = y;
      this.pathBuf.push(p);
    }
  }

  /** Before rendering: expose the whole frame's edges to immediate-mode UI. */
  beginRender(): void {
    const f = this.frame;
    this.pressed = f.pressed;
    this.released = f.released;
    this.rightPressed = f.rightPressed;
    this.wheel = f.wheel;
    this.keysPressed = f.keys;
  }

  /** Legacy single-step frame: consume everything queued. */
  beginFrame(): void {
    this.beginStep(Infinity);
  }

  endFrame(): void {
    const f = this.frame;
    f.pressed = f.released = f.rightPressed = false;
    f.wheel = 0;
    f.keys = new Set();
    this.pressed = this.released = this.rightPressed = false;
    this.wheel = 0;
    this.keysPressed = f.keys;
  }

  /**
   * Run `fn` with input edges hidden and the pointer parked off-screen — used to
   * render scenes underneath an overlay without them reacting to clicks.
   */
  suppress(fn: () => void): void {
    if (this.suppressed) return fn();
    const saved = { pressed: this.pressed, released: this.released, rightPressed: this.rightPressed, wheel: this.wheel, keys: this.keysPressed, x: this.pos.x, y: this.pos.y };
    this.pressed = this.released = this.rightPressed = false;
    this.wheel = 0;
    this.keysPressed = new Set();
    this.pos.x = this.pos.y = -1e5;
    this.suppressed = true;
    try {
      fn();
    } finally {
      this.suppressed = false;
      this.pressed = saved.pressed;
      this.released = saved.released;
      this.rightPressed = saved.rightPressed;
      this.wheel = saved.wheel;
      this.keysPressed = saved.keys;
      this.pos.x = saved.x;
      this.pos.y = saved.y;
    }
  }

  key(code: string): boolean {
    return this.keysDown.has(code);
  }
  keyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }
}
