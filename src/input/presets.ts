import { ACTION_IDS, DEFAULT_BINDINGS, type ActionId, type BindingSet } from './actions';
import { DEFAULT_PREFS, type Bindings, type InputPrefs } from './bindings';

/**
 * Binding presets (INP-0075). A preset is the shipped defaults plus a few changes, so
 * applying one is a reset followed by those changes; `presetChanges` lists what would
 * differ from the player's current setup so the Controls screen can preview it first.
 */
export type PresetId = 'default' | 'left' | 'trackpad' | 'onehand';

export interface BindingPreset {
  id: PresetId;
  bindings: Partial<Record<ActionId, BindingSet>>;
  prefs: Partial<InputPrefs>;
}

export const PRESETS: readonly BindingPreset[] = [
  { id: 'default', bindings: {}, prefs: {} },
  {
    // Mouse in the left hand: the instrument on the right button, the star on the left, the tray on the
    // right, and the hold/cycle keys where the right hand rests.
    id: 'left',
    bindings: {
      'tool.hold': { kbm: ['key:ShiftRight'], pad: [] },
      'tool.prev': { kbm: ['key:BracketLeft', 'wheel:up'], pad: ['pad:4'] },
      'tool.next': { kbm: ['key:BracketRight', 'wheel:down'], pad: ['pad:5'] },
    },
    prefs: { leftHanded: true },
  },
  {
    // No middle button, no wheel worth the name, and holding a pad button while dragging is awkward.
    id: 'trackpad',
    bindings: { 'tool.radial': { kbm: ['key:KeyF', 'mouse:1'], pad: ['pad:3'] } },
    prefs: { holdMode: 'toggle', grabMode: 'toggle', litanyInput: 'both' },
  },
  {
    // One hand, on the mouse (GAM-0241): the side buttons cycle the instruments (the wheel still does), the
    // right button speaks the Litany instead of drawing it, and nothing needs the keyboard.
    id: 'onehand',
    bindings: {
      'tool.prev': { kbm: ['mouse:3', 'wheel:up'], pad: ['pad:4'] },
      'tool.next': { kbm: ['mouse:4', 'wheel:down'], pad: ['pad:5'] },
      'tool.quickSwap': { kbm: ['key:Tab'], pad: ['pad:14'] },
      'litany.draw': { kbm: [], pad: ['pad:6'] },
      'litany.key': { kbm: ['mouse:2'], pad: ['pad:4+pad:5'] },
    },
    prefs: { litanyInput: 'key', wrapWheel: true },
  },
];

export const presetById = (id: PresetId): BindingPreset => PRESETS.find((p) => p.id === id)!;

export interface PresetChange {
  /** The action (`kbm`/`pad` slot list) or preference that changes. */
  action?: ActionId;
  pref?: keyof InputPrefs;
  from: string;
  to: string;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const show = (set: BindingSet): string => [...set.kbm, ...set.pad].join(' / ') || '—';
const showPref = (v: unknown): string => (typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Preset prefs are the defaults with the preset's changes over them. */
export function presetPrefs(p: BindingPreset): InputPrefs {
  return { ...(JSON.parse(JSON.stringify(DEFAULT_PREFS)) as InputPrefs), ...p.prefs };
}

/** What applying `p` would change against the bindings and preferences in `b`, in table order. */
export function presetChanges(b: Bindings, p: BindingPreset): PresetChange[] {
  const out: PresetChange[] = [];
  for (const id of ACTION_IDS) {
    const cur = b.get(id);
    const next = p.bindings[id] ?? DEFAULT_BINDINGS[id];
    if (!same(cur.kbm, next.kbm) || !same(cur.pad, next.pad)) out.push({ action: id, from: show(cur), to: show(next) });
  }
  const prefs = presetPrefs(p);
  for (const k of Object.keys(prefs) as (keyof InputPrefs)[]) {
    const a = showPref(b.prefs[k]);
    const z = showPref(prefs[k]);
    if (a !== z) out.push({ pref: k, from: a, to: z });
  }
  return out;
}

/** Reset to the defaults, then apply the preset's bindings and preferences. */
export function applyPreset(b: Bindings, p: BindingPreset): void {
  b.resetAll();
  b.applyOverrides(p.bindings);
  Object.assign(b.prefs, presetPrefs(p));
}
