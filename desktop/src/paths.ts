/**
 * OS directory layout (PLT-0132, PLT-0136). Pure — takes the OS, environment and home directory so it
 * is unit-tested for every platform on any machine.
 *
 *   Windows  saves+settings  %APPDATA%\suture-and-steel\<edition>\<user>\          (roaming → Steam Auto-Cloud root WinAppDataRoaming)
 *            logs/cache      %LOCALAPPDATA%\suture-and-steel\{logs,cache}\<edition>\
 *   macOS    saves+settings  ~/Library/Application Support/suture-and-steel/<edition>/<user>/   (MacAppSupport)
 *            logs            ~/Library/Logs/suture-and-steel/<edition>/
 *            cache           ~/Library/Caches/suture-and-steel/<edition>/
 *   Linux    saves           $XDG_DATA_HOME/suture-and-steel/<edition>/<user>/      (LinuxXdgDataHome)
 *            settings        $XDG_CONFIG_HOME/suture-and-steel/<edition>/<user>/
 *            logs            $XDG_STATE_HOME/suture-and-steel/<edition>/logs/
 *            cache           $XDG_CACHE_HOME/suture-and-steel/<edition>/
 *
 * The Documents folder is never used (OneDrive redirection, PLT-0133). Demo and full edition share the
 * parent so the full game can read `…/suture-and-steel/demo/` for carry-over (PLT-0066).
 */
import { join, posix, win32 } from 'node:path';

export type Os = 'windows' | 'mac' | 'linux';
export const APP_DIR = 'suture-and-steel';

export interface AppPaths {
  /** Parent of every edition's save folders. */
  savesRoot: string;
  /** This edition + user's save folder (profile, slots). */
  saves: string;
  /** Where settings.json lives (same as saves except on Linux). */
  settings: string;
  /** The demo's save root for this user namespace (carry-over source). */
  demoSaves: string;
  logs: string;
  cache: string;
  /** Chromium profile (userData): kept out of the roaming/cloud folders. */
  chromium: string;
  crashDumps: string;
  support: string;
}

export function resolvePaths(os: Os, env: Record<string, string | undefined>, home: string, edition: string, userNs: string): AppPaths {
  const p = os === 'windows' ? win32 : posix;
  let dataRoot: string;
  let configRoot: string;
  let logRoot: string;
  let cacheRoot: string;
  if (os === 'windows') {
    const roaming = env.APPDATA || p.join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA || p.join(home, 'AppData', 'Local');
    dataRoot = configRoot = p.join(roaming, APP_DIR);
    logRoot = p.join(local, APP_DIR, 'logs');
    cacheRoot = p.join(local, APP_DIR, 'cache');
  } else if (os === 'mac') {
    dataRoot = configRoot = p.join(home, 'Library', 'Application Support', APP_DIR);
    logRoot = p.join(home, 'Library', 'Logs', APP_DIR);
    cacheRoot = p.join(home, 'Library', 'Caches', APP_DIR);
  } else {
    const xdg = (name: string, dflt: string) => (env[name] && p.isAbsolute(env[name]!) ? env[name]! : p.join(home, dflt));
    dataRoot = p.join(xdg('XDG_DATA_HOME', '.local/share'), APP_DIR);
    configRoot = p.join(xdg('XDG_CONFIG_HOME', '.config'), APP_DIR);
    logRoot = p.join(xdg('XDG_STATE_HOME', '.local/state'), APP_DIR);
    cacheRoot = p.join(xdg('XDG_CACHE_HOME', '.cache'), APP_DIR);
  }
  const cache = p.join(cacheRoot, edition);
  return {
    savesRoot: dataRoot,
    saves: p.join(dataRoot, edition, userNs),
    settings: p.join(configRoot, edition, userNs),
    demoSaves: p.join(dataRoot, 'demo', userNs),
    logs: os === 'linux' ? p.join(logRoot, edition, 'logs') : p.join(logRoot, edition),
    cache,
    chromium: p.join(cache, 'chromium'),
    crashDumps: p.join(cache, 'crashes'),
    support: p.join(os === 'linux' ? p.join(logRoot, edition) : logRoot, 'support'),
  };
}

/** Save namespace per user (PLT-0091): a short hash of the SteamID, or `local` outside Steam. */
export function userNamespace(steamId: string | null, hash: (s: string) => string): string {
  return steamId ? `steam-${hash(steamId).slice(0, 12)}` : 'local';
}

/** Is this a file the game may read/write through the bridge? Flat names only, no traversal. */
export const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const isSafeName = (name: string): boolean => SAFE_NAME.test(name) && !name.includes('..');

export { join };
