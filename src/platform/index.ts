/**
 * The platform singleton. Desktop builds (Electron) find `window.ssBridge` from the preload script;
 * everywhere else — browser demo, itch, tests — the web/no-op implementation is used, so the game
 * code never checks which one it runs on (PLT-0013, PLT-0023).
 *
 * Top-level await: modules that import `platform` evaluate after the save snapshot has been read.
 */
import type { RawBridge } from './bridge';
import { DesktopPlatform } from './desktop';
import { applyFlagOverrides, parseFlagOverrides } from './flags';
import { log, parseLogLevel } from './log';
import type { Platform } from './types';
import { WebPlatform } from './web';

async function createPlatform(): Promise<Platform> {
  const bridge = (globalThis as { ssBridge?: RawBridge }).ssBridge;
  if (bridge) {
    try {
      const p = await DesktopPlatform.create(bridge);
      applyFlagOverrides(parseFlagOverrides(Object.entries(p.args.flags)));
      const lvl = parseLogLevel(p.args.logLevel);
      if (lvl) log.minLevel = lvl;
      return p;
    } catch (e) {
      log.error('platform', 'desktop bridge failed to boot; falling back to web platform', e);
    }
  }
  return WebPlatform.create();
}

export const platform: Platform = await createPlatform();

export type { Platform, FileStorage, SteamPlatform, WindowPlatform } from './types';
