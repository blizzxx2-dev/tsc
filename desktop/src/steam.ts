/**
 * Steamworks behind `platform.steam` (PLT-0040/0041/0043/0044/0045/0051/0064): steamworks.js (napi)
 * loaded lazily in the main process. When the module, the Steam client or the app id is missing, every
 * call is a no-op and the game runs as a plain desktop build.
 */
import { createRequire } from 'node:module';
import type { SteamBoot } from '../../src/platform/bridge';

type Client = typeof import('steamworks.js/client');
type Api = Omit<Client, 'init' | 'runCallbacks'>;
interface SteamworksModule {
  init(appId?: number): Api;
  restartAppIfNecessary(appId: number): boolean;
  electronEnableSteamOverlay(disableEachFrameInvalidation?: boolean): void;
}

const require_ = createRequire(__filename);

export function loadSteamworks(log: (m: string) => void): SteamworksModule | null {
  try {
    return require_('steamworks.js') as SteamworksModule;
  } catch (e) {
    log(`steamworks.js unavailable: ${(e as Error).message}`);
    return null;
  }
}

export class SteamService {
  private api: Api | null = null;
  constructor(
    private sw: SteamworksModule | null,
    readonly appId: number,
    private log: (m: string) => void,
  ) {}

  get available(): boolean {
    return !!this.api;
  }

  /**
   * Release builds launched outside Steam relaunch through the Steam client (PLT-0041).
   * Returns true when the process must exit now.
   */
  restartIfNecessary(release: boolean): boolean {
    if (!release || !this.sw || this.appId <= 0) return false;
    try {
      return this.sw.restartAppIfNecessary(this.appId);
    } catch (e) {
      this.log(`RestartAppIfNecessary failed: ${(e as Error).message}`);
      return false;
    }
  }

  /** Must run before the app is ready so the overlay switches are applied. */
  enableOverlay(): void {
    try {
      this.sw?.electronEnableSteamOverlay();
    } catch (e) {
      this.log(`overlay: ${(e as Error).message}`);
    }
  }

  init(): boolean {
    if (!this.sw || this.appId <= 0) return false;
    try {
      this.api = this.sw.init(this.appId);
      this.log('Steam initialised');
      return true;
    } catch (e) {
      this.log(`Steam not running or init failed: ${(e as Error).message}`);
      this.api = null;
      return false;
    }
  }

  boot(fullAppId: number, achievementIds: readonly string[]): SteamBoot | null {
    const a = this.api;
    if (!a) return null;
    try {
      const achievements: Record<string, boolean> = {};
      for (const id of achievementIds) {
        try {
          achievements[id] = a.achievement.isActivated(id);
        } catch {
          // not defined in Steamworks yet
        }
      }
      return {
        appId: this.appId,
        steamId: a.localplayer.getSteamId().steamId64.toString(),
        personaName: a.localplayer.getName(),
        language: a.apps.currentGameLanguage(),
        isDeck: a.utils.isSteamRunningOnSteamDeck(),
        ownsFullGame: fullAppId > 0 && fullAppId !== this.appId ? a.apps.isSubscribedApp(fullAppId) : false,
        achievements,
      };
    } catch (e) {
      this.log(`Steam boot query failed: ${(e as Error).message}`);
      return null;
    }
  }

  steamId(): string | null {
    try {
      return this.api?.localplayer.getSteamId().steamId64.toString() ?? null;
    } catch {
      return null;
    }
  }

  setAchievement(id: string, unlock: boolean): boolean {
    try {
      return this.api ? (unlock ? this.api.achievement.activate(id) : this.api.achievement.clear(id)) : false;
    } catch {
      return false;
    }
  }

  setRichPresence(values: Record<string, string | null>): void {
    if (!this.api) return;
    for (const [k, v] of Object.entries(values)) {
      try {
        this.api.localplayer.setRichPresence(k, v ?? undefined);
      } catch {
        // ignore
      }
    }
  }

  /** Overlay store/web page; false when Steam is absent so the caller falls back to the browser. */
  overlay(kind: 'store' | 'web', target: string): boolean {
    if (!this.api) return false;
    try {
      if (kind === 'store') {
        const id = Number(target);
        if (!(id > 0)) return false;
        this.api.overlay.activateToStore(id, 0);
      } else this.api.overlay.activateToWebPage(target);
      return true;
    } catch {
      return false;
    }
  }

  async floatingKeyboard(x: number, y: number, w: number, h: number): Promise<boolean> {
    if (!this.api) return false;
    try {
      return await this.api.utils.showFloatingGamepadTextInput(0, x, y, w, h);
    } catch {
      return false;
    }
  }
}
