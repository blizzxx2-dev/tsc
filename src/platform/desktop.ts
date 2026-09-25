import type { BootInfo, ConfirmOptions, DisplayInfo, DisplayMode, RawBridge, WindowState, WriteResult } from './bridge';
import { storeUrl } from './editions';
import type { FileStorage, OpenTarget, Platform, SteamPlatform, WindowPlatform } from './types';

/** Save folder on disk, read at boot and written atomically by the main process (PLT-0079/0082). */
class DesktopFiles implements FileStorage {
  readonly backend = 'desktop-fs' as const;
  private cache: Map<string, string>;
  constructor(
    private bridge: RawBridge,
    files: Record<string, string>,
  ) {
    this.cache = new Map(Object.entries(files));
  }
  read(name: string): string | null {
    return this.cache.get(name) ?? null;
  }
  list(): string[] {
    return [...this.cache.keys()].sort();
  }
  async write(name: string, data: string): Promise<WriteResult> {
    this.cache.set(name, data);
    try {
      return await this.bridge.invoke('ss:fs-write', name, data);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
  async remove(name: string): Promise<WriteResult> {
    this.cache.delete(name);
    try {
      return await this.bridge.invoke('ss:fs-remove', name);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

class DesktopSteam implements SteamPlatform {
  readonly available: boolean;
  readonly appId: number;
  readonly steamId: string | null;
  readonly personaName: string | null;
  readonly language: string | null;
  readonly isDeck: boolean;
  readonly ownsFullGame: boolean;
  private achievements: Record<string, boolean>;
  constructor(
    private bridge: RawBridge,
    boot: BootInfo,
  ) {
    const s = boot.steam;
    this.available = !!s;
    this.appId = s?.appId ?? 0;
    this.steamId = s?.steamId ?? null;
    this.personaName = s?.personaName ?? null;
    this.language = s?.language ?? null;
    this.isDeck = s?.isDeck ?? false;
    this.ownsFullGame = s?.ownsFullGame ?? false;
    this.achievements = { ...(s?.achievements ?? {}) };
  }
  achievementState(id: string): boolean | undefined {
    return this.achievements[id];
  }
  async setAchievement(id: string, unlocked: boolean): Promise<boolean> {
    if (!this.available) return false;
    const ok = await this.bridge.invoke('ss:steam-achievement', id, unlocked).catch(() => false);
    if (ok) this.achievements[id] = unlocked;
    return ok;
  }
  setRichPresence(values: Record<string, string | null>): void {
    if (this.available) this.bridge.send('ss:rich-presence', values);
  }
  openStore(appId: number): void {
    // Main falls back to the default browser when the overlay is unavailable.
    void this.bridge.invoke('ss:steam-overlay', 'store', String(appId)).then((shown) => {
      if (!shown) this.bridge.send('ss:open', { url: storeUrl(appId) });
    });
  }
  openWebPage(url: string): void {
    void this.bridge.invoke('ss:steam-overlay', 'web', url).then((shown) => {
      if (!shown) this.bridge.send('ss:open', { url });
    });
  }
  showKeyboard(r: { x: number; y: number; w: number; h: number }): Promise<boolean> {
    return this.available ? this.bridge.invoke('ss:steam-keyboard', r.x, r.y, r.w, r.h).catch(() => false) : Promise.resolve(false);
  }
  onConnected(cb: (connected: boolean) => void): void {
    this.bridge.on('ss:steam-connected', cb);
  }
}

class DesktopWindow implements WindowPlatform {
  constructor(
    private bridge: RawBridge,
    private current: WindowState,
  ) {
    bridge.on('ss:window-state', (s) => (this.current = s));
  }
  state(): WindowState {
    return this.current;
  }
  async setMode(mode: DisplayMode, displayId: number | null = null): Promise<void> {
    this.current = await this.bridge.invoke('ss:window-set', mode, displayId);
  }
  async setSize(width: number, height: number): Promise<void> {
    this.current = await this.bridge.invoke('ss:window-size', width, height);
  }
  toggleFullscreen(): void {
    void this.setMode(this.current.mode === 'windowed' ? 'fullscreen' : 'windowed');
  }
  displays(): Promise<DisplayInfo[]> {
    return this.bridge.invoke('ss:displays');
  }
  onFocus(cb: (focused: boolean) => void): void {
    this.bridge.on('ss:focus', cb);
  }
  onSuspend(cb: (suspended: boolean) => void): void {
    this.bridge.on('ss:suspend', cb);
  }
  onModeChange(cb: (mode: DisplayMode) => void): void {
    this.bridge.on('ss:window-state', (s) => cb(s.mode));
  }
}

/** The Electron build: every capability goes through the typed IPC bridge (PLT-0013). */
export class DesktopPlatform implements Platform {
  readonly kind = 'desktop' as const;
  readonly os;
  readonly locale;
  readonly args;
  readonly safeMode;
  readonly recovered;
  readonly userNamespace;
  readonly storage: FileStorage;
  readonly demoFiles;
  readonly steam: SteamPlatform;
  readonly window: WindowPlatform;
  readonly folders;

  constructor(
    private bridge: RawBridge,
    boot: BootInfo,
  ) {
    this.os = boot.os;
    this.locale = boot.locale;
    this.args = boot.args;
    this.safeMode = boot.safeMode;
    this.recovered = boot.recovered;
    this.userNamespace = boot.userNamespace;
    this.storage = new DesktopFiles(bridge, boot.files);
    this.demoFiles = boot.demoFiles;
    this.steam = new DesktopSteam(bridge, boot);
    this.window = new DesktopWindow(bridge, boot.window);
    this.folders = boot.folders;
  }

  static async create(bridge: RawBridge): Promise<DesktopPlatform> {
    return new DesktopPlatform(bridge, await bridge.invoke('ss:boot'));
  }

  writeLog(lines: string[]): void {
    this.bridge.send('ss:log', lines);
  }
  setActivity(a: { preventSleep: boolean; guardQuit: boolean; kioskIdleReset: boolean }): void {
    this.bridge.send('ss:activity', a);
  }
  onQuitRequest(handler: () => Promise<void>): void {
    this.bridge.on('ss:quit-request', () => {
      void handler().finally(() => this.bridge.send('ss:quit-ready'));
    });
  }
  open(target: OpenTarget): void {
    this.bridge.send('ss:open', target);
  }
  quit(): void {
    this.bridge.send('ss:quit');
  }
  relaunch(args: string[]): void {
    this.bridge.send('ss:relaunch', args);
  }
  screenshot(): Promise<string | null> {
    return this.bridge.invoke('ss:screenshot');
  }
  exportSupport(extra: Record<string, string>): Promise<string | null> {
    return this.bridge.invoke('ss:support-export', extra);
  }
  deleteAllData(): Promise<boolean> {
    return this.bridge.invoke('ss:delete-all-data');
  }
  confirm(opts: ConfirmOptions): Promise<boolean> {
    return this.bridge.invoke('ss:confirm', opts);
  }
  setCrashConsent(on: boolean): void {
    this.bridge.send('ss:consent', on);
  }
  heartbeat(): void {
    this.bridge.send('ss:heartbeat');
  }
  setLaunchSwitches(s: { vsync: boolean; glBackend: string | null }): void {
    this.bridge.send('ss:settings-restart', s);
  }
}
