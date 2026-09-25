/**
 * Global overlay host (ENG-0066): things that belong to the game, not to a scene — toasts,
 * achievement popups, the FPS/profiler counter and the Steam-overlay pause veil — are registered here
 * and drawn by the main loop after the scene stack and the transition, every frame, whatever scene is
 * active (the autosave quill and platform notices are DOM overlays in platform/ui.ts, likewise
 * independent of scenes). Items run on real time, so they keep animating while an operation is paused.
 */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

export interface OverlayItem {
  id: string;
  /** Higher draws later (on top). */
  order: number;
  update?(dt: number): void;
  draw(g: Gfx): void;
}

export interface Toast {
  title: string;
  body?: string;
  kind: 'info' | 'achievement' | 'warning';
  /** Seconds shown so far. */
  t: number;
}

/** Toasts stay this long (seconds), including a 0.3 s slide in and a 0.5 s fade out. */
export const TOAST_S = 4.5;
const MAX_TOASTS = 4;

export class OverlayHost {
  private items: OverlayItem[] = [];
  readonly toasts: Toast[] = [];

  constructor() {
    this.add({ id: 'toasts', order: 50, update: (dt) => this.ageToasts(dt), draw: (g) => this.drawToasts(g) });
  }

  add(item: OverlayItem): () => void {
    this.remove(item.id);
    this.items.push(item);
    this.items.sort((a, b) => a.order - b.order);
    return () => this.remove(item.id);
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  has(id: string): boolean {
    return this.items.some((i) => i.id === id);
  }

  /** Queue a toast (achievement popups use kind 'achievement'). */
  toast(title: string, body?: string, kind: Toast['kind'] = 'info'): void {
    this.toasts.push({ title, body, kind, t: 0 });
    if (this.toasts.length > MAX_TOASTS) this.toasts.shift();
  }

  update(dt: number): void {
    for (const i of this.items) i.update?.(dt);
  }

  draw(g: Gfx): void {
    // Overlays are screen-space: never through the world camera.
    g.setCamera(null);
    for (const i of this.items) i.draw(g);
  }

  private ageToasts(dt: number): void {
    for (const t of this.toasts) t.t += dt;
    while (this.toasts.length && this.toasts[0].t >= TOAST_S) this.toasts.shift();
  }

  private drawToasts(g: Gfx): void {
    if (!this.toasts.length) return;
    const vr = g.viewRect();
    const w = 360;
    let y = vr.y + 96;
    for (const t of this.toasts) {
      const inK = Math.min(1, t.t / 0.3);
      const out = Math.min(1, Math.max(0, (TOAST_S - t.t) / 0.5));
      const a = Math.min(inK, out);
      const x = vr.x + vr.w - w - 16 + (1 - inK) * 40;
      const h = t.body ? 70 : 46;
      const gold = t.kind === 'achievement';
      g.plate(x, y, w, h, { radius: 4, alpha: a, border: hex(gold ? '#d8b060' : t.kind === 'warning' ? '#c05030' : '#8a6a3a', 0.9), glow: gold ? hex('#e0b050', 0.25 * a) : undefined });
      g.text(t.title, x + 16, y + 28, { size: 18, font: gold ? 'display' : 'body', color: hex(gold ? '#f0d890' : '#e8dcc0', a), shadow: false });
      if (t.body) g.text(t.body, x + 16, y + 54, { size: 16, font: 'italic', color: hex('#c8b898', a), shadow: false });
      y += h + 10;
    }
  }
}

/** The Steam-overlay pause veil: dims everything while the overlay is up. */
export function veilItem(active: () => boolean, label: () => string): OverlayItem {
  return {
    id: 'steam-veil',
    order: 90,
    draw: (g) => {
      if (!active()) return;
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.6));
      g.text(label(), vr.x + vr.w / 2, vr.y + vr.h / 2, { size: 28, font: 'display', color: hex('#e8dcc0', 0.9), align: 'center' });
    },
  };
}
