import type { InputCode } from './types';

/**
 * The action map. Scenes never ask about physical keys: they ask whether a named
 * action fired. This file is the only place in the game that names default keys.
 */
export const TOOL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type ActionId =
  | 'primary'
  | 'tool.hold'
  | `tool.select.${(typeof TOOL_SLOTS)[number]}`
  | 'tool.next'
  | 'tool.prev'
  | 'tool.quickSwap'
  | 'tool.radial'
  | 'litany.draw'
  | 'litany.key'
  | 'pause'
  | 'ui.confirm'
  | 'ui.back'
  | 'ui.up'
  | 'ui.down'
  | 'ui.left'
  | 'ui.right'
  | 'ui.tabPrev'
  | 'ui.tabNext'
  | 'vn.advance'
  | 'vn.fast'
  | 'vn.auto'
  | 'vn.log'
  | 'vn.hide';

export type ActionGroup = 'tools' | 'litany' | 'story' | 'menus';
/** Where an action is live; two actions only conflict when their contexts overlap. */
export type ActionContext = 'op' | 'menu' | 'story';

export interface ActionDef {
  id: ActionId;
  group: ActionGroup;
  label: string;
  contexts: readonly ActionContext[];
  /** Pad bindings fire on release (and not at all if they were part of a chord), so LB+RB never cycles. */
  padOnRelease?: boolean;
  /** Pad chord bindings must be held this long (s) before the action fires. */
  chordHold?: number;
  /** Menu direction: repeats while held (180 ms delay, 80 ms rate). */
  repeat?: boolean;
}

export interface BindingSet {
  /** Up to two keyboard/mouse bindings. */
  kbm: InputCode[];
  /** Up to one gamepad binding (a button or a chord). */
  pad: InputCode[];
}

export const MAX_KBM = 2;
export const MAX_PAD = 1;

const op: readonly ActionContext[] = ['op'];
const menu: readonly ActionContext[] = ['menu'];
const story: readonly ActionContext[] = ['story'];

export const ACTIONS: readonly ActionDef[] = [
  { id: 'primary', group: 'tools', label: 'Use instrument', contexts: op },
  { id: 'tool.hold', group: 'tools', label: 'Hold instrument (hand rest)', contexts: op },
  ...TOOL_SLOTS.map((n): ActionDef => ({ id: `tool.select.${n}`, group: 'tools', label: `Instrument ${n}`, contexts: op })),
  { id: 'tool.next', group: 'tools', label: 'Next instrument', contexts: op, padOnRelease: true },
  { id: 'tool.prev', group: 'tools', label: 'Previous instrument', contexts: op, padOnRelease: true },
  { id: 'tool.quickSwap', group: 'tools', label: 'Swap to last instrument', contexts: op },
  { id: 'tool.radial', group: 'tools', label: 'Instrument wheel', contexts: op },
  { id: 'litany.draw', group: 'litany', label: 'Draw the star', contexts: op },
  { id: 'litany.key', group: 'litany', label: 'Speak the Litany', contexts: op, chordHold: 0.6 },
  { id: 'pause', group: 'menus', label: 'Pause', contexts: op },
  { id: 'ui.confirm', group: 'menus', label: 'Confirm', contexts: menu },
  { id: 'ui.back', group: 'menus', label: 'Back', contexts: ['menu', 'story'] },
  { id: 'ui.up', group: 'menus', label: 'Up', contexts: menu, repeat: true },
  { id: 'ui.down', group: 'menus', label: 'Down', contexts: menu, repeat: true },
  { id: 'ui.left', group: 'menus', label: 'Left', contexts: menu, repeat: true },
  { id: 'ui.right', group: 'menus', label: 'Right', contexts: menu, repeat: true },
  { id: 'ui.tabPrev', group: 'menus', label: 'Previous tab', contexts: menu },
  { id: 'ui.tabNext', group: 'menus', label: 'Next tab', contexts: menu },
  { id: 'vn.advance', group: 'story', label: 'Advance', contexts: story },
  { id: 'vn.fast', group: 'story', label: 'Fast-forward (hold)', contexts: story },
  { id: 'vn.auto', group: 'story', label: 'Auto-advance', contexts: story },
  { id: 'vn.log', group: 'story', label: 'Dialogue log', contexts: story },
  { id: 'vn.hide', group: 'story', label: 'Hide text box', contexts: story },
];

export const ACTION_IDS: readonly ActionId[] = ACTIONS.map((a) => a.id);
export const actionDef = (id: ActionId): ActionDef => ACTIONS.find((a) => a.id === id)!;
export const isActionId = (s: string): s is ActionId => ACTION_IDS.includes(s as ActionId);

const b = (kbm: InputCode[], pad: InputCode[] = []): BindingSet => ({ kbm, pad });

/** Default bindings (standard gamepad mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 11 RS, 12–15 D-pad). */
export const DEFAULT_BINDINGS: Readonly<Record<ActionId, BindingSet>> = {
  primary: b(['mouse:0'], ['pad:7']),
  'tool.hold': b(['key:ShiftLeft']),
  'tool.select.1': b(['key:Digit1']),
  'tool.select.2': b(['key:Digit2']),
  'tool.select.3': b(['key:Digit3']),
  'tool.select.4': b(['key:Digit4']),
  'tool.select.5': b(['key:Digit5']),
  'tool.select.6': b(['key:Digit6']),
  'tool.select.7': b(['key:Digit7']),
  'tool.select.8': b(['key:Digit8']),
  'tool.next': b(['key:KeyE', 'wheel:down'], ['pad:5']),
  'tool.prev': b(['key:KeyQ', 'wheel:up'], ['pad:4']),
  'tool.quickSwap': b(['key:Tab', 'mouse:3'], ['pad:14']),
  'tool.radial': b(['mouse:1'], ['pad:3']),
  'litany.draw': b(['mouse:2'], ['pad:6']),
  'litany.key': b(['key:Space'], ['pad:4+pad:5']),
  pause: b(['key:Escape'], ['pad:9']),
  'ui.confirm': b(['key:Enter', 'key:Space'], ['pad:0']),
  'ui.back': b(['key:Escape', 'key:Backspace'], ['pad:1']),
  'ui.up': b(['key:ArrowUp', 'key:KeyW'], ['pad:12']),
  'ui.down': b(['key:ArrowDown', 'key:KeyS'], ['pad:13']),
  'ui.left': b(['key:ArrowLeft', 'key:KeyA'], ['pad:14']),
  'ui.right': b(['key:ArrowRight', 'key:KeyD'], ['pad:15']),
  'ui.tabPrev': b(['key:PageUp'], ['pad:4']),
  'ui.tabNext': b(['key:PageDown'], ['pad:5']),
  'vn.advance': b(['key:Space', 'key:Enter'], ['pad:0']),
  'vn.fast': b(['key:ControlLeft', 'key:ControlRight'], ['pad:2']),
  'vn.auto': b(['key:KeyA'], ['pad:3']),
  'vn.log': b(['key:KeyL'], ['pad:8']),
  'vn.hide': b(['key:KeyH'], ['pad:11']),
};

/** Inputs the player can never unbind from these actions (Escape, left mouse, gamepad Start). */
export const RESERVED: readonly { action: ActionId; code: InputCode; why: string }[] = [
  { action: 'pause', code: 'key:Escape', why: 'Escape always pauses, so you can never be locked out of the menus.' },
  { action: 'ui.back', code: 'key:Escape', why: 'Escape always backs out of menus.' },
  { action: 'primary', code: 'mouse:0', why: 'The left mouse button always uses the instrument.' },
  { action: 'pause', code: 'pad:9', why: 'The gamepad Start/Menu button always pauses.' },
];

/** Keys a player may not capture as a binding at all (the OS or the game owns them). */
export const UNBINDABLE: readonly InputCode[] = ['key:F11', 'key:MetaLeft', 'key:MetaRight', 'key:PrintScreen', 'pad:16'];

export const isReserved = (action: ActionId, code: InputCode): boolean => RESERVED.some((r) => r.action === action && r.code === code);
export const reservedFor = (code: InputCode): (typeof RESERVED)[number] | undefined => RESERVED.find((r) => r.code === code);

/** Keyboard codes whose browser default (scrolling, focus change) must be suppressed. */
export const PREVENT_DEFAULT_KEYS: readonly string[] = ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Backspace'];

/** Scene-facing key codes needed by non-action UI (the rebinding capture screen). */
export const CAPTURE_CANCEL: InputCode = 'key:Escape';
/** Fullscreen toggles, handled by the shell. */
export const isFullscreenChord = (code: string, alt: boolean): boolean => code === 'F11' || (code === 'Enter' && alt);
