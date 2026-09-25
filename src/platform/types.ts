import type { ConfirmOptions, DisplayInfo, DisplayMode, LaunchArgs, OsKind, WindowState, WriteResult } from './bridge';

/**
 * A flat namespace of small text files (profile.json, settings.json, slot1.json …).
 * Reads are synchronous from a snapshot taken at boot; writes are asynchronous and durable
 * (atomic file replace on desktop, IndexedDB/localStorage on the web) — PLT-0079/0089.
 */
export interface FileStorage {
  readonly backend: 'desktop-fs' | 'indexeddb' | 'localstorage' | 'memory';
  read(name: string): string | null;
  list(): string[];
  write(name: string, data: string): Promise<WriteResult>;
  remove(name: string): Promise<WriteResult>;
}

export interface SteamPlatform {
  readonly available: boolean;
  readonly appId: number;
  /** SteamID64 — namespacing only, never displayed (PLT-0044). */
  readonly steamId: string | null;
  readonly personaName: string | null;
  /** Steam API language name (`english`, `german` …) or null outside Steam. */
  readonly language: string | null;
  readonly isDeck: boolean;
  readonly ownsFullGame: boolean;
  /** Unlock state Steam reported at boot, if known. */
  achievementState(id: string): boolean | undefined;
  setAchievement(id: string, unlocked: boolean): Promise<boolean>;
  setRichPresence(values: Record<string, string | null>): void;
  /** Store page in the overlay, or the default browser when Steam is unavailable (PLT-0051/0062). */
  openStore(appId: number): void;
  openWebPage(url: string): void;
  /** Deck on-screen keyboard over a text field (PLT-0162). Resolves false when not shown. */
  showKeyboard(rect: { x: number; y: number; w: number; h: number }): Promise<boolean>;
  onConnected(cb: (connected: boolean) => void): void;
}

export interface WindowPlatform {
  /** Null on the web, where the browser owns the window. */
  state(): WindowState | null;
  setMode(mode: DisplayMode, displayId?: number | null): Promise<void>;
  toggleFullscreen(): void;
  displays(): Promise<DisplayInfo[]>;
  onFocus(cb: (focused: boolean) => void): void;
  onSuspend(cb: (suspended: boolean) => void): void;
  /** Mode changed outside the settings (F11, OS full-screen button). */
  onModeChange(cb: (mode: DisplayMode) => void): void;
}

export type OpenTarget = 'saves' | 'logs' | 'screenshots' | 'notices' | { url: string };

export interface Platform {
  readonly kind: 'web' | 'desktop';
  readonly os: OsKind | 'web';
  readonly locale: string;
  readonly args: LaunchArgs;
  readonly safeMode: boolean;
  readonly recovered: boolean;
  readonly userNamespace: string;
  readonly storage: FileStorage;
  /** The demo's save folder, visible to the full edition for carry-over (PLT-0066). */
  readonly demoFiles: Record<string, string> | null;
  readonly steam: SteamPlatform;
  readonly window: WindowPlatform;
  readonly folders: { saves: string; logs: string; screenshots: string } | null;
  writeLog(lines: string[]): void;
  /** Scene activity: keeps the display awake and arms the quit confirmation (PLT-0017/0022). */
  setActivity(a: { preventSleep: boolean; guardQuit: boolean; kioskIdleReset: boolean }): void;
  /** Called when the OS/user asks to quit; the promise must settle once pending saves are flushed. */
  onQuitRequest(handler: () => Promise<void>): void;
  open(target: OpenTarget): void;
  quit(): void;
  relaunch(args: string[]): void;
  screenshot(): Promise<string | null>;
  exportSupport(extra: Record<string, string>): Promise<string | null>;
  deleteAllData(): Promise<boolean>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  setCrashConsent(on: boolean): void;
  /** Main-loop heartbeat for the hang watchdog (PLT-0128). */
  heartbeat(): void;
  /** Restart-only switches (vsync, GL backend) for the next launch (PLT-0111). */
  setLaunchSwitches(s: { vsync: boolean; glBackend: string | null }): void;
}

export const DEFAULT_ARGS: LaunchArgs = {
  dev: false,
  windowed: false,
  fullscreen: false,
  safeMode: false,
  resetSettings: false,
  kiosk: false,
  logLevel: null,
  glBackend: null,
  flags: {},
};
