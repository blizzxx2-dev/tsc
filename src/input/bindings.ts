import { ACTION_IDS, ACTIONS, DEFAULT_BINDINGS, MAX_KBM, MAX_PAD, RESERVED, UNBINDABLE, actionDef, isActionId, isReserved, type ActionId, type BindingSet } from './actions';
import type { InputCode } from './types';

/**
 * Player bindings and input preferences. Stored in their own versioned localStorage
 * entry (separate from campaign progress and from the general settings file) so the
 * bindings format can migrate independently.
 */
export const BINDINGS_KEY = 'suture-and-steel.input';
export const BINDINGS_VERSION = 2;

export type HoldMode = 'hold' | 'toggle';
export type LitanyInput = 'draw' | 'key' | 'both';
export type GlyphSet = 'auto' | 'xbox' | 'playstation' | 'nintendo' | 'deck' | 'generic';

export interface Deadzone {
  inner: number;
  outer: number;
}

export interface InputPrefs {
  /** Hold tools (Leech, Salve, Tincture, Brand): hold the button, or click once to start and again to stop. */
  holdMode: HoldMode;
  /** Target Size assist: every interaction radius is multiplied by this. */
  hitScale: 1 | 1.25 | 1.5;
  /** Assisted stitching: run the cursor along the wound and the stitches are placed for you. */
  assistedStitch: 'off' | 'on' | 'gamepad';
  /** Gamepad aim assist (slow-down near targets, snap to the incision node). */
  aimAssist: boolean;
  /** Virtual cursor speed multiplier, 0.5–2.0. */
  cursorSpeed: number;
  deadzones: { left: Deadzone; right: Deadzone };
  /** How the Litany is invoked: drawing the star, the Litany key, or either. */
  litanyInput: LitanyInput;
  /** Nintendo layout: swap the confirm/back face buttons. */
  nintendoLayout: boolean;
  invertWheel: boolean;
  wrapWheel: boolean;
  glyphs: GlyphSet;
  /** Tongs: hold the button while pulling, or click once to seize and again to let go (INP-0044). */
  grabMode: HoldMode;
  /** Suggest tool on press: pressing on a target with the wrong instrument switches to the one it needs (INP-0052). */
  autoTool: boolean;
  /** Left-handed mode: tray mirrored to the right, tool on the right mouse button and the star on the left (INP-0069). */
  leftHanded: boolean;
}

export const DEFAULT_PREFS: InputPrefs = {
  holdMode: 'hold',
  hitScale: 1,
  assistedStitch: 'off',
  aimAssist: true,
  cursorSpeed: 1,
  deadzones: { left: { inner: 0.15, outer: 0.95 }, right: { inner: 0.15, outer: 0.95 } },
  litanyInput: 'draw',
  nintendoLayout: false,
  invertWheel: false,
  wrapWheel: true,
  glyphs: 'auto',
  grabMode: 'hold',
  autoTool: false,
  leftHanded: false,
};

/** Left-handed mode trades the two mouse buttons (the instrument moves to the right button, the star to the left). */
export const swapMouse = (c: InputCode): InputCode => (c === 'mouse:0' ? 'mouse:2' : c === 'mouse:2' ? 'mouse:0' : c);

export interface StoredInputV2 {
  version: 2;
  /** Only actions the player changed; everything else follows the defaults in code. */
  bindings: Partial<Record<ActionId, BindingSet>>;
  prefs: Partial<InputPrefs>;
}

/** Version 1 (pre-release builds): one flat list per action and a boolean Litany-key assist. */
export interface StoredInputV1 {
  version: 1;
  bindings: Record<string, string[]>;
  litanySpace?: boolean;
}

/** v1 used a few action names that were later renamed. */
const V1_RENAMES: Record<string, ActionId> = { 'litany.space': 'litany.key', 'tool.swap': 'tool.quickSwap', 'menu.back': 'ui.back' };

export function migrate(raw: unknown): StoredInputV2 {
  const empty: StoredInputV2 = { version: 2, bindings: {}, prefs: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as { version?: number };
  if (r.version === 1) {
    const v1 = raw as StoredInputV1;
    const bindings: Partial<Record<ActionId, BindingSet>> = {};
    for (const [name, codes] of Object.entries(v1.bindings ?? {})) {
      const id = V1_RENAMES[name] ?? name;
      if (!isActionId(id) || !Array.isArray(codes)) continue;
      bindings[id] = {
        kbm: codes.filter((c) => !c.startsWith('pad:')).slice(0, MAX_KBM),
        pad: codes.filter((c) => c.startsWith('pad:')).slice(0, MAX_PAD),
      };
    }
    return { version: 2, bindings, prefs: v1.litanySpace ? { litanyInput: 'both' } : {} };
  }
  if (r.version === 2) {
    const v2 = raw as StoredInputV2;
    const bindings: Partial<Record<ActionId, BindingSet>> = {};
    for (const [id, set] of Object.entries(v2.bindings ?? {})) {
      if (!isActionId(id) || !set) continue;
      bindings[id] = { kbm: (set.kbm ?? []).slice(0, MAX_KBM), pad: (set.pad ?? []).slice(0, MAX_PAD) };
    }
    return { version: 2, bindings, prefs: v2.prefs ?? {} };
  }
  // Unknown (newer) version: fall back to defaults rather than guess.
  return empty;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export type Slot = { kind: 'kbm'; index: 0 | 1 } | { kind: 'pad'; index: 0 };

export type AssignResult =
  | { ok: true }
  | { ok: false; reason: 'reserved' | 'unbindable'; message: string }
  | { ok: false; reason: 'conflict'; conflicts: { action: ActionId; slot: Slot }[] };

const slotKindOf = (code: InputCode): 'kbm' | 'pad' => (code.startsWith('pad:') ? 'pad' : 'kbm');

export class Bindings {
  private overrides: Partial<Record<ActionId, BindingSet>> = {};
  prefs: InputPrefs = structuredCloneish(DEFAULT_PREFS);
  /** Bumped on every change so caches (glyph labels) can refresh. */
  revision = 0;

  constructor(private storage: StorageLike | null = null) {
    this.load();
  }

  load(): void {
    let raw: unknown = null;
    try {
      const s = this.storage?.getItem(BINDINGS_KEY);
      raw = s ? JSON.parse(s) : null;
    } catch {
      raw = null;
    }
    const data = migrate(raw);
    this.overrides = data.bindings;
    this.prefs = { ...structuredCloneish(DEFAULT_PREFS), ...data.prefs, deadzones: { ...DEFAULT_PREFS.deadzones, ...(data.prefs.deadzones ?? {}) } };
    this.revision++;
  }

  save(): void {
    const data: StoredInputV2 = { version: BINDINGS_VERSION, bindings: this.overrides, prefs: this.prefs };
    try {
      this.storage?.setItem(BINDINGS_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable: bindings last for this session only.
    }
    this.revision++;
  }

  get(id: ActionId): BindingSet {
    const o = this.overrides[id];
    const d = DEFAULT_BINDINGS[id];
    return { kbm: [...(o?.kbm ?? d.kbm)], pad: [...(o?.pad ?? d.pad)] };
  }

  /** Bindings as used at runtime (Nintendo layout swaps the confirm/back face buttons; left-handed mode swaps the mouse buttons). */
  effective(id: ActionId): InputCode[] {
    const set = this.shown(id);
    return [...set.kbm, ...set.pad];
  }

  /** The bindings with the layout preferences applied, slot by slot (what the Controls screen shows). */
  shown(id: ActionId): BindingSet {
    const set = this.get(id);
    if (this.prefs.nintendoLayout) set.pad = set.pad.map((c) => (c === 'pad:0' ? 'pad:1' : c === 'pad:1' ? 'pad:0' : c));
    if (this.prefs.leftHanded) set.kbm = set.kbm.map(swapMouse);
    return set;
  }

  isDefault(id: ActionId): boolean {
    return !this.overrides[id];
  }

  private put(id: ActionId, set: BindingSet): void {
    const d = DEFAULT_BINDINGS[id];
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    if (same(set.kbm, d.kbm) && same(set.pad, d.pad)) delete this.overrides[id];
    else this.overrides[id] = { kbm: [...set.kbm], pad: [...set.pad] };
    this.revision++;
  }

  codeAt(id: ActionId, slot: Slot): InputCode | undefined {
    return this.get(id)[slot.kind][slot.index];
  }

  /** Other actions sharing a context with `id` that are bound to `code`. */
  conflicts(id: ActionId, code: InputCode): { action: ActionId; slot: Slot }[] {
    const ctx = actionDef(id).contexts;
    const out: { action: ActionId; slot: Slot }[] = [];
    for (const a of ACTIONS) {
      if (a.id === id || !a.contexts.some((c) => ctx.includes(c))) continue;
      const set = this.get(a.id);
      set.kbm.forEach((c, i) => c === code && out.push({ action: a.id, slot: { kind: 'kbm', index: i as 0 | 1 } }));
      set.pad.forEach((c) => c === code && out.push({ action: a.id, slot: { kind: 'pad', index: 0 } }));
    }
    return out;
  }

  /**
   * Bind `code` into a slot. Refuses reserved slots and unbindable inputs; reports
   * conflicts (unless `mode` says how to resolve them: swap the old code onto the
   * other action, or just take it).
   */
  assign(id: ActionId, slot: Slot, code: InputCode, mode: 'ask' | 'swap' = 'ask'): AssignResult {
    if (UNBINDABLE.includes(code)) return { ok: false, reason: 'unbindable', message: 'That key belongs to the system.' };
    if (slotKindOf(code) !== slot.kind) return { ok: false, reason: 'unbindable', message: slot.kind === 'pad' ? 'Press a gamepad button.' : 'Press a key or mouse button.' };
    const current = this.codeAt(id, slot);
    if (current === code) return { ok: true };
    if (current && isReserved(id, current)) return { ok: false, reason: 'reserved', message: RESERVED.find((r) => r.action === id && r.code === current)!.why };
    const conflicts = this.conflicts(id, code);
    const blocking = conflicts.find((c) => isReserved(c.action, code));
    if (blocking) return { ok: false, reason: 'reserved', message: RESERVED.find((r) => r.action === blocking.action && r.code === code)!.why };
    if (conflicts.length && mode === 'ask') return { ok: false, reason: 'conflict', conflicts };
    for (const c of conflicts) {
      const other = this.get(c.action);
      const list = other[c.slot.kind];
      if (current) list[c.slot.index] = current;
      else list.splice(c.slot.index, 1);
      this.put(c.action, other);
    }
    const set = this.get(id);
    const list = set[slot.kind];
    if (slot.index < list.length) list[slot.index] = code;
    else list.push(code);
    // Keep the pair free of duplicates.
    set[slot.kind] = list.filter((c, i) => list.indexOf(c) === i);
    this.put(id, set);
    return { ok: true };
  }

  /** Remove a binding. Reserved inputs cannot be removed. */
  clear(id: ActionId, slot: Slot): AssignResult {
    const current = this.codeAt(id, slot);
    if (!current) return { ok: true };
    if (isReserved(id, current)) return { ok: false, reason: 'reserved', message: RESERVED.find((r) => r.action === id && r.code === current)!.why };
    const set = this.get(id);
    set[slot.kind].splice(slot.index, 1);
    this.put(id, set);
    return { ok: true };
  }

  reset(id: ActionId): void {
    delete this.overrides[id];
    this.revision++;
  }

  resetAll(): void {
    this.overrides = {};
    this.revision++;
  }

  /** Install a set of trusted overrides at once (a binding preset); reserved and unbindable rules are not consulted. */
  applyOverrides(o: Partial<Record<ActionId, BindingSet>>): void {
    for (const [id, set] of Object.entries(o)) if (isActionId(id) && set) this.put(id, { kbm: set.kbm.slice(0, MAX_KBM), pad: set.pad.slice(0, MAX_PAD) });
  }

  /** Every action with its current bindings (for the Controls screen and for glyphs). */
  all(): { id: ActionId; set: BindingSet }[] {
    return ACTION_IDS.map((id) => ({ id, set: this.get(id) }));
  }
}

function structuredCloneish<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The game's single bindings store. */
export const bindings = new Bindings(browserStorage());
