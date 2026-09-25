/**
 * The contract between the Electron main process (desktop/src) and the game (PLT-0013).
 * The preload script exposes only `window.ssBridge.invoke/send/on` restricted to the channels below;
 * everything typed lives here so main, preload and renderer cannot drift apart.
 * Type-only module: safe to import from both sides.
 */
import type { Edition } from './editions';

export type OsKind = 'windows' | 'mac' | 'linux';
export type DisplayMode = 'windowed' | 'borderless' | 'fullscreen';

export interface DisplayInfo {
  id: number;
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
  refreshRate: number;
  primary: boolean;
}

export interface WindowState {
  mode: DisplayMode;
  displayId: number;
  /** Windowed bounds (restored when leaving fullscreen/borderless). */
  bounds: { x: number; y: number; width: number; height: number };
  maximized: boolean;
}

/** Parsed command-line flags (PLT-0020). */
export interface LaunchArgs {
  dev: boolean;
  windowed: boolean;
  fullscreen: boolean;
  safeMode: boolean;
  resetSettings: boolean;
  kiosk: boolean;
  logLevel: string | null;
  glBackend: string | null;
  flags: Record<string, string>;
}

export interface SteamBoot {
  appId: number;
  /** SteamID64 as a string — used for save namespacing only, never rendered (PLT-0044). */
  steamId: string;
  personaName: string;
  /** Steam API language name, e.g. `english`, `german`, `schinese`. */
  language: string;
  isDeck: boolean;
  /** Owns the full game (queried from the demo; PLT-0064). */
  ownsFullGame: boolean;
  /** Achievement id → unlocked, as Steam reports it at boot. */
  achievements: Record<string, boolean>;
}

export interface BootInfo {
  os: OsKind;
  arch: string;
  osRelease: string;
  locale: string;
  edition: Edition;
  version: string;
  args: LaunchArgs;
  /** Launched in safe mode (flag, or accepted after repeated failed launches — PLT-0021). */
  safeMode: boolean;
  /** Renderer was restarted after a crash/hang; resume from the last autosave (PLT-0126). */
  recovered: boolean;
  steam: SteamBoot | null;
  /** Namespace of the save folder: `steam-<hash>` or `local` (PLT-0091). */
  userNamespace: string;
  /** Snapshot of every file in this user's save folder, name → contents. */
  files: Record<string, string>;
  /** Full edition only: the demo's files for carry-over import (PLT-0066). */
  demoFiles: Record<string, string> | null;
  window: WindowState;
  displays: DisplayInfo[];
  /** Human-readable, PII-free folder labels for the options screen. */
  folders: { saves: string; logs: string; screenshots: string };
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  detail?: string;
  confirm: string;
  cancel: string;
  /** Destructive actions ask twice (PLT-0137). */
  twice?: boolean;
}

/** Game → main, awaiting a reply. */
export interface InvokeContract {
  'ss:boot': [[], BootInfo];
  'ss:fs-write': [[name: string, data: string], WriteResult];
  'ss:fs-remove': [[name: string], WriteResult];
  'ss:window-set': [[mode: DisplayMode, displayId: number | null], WindowState];
  'ss:displays': [[], DisplayInfo[]];
  'ss:steam-achievement': [[id: string, unlock: boolean], boolean];
  'ss:steam-overlay': [[kind: 'store' | 'web', target: string], boolean];
  'ss:steam-keyboard': [[x: number, y: number, w: number, h: number], boolean];
  'ss:screenshot': [[], string | null];
  'ss:support-export': [[extra: Record<string, string>], string | null];
  'ss:delete-all-data': [[], boolean];
  'ss:confirm': [[opts: ConfirmOptions], boolean];
}

/** Game → main, fire and forget. */
export interface SendContract {
  'ss:log': [lines: string[]];
  'ss:activity': [a: { preventSleep: boolean; guardQuit: boolean; kioskIdleReset: boolean }];
  'ss:rich-presence': [values: Record<string, string | null>];
  'ss:open': [target: 'saves' | 'logs' | 'screenshots' | 'notices' | { url: string }];
  'ss:relaunch': [args: string[]];
  'ss:quit': [];
  'ss:quit-ready': [];
  'ss:consent': [crashReports: boolean];
  'ss:heartbeat': [];
  'ss:settings-restart': [switches: { vsync: boolean; glBackend: string | null }];
}

/** Main → game events. */
export interface EventContract {
  'ss:focus': [focused: boolean];
  'ss:window-state': [state: WindowState];
  'ss:quit-request': [];
  'ss:suspend': [suspended: boolean];
  'ss:steam-connected': [connected: boolean];
}

export const INVOKE_CHANNELS = [
  'ss:boot',
  'ss:fs-write',
  'ss:fs-remove',
  'ss:window-set',
  'ss:displays',
  'ss:steam-achievement',
  'ss:steam-overlay',
  'ss:steam-keyboard',
  'ss:screenshot',
  'ss:support-export',
  'ss:delete-all-data',
  'ss:confirm',
] as const satisfies readonly (keyof InvokeContract)[];

export const SEND_CHANNELS = [
  'ss:log',
  'ss:activity',
  'ss:rich-presence',
  'ss:open',
  'ss:relaunch',
  'ss:quit',
  'ss:quit-ready',
  'ss:consent',
  'ss:heartbeat',
  'ss:settings-restart',
] as const satisfies readonly (keyof SendContract)[];

export const EVENT_CHANNELS = ['ss:focus', 'ss:window-state', 'ss:quit-request', 'ss:suspend', 'ss:steam-connected'] as const satisfies readonly (keyof EventContract)[];

/** What the preload script puts on `window.ssBridge`. */
export interface RawBridge {
  invoke<C extends keyof InvokeContract>(channel: C, ...args: InvokeContract[C][0]): Promise<InvokeContract[C][1]>;
  send<C extends keyof SendContract>(channel: C, ...args: SendContract[C]): void;
  on<C extends keyof EventContract>(channel: C, cb: (...args: EventContract[C]) => void): () => void;
}
