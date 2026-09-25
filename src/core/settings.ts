/** Player preferences, stored separately from campaign progress. */
export interface Settings {
  volume: number; // 0..1
  muted: boolean;
  /** Screen-shake multiplier (0 disables). */
  shake: number;
  /** Assist: multiply every operation's time limit. */
  timerAssist: 1 | 1.5 | 2;
  /** Assist: Space invokes the Litany instead of drawing the star. */
  litanyKey: boolean;
  /** Dampen full-screen flashes and pulses. */
  reduceFlashing: boolean;
  /** Interface language (BCP 47, see src/i18n/locales.ts); '' follows the system language. */
  language: string;
}

const KEY = 'suture-and-steel.settings';

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  muted: false,
  shake: 1,
  timerAssist: 1,
  litanyKey: false,
  reduceFlashing: false,
  language: '',
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}

/** True when any assist that eases the challenge is on (shown on results). */
export const assisted = (): boolean => settings.timerAssist !== 1 || settings.litanyKey;
