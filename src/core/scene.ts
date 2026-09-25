import type { Audio } from './audio';
import type { Clock } from './clock';
import type { Input } from './input';
import type { Gfx } from '../render/gfx';

export interface Game {
  input: Input;
  audio: Audio;
  gfx: Gfx;
  /** Shared real/sim/world time (optional so headless fakes need not provide it). */
  clock?: Clock;
  /** Replace the whole scene stack; outgoing scenes are exited and disposed. */
  go(scene: Scene): void;
  /** Push an overlay (pause, options, confirm) over the live scene. */
  push?(scene: Scene): void;
  /** Pop the top overlay, resuming the scene beneath. */
  pop?(): void;
}

/**
 * Scene lifecycle (ENG-0062):
 *   enter → (pause ⇄ resume)* → exit → dispose
 * `pause`/`resume` bracket an overlay pushed on top; `exit` runs whenever the
 * scene leaves the stack and `dispose` frees what it owns (GL objects,
 * listeners) — a disposed scene is never shown again.
 */
export interface Scene {
  enter?(game: Game): void;
  exit?(game: Game): void;
  pause?(game: Game): void;
  resume?(game: Game): void;
  dispose?(game: Game): void;
  update(dt: number, game: Game): void;
  /** `alpha` is the fixed-step interpolation factor (0..1) since the last tick. */
  render(g: Gfx, game: Game, alpha?: number): void;
  /** Overlays render on top of the scene beneath, which keeps rendering but stops updating. */
  overlay?: boolean;
}

/** Human-readable scene name for logs and error reports. */
export const sceneName = (s: Scene | null | undefined): string => (s ? s.constructor?.name || 'Scene' : 'none');

/**
 * DOM listeners owned by a scene, removed together on dispose. Counts every
 * live listener globally so leak tests can assert it returns to baseline.
 */
export class ListenerScope {
  static live = 0;
  private items: { target: EventTarget; type: string; fn: EventListenerOrEventListenerObject; opts?: AddEventListenerOptions | boolean }[] = [];

  add(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions | boolean): void {
    target.addEventListener(type, fn, opts);
    this.items.push({ target, type, fn, opts });
    ListenerScope.live++;
  }

  dispose(): void {
    for (const it of this.items) it.target.removeEventListener(it.type, it.fn, it.opts);
    ListenerScope.live -= this.items.length;
    this.items.length = 0;
  }
}

/**
 * The scene stack (ENG-0062/0063). Only the top scene updates; rendering starts
 * at the lowest scene that is visible through the overlays above it.
 */
export class SceneStack {
  readonly stack: Scene[] = [];

  constructor(private game: Game) {}

  get top(): Scene | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get depth(): number {
    return this.stack.length;
  }

  /** Replace everything with `scene`. Re-entering a scene already on the stack keeps it alive. */
  go(scene: Scene): void {
    const outgoing = this.stack.splice(0, this.stack.length);
    for (let i = outgoing.length - 1; i >= 0; i--) {
      const s = outgoing[i];
      if (s === scene) continue;
      s.exit?.(this.game);
      s.dispose?.(this.game);
    }
    this.stack.push(scene);
    scene.enter?.(this.game);
  }

  push(scene: Scene): void {
    this.top?.pause?.(this.game);
    this.stack.push(scene);
    scene.enter?.(this.game);
  }

  pop(): void {
    const s = this.stack.pop();
    if (!s) return;
    s.exit?.(this.game);
    s.dispose?.(this.game);
    this.top?.resume?.(this.game);
  }

  update(dt: number): void {
    this.top?.update(dt, this.game);
  }

  render(g: Gfx, alpha = 1): void {
    const n = this.stack.length;
    if (!n) return;
    let base = n - 1;
    while (base > 0 && this.stack[base].overlay) base--;
    for (let i = base; i < n; i++) {
      const s = this.stack[i];
      if (i < n - 1) this.game.input.suppress(() => s.render(g, this.game, alpha));
      else s.render(g, this.game, alpha);
    }
  }
}
