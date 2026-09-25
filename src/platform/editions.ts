/**
 * Per-edition identifiers (PLT-0060). Pure data with no imports so that node build scripts
 * (`scripts/*.mjs`, electron-builder config, SteamPipe generator) can import it directly
 * through Node's built-in TypeScript type stripping — this file is the single source of truth.
 *
 * Steam app/depot ids are 0 until the Steamworks apps exist (see docs/handoff/PLT/steamworks-setup.md).
 * 0 means "not assigned": Steam features stay off and store links fall back to the browser search URL.
 */

export type Edition = 'demo' | 'full';

export interface EditionInfo {
  id: Edition;
  /** Window title and product name. */
  productName: string;
  /** Executable base name (no extension) on every OS. */
  executableName: string;
  /** Reverse-DNS bundle id (macOS CFBundleIdentifier / Windows AppUserModelID). */
  bundleId: string;
  /** Steam app id of this edition (0 = not yet assigned). */
  steamAppId: number;
  /** Steam depot ids per OS. */
  depots: { windows: number; mac: number; linux: number };
  /** Sub-directory of the shared save root (PLT-0136): `…/suture-and-steel/<saveDir>/`. */
  saveDir: string;
  /** Chapters (0-based campaign indices) this edition may expose. */
  chapters: readonly number[];
  /** Which achievement set applies (PLT-0049/0060). */
  achievementSet: Edition;
  /** Rich presence token set (PLT-0045/0060). */
  richPresenceSet: Edition;
}

/** Shared parent folder name for saves, settings and logs on every OS (PLT-0132). */
export const APP_DIR = 'suture-and-steel';

export const EDITIONS: Record<Edition, EditionInfo> = {
  demo: {
    id: 'demo',
    productName: 'Suture & Steel Demo',
    executableName: 'SutureAndSteelDemo',
    bundleId: 'games.sutureandsteel.demo',
    steamAppId: 0,
    depots: { windows: 0, mac: 0, linux: 0 },
    saveDir: 'demo',
    chapters: [0, 1],
    achievementSet: 'demo',
    richPresenceSet: 'demo',
  },
  full: {
    id: 'full',
    productName: 'Suture & Steel',
    executableName: 'SutureAndSteel',
    bundleId: 'games.sutureandsteel.game',
    steamAppId: 0,
    depots: { windows: 0, mac: 0, linux: 0 },
    saveDir: 'full',
    chapters: [0, 1, 2, 3, 4],
    achievementSet: 'full',
    richPresenceSet: 'full',
  },
};

/** Store page used when the Steam app id is not assigned yet or Steam is unavailable. */
export const STORE_FALLBACK_URL = 'https://store.steampowered.com/search/?term=Suture%20%26%20Steel';

export const storeUrl = (appId: number): string => (appId > 0 ? `https://store.steampowered.com/app/${appId}/` : STORE_FALLBACK_URL);
