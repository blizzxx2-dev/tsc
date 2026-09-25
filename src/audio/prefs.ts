/**
 * Audio preferences, persisted separately from the general settings so the
 * audio options can grow without touching the shared settings file. The first
 * load migrates the legacy master volume/mute from the general settings.
 */
import { saveSettings, settings as general } from '../core/settings';

export type HeartbeatMode = 'always' | 'low' | 'off';
export type DynamicRange = 'full' | 'reduced' | 'night';
export type SubtitleSize = 'S' | 'M' | 'L' | 'XL';

export interface AudioPrefs {
  /** 0..100 volumes. */
  master: number;
  music: number;
  sfx: number;
  voice: number;
  ambience: number;
  ui: number;
  muted: boolean;
  mono: boolean;
  /** −100 (left) … 100 (right). */
  balance: number;
  dynamicRange: DynamicRange;
  muteUnfocused: boolean;
  patientVox: boolean;
  heartbeat: HeartbeatMode;
  /** Glass pulse tick on every beat (otherwise only below 30 vitals). */
  pulseTick: boolean;
  reduceStress: boolean;
  /** Timer ticks from 30 s (quieter) instead of only the last 10 s. */
  timerTicksEarly: boolean;
  captions: boolean;
  subtitles: boolean;
  subtitleSize: SubtitleSize;
  /** 0..100 subtitle background opacity. */
  subtitleBg: number;
  /** Per-character typewriter blips in story scenes. */
  textBlips: boolean;
  /** Output device id (Electron setSinkId); '' = system default. */
  sinkId: string;
}

const KEY = 'suture-and-steel.audio';

/** Steam Deck heuristics: Linux at the Deck's native 1280×800. */
export function isSteamDeck(): boolean {
  try {
    return /Linux/.test(navigator.userAgent) && ((screen.width === 1280 && screen.height === 800) || /Steam ?Deck|SteamOS/i.test(navigator.userAgent));
  } catch {
    return false;
  }
}

export function defaultPrefs(): AudioPrefs {
  return {
    master: Math.round((general.volume ?? 0.6) * 100),
    music: 80,
    sfx: 90,
    voice: 100,
    ambience: 70,
    ui: 70,
    muted: general.muted ?? false,
    mono: false,
    balance: 0,
    dynamicRange: isSteamDeck() ? 'reduced' : 'full',
    muteUnfocused: true,
    patientVox: true,
    heartbeat: 'low',
    pulseTick: false,
    reduceStress: false,
    timerTicksEarly: false,
    captions: false,
    subtitles: true,
    subtitleSize: 'M',
    subtitleBg: 60,
    textBlips: false,
    sinkId: '',
  };
}

function load(): AudioPrefs {
  const base = defaultPrefs();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...base, ...(JSON.parse(raw) as Partial<AudioPrefs>) } : base;
  } catch {
    return base;
  }
}

export const audioPrefs: AudioPrefs = load();

export function saveAudioPrefs(): void {
  // Keep the legacy general settings in step for code that still reads them.
  general.volume = audioPrefs.master / 100;
  general.muted = audioPrefs.muted;
  saveSettings();
  try {
    localStorage.setItem(KEY, JSON.stringify(audioPrefs));
  } catch {
    // Storage unavailable: preferences last for this session only.
  }
}
