/**
 * Software-rendering detection (ENG-0194). When the WebGL renderer string names a software
 * rasteriser (SwiftShader, llvmpipe, Microsoft Basic Render…), the game forces the Low tier for the
 * session and, once per machine, explains that hardware acceleration is off with a help link.
 */
import type { GpuCaps } from '../render/caps';

/** Help page on turning hardware acceleration back on (`VITE_HWACCEL_HELP_URL` overrides it). */
export const HWACCEL_HELP_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_HWACCEL_HELP_URL ?? 'https://support.google.com/chrome/answer/95759';

const SHOWN_KEY = 'sns.notice.hwaccel';

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface SoftwareRenderPlan {
  /** Force the Low tier this session. */
  forceLow: boolean;
  /** Show the one-time notice now (and remember that it was shown). */
  notify: boolean;
}

/** Decide what to do for these caps; marks the notice as shown in `store` when it returns `notify`. */
export function softwareRenderPlan(caps: Pick<GpuCaps, 'software'>, store: KeyValueStore | null): SoftwareRenderPlan {
  if (!caps.software) return { forceLow: false, notify: false };
  let seen = false;
  try {
    seen = store?.getItem(SHOWN_KEY) === '1';
    if (!seen) store?.setItem(SHOWN_KEY, '1');
  } catch {
    // storage unavailable: show it this session only
  }
  return { forceLow: true, notify: !seen };
}

/** The Low-tier quality overrides applied for a software renderer. */
export const SOFTWARE_TIER = { gpuTier: 'low', shaderQuality: 'low', particleQuality: 'low' } as const;
