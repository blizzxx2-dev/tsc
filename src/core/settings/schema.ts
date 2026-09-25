/**
 * Typed settings schema (PLT-0096): every setting's default, range or options, category, widget and
 * restart flag in one table. The options screen renders from `SETTINGS_SCHEMA` (PLT-0105) — there is
 * no hand-maintained list of options anywhere else.
 */

export const SETTINGS_VERSION = 2;

export type Category = 'display' | 'graphics' | 'audio' | 'accessibility' | 'gameplay' | 'controls' | 'language' | 'privacy';
export const CATEGORIES: readonly Category[] = ['display', 'graphics', 'audio', 'accessibility', 'gameplay', 'controls', 'language', 'privacy'];

export type Widget = 'slider' | 'toggle' | 'choice' | 'bindings' | 'display';

/** Remappable keyboard actions (PLT-0101). Values are `KeyboardEvent.code`s. */
export const ACTIONS = ['tool1', 'tool2', 'tool3', 'tool4', 'tool5', 'tool6', 'tool7', 'tool8', 'toolNext', 'toolPrev', 'toolQuickSwap', 'pause', 'litany', 'confirm'] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, string>;

export const DEFAULT_BINDINGS: Bindings = {
  tool1: 'Digit1',
  tool2: 'Digit2',
  tool3: 'Digit3',
  tool4: 'Digit4',
  tool5: 'Digit5',
  tool6: 'Digit6',
  tool7: 'Digit7',
  tool8: 'Digit8',
  toolNext: 'KeyE',
  toolPrev: 'KeyQ',
  toolQuickSwap: 'Tab',
  pause: 'Escape',
  litany: 'Space',
  confirm: 'Enter',
};

/** Languages with shipped string tables (the LOC workstream appends as tables land). */
export const SHIPPED_LANGUAGES = ['en'] as const;

export type Consent = 'ask' | 'on' | 'off';
export type DisplayModeSetting = 'windowed' | 'borderless' | 'fullscreen';
export type Quality = 'low' | 'medium' | 'high';
export type Preset = Quality | 'custom';

export interface Settings {
  version: number;
  // display
  displayMode: DisplayModeSetting;
  /** Display id for fullscreen/borderless; -1 = the one the window is on. */
  monitor: number;
  renderScale: number;
  uiScale: number;
  vsync: boolean;
  /** Frames per second cap; 0 = uncapped (display rate). */
  frameCap: number;
  // graphics
  preset: Preset;
  /** Graphics quality tier; 'auto' uses the tier detected on first launch (ENG-0191). */
  gpuTier: 'auto' | 'low' | 'medium' | 'high';

  antialias: 'off' | 'msaa2' | 'msaa4';
  particleQuality: Quality;
  shaderQuality: Quality;
  bloom: boolean;
  grain: boolean;
  chromaticAberration: boolean;
  /** Candle flicker in the grade pass. */
  flicker: boolean;
  /** Screen-shake multiplier (0 disables). */
  shake: number;
  // audio
  /** Master volume 0..1. */
  volume: number;
  music: number;
  sfx: number;
  voice: number;
  ambience: number;
  muted: boolean;
  muteWhenUnfocused: boolean;
  // accessibility
  textSpeed: number;
  /** Dampen full-screen flashes and pulses. */
  reduceFlashing: boolean;
  reduceMotion: boolean;
  colorFilter: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'highContrast';
  cursorSize: number;
  /** Holds (drag, suction, cautery) toggle on click instead of requiring a held button. */
  holdToToggle: boolean;
  // gameplay
  /** Assist: multiply every operation's time limit. */
  timerAssist: 1 | 1.5 | 2;
  /** Assist: Space invokes the Litany instead of drawing the star. */
  litanyKey: boolean;
  pauseOnFocusLoss: boolean;
  // controls
  bindings: Bindings;
  swapMouseButtons: boolean;
  /** Gamepad virtual cursor speed, view pixels per second at full stick. */
  gamepadCursorSpeed: number;
  /** Stick response curve exponent-ish acceleration 0..3. */
  gamepadCursorAccel: number;
  // language
  /** `auto` follows Steam, then the OS locale (PLT-0102). */
  language: string;
  // privacy
  crashReports: Consent;
  telemetry: Consent;
}

interface Base<K extends keyof Settings> {
  key: K;
  category: Category;
  widget: Widget;
  /** Localisation key for the label; `<labelKey>.note` holds the help line. */
  labelKey: string;
  requiresRestart?: boolean;
  /** Changing this setting switches the graphics preset to Custom. */
  presetMember?: boolean;
}
type NumDef<K extends keyof Settings> = Base<K> & { type: 'number'; min: number; max: number; step: number; options?: readonly number[] };
type BoolDef<K extends keyof Settings> = Base<K> & { type: 'bool' };
type EnumDef<K extends keyof Settings> = Base<K> & { type: 'enum'; options: readonly Settings[K][] };
type MapDef<K extends keyof Settings> = Base<K> & { type: 'bindings' };
export type SettingDef = { [K in keyof Settings]: NumDef<K> | BoolDef<K> | EnumDef<K> | MapDef<K> }[Exclude<keyof Settings, 'version'>];

const d = <K extends keyof Settings>(key: K, category: Category, widget: Widget, extra: Omit<NumDef<K>, 'key' | 'category' | 'widget' | 'labelKey'> | Omit<BoolDef<K>, 'key' | 'category' | 'widget' | 'labelKey'> | Omit<EnumDef<K>, 'key' | 'category' | 'widget' | 'labelKey'> | Omit<MapDef<K>, 'key' | 'category' | 'widget' | 'labelKey'>) =>
  ({ key, category, widget, labelKey: `settings.${key}`, ...extra }) as SettingDef;

const vol = (key: 'volume' | 'music' | 'sfx' | 'voice' | 'ambience') => d(key, 'audio', 'slider', { type: 'number', min: 0, max: 1, step: 0.1 });

export const SETTINGS_SCHEMA: readonly SettingDef[] = [
  d('displayMode', 'display', 'choice', { type: 'enum', options: ['windowed', 'borderless', 'fullscreen'] }),
  d('monitor', 'display', 'display', { type: 'number', min: -1, max: 1e9, step: 1 }),
  d('renderScale', 'display', 'slider', { type: 'number', min: 0.5, max: 2, step: 0.25 }),
  d('uiScale', 'display', 'slider', { type: 'number', min: 0.8, max: 1.5, step: 0.05 }),
  d('vsync', 'display', 'toggle', { type: 'bool', requiresRestart: true }),
  d('frameCap', 'display', 'choice', { type: 'number', min: 0, max: 360, step: 1, options: [0, 30, 60, 90, 120, 144, 165, 240] }),
  d('preset', 'graphics', 'choice', { type: 'enum', options: ['low', 'medium', 'high', 'custom'] }),
  d('gpuTier', 'graphics', 'choice', { type: 'enum', options: ['auto', 'low', 'medium', 'high'] }),
  d('antialias', 'graphics', 'choice', { type: 'enum', options: ['off', 'msaa2', 'msaa4'], presetMember: true }),
  d('particleQuality', 'graphics', 'choice', { type: 'enum', options: ['low', 'medium', 'high'], presetMember: true }),
  d('shaderQuality', 'graphics', 'choice', { type: 'enum', options: ['low', 'medium', 'high'], presetMember: true }),
  d('bloom', 'graphics', 'toggle', { type: 'bool', presetMember: true }),
  d('grain', 'graphics', 'toggle', { type: 'bool' }),
  d('chromaticAberration', 'graphics', 'toggle', { type: 'bool' }),
  d('flicker', 'graphics', 'toggle', { type: 'bool' }),
  d('shake', 'accessibility', 'choice', { type: 'number', min: 0, max: 1, step: 0.5, options: [0, 0.5, 1] }),
  vol('volume'),
  vol('music'),
  vol('sfx'),
  vol('voice'),
  vol('ambience'),
  d('muted', 'audio', 'toggle', { type: 'bool' }),
  d('muteWhenUnfocused', 'audio', 'toggle', { type: 'bool' }),
  d('textSpeed', 'accessibility', 'slider', { type: 'number', min: 0.5, max: 3, step: 0.25 }),
  d('reduceFlashing', 'accessibility', 'toggle', { type: 'bool' }),
  d('reduceMotion', 'accessibility', 'toggle', { type: 'bool' }),
  d('colorFilter', 'accessibility', 'choice', { type: 'enum', options: ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'highContrast'] }),
  d('cursorSize', 'accessibility', 'slider', { type: 'number', min: 0.75, max: 2, step: 0.25 }),
  d('holdToToggle', 'accessibility', 'toggle', { type: 'bool' }),
  d('timerAssist', 'gameplay', 'choice', { type: 'enum', options: [1, 1.5, 2] }),
  d('litanyKey', 'gameplay', 'toggle', { type: 'bool' }),
  d('pauseOnFocusLoss', 'gameplay', 'toggle', { type: 'bool' }),
  d('bindings', 'controls', 'bindings', { type: 'bindings' }),
  d('swapMouseButtons', 'controls', 'toggle', { type: 'bool' }),
  d('gamepadCursorSpeed', 'controls', 'slider', { type: 'number', min: 200, max: 2000, step: 100 }),
  d('gamepadCursorAccel', 'controls', 'slider', { type: 'number', min: 0, max: 3, step: 0.5 }),
  d('language', 'language', 'choice', { type: 'enum', options: ['auto', ...SHIPPED_LANGUAGES] }),
  d('crashReports', 'privacy', 'choice', { type: 'enum', options: ['ask', 'on', 'off'] }),
  d('telemetry', 'privacy', 'choice', { type: 'enum', options: ['ask', 'on', 'off'] }),
];

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  version: SETTINGS_VERSION,
  displayMode: 'fullscreen',
  monitor: -1,
  renderScale: 1,
  gpuTier: 'auto',
  uiScale: 1,
  vsync: true,
  frameCap: 0,
  preset: 'high',
  antialias: 'msaa4',
  particleQuality: 'high',
  shaderQuality: 'high',
  bloom: true,
  grain: true,
  chromaticAberration: true,
  flicker: true,
  shake: 1,
  volume: 0.6,
  music: 1,
  sfx: 1,
  voice: 1,
  ambience: 1,
  muted: false,
  muteWhenUnfocused: true,
  textSpeed: 1,
  reduceFlashing: false,
  reduceMotion: false,
  colorFilter: 'none',
  cursorSize: 1,
  holdToToggle: false,
  timerAssist: 1,
  litanyKey: false,
  pauseOnFocusLoss: true,
  bindings: Object.freeze({ ...DEFAULT_BINDINGS }) as Bindings,
  swapMouseButtons: false,
  gamepadCursorSpeed: 900,
  gamepadCursorAccel: 1.5,
  language: 'auto',
  crashReports: 'ask',
  telemetry: 'ask',
});

/** Graphics preset contents (PLT-0098). Safe mode uses `low` (PLT-0021). */
export const PRESETS: Record<Quality, Pick<Settings, 'antialias' | 'particleQuality' | 'shaderQuality' | 'bloom'>> = {
  low: { antialias: 'off', particleQuality: 'low', shaderQuality: 'low', bloom: false },
  medium: { antialias: 'msaa2', particleQuality: 'medium', shaderQuality: 'medium', bloom: true },
  high: { antialias: 'msaa4', particleQuality: 'high', shaderQuality: 'high', bloom: true },
};

export const schemaFor = (key: keyof Settings): SettingDef | undefined => SETTINGS_SCHEMA.find((s) => s.key === key);

/** Serializable metadata for the options screen (PLT-0105). */
export function settingsMetadata() {
  return SETTINGS_SCHEMA.map((s) => ({
    key: s.key,
    category: s.category,
    widget: s.widget,
    labelKey: s.labelKey,
    noteKey: `${s.labelKey}.note`,
    requiresRestart: !!s.requiresRestart,
    default: DEFAULT_SETTINGS[s.key],
    ...(s.type === 'number' ? { min: s.min, max: s.max, step: s.step, ...(s.options ? { options: s.options } : {}) } : {}),
    ...(s.type === 'enum' ? { options: s.options } : {}),
  }));
}
