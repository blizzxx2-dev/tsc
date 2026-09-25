import { PREVENT_DEFAULT_KEYS } from './actions';
import type { InputEvent } from './types';

type Sink = (e: InputEvent) => void;

/** Keyboard adapter: `KeyboardEvent.code` presses and releases, auto-repeat ignored. */
export class KeyboardAdapter {
  readonly held = new Set<string>();

  constructor(private sink: Sink) {}

  down(code: string, t: number): void {
    if (this.held.has(code)) return;
    this.held.add(code);
    this.sink({ t, type: 'down', code: `key:${code}` });
  }

  up(code: string, t: number): void {
    if (!this.held.delete(code)) return;
    this.sink({ t, type: 'up', code: `key:${code}` });
  }

  releaseAll(t: number): void {
    for (const c of [...this.held]) {
      this.held.delete(c);
      this.sink({ t, type: 'up', code: `key:${c}`, cancel: true });
    }
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT_KEYS.includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down(e.code, e.timeStamp);
    });
    target.addEventListener('keyup', (e) => this.up(e.code, e.timeStamp));
  }
}
