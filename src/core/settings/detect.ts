/**
 * First-launch auto-detection (PLT-0103) and language resolution (PLT-0102, PLT-0043). Pure functions;
 * the session glue feeds them the GPU renderer string, a measured refresh rate and Steam/OS locales.
 */
import { applyPreset } from './validate';
import { SHIPPED_LANGUAGES, type Quality, type Settings } from './schema';

/** Steam API language names → BCP-47 codes (https://partner.steamgames.com/doc/store/localization/languages). */
export const STEAM_LANGUAGES: Record<string, string> = {
  english: 'en',
  german: 'de',
  french: 'fr',
  spanish: 'es',
  latam: 'es-419',
  italian: 'it',
  polish: 'pl',
  brazilian: 'pt-BR',
  portuguese: 'pt',
  russian: 'ru',
  ukrainian: 'uk',
  schinese: 'zh-Hans',
  tchinese: 'zh-Hant',
  japanese: 'ja',
  koreana: 'ko',
  turkish: 'tr',
  czech: 'cs',
  dutch: 'nl',
  hungarian: 'hu',
  swedish: 'sv',
  danish: 'da',
  norwegian: 'no',
  finnish: 'fi',
  romanian: 'ro',
  thai: 'th',
  vietnamese: 'vi',
  greek: 'el',
  bulgarian: 'bg',
  arabic: 'ar',
  indonesian: 'id',
};

function match(code: string | null | undefined, shipped: readonly string[]): string | null {
  if (!code) return null;
  const c = code.replace('_', '-');
  const exact = shipped.find((s) => s.toLowerCase() === c.toLowerCase());
  if (exact) return exact;
  const base = c.split('-')[0].toLowerCase();
  return shipped.find((s) => s.split('-')[0].toLowerCase() === base) ?? null;
}

/** Explicit choice → Steam language → OS locale → English. */
export function resolveLanguage(setting: string, steamLanguage: string | null, osLocale: string | null, shipped: readonly string[] = SHIPPED_LANGUAGES): string {
  if (setting !== 'auto' && shipped.includes(setting)) return setting;
  return match(steamLanguage ? STEAM_LANGUAGES[steamLanguage] : null, shipped) ?? match(osLocale, shipped) ?? 'en';
}

/** Coarse GPU tier from the unmasked WebGL renderer string. */
export function gpuTier(renderer: string | null): Quality {
  if (!renderer) return 'medium';
  const r = renderer.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|microsoft basic render|software/.test(r)) return 'low';
  if (/geforce (gtx|rtx)|rtx \d|quadro|radeon (rx|pro)|rx \d{3,4}|arc a\d|apple m\d (pro|max|ultra)|apple m[3-9]/.test(r)) return 'high';
  if (/iris(\(r\))? xe|apple m\d|radeon graphics|vega|custom gpu|van ?gogh|adreno 7|\barc\b/.test(r)) return 'medium';
  if (/intel|hd graphics|uhd graphics|mali|adreno|powervr/.test(r)) return 'low';
  return 'medium';
}

const CAPS = [30, 60, 90, 120, 144, 165, 240];

/** Nearest listed frame cap for a measured refresh rate. */
export function frameCapFor(refreshHz: number): number {
  if (!Number.isFinite(refreshHz) || refreshHz <= 0) return 0;
  return CAPS.reduce((best, c) => (Math.abs(c - refreshHz) < Math.abs(best - refreshHz) ? c : best), 60);
}

export interface DetectInput {
  gpuRenderer: string | null;
  refreshHz: number;
  steamLanguage: string | null;
  osLocale: string | null;
  isDeck: boolean;
}

/** Steam Deck preset (PLT-0158): native 1280×800 fullscreen, Medium, 60 fps, UI 115%. */
export function applyDeckPreset(s: Settings): void {
  s.displayMode = 'fullscreen';
  applyPreset(s, 'medium');
  s.frameCap = 60;
  s.uiScale = 1.15;
}

/** Fill first-launch settings from the hardware; the Deck preset overrides on Steam Deck. */
export function autoDetect(s: Settings, input: DetectInput): void {
  applyPreset(s, gpuTier(input.gpuRenderer));
  s.frameCap = frameCapFor(input.refreshHz);
  // `auto` resolves Steam → OS locale → English at every launch (see resolveLanguage), so a later
  // change of the Steam client language is followed too.
  s.language = 'auto';
  if (input.isDeck) applyDeckPreset(s);
}
