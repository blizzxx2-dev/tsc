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
  /** World render scale, 0.5–1 of native resolution (ENG-0181); UI is always native. */
  renderScale: number;
  /** Graphics quality tier; 'auto' uses the tier detected on first launch (ENG-0191). */
  gpuTier: 'auto' | 'low' | 'medium' | 'high';
  /** Tier chosen by the first-launch benchmark, with the renderer it was measured on. */
  detectedTier?: { tier: 'low' | 'medium' | 'high'; renderer: string; benchMs?: number };
  /** Frame-rate cap in fps (0 = uncapped / display refresh) (ENG-0060). */
  frameCap: number;
  /** Disables hitstop and other motion-heavy effects. */
  reduceMotion: boolean;
}

const KEY = 'suture-and-steel.settings';

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  muted: false,
  shake: 1,
  timerAssist: 1,
  litanyKey: false,
  reduceFlashing: false,
  renderScale: 1,
  gpuTier: 'auto',
  frameCap: 0,
  reduceMotion: false,
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
