/**
 * Player preferences — the settings service (PLT-0096/0097). Stored in `settings.json`, separately
 * from saves, through the same SaveStore (envelope, checksum, backup, retry).
 *
 * `settings` is a plain mutable object so scenes can read fields directly. Change it with `setSetting`
 * (validates, emits) — or mutate fields and call `saveSettings()`, which diffs against the last
 * persisted state and emits change events for whatever changed. Subscribers (audio, window, display
 * sleep, renderer, post-FX) apply changes live with `onSettingChange`.
 */
import { log } from '../platform/log';
import { platform } from '../platform';
import { encode } from './save/codec';
import { SETTINGS_FILE } from './save/schema';
import { saveStore } from './save';
import { DEFAULT_SETTINGS, PRESETS, schemaFor, type Category, type Settings } from './settings/schema';
import { applyPreset, defaultsFor, detectPreset, readSettings, validateSettings } from './settings/validate';

export type { Settings } from './settings/schema';
export { DEFAULT_SETTINGS, SETTINGS_SCHEMA, settingsMetadata } from './settings/schema';

const LEGACY_SETTINGS_KEY = 'suture-and-steel.settings';

function readLegacy(): string | null {
  try {
    return globalThis.localStorage?.getItem(LEGACY_SETTINGS_KEY) ?? null;
  } catch {
    return null;
  }
}

/** The v1 save stored the volume; carry it over when settings are created from it (PLT-0078). */
function legacySaveVolume(): number | null {
  for (const key of ['suture-and-steel.save', 'grim-apothecary.save']) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      const v = raw ? (JSON.parse(raw) as { volume?: unknown }).volume : undefined;
      if (typeof v === 'number' && Number.isFinite(v)) return Math.min(1, Math.max(0, v));
    } catch {
      // ignore
    }
  }
  return null;
}

function loadInitial(): { settings: Settings; firstLaunch: boolean } {
  const fs = saveStore.fs;
  let r = readSettings(fs.read(SETTINGS_FILE));
  if (!r.found) r = readSettings(fs.read(`${SETTINGS_FILE}.bak`));
  let migratedLegacy = false;
  if (!r.found) {
    const legacy = readLegacy();
    if (legacy) {
      r = readSettings(legacy);
      migratedLegacy = true;
    } else {
      const vol = legacySaveVolume();
      if (vol !== null) {
        r = { ...validateSettings({ volume: vol }), found: true };
        migratedLegacy = true;
      }
    }
  }
  for (const w of r.warnings) log.warn('settings', w);
  const s = r.settings;
  if (platform.args.resetSettings) {
    log.info('settings', '--reset-settings: defaults restored');
    Object.assign(s, structuredClone(DEFAULT_SETTINGS));
  }
  if (platform.safeMode) {
    // Safe mode (PLT-0021): defaults, Low tier, no MSAA, windowed.
    Object.assign(s, structuredClone(DEFAULT_SETTINGS));
    applyPreset(s, 'low');
    s.displayMode = 'windowed';
    s.vsync = true;
  }
  if (platform.args.windowed) s.displayMode = 'windowed';
  if (platform.args.fullscreen) s.displayMode = 'fullscreen';
  const needsWrite = migratedLegacy || platform.args.resetSettings || platform.safeMode || r.warnings.length > 0;
  if (needsWrite) void saveStore.write(SETTINGS_FILE, encode('settings', s));
  return { settings: s, firstLaunch: !r.found || platform.args.resetSettings };
}

const initial = loadInitial();

export const settings: Settings = initial.settings;
/** No settings existed before this launch — run first-launch auto-detection (PLT-0103). */
export const firstLaunch: boolean = initial.firstLaunch;

type Listener = (value: unknown, key: keyof Settings) => void;
const listeners = new Map<keyof Settings | '*', Set<Listener>>();
let persisted: Settings = structuredClone(settings);

/** Subscribe to one setting (or `'*'` for all); returns an unsubscribe function. */
export function onSettingChange<K extends keyof Settings>(key: K | '*', cb: (value: Settings[K], key: K) => void): () => void {
  const set = listeners.get(key) ?? new Set();
  set.add(cb as Listener);
  listeners.set(key, set);
  return () => set.delete(cb as Listener);
}

function emit(key: keyof Settings): void {
  for (const cb of [...(listeners.get(key) ?? []), ...(listeners.get('*') ?? [])]) {
    try {
      cb(settings[key], key);
    } catch (e) {
      log.error('settings', `listener for ${String(key)} failed`, e);
    }
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Validate, clamp, keep the preset consistent, persist, and notify. */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const { settings: v, warnings } = validateSettings({ ...settings, [key]: value });
  for (const w of warnings) log.warn('settings', w);
  if (key === 'preset') applyPreset(v, v.preset);
  else if (schemaFor(key)?.presetMember) v.preset = detectPreset(v);
  Object.assign(settings, v);
  saveSettings();
}

/** Persist and emit change events for every field that differs from the last persisted state. */
export function saveSettings(): void {
  const { settings: v } = validateSettings(settings);
  Object.assign(settings, v);
  const changed = (Object.keys(settings) as (keyof Settings)[]).filter((k) => !same(settings[k], persisted[k]));
  if (!changed.length) return;
  persisted = structuredClone(settings);
  void saveStore.write(SETTINGS_FILE, encode('settings', settings));
  for (const k of changed) emit(k);
}

/** Reset one category or everything to defaults (PLT-0106). */
export function resetSettings(category: Category | null = null): void {
  Object.assign(settings, defaultsFor(category));
  if (category === 'graphics' || category === null) settings.preset = detectPreset(settings);
  saveSettings();
}

/** True when any assist that eases the challenge is on (shown on results). */
export const assisted = (): boolean => settings.timerAssist !== 1 || settings.litanyKey;

export { PRESETS };
