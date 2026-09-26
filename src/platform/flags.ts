import { IS_DEMO } from './build';

/**
 * Feature flags (PLT-0151): each flag has a build-time default (a constant, so disabled code is
 * tree-shaken from release bundles when the default is a literal) and, in QA builds only, a runtime
 * override from `?flag.<name>=0|1` in the URL, `--flag=<name>=0|1` on the desktop command line, or
 * `localStorage['suture-and-steel.flags']` (`{"name": true}`).
 */

declare const __QA__: boolean | undefined;

/** QA builds: dev server, or `VITE_QA=1` production builds for the `qa` Steam branch. */
export const QA_BUILD: boolean = (typeof __QA__ !== 'undefined' && __QA__) || import.meta.env?.DEV === true || import.meta.env?.VITE_QA === '1';

export const FLAG_DEFAULTS = {
  /** Corner stamp with the build id for press/festival builds (PLT-0061). Off in the public demo. */
  watermark: import.meta.env?.VITE_WATERMARK === '1',
  /** F8 bug-report capture and dev commands such as "reset achievements" (PLT-0131, PLT-0049). */
  qaTools: QA_BUILD,
  /** Wishlist call-to-action on the demo title and pause menus (PLT-0063). */
  wishlistPrompts: IS_DEMO,
  /** Challenge mode (the Trials of the Guild board) is a post-release feature: off until then. */
  challengeMode: false,
  /** Unfinished full-game features — always off in the demo. */
  disciplines: false,
} satisfies Record<string, boolean>;

export type FlagName = keyof typeof FLAG_DEFAULTS;

/** Parse overrides from `name=0|1|true|false` pairs; unknown flags are ignored. */
export function parseFlagOverrides(pairs: Iterable<[string, string]>): Partial<Record<FlagName, boolean>> {
  const out: Partial<Record<FlagName, boolean>> = {};
  for (const [k, v] of pairs) {
    if (!(k in FLAG_DEFAULTS)) continue;
    out[k as FlagName] = v === '1' || v === 'true' || v === '';
  }
  return out;
}

function runtimeOverrides(): Partial<Record<FlagName, boolean>> {
  if (!QA_BUILD) return {};
  const pairs: [string, string][] = [];
  try {
    const stored = globalThis.localStorage?.getItem('suture-and-steel.flags');
    if (stored) for (const [k, v] of Object.entries(JSON.parse(stored) as Record<string, unknown>)) pairs.push([k, v ? '1' : '0']);
  } catch {
    // ignore malformed overrides
  }
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    params.forEach((v, k) => {
      if (k.startsWith('flag.')) pairs.push([k.slice(5), v]);
    });
  } catch {
    // not in a browser
  }
  return parseFlagOverrides(pairs);
}

const overrides: Partial<Record<FlagName, boolean>> = runtimeOverrides();

/** Apply command-line overrides from the desktop shell (QA builds only). */
export function applyFlagOverrides(extra: Partial<Record<FlagName, boolean>>): void {
  if (QA_BUILD) Object.assign(overrides, extra);
}

export function flag(name: FlagName): boolean {
  return overrides[name] ?? FLAG_DEFAULTS[name];
}
