/**
 * The UI context (UIX-0003/0004/0005): a per-scene object that separates what a
 * menu *is* from how it is drawn.
 *
 *   update():  ui.begin(); …declare nodes (ui.button, ui.slider…)…; ui.update(input, dt)
 *   render():  draw each node from `ui.nodes`, reading `ui.state(id)`
 *
 * Input is processed exactly once per simulation tick, in `update`, so menus can be
 * driven headlessly in tests with a synthetic input and no WebGL. Features:
 *  - activate-on-release: a button fires when the primary button is released inside
 *    the rect it was pressed in, so a click can never fall through into the next scene;
 *  - focus navigation: arrows / D-pad move focus to the nearest node in that direction
 *    (lists wrap), Enter / A activates, Left/Right adjust sliders, steppers and toggles;
 *  - pointer hover moves focus too, so mouse, keyboard and gamepad share one highlight;
 *  - tooltip timing (hover delay, instant on keyboard/gamepad focus);
 *  - semantic events for audio (`ui/events.ts`).
 */
import type { Vec } from '../core/math';
import type { ActionId } from '../input/actions';
import { uiEvents } from './events';
import { MOTION } from './motion';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inside = (p: Vec, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** The slice of `Input` the UI needs — tests provide a plain object. */
export interface UiInput {
  pos: Vec;
  down: boolean;
  pressed: boolean;
  released: boolean;
  wheel: number;
  device: 'kbm' | 'pad';
  actPressed(id: ActionId): boolean;
  actRepeated(id: ActionId): boolean;
}

export type NodeKind = 'button' | 'toggle' | 'slider' | 'stepper' | 'tab' | 'item' | 'dropdown';

export interface UiNode {
  id: string;
  kind: NodeKind;
  rect: Rect;
  /** Display text (already localised). */
  label: string;
  /** Current value text for steppers/toggles/dropdowns. */
  value?: string;
  /** Slider position 0..1. */
  frac?: number;
  /** Toggle state. */
  on?: boolean;
  enabled: boolean;
  /** Localised tooltip / description shown on hover or focus. */
  tip?: string;
  /** Visual style hint for the renderer. */
  style?: string;
  /** Not reachable with directional navigation (still clickable). */
  noNav?: boolean;
  /** Hit area limit (scroll lists): the pointer only reaches the node inside this rect. */
  clip?: Rect;
  /** Arbitrary payload for custom renderers. */
  data?: unknown;
  onActivate?: () => void;
  /** Left/Right (dir −1/+1) on a focused slider, stepper, toggle or tab. */
  onAdjust?: (dir: -1 | 1) => void;
  /** Slider drag: position along the rect, 0..1. */
  onDrag?: (frac: number) => void;
}

export interface NodeState {
  hover: boolean;
  focus: boolean;
  /** Pressed and still held inside. */
  active: boolean;
  enabled: boolean;
  /** Eased 0..1 highlight amount (hover/focus fade, MOTION.hover). */
  glow: number;
}

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Record<Dir, Vec> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const centre = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Nearest node from `from` in direction `dir`: candidates must lie ahead of it;
 * the score favours alignment (perpendicular offset counts double). Returns
 * null when nothing is ahead.
 */
export function nearestInDirection(from: Rect, nodes: readonly UiNode[], dir: Dir, skip?: string): UiNode | null {
  const d = DIRS[dir];
  const c0 = centre(from);
  let best: UiNode | null = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n.id === skip || !n.enabled || n.noNav) continue;
    const c = centre(n.rect);
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    const along = dx * d.x + dy * d.y;
    if (along <= 2) continue;
    const perp = Math.abs(dx * d.y - dy * d.x);
    // Nodes overlapping on the perpendicular axis (same row/column) are strongly preferred.
    const overlap = d.x !== 0 ? n.rect.y < from.y + from.h && n.rect.y + n.rect.h > from.y : n.rect.x < from.x + from.w && n.rect.x + n.rect.w > from.x;
    const score = along + perp * (overlap ? 0.5 : 2.5);
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

/** Wrap-around target for up/down at the ends of a column: the farthest node the other way, best aligned. */
function wrapTarget(from: Rect, nodes: readonly UiNode[], dir: Dir): UiNode | null {
  const d = DIRS[dir];
  const c0 = centre(from);
  let best: UiNode | null = null;
  let bestScore = -Infinity;
  for (const n of nodes) {
    if (!n.enabled || n.noNav) continue;
    const c = centre(n.rect);
    const back = -((c.x - c0.x) * d.x + (c.y - c0.y) * d.y);
    const perp = Math.abs((c.x - c0.x) * d.y - (c.y - c0.y) * d.x);
    const score = back - perp * 3;
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

export class Ui {
  nodes: UiNode[] = [];
  private building: UiNode[] = [];
  focus: string | null = null;
  hover: string | null = null;
  /** The node the primary button went down on (activate-on-release). */
  private pressedOn: string | null = null;
  /** Slider being dragged. */
  private dragging: string | null = null;
  private glows = new Map<string, number>();
  /** Seconds the pointer has rested on `hover`. */
  hoverT = 0;
  /** Focus was last moved by keyboard/gamepad (focus ring shown, tooltip instant). */
  navMode = false;
  /** Set by a scene to ignore all input (e.g. while an intro plays). */
  enabled = true;
  private lastPos: Vec = { x: -1e5, y: -1e5 };
  private started = false;

  constructor(
    /** Namespace for event ids (`title/continue`). */
    readonly scope = 'ui',
  ) {}

  /** Start declaring this tick's nodes. */
  begin(): void {
    this.building = [];
  }

  add(n: Omit<UiNode, 'enabled'> & { enabled?: boolean }): UiNode {
    const node: UiNode = { enabled: true, ...n };
    this.building.push(node);
    return node;
  }

  button(id: string, rect: Rect, label: string, onActivate: () => void, o: Partial<UiNode> = {}): UiNode {
    return this.add({ id, kind: 'button', rect, label, onActivate, ...o });
  }

  toggle(id: string, rect: Rect, label: string, on: boolean, set: (on: boolean) => void, o: Partial<UiNode> = {}): UiNode {
    return this.add({ id, kind: 'toggle', rect, label, on, onActivate: () => set(!on), onAdjust: () => set(!on), ...o });
  }

  /** Discrete choice cycled with ◀ ▶ (and click on either half). */
  stepper(id: string, rect: Rect, label: string, value: string, change: (dir: -1 | 1) => void, o: Partial<UiNode> = {}): UiNode {
    return this.add({ id, kind: 'stepper', rect, label, value, onAdjust: change, onActivate: () => change(1), ...o });
  }

  /** Continuous value 0..1 (`frac`) with `step` for keyboard/gamepad nudges. */
  slider(id: string, rect: Rect, label: string, frac: number, set: (frac: number) => void, o: Partial<UiNode> & { step?: number } = {}): UiNode {
    const step = o.step ?? 0.1;
    const clampSet = (f: number) => set(Math.max(0, Math.min(1, Math.round(f / step) * step)));
    return this.add({ id, kind: 'slider', rect, label, frac, onAdjust: (d) => clampSet(frac + d * step), onDrag: clampSet, ...o });
  }

  /**
   * Finish the declaration and process this tick's input. Returns the id of the
   * node activated this tick (or null).
   */
  update(input: UiInput, dt: number): string | null {
    const prevNodes = this.nodes;
    this.nodes = this.building;
    this.building = [];
    const byId = (id: string | null) => (id ? this.nodes.find((n) => n.id === id) : undefined);
    // Keep focus valid: if the focused node vanished, keep its place in the list.
    if (this.focus && !byId(this.focus)) {
      const idx = prevNodes.findIndex((n) => n.id === this.focus);
      const nav = this.nodes.filter((n) => n.enabled && !n.noNav);
      this.focus = nav.length ? nav[Math.min(Math.max(0, idx), nav.length - 1)].id : null;
    }
    let activated: string | null = null;
    if (!this.enabled) {
      this.pressedOn = this.dragging = null;
      this.ageGlows(dt);
      return null;
    }

    // ---- pointer
    const p = input.pos;
    const moved = Math.abs(p.x - this.lastPos.x) + Math.abs(p.y - this.lastPos.y) > 0.5;
    this.lastPos = { x: p.x, y: p.y };
    const under = [...this.nodes].reverse().find((n) => inside(p, n.rect) && (!n.clip || inside(p, n.clip)));
    const hoverId = under && under.enabled ? under.id : null;
    if (hoverId !== this.hover) {
      this.hover = hoverId;
      this.hoverT = 0;
      if (hoverId) uiEvents.emit('ui.hover', { id: this.eid(hoverId) });
    } else this.hoverT += dt;
    // Mouse movement over a node moves focus there (one shared highlight); the first tick never steals focus.
    if (moved && this.started && hoverId) {
      if (this.focus !== hoverId) this.setFocus(hoverId);
      this.navMode = false;
    }
    // A gamepad's confirm button also raises `pressed` (virtual-cursor click); focus activation handles it instead.
    const pointerPress = input.pressed && !(input.device === 'pad' && input.actPressed('ui.confirm'));
    if (pointerPress && under && under.enabled) {
      this.pressedOn = under.id;
      if (under.kind === 'slider') this.dragging = under.id;
    }
    const drag = byId(this.dragging);
    if (drag && input.down && drag.onDrag) {
      const f = Math.max(0, Math.min(1, (p.x - drag.rect.x - 12) / Math.max(1, drag.rect.w - 24)));
      if (Math.abs(f - (drag.frac ?? 0)) > 1e-3) {
        drag.onDrag(f);
        uiEvents.emit('ui.slider', { id: this.eid(drag.id), value: f });
      }
    }
    if (input.released) {
      const n = byId(this.pressedOn);
      if (n && n.enabled && inside(p, n.rect) && n.kind !== 'slider') {
        if (n.kind === 'stepper' && n.onAdjust) {
          const dir = p.x < n.rect.x + n.rect.w * 0.55 ? -1 : 1;
          n.onAdjust(dir);
          uiEvents.emit('ui.confirm', { id: this.eid(n.id) });
          activated = n.id;
        } else activated = this.activate(n);
        this.setFocus(n.id);
      }
      this.pressedOn = null;
      this.dragging = null;
    }
    if (!input.down && !input.released) {
      this.pressedOn = null;
      this.dragging = null;
    }

    // ---- keyboard / gamepad
    const dirPressed = (['up', 'down', 'left', 'right'] as Dir[]).find((d) => input.actRepeated(`ui.${d}` as ActionId));
    if (dirPressed) {
      this.navMode = true;
      const cur = byId(this.focus);
      const horizontal = dirPressed === 'left' || dirPressed === 'right';
      if (cur && horizontal && cur.onAdjust && (cur.kind === 'slider' || cur.kind === 'stepper' || cur.kind === 'toggle' || cur.kind === 'dropdown')) {
        cur.onAdjust(dirPressed === 'left' ? -1 : 1);
        if (cur.kind === 'slider') uiEvents.emit('ui.slider', { id: this.eid(cur.id), value: cur.frac ?? 0 });
        else uiEvents.emit('ui.confirm', { id: this.eid(cur.id) });
      } else if (!cur) {
        const first = this.nodes.find((n) => n.enabled && !n.noNav);
        if (first) this.setFocus(first.id);
      } else {
        const next = nearestInDirection(cur.rect, this.nodes, dirPressed, cur.id) ?? (horizontal ? null : wrapTarget(cur.rect, this.nodes, dirPressed));
        if (next && next.id !== cur.id) this.setFocus(next.id);
      }
    }
    if (input.actPressed('ui.confirm')) {
      const cur = byId(this.focus);
      if (cur && cur.enabled && !activated) activated = this.activate(cur);
      else if (cur && !cur.enabled) uiEvents.emit('ui.error', { id: this.eid(cur.id) });
    }
    this.started = true;
    this.ageGlows(dt);
    return activated;
  }

  private activate(n: UiNode): string | null {
    if (!n.onActivate) return null;
    n.onActivate();
    uiEvents.emit('ui.confirm', { id: this.eid(n.id) });
    return n.id;
  }

  private ageGlows(dt: number): void {
    for (const n of this.nodes) {
      const target = n.id === this.focus || n.id === this.hover ? 1 : 0;
      const cur = this.glows.get(n.id) ?? 0;
      const step = dt / MOTION.hover;
      this.glows.set(n.id, target > cur ? Math.min(target, cur + step) : Math.max(target, cur - step));
    }
  }

  private eid(id: string): string {
    return `${this.scope}/${id}`;
  }

  /** Forget the current press (a scroll-drag started on a row must not click it on release). */
  cancelPress(): void {
    this.pressedOn = null;
  }

  setFocus(id: string | null): void {
    if (id === this.focus) return;
    this.focus = id;
    if (id) uiEvents.emit('ui.focus', { id: this.eid(id) });
  }

  /** Focus the first navigable node (menus call this on enter so keyboard users land somewhere sensible). */
  focusFirst(id?: string): void {
    const n = id ? this.building.find((b) => b.id === id) ?? this.nodes.find((b) => b.id === id) : undefined;
    const target = n ?? [...this.building, ...this.nodes].find((b) => b.enabled && !b.noNav);
    if (target) this.focus = target.id;
  }

  state(id: string): NodeState {
    const n = this.nodes.find((x) => x.id === id);
    return {
      hover: this.hover === id,
      focus: this.focus === id,
      active: this.pressedOn === id && this.hover === id,
      enabled: n?.enabled ?? false,
      glow: this.glows.get(id) ?? 0,
    };
  }

  node(id: string): UiNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  /** The node whose tooltip should show now: focus via keyboard/gamepad (instant) or mouse hover after the delay. */
  tipNode(): UiNode | undefined {
    if (this.navMode) {
      const f = this.node(this.focus ?? '');
      return f?.tip ? f : undefined;
    }
    const h = this.node(this.hover ?? '');
    return h?.tip && this.hoverT >= MOTION.tooltipDelay ? h : undefined;
  }
}
