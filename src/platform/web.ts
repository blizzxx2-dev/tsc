import type { ConfirmOptions, DisplayInfo, DisplayMode, WriteResult } from './bridge';
import { EDITION_INFO } from './build';
import { storeUrl } from './editions';
import { MemoryStorage, openWebStorage } from './storage';
import { DEFAULT_ARGS, type FileStorage, type OpenTarget, type Platform, type SteamPlatform, type WindowPlatform } from './types';

/** Steam is never present in a browser: every call is a no-op and links open in a new tab. */
export class NoSteam implements SteamPlatform {
  readonly available = false;
  readonly appId = 0;
  readonly steamId = null;
  readonly personaName = null;
  readonly language = null;
  readonly isDeck = false;
  readonly ownsFullGame = false;
  constructor(private openUrl: (url: string) => void = (url) => globalThis.open?.(url, '_blank', 'noopener')) {}
  achievementState(): boolean | undefined {
    return undefined;
  }
  setAchievement(): Promise<boolean> {
    return Promise.resolve(false);
  }
  setRichPresence(): void {}
  openStore(appId: number): void {
    this.openUrl(storeUrl(appId));
  }
  openWebPage(url: string): void {
    this.openUrl(url);
  }
  showKeyboard(): Promise<boolean> {
    return Promise.resolve(false);
  }
  onConnected(): void {}
}

class BrowserWindowPlatform implements WindowPlatform {
  state() {
    return null;
  }
  async setMode(mode: DisplayMode): Promise<void> {
    const doc = globalThis.document;
    if (!doc) return;
    try {
      if (mode === 'windowed') {
        if (doc.fullscreenElement) await doc.exitFullscreen();
      } else if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen();
    } catch {
      // needs a user gesture; ignored
    }
  }
  setSize(): Promise<void> {
    // The browser owns its window; the preset is kept for the desktop build.
    return Promise.resolve();
  }
  toggleFullscreen(): void {
    void this.setMode(globalThis.document?.fullscreenElement ? 'windowed' : 'fullscreen');
  }
  displays(): Promise<DisplayInfo[]> {
    const s = globalThis.screen;
    return Promise.resolve(s ? [{ id: 0, label: 'Screen', width: s.width, height: s.height, scaleFactor: globalThis.devicePixelRatio || 1, refreshRate: 60, primary: true }] : []);
  }
  onFocus(cb: (focused: boolean) => void): void {
    globalThis.addEventListener?.('blur', () => cb(false));
    globalThis.addEventListener?.('focus', () => cb(true));
    globalThis.document?.addEventListener('visibilitychange', () => cb(globalThis.document.visibilityState === 'visible' && globalThis.document.hasFocus()));
  }
  onSuspend(cb: (suspended: boolean) => void): void {
    globalThis.document?.addEventListener('visibilitychange', () => cb(globalThis.document.visibilityState === 'hidden'));
  }
  onModeChange(cb: (mode: DisplayMode) => void): void {
    globalThis.document?.addEventListener('fullscreenchange', () => cb(globalThis.document.fullscreenElement ? 'fullscreen' : 'windowed'));
  }
}

/** The browser build (press/itch web demo) and the headless test environment. */
export class WebPlatform implements Platform {
  readonly kind = 'web' as const;
  readonly os = 'web' as const;
  readonly locale: string = globalThis.navigator?.language ?? 'en';
  readonly args = { ...DEFAULT_ARGS };
  readonly safeMode = false;
  readonly recovered = false;
  readonly userNamespace = 'local';
  readonly demoFiles = null;
  readonly steam = new NoSteam();
  readonly window = new BrowserWindowPlatform();
  readonly folders = null;

  constructor(readonly storage: FileStorage) {}

  static async create(): Promise<WebPlatform> {
    const inBrowser = typeof globalThis.document !== 'undefined';
    return new WebPlatform(inBrowser ? await openWebStorage(`${EDITION_INFO.saveDir}/local/`) : new MemoryStorage());
  }

  writeLog(): void {}
  setActivity(): void {}
  onQuitRequest(handler: () => Promise<void>): void {
    // Browsers give no time for async work on unload; flush best-effort when the tab is hidden.
    globalThis.document?.addEventListener('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'hidden') void handler();
    });
  }
  open(target: OpenTarget): void {
    if (typeof target === 'object') globalThis.open?.(target.url, '_blank', 'noopener');
  }
  quit(): void {}
  relaunch(): void {
    globalThis.location?.reload();
  }
  screenshot(): Promise<string | null> {
    return Promise.resolve(null);
  }
  exportSupport(): Promise<string | null> {
    return Promise.resolve(null);
  }
  async deleteAllData(): Promise<boolean> {
    const results: WriteResult[] = await Promise.all(this.storage.list().map((n) => this.storage.remove(n)));
    return results.every((r) => r.ok);
  }
  confirm(opts: ConfirmOptions): Promise<boolean> {
    const ask = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    if (!ask) return Promise.resolve(false);
    const text = `${opts.title}\n\n${opts.message}${opts.detail ? `\n\n${opts.detail}` : ''}`;
    return Promise.resolve(ask(text) && (!opts.twice || ask(`${opts.title}\n\nAre you certain? This cannot be undone.`)));
  }
  setCrashConsent(): void {}
  heartbeat(): void {}
  setLaunchSwitches(): void {}
}
