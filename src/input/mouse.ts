import type { Vec } from '../core/math';
import type { InputEvent } from './types';
import { WheelNormaliser } from './wheel';

type Sink = (e: InputEvent) => void;

/**
 * Mouse adapter: buttons 0–4 (left, middle, right, back, forward), pointer motion
 * with coalesced sub-frame samples, normalised wheel steps. `pointercancel`,
 * `lostpointercapture` and focus loss release every held button as a cancel.
 * The DOM wiring is in `attach`; the handlers are plain methods so tests can drive them.
 */
export class MouseAdapter {
  readonly held = new Set<number>();
  pos: Vec = { x: 0, y: 0 };
  invertWheel = false;
  private wheel = new WheelNormaliser();

  constructor(private sink: Sink) {}

  move(x: number, y: number, t: number): void {
    if (x === this.pos.x && y === this.pos.y) return;
    this.pos = { x, y };
    this.sink({ t, type: 'move', x, y, src: 'kbm' });
  }

  down(button: number, x: number, y: number, t: number): void {
    this.move(x, y, t);
    if (button < 0 || button > 4 || this.held.has(button)) return;
    this.held.add(button);
    this.sink({ t, type: 'down', code: `mouse:${button}` });
  }

  up(button: number, x: number, y: number, t: number): void {
    this.move(x, y, t);
    if (!this.held.delete(button)) return;
    this.sink({ t, type: 'up', code: `mouse:${button}` });
  }

  /** The browser took the pointer away (alt-tab, touch cancel, capture lost): release everything as a cancel. */
  cancel(t: number): void {
    for (const b of [...this.held]) {
      this.held.delete(b);
      this.sink({ t, type: 'up', code: `mouse:${b}`, cancel: true });
    }
  }

  wheelDelta(deltaY: number, mode: number, t: number): void {
    const step = this.wheel.feed(deltaY, mode, t) * (this.invertWheel ? -1 : 1);
    if (step) this.sink({ t, type: 'wheel', code: step > 0 ? 'wheel:down' : 'wheel:up' });
  }

  attach(el: HTMLElement, toView: (clientX: number, clientY: number) => Vec): void {
    const at = (e: MouseEvent) => toView(e.clientX, e.clientY);
    el.addEventListener('pointermove', (e) => {
      // Coalesced events carry the high-rate samples the browser merged into this one.
      const samples = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
      for (const s of samples) {
        const p = at(s);
        this.move(p.x, p.y, s.timeStamp || e.timeStamp);
      }
    });
    el.addEventListener('pointerdown', (e) => {
      const p = at(e);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events may not be capturable.
      }
      this.down(e.button, p.x, p.y, e.timeStamp);
      // Side buttons would navigate the page back/forward.
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });
    el.addEventListener('pointerup', (e) => {
      const p = at(e);
      this.up(e.button, p.x, p.y, e.timeStamp);
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });
    el.addEventListener('pointercancel', (e) => this.cancel(e.timeStamp));
    el.addEventListener('lostpointercapture', (e) => {
      // Capture is also lost after a normal pointerup; only treat it as a cancel while buttons are still held.
      if (this.held.size && e.buttons === 0) this.cancel(e.timeStamp);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('auxclick', (e) => e.preventDefault());
    window.addEventListener('mouseup', (e) => {
      if (e.button === 3 || e.button === 4) e.preventDefault();
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheelDelta(e.deltaY, e.deltaMode, e.timeStamp);
      },
      { passive: false },
    );
  }
}
