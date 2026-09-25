import type { ActionId } from './actions';
import { bindings as defaultBindings, type Bindings, type GlyphSet } from './bindings';
import type { Device, InputCode } from './types';

/**
 * On-screen names for inputs. Every prompt in the game is built from the player's
 * current bindings through `glyphFor(action)`, so rebinding a key changes the text.
 */

const KEY_NAMES: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  ShiftLeft: 'Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'R-Ctrl',
  AltLeft: 'Alt',
  AltRight: 'AltGr',
  MetaLeft: 'Meta',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  CapsLock: 'Caps',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

const MOUSE_NAMES = ['Left-click', 'Middle-click', 'Right-click', 'Mouse 4', 'Mouse 5'];
const MOUSE_DRAG = ['Left-drag', 'Middle-drag', 'Right-drag', 'Mouse 4 drag', 'Mouse 5 drag'];

/** Face/shoulder names per controller family, indexed by standard-mapping button. */
export const PAD_GLYPHS: Record<Exclude<GlyphSet, 'auto'>, readonly string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'Xbox'],
  playstation: ['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L-stick', 'R-stick', 'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'Home'],
  deck: ['A', 'B', 'X', 'Y', 'L1', 'R1', 'L2', 'R2', 'View', 'Menu', 'L3', 'R3', 'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'Steam'],
  generic: ['Button 1', 'Button 2', 'Button 3', 'Button 4', 'L-bumper', 'R-bumper', 'L-trigger', 'R-trigger', 'Select', 'Start', 'L-stick', 'R-stick', 'D-pad Up', 'D-pad Down', 'D-pad Left', 'D-pad Right', 'Home'],
};

/** Guess the glyph family from `Gamepad.id`. */
export function detectGlyphSet(id: string): Exclude<GlyphSet, 'auto'> {
  const s = id.toLowerCase();
  if (/28de|steam deck|valve|neptune/.test(s)) return 'deck';
  if (/054c|dualsense|dualshock|playstation|wireless controller/.test(s)) return 'playstation';
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return 'nintendo';
  if (/045e|xbox|xinput|microsoft/.test(s)) return 'xbox';
  return s ? 'generic' : 'xbox';
}

let layout: Map<string, string> | null = null;

/**
 * Ask the browser for the player's keyboard layout so AZERTY/QWERTZ players see their
 * own key caps (bindings stay on physical `code`). Falls back to US names.
 */
export async function loadLayoutLabels(nav: { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } } = typeof navigator === 'undefined' ? {} : (navigator as never)): Promise<void> {
  try {
    const m = await nav.keyboard?.getLayoutMap?.();
    if (m) setLayoutLabels(new Map(m));
  } catch {
    // Not permitted or unsupported: keep US labels.
  }
}

export function setLayoutLabels(m: Map<string, string> | null): void {
  layout = m;
}

export function keyLabel(code: string): string {
  const printable = layout?.get(code);
  if (printable && printable.trim()) return printable.length === 1 ? printable.toUpperCase() : printable;
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export interface GlyphContext {
  device: Device;
  glyphs: Exclude<GlyphSet, 'auto'>;
}

/** Name of one physical input. */
export function codeLabel(code: InputCode, glyphs: Exclude<GlyphSet, 'auto'> = 'xbox'): string {
  if (code.includes('+')) return code.split('+').map((c) => codeLabel(c.startsWith('pad:') ? c : `pad:${c}`, glyphs)).join('+');
  const [kind, rest] = [code.slice(0, code.indexOf(':')), code.slice(code.indexOf(':') + 1)];
  if (kind === 'key') return keyLabel(rest);
  if (kind === 'mouse') return MOUSE_NAMES[Number(rest)] ?? `Mouse ${Number(rest) + 1}`;
  if (kind === 'wheel') return rest === 'up' ? 'Wheel up' : 'Wheel down';
  if (kind === 'pad') return PAD_GLYPHS[glyphs][Number(rest)] ?? `Button ${rest}`;
  return code;
}

let context: GlyphContext = { device: 'kbm', glyphs: 'xbox' };

/** The Input facade keeps this current: last-used device and detected pad family. */
export function setGlyphContext(c: GlyphContext): void {
  context = c;
}
export const glyphContext = (): GlyphContext => context;

/** The label for an action on the current (or given) device: its first binding for that device. */
export function glyphFor(action: ActionId, device: Device = context.device, b: Bindings = defaultBindings): string {
  // `shown` applies the layout preferences (Nintendo face buttons, left-handed mouse) slot by slot.
  const set = b.shown(action);
  const list = device === 'pad' && set.pad.length ? set.pad : set.kbm.length ? set.kbm : set.pad;
  if (!list.length) return '—';
  return codeLabel(list[0], device === 'pad' ? context.glyphs : 'xbox');
}

/** A "hold and drag" prompt, e.g. "Right-drag" or "Hold LT". */
export function dragGlyphFor(action: ActionId, device: Device = context.device, b: Bindings = defaultBindings): string {
  const set = b.shown(action);
  const code = device === 'pad' && set.pad.length ? set.pad[0] : set.kbm[0];
  if (!code) return '—';
  if (code.startsWith('mouse:')) return MOUSE_DRAG[Number(code.slice(6))] ?? `${codeLabel(code)} drag`;
  return `Hold ${codeLabel(code, device === 'pad' ? context.glyphs : 'xbox')}`;
}

/** Tray/briefing label for the instrument in TOOL_INFO order position `slot` (1-based). */
export const toolKeyLabel = (slot: number, b: Bindings = defaultBindings): string => glyphFor(`tool.select.${slot}` as ActionId, context.device, b);
