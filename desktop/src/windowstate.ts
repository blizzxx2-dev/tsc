/**
 * Window size/position/mode/monitor persistence (PLT-0109). On launch the stored bounds are clamped to
 * the visible work area of a display that still exists; if the stored monitor is gone the window is
 * centred on the primary display.
 */
import type { DisplayMode, WindowState } from '../../src/platform/bridge';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Screen {
  id: number;
  bounds: Rect;
  workArea: Rect;
  primary?: boolean;
}

export const MIN_W = 960;
export const MIN_H = 540;
export const DEFAULT_W = 1280;
export const DEFAULT_H = 720;

const intersectArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

export function defaultState(primary: Screen): WindowState {
  const wa = primary.workArea;
  const width = Math.min(DEFAULT_W, wa.width);
  const height = Math.min(DEFAULT_H, wa.height);
  return { mode: 'fullscreen', displayId: primary.id, maximized: false, bounds: { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height } };
}

export function parseState(text: string | null): Partial<WindowState> | null {
  try {
    const o = JSON.parse(text ?? '') as Partial<WindowState>;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

const MODES: DisplayMode[] = ['windowed', 'borderless', 'fullscreen'];

/** Make a stored state safe for the current display layout. */
export function restoreState(stored: Partial<WindowState> | null, screens: Screen[]): WindowState {
  const primary = screens.find((s) => s.primary) ?? screens[0];
  const dflt = defaultState(primary);
  if (!stored) return dflt;
  const mode = MODES.includes(stored.mode as DisplayMode) ? (stored.mode as DisplayMode) : dflt.mode;
  const b = stored.bounds;
  const valid = b && [b.x, b.y, b.width, b.height].every((n) => Number.isFinite(n));
  const byId = screens.find((s) => s.id === stored.displayId);
  // Pick the screen the stored bounds overlap most, preferring the stored id.
  let screen = byId;
  if (!screen && valid) screen = screens.reduce((best, s) => (intersectArea(s.workArea, b!) > intersectArea(best.workArea, b!) ? s : best), primary);
  if (!screen || (valid && !byId && intersectArea(screen.workArea, b!) === 0)) screen = primary;
  const wa = screen.workArea;
  if (!valid) return { ...dflt, mode, displayId: screen.id };
  const width = Math.min(Math.max(MIN_W, Math.round(b!.width)), wa.width);
  const height = Math.min(Math.max(MIN_H, Math.round(b!.height)), wa.height);
  const x = Math.min(Math.max(wa.x, Math.round(b!.x)), wa.x + wa.width - width);
  const y = Math.min(Math.max(wa.y, Math.round(b!.y)), wa.y + wa.height - height);
  return { mode, displayId: screen.id, maximized: stored.maximized === true, bounds: { x, y, width, height } };
}
