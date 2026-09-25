import type { Vec } from '../core/math';
import type { ToolId } from '../surgery/types';
import { VIEW_W } from '../ui/layout';
import { bindings as defaultBindings, type Bindings } from './bindings';
import type { HudHit } from './opinput';

/**
 * HUD hit-test layer (INP-0047). The operation scene registers every HUD widget
 * that sits over the field each frame; a primary press is tested against them
 * first, in order, and the first widget that owns the point decides what
 * happens: a tray slot selects its tool, opaque widgets (the tray frame, the
 * Litany reliquary, a pause button) swallow the press, and click-through
 * widgets (the callout panel) let it fall to the field. Nothing here draws.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HudWidgetKind = 'tray' | 'slot' | 'litany' | 'callout' | 'pause';

export interface HudWidget {
  kind: HudWidgetKind;
  rect: Rect;
  /** A tray slot: the press selects this instrument. */
  tool?: ToolId;
  /** The press falls through to the field even though the widget is under it. */
  clickThrough?: boolean;
  /** Extra hit margin in px (a fat-finger pad around small widgets). */
  pad?: number;
}

export const inRect = (p: Vec, r: Rect, pad = 0): boolean => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

export class HudLayer {
  readonly widgets: HudWidget[] = [];

  /** Forget last frame's widgets (the scene registers them again as it lays the HUD out). */
  clear(): void {
    this.widgets.length = 0;
  }

  add(w: HudWidget): this {
    this.widgets.push(w);
    return this;
  }

  /** The widget under `p`, or null when the point is over the field. */
  at(p: Vec): HudWidget | null {
    for (const w of this.widgets) if (inRect(p, w.rect, w.pad ?? 0)) return w;
    return null;
  }

  /** What a primary press at `p` does: select a tool, get swallowed, or reach the field. */
  hit: HudHit = (p) => {
    const w = this.at(p);
    if (!w || w.clickThrough) return null;
    return w.tool ?? 'consume';
  };
}

// ---------------------------------------------------------------- tray geometry

/** Slot size and spacing of the instrument tray; `x` is the left-handed (mirrored) or right-handed origin. */
export const TRAY = { margin: 24, y: 124, w: 64, h: 60, gap: 8, frame: 8 } as const;

export type TraySide = 'left' | 'right';

/** Which screen edge the tray sits on: the left for right-handed players, mirrored for left-handed ones (INP-0069). */
export function traySide(b: Bindings = defaultBindings): TraySide {
  return b.prefs.leftHanded ? 'right' : 'left';
}

export function trayX(side: TraySide = traySide()): number {
  return side === 'left' ? TRAY.margin : VIEW_W - TRAY.margin - TRAY.w;
}

export function traySlot(i: number, side: TraySide = traySide()): Rect {
  return { x: trayX(side), y: TRAY.y + i * (TRAY.h + TRAY.gap), w: TRAY.w, h: TRAY.h };
}

/** The plate behind `n` slots (what swallows presses in the gaps between them). */
export function trayFrame(n: number, side: TraySide = traySide()): Rect {
  return { x: trayX(side) - TRAY.frame, y: TRAY.y - TRAY.frame, w: TRAY.w + TRAY.frame * 2, h: Math.max(1, n) * (TRAY.h + TRAY.gap) - TRAY.gap + TRAY.frame * 2 };
}

/** Register the tray for an operation's kit: each slot selects its tool, the frame around them swallows the press. */
export function addTray(layer: HudLayer, tools: readonly ToolId[], side: TraySide = traySide()): void {
  tools.forEach((tool, i) => layer.add({ kind: 'slot', rect: traySlot(i, side), tool }));
  layer.add({ kind: 'tray', rect: trayFrame(tools.length, side), pad: 4 });
}
