/**
 * Steamworks behind `platform.steam` (PLT-0040/0041/0043/0044/0045/0051/0064): steamworks.js (napi)
 * loaded lazily in the main process. When the module, the Steam client or the app id is missing, every
 * call is a no-op and the game runs as a plain desktop build.
 */
import { createRequire } from 'node:module';
import type { SteamBoot, TimelineMarker } from '../../src/platform/bridge';

type Client = typeof import('steamworks.js/client');
type Api = Omit<Client, 'init' | 'runCallbacks'>;

/**
 * Bindings steamworks.js 0.4 does not ship, probed at runtime so a newer build of the module lights
 * them up without a code change (PLT-0042 overlay callback, PLT-0050 Timeline):
 * - `callback.SteamCallback.GameOverlayActivated` → `register(id, ({ active }) => …)`
 * - `timeline.setTimelineGameMode/setTimelineTooltip/addInstantaneousTimelineEvent/startRangeTimelineEvent/endRangeTimelineEvent`
 *   (ISteamTimeline, Steamworks SDK ≥ 1.60).
 */
interface OptionalApi {
  callback?: { SteamCallback?: Record<string, number>; register?: (id: number, handler: (value: { active?: boolean }) => void) => unknown };
  timeline?: {
    setTimelineTooltip?: (description: string, timeDelta: number) => void;
    setTimelineGameMode?: (mode: number) => void;
    addInstantaneousTimelineEvent?: (title: string, description: string, icon: string, priority: number, startOffsetSeconds: number, possibleClip: number) => unknown;
    startRangeTimelineEvent?: (title: string, description: string, icon: string, priority: number, startOffsetSeconds: number, possibleClip: number) => number | bigint;
    endRangeTimelineEvent?: (handle: number | bigint, endOffsetSeconds: number) => void;
  };
}
/** Steam's `ETimelineEventClipPriority`: 0 invalid, 1 none, 2 standard, 3 featured. */
const CLIP = { none: 1, standard: 2, featured: 3 } as const;
/** `ETimelineGameMode`: 1 playing, 2 staging, 3 menus, 4 loading. */
const GAME_MODE = { playing: 1, menus: 3 } as const;
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

  /**
   * Overlay opened/closed (PLT-0042). steamworks.js 0.4 has no `GameOverlayActivated` id; when the
   * module exposes one the callback is registered, otherwise this returns false and the log says so.
   */
  onOverlay(cb: (active: boolean) => void): boolean {
    const api = this.api as unknown as OptionalApi | null;
    const id = api?.callback?.SteamCallback?.GameOverlayActivated;
    if (!api || typeof id !== 'number' || !api.callback?.register) {
      if (this.api) this.log('GameOverlayActivated is not bound in this steamworks.js; overlay auto-pause relies on focus loss');
      return false;
    }
    try {
      api.callback.register(id, (v) => cb(!!v?.active));
      return true;
    } catch (e) {
      this.log(`GameOverlayActivated register failed: ${(e as Error).message}`);
      return false;
    }
  }

  private rangeHandle: number | bigint | null = null;
  private timelineWarned = false;

  /** Timeline marker (PLT-0050); false when the module has no `timeline` binding. */
  timeline(m: TimelineMarker): boolean {
    const t = (this.api as unknown as OptionalApi | null)?.timeline;
    if (!this.api) return false;
    if (!t?.addInstantaneousTimelineEvent) {
      if (!this.timelineWarned) this.log('Steam Timeline is not bound in this steamworks.js; markers are dropped');
      this.timelineWarned = true;
      return false;
    }
    try {
      if (m.state !== undefined) {
        t.setTimelineTooltip?.(m.state, 0);
        t.setTimelineGameMode?.(m.kind === 'op-end' ? GAME_MODE.menus : GAME_MODE.playing);
      }
      if (m.kind === 'op-start' && t.startRangeTimelineEvent) this.rangeHandle = t.startRangeTimelineEvent(m.title, m.description ?? '', m.icon, m.priority, 0, CLIP.standard);
      else if (m.kind === 'op-end' && this.rangeHandle !== null && t.endRangeTimelineEvent) {
        t.endRangeTimelineEvent(this.rangeHandle, 0);
        this.rangeHandle = null;
      } else t.addInstantaneousTimelineEvent(m.title, m.description ?? '', m.icon, m.priority, 0, m.kind === 'rank-xs' ? CLIP.featured : CLIP.standard);
      return true;
    } catch (e) {
      this.log(`timeline marker failed: ${(e as Error).message}`);
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
