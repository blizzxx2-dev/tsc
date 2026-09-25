import { EDITIONS, type Edition, type EditionInfo } from './editions';

/* Compile-time constants injected by vite.config.ts (`define`). Guarded so plain tsc/vitest runs still work. */
declare const __EDITION__: string | undefined;
declare const __APP_VERSION__: string | undefined;
declare const __GIT_SHA__: string | undefined;
declare const __BUILD_DATE__: string | undefined;
declare const __PLATFORM_TARGET__: string | undefined;

/**
 * Build flavour (PLT-0057): `VITE_EDITION=demo|full` becomes the literal `__EDITION__`, so
 * `if (EDITION === 'full')` branches and dynamic imports behind them are dropped from demo bundles.
 */
export const EDITION: Edition = typeof __EDITION__ !== 'undefined' && __EDITION__ === 'full' ? 'full' : 'demo';
export const IS_DEMO = EDITION === 'demo';
export const EDITION_INFO: EditionInfo = EDITIONS[EDITION];

/** `web` (browser/itch/press), `desktop` (Electron + Steam), `none` (desktop without Steam: GOG/itch, PLT-0183). */
export type PlatformTarget = 'web' | 'desktop' | 'none';
export const PLATFORM_TARGET: PlatformTarget =
  typeof __PLATFORM_TARGET__ !== 'undefined' && (__PLATFORM_TARGET__ === 'desktop' || __PLATFORM_TARGET__ === 'none') ? __PLATFORM_TARGET__ : 'web';

export interface BuildInfo {
  edition: Edition;
  /** SemVer of this edition — demo `1.0.x` at launch, full `0.x` until 1.0 (PLT-0146). */
  version: string;
  sha: string;
  /** yyyymmdd */
  date: string;
  /** `version+sha.date` — shown on the title screen, in logs and in crash reports. */
  id: string;
}

export function makeBuildInfo(edition: Edition, version: string, sha: string, date: string): BuildInfo {
  return { edition, version, sha, date, id: `${version}+${sha}.${date}` };
}

export const BUILD: BuildInfo = makeBuildInfo(
  EDITION,
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev',
  typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev',
  typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '00000000',
);

/** Short label for the title-screen corner, e.g. `Demo 0.9.0 · 1a2b3c4d`. */
export const buildLabel = (b: BuildInfo = BUILD): string => `${b.edition === 'demo' ? 'Demo ' : ''}${b.version} · ${b.sha}`;
