/**
 * Settings validation and migration (PLT-0107): out-of-range values are clamped, unknown keys are
 * dropped, missing keys take defaults, and a corrupt file yields defaults plus a warning. Settings
 * use the same envelope/checksum and ordered-migration approach as saves (PLT-0096).
 */
import { decode, isObj } from '../save/codec';
import { ACTIONS, DEFAULT_BINDINGS, DEFAULT_SETTINGS, PRESETS, SETTINGS_SCHEMA, SETTINGS_VERSION, type Action, type Bindings, type Category, type Settings } from './schema';

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;

/** `SETTINGS_MIGRATIONS[n]` upgrades version n to n+1. Append only. */
export const SETTINGS_MIGRATIONS: Record<number, Migration> = {
  // v1: the M0 localStorage object (volume, muted, shake, timerAssist, litanyKey, reduceFlashing) — same keys, no version.
  1: (d) => ({ ...d }),
};

const KEY_CODE = /^[A-Za-z][A-Za-z0-9]{0,31}$/;

export function sanitizeBindings(v: unknown, warnings: string[]): Bindings {
  const out: Bindings = { ...DEFAULT_BINDINGS };
  if (!isObj(v)) return out;
  for (const a of ACTIONS) {
    const code = v[a];
    if (typeof code === 'string' && KEY_CODE.test(code)) out[a] = code;
    else if (code !== undefined) warnings.push(`bindings.${a}: invalid key code`);
  }
  const conflicts = findConflicts(out);
  if (conflicts.length) {
    warnings.push(`bindings: conflicting keys ${conflicts.map((c) => c.join('/')).join(', ')} reset to defaults`);
    for (const group of conflicts) for (const a of group) out[a] = DEFAULT_BINDINGS[a];
    // Defaults are conflict-free; if a non-conflicting custom binding now collides with a restored default, restore it too.
    for (const group of findConflicts(out)) for (const a of group) out[a] = DEFAULT_BINDINGS[a];
  }
  return out;
}

/** Groups of actions bound to the same key (PLT-0101). */
export function findConflicts(b: Bindings): Action[][] {
  const byCode = new Map<string, Action[]>();
  for (const a of ACTIONS) byCode.set(b[a], [...(byCode.get(b[a]) ?? []), a]);
  return [...byCode.values()].filter((g) => g.length > 1);
}

/**
 * Bind `action` to `code`. If another action already uses that key the two swap keys, so a remap
 * can never leave a conflict. Returns the action that was displaced (or null).
 */
export function rebind(b: Bindings, action: Action, code: string): Action | null {
  if (!KEY_CODE.test(code)) throw new Error(`Invalid key code: ${code}`);
  const other = ACTIONS.find((a) => a !== action && b[a] === code) ?? null;
  if (other) b[other] = b[action];
  b[action] = code;
  return other;
}

/** Toggle → 0–100 % amount pairs (ENG-0164). */
const AMOUNT_OF = { bloom: 'bloomAmount', grain: 'grainAmount', chromaticAberration: 'chromaAmount', flicker: 'flickerAmount' } as const;

/**
 * Backwards compatibility for post-effect strengths (ENG-0164): a file that stored a toggle as a
 * number (0..1 or 0..100, from dev builds that trialled sliders) becomes toggle + amount, and an
 * amount is never invented for a file that only knew the toggle (the default 100 % applies).
 */
export function normaliseLegacyAmounts(d: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const out = { ...d };
  for (const [toggle, amount] of Object.entries(AMOUNT_OF)) {
    const v = out[toggle];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[toggle] = v > 0;
    if (out[amount] === undefined && v > 0) out[amount] = Math.round(v <= 1 ? v * 100 : v);
    warnings.push(`settings.${toggle}: numeric strength migrated to ${amount}`);
  }
  return out;
}

export function validateSettings(raw: unknown): { settings: Settings; warnings: string[] } {
  const warnings: string[] = [];
  const src = isObj(raw) ? normaliseLegacyAmounts(raw, warnings) : {};
  if (!isObj(raw)) warnings.push('settings: not an object, using defaults');
  const out: Settings = { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  const known = new Set<string>(['version', ...SETTINGS_SCHEMA.map((s) => s.key)]);
  for (const k of Object.keys(src)) if (!known.has(k)) warnings.push(`settings.${k}: unknown key dropped`);

  for (const def of SETTINGS_SCHEMA) {
    const v = src[def.key];
    if (v === undefined) continue;
    const o = out as unknown as Record<string, unknown>;
    switch (def.type) {
      case 'number': {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          warnings.push(`settings.${def.key}: not a number`);
          break;
        }
        let n = Math.min(def.max, Math.max(def.min, v));
        if (n !== v) warnings.push(`settings.${def.key}: ${v} clamped to ${n}`);
        if (def.options && !def.options.includes(n)) {
          // Snap to the nearest listed option.
          n = def.options.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), def.options[0]);
          warnings.push(`settings.${def.key}: snapped to ${n}`);
        }
        o[def.key] = n;
        break;
      }
      case 'bool':
        if (typeof v === 'boolean') o[def.key] = v;
        else warnings.push(`settings.${def.key}: not a boolean`);
        break;
      case 'enum':
        if ((def.options as readonly unknown[]).includes(v)) o[def.key] = v;
        else warnings.push(`settings.${def.key}: ${JSON.stringify(v)} is not an option`);
        break;
      case 'bindings':
        o[def.key] = sanitizeBindings(v, warnings);
        break;
    }
  }
  out.version = SETTINGS_VERSION;
  return { settings: out, warnings };
}

/** Decode a settings file of any version into valid settings. Corrupt input → defaults + warning. */
export function readSettings(raw: string | null): { settings: Settings; warnings: string[]; found: boolean } {
  if (raw == null) return { ...validateSettings({}), warnings: [], found: false };
  const d = decode(raw, 'settings');
  let data: unknown;
  if (d.ok) data = d.data;
  else {
    // The v1 settings were a bare object with no version or envelope.
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isObj(parsed) && !('format' in parsed)) data = parsed;
    } catch {
      // fall through
    }
  }
  if (!isObj(data)) return { ...validateSettings({}), warnings: [`settings: file corrupt (${d.ok ? 'format' : d.error}), using defaults`], found: true };
  let cur: Record<string, unknown> = data;
  const from = typeof cur.version === 'number' && cur.version >= 1 ? Math.floor(cur.version) : 1;
  for (let v = from; v < SETTINGS_VERSION; v++) {
    const step = SETTINGS_MIGRATIONS[v];
    if (step) cur = step(cur);
  }
  cur.version = SETTINGS_VERSION;
  return { ...validateSettings(cur), found: true };
}

/** Defaults for one category (PLT-0106). `bindings` are copied so callers may mutate. */
export function defaultsFor(category: Category | null): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const def of SETTINGS_SCHEMA) {
    if (category && def.category !== category) continue;
    out[def.key] = def.key === 'bindings' ? { ...DEFAULT_BINDINGS } : DEFAULT_SETTINGS[def.key];
  }
  return out as Partial<Settings>;
}

/** Apply a named preset's members. */
export function applyPreset(s: Settings, preset: Settings['preset']): void {
  s.preset = preset;
  if (preset !== 'custom') Object.assign(s, PRESETS[preset]);
}

/** The preset whose members match, or `custom`. */
export function detectPreset(s: Settings): Settings['preset'] {
  for (const q of ['low', 'medium', 'high'] as const) {
    const p = PRESETS[q];
    if ((Object.keys(p) as (keyof typeof p)[]).every((k) => s[k] === p[k])) return q;
  }
  return 'custom';
}
