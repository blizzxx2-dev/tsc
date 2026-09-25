import type { Vec } from './math';

/**
 * Mouse + keyboard state, sampled once per frame. Pointer coordinates are in the
 * game's virtual resolution (see VIEW_W/VIEW_H), not CSS pixels.
 */
export class Input {
  pos: Vec = { x: 0, y: 0 };
  prev: Vec = { x: 0, y: 0 };
  down = false;
  pressed = false;
  released = false;
  rightDown = false;
  rightPressed = false;
  wheel = 0;
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private pending = { pressed: false, released: false, rightPressed: false, wheel: 0 };
  private pendingKeys = new Set<string>();

  constructor(
    private el: HTMLCanvasElement,
    private viewW: number,
    private viewH: number,
  ) {
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerdown', (e) => {
      this.move(e);
      el.setPointerCapture(e.pointerId);
      if (e.button === 0) {
        this.down = true;
        this.pending.pressed = true;
      } else if (e.button === 2) {
        this.rightDown = true;
        this.pending.rightPressed = true;
      }
    });
    el.addEventListener('pointerup', (e) => {
      this.move(e);
      if (e.button === 0) {
        this.down = false;
        this.pending.released = true;
      } else if (e.button === 2) this.rightDown = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.pending.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pendingKeys.add(e.code);
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

  private move(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    this.pos = {
      x: ((e.clientX - r.left) / r.width) * this.viewW,
      y: ((e.clientY - r.top) / r.height) * this.viewH,
    };
  }

  /** Latch events that happened since the last frame. Call at the start of each update. */
  beginFrame(): void {
    this.pressed = this.pending.pressed;
    this.released = this.pending.released;
    this.rightPressed = this.pending.rightPressed;
    this.wheel = this.pending.wheel;
    this.keysPressed = this.pendingKeys;
    this.pendingKeys = new Set();
    this.pending = { pressed: false, released: false, rightPressed: false, wheel: 0 };
  }

  endFrame(): void {
    this.prev = { ...this.pos };
  }

  key(code: string): boolean {
    return this.keysDown.has(code);
  }
  keyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }
}
