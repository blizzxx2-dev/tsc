/**
 * Scene transitions (UIX-0009, ENG-0064): `game.go(scene, { transition, ms })` covers the screen
 * (half out, swap, half in) with a fade, an iris closing on the centre or an ink bleed spreading
 * from the edges, drawn on the Overlay layer after every scene. While a transition runs, scenes
 * neither update nor see input, and further `go()` requests are ignored — a double-clicked button
 * can never start two scenes. Reduced Motion swaps instantly.
 */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { MOTION, reducedMotion } from './motion';

export type TransitionKind = 'fade' | 'iris' | 'ink' | 'none';

export interface TransitionOptions {
  transition?: TransitionKind;
  /** Whole transition length in ms (out + in). */
  ms?: number;
}

/** Ink blots for the ink-bleed wipe: [u, v, size] in view fractions, along the edges. */
const INK_BLOTS: readonly [number, number, number][] = [
  [0, 0, 0.5],
  [1, 0, 0.45],
  [0, 1, 0.48],
  [1, 1, 0.52],
  [0.5, 0, 0.3],
  [0.5, 1, 0.33],
  [0, 0.5, 0.36],
  [1, 0.5, 0.34],
  [0.25, 0, 0.26],
  [0.75, 1, 0.28],
];

export class Transition {
  phase: 'idle' | 'out' | 'in' = 'idle';
  t = 0;
  /** The look of the transition in progress. */
  kind: TransitionKind = 'ink';
  /** Length of the transition in progress (seconds, out + in). */
  private len: number;
  private swap: (() => void) | null = null;
  /** Automation (a frozen QA loop stepping frame by frame) swaps scenes instantly, like Reduced Motion. */
  instant = false;

  constructor(readonly duration = MOTION.transition) {
    this.len = duration;
  }

  /** True while scenes must not update or take input. */
  get busy(): boolean {
    return this.phase !== 'idle';
  }

  /**
   * Ask to change scene. Returns false (and does nothing) if a transition is
   * already running; otherwise `swap` runs at the midpoint (immediately with
   * Reduced Motion).
   */
  request(swap: () => void, opts: TransitionOptions = {}): boolean {
    if (this.phase === 'out') return false;
    this.kind = opts.transition ?? 'ink';
    this.len = opts.ms !== undefined ? opts.ms / 1000 : this.duration;
    if (this.instant || reducedMotion() || this.len <= 0 || this.kind === 'none') {
      this.phase = 'idle';
      swap();
      return true;
    }
    this.swap = swap;
    this.phase = 'out';
    this.t = 0;
    return true;
  }

  /** Start by fading in from black (first scene after boot). */
  fadeIn(): void {
    if (this.instant || reducedMotion()) return;
    this.kind = 'fade';
    this.len = this.duration;
    this.phase = 'in';
    this.t = 0;
  }

  /** Finish at once: run a pending swap and clear the veil. */
  settle(): void {
    const s = this.swap;
    this.swap = null;
    this.phase = 'idle';
    this.t = 0;
    s?.();
  }

  update(dt: number): void {
    if (this.phase === 'idle') return;
    this.t += dt;
    const half = this.len / 2;
    if (this.phase === 'out' && this.t >= half) {
      const s = this.swap;
      this.swap = null;
      this.phase = 'in';
      this.t = 0;
      s?.();
    } else if (this.phase === 'in' && this.t >= half) {
      this.phase = 'idle';
      this.t = 0;
    }
  }

  /** Veil opacity 0..1. */
  get alpha(): number {
    const half = this.len / 2;
    if (this.phase === 'out') return Math.min(1, this.t / half);
    if (this.phase === 'in') return Math.max(0, 1 - this.t / half);
    return 0;
  }

  draw(g: Gfx): void {
    const a = this.alpha;
    if (a <= 0) return;
    const vr = g.viewRect();
    if (this.kind === 'iris') return this.drawIris(g, vr, a);
    if (this.kind === 'fade') {
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', a));
      return;
    }
    // Ink wash: the edges darken first, then the centre follows.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', Math.min(1, a * 1.1)));
    const edge = Math.min(1, a * 1.6);
    g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.3, hex('#000000', edge), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h * 0.7, vr.w, vr.h * 0.3, hex('#000000', 0), hex('#000000', edge));
    // Ink bleeding in from the frame: blots grow from fixed points along the edges.
    const k = Math.min(1, a * 1.3);
    for (let i = 0; i < INK_BLOTS.length; i++) {
      const [u, v, s] = INK_BLOTS[i];
      g.circle(vr.x + u * vr.w, vr.y + v * vr.h, s * k * Math.max(vr.w, vr.h) * 0.55, hex('#050202', Math.min(1, k * 1.2)));
    }
  }

  /** Iris: black closes on the centre as a shrinking circular opening. */
  private drawIris(g: Gfx, vr: { x: number; y: number; w: number; h: number }, a: number): void {
    const cx = vr.x + vr.w / 2;
    const cy = vr.y + vr.h / 2;
    const far = Math.hypot(vr.w, vr.h) / 2 + 4;
    const r = far * (1 - a);
    if (r < 1) {
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303'));
      return;
    }
    // A ring from the opening out past the corners; a soft inner lip.
    g.arc(cx, cy, (r + far) / 2, far - r + 2, hex('#060303'));
    g.arc(cx, cy, r - 6, 12, hex('#060303', 0.45));
  }
}
