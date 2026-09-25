/**
 * Scene transitions (UIX-0009): `game.go()` fades through ink-black over
 * MOTION.transition (half out, swap, half in). While a transition runs, scenes
 * neither update nor see input, and further `go()` requests are ignored — a
 * double-clicked button can never start two scenes. Reduced Motion swaps
 * instantly.
 */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { MOTION, reducedMotion } from './motion';
import { parchmentArt, sealArt } from '../art/kit';
import { FPS, frameOf } from '../art/timing';

/**
 * Transition looks (ART-0306): the ink wash (default), a woodcut page turn between menu pages
 * (8 frames at 12 fps: 4 turning the old page away, 4 laying the new one) and a wax seal that
 * cracks and breaks on New Game.
 */
export type TransitionStyle = 'ink' | 'page' | 'seal';
export const STYLE_DURATION: Record<TransitionStyle, number> = { ink: MOTION.transition, page: 8 / FPS.woodcut, seal: 0.9 };
let pending: TransitionStyle | null = null;

/** Use `style` for the next `game.go()` (consumed by the next transition request). */
export function nextTransitionStyle(style: TransitionStyle): void {
  pending = style;
}
/** Scenes that are menu pages (the page turn plays between two of them). */
export const isMenuPage = (s: unknown): boolean => !!s && typeof s === 'object' && (s as { menuPage?: boolean }).menuPage === true;

export class Transition {
  phase: 'idle' | 'out' | 'in' = 'idle';
  t = 0;
  private swap: (() => void) | null = null;
  style: TransitionStyle = 'ink';
  /** Automation (a frozen QA loop stepping frame by frame) swaps scenes instantly, like Reduced Motion. */
  instant = false;

  constructor(private readonly baseDuration = MOTION.transition) {}

  get duration(): number {
    return this.style === 'ink' ? this.baseDuration : STYLE_DURATION[this.style];
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
  request(swap: () => void, style?: TransitionStyle): boolean {
    if (this.phase === 'out') return false;
    this.style = style ?? pending ?? 'ink';
    pending = null;
    if (this.instant || reducedMotion() || this.duration <= 0) {
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
    this.style = 'ink';
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
    const half = this.duration / 2;
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
    const half = this.duration / 2;
    if (this.phase === 'out') return Math.min(1, this.t / half);
    if (this.phase === 'in') return Math.max(0, 1 - this.t / half);
    return 0;
  }

  draw(g: Gfx): void {
    const a = this.alpha;
    if (a <= 0 && this.style === 'ink') return;
    const vr = g.viewRect();
    if (this.style === 'page') return this.drawPage(g, vr);
    if (this.style === 'seal') return this.drawSeal(g, vr, a);
    // Ink wash: the edges darken first, then the centre follows.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', Math.min(1, a * 1.1)));
    const edge = Math.min(1, a * 1.6);
    g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.3, hex('#000000', edge), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h * 0.7, vr.w, vr.h * 0.3, hex('#000000', 0), hex('#000000', edge));
  }

  /** Frame 0–7 of the page turn: 0–3 while the old page lifts away, 4–7 while the new one settles. */
  pageFrame(): number {
    if (this.phase === 'idle') return 8;
    const half = this.duration / 2;
    return this.phase === 'out' ? frameOf(this.t, FPS.woodcut, 4) : 4 + frameOf(Math.min(this.t, half - 1e-6), FPS.woodcut, 4);
  }

  /** A parchment leaf sweeps right-to-left over the screen (out), then peels off to the left (in). */
  private drawPage(g: Gfx, vr: { x: number; y: number; w: number; h: number }): void {
    const f = this.pageFrame();
    if (f >= 8) return;
    // Covered width per frame: 25/50/75/100 % on the way out, then uncovering from the right.
    const k = f < 4 ? (f + 1) / 4 : (8 - f - 1) / 4;
    const w = vr.w * k;
    if (w <= 0) return;
    const x = f < 4 ? vr.x + vr.w - w : vr.x;
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', 0.35 * k));
    parchmentArt(g, { x, y: vr.y, w, h: vr.h }, 'foxed', 0, 7);
    // The turning edge: a curl shadow and a highlight on the lifted fold.
    const ex = f < 4 ? x : x + w;
    const dir = f < 4 ? 1 : -1;
    g.rectGrad(ex - (dir > 0 ? 0 : 40), vr.y, 40, vr.h, hex('#000000', dir > 0 ? 0.45 : 0), hex('#000000', dir > 0 ? 0 : 0.45));
    g.rect(ex - 2, vr.y, 4, vr.h, hex('#fff4d0', 0.35));
  }

  /** New Game: the ink closes in round a wax seal, which cracks and breaks apart as the new scene opens. */
  private drawSeal(g: Gfx, vr: { x: number; y: number; w: number; h: number }, a: number): void {
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#060303', Math.min(1, a * 1.1)));
    const cx = vr.x + vr.w / 2;
    const cy = vr.y + vr.h / 2;
    const half = this.duration / 2;
    if (this.phase === 'out') {
      const k = Math.min(1, this.t / half);
      sealArt(g, cx, cy, 70, '#8a1016', { press: 0.4 + 0.6 * k, seed: 3 });
      return;
    }
    // Breaking: the pressed seal cracks, then splits into five wax shards that fly apart as the veil lifts.
    const k = Math.min(1, this.t / half);
    if (k < 0.25) {
      sealArt(g, cx, cy, 70, '#8a1016', { press: 1, cracked: true, seed: 3 });
      return;
    }
    const u = (k - 0.25) / 0.75;
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * Math.PI * 2 + 0.3;
      const a1 = a0 + (Math.PI * 2) / 5;
      const am = (a0 + a1) / 2;
      const ox = cx + Math.cos(am) * u * 140;
      const oy = cy + Math.sin(am) * u * 110 + u * u * 160;
      const pts = [{ x: ox, y: oy }];
      for (let j = 0; j <= 4; j++) {
        const aa = a0 + ((a1 - a0) * j) / 4;
        const rr = 70 * (1 + 0.06 * Math.sin(j * 2.7 + i));
        pts.push({ x: ox + Math.cos(aa) * rr, y: oy + Math.sin(aa) * rr });
      }
      g.poly(pts, hex('#5a0a10', 1 - u), hex('#b02030', 1 - u));
    }
  }
}
