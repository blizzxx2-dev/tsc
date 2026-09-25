/**
 * Localisation runtime: `t(key, params)` over `strings/<lang>.json` ICU tables.
 *
 * - English is bundled; every other locale is a lazily loaded Vite chunk.
 * - Lookups walk the fallback chain (e.g. pt-BR → en). A key missing from the
 *   current locale renders the next locale's text, warns once in development and
 *   bumps `i18nStats.missing` (the `loc_missing_key` telemetry counter).
 * - Pseudo-locales (`qps`, `qps-long`, `qps-cjk`) are generated from English at load time.
 * - Keys beginning with `@` are metadata (e.g. `@fallback`: keys deliberately left in English).
 *
 * Key conventions: docs/loc/keys.md.
 */
import { format, IcuSyntaxError, type Params } from './icu';
import { fallbackChain, localeInfo, LOCALES, SOURCE_LOCALE, type LocaleInfo } from './locales';
import { resolveParticles } from './korean';
import { pseudoTable } from './pseudo';

export type { Params } from './icu';
export type Messages = Record<string, string>;

const EN_MODULE = import.meta.glob<Messages>('./strings/en.json', { eager: true, import: 'default' });
/** The English source table (bundled). */
export const EN: Messages = EN_MODULE['./strings/en.json'];

const LOADERS = import.meta.glob<unknown>(['./strings/*.json', '!./strings/en.json', '!./strings/*.meta.json'], { import: 'default' });

const tables = new Map<string, Messages>([[SOURCE_LOCALE, EN]]);
let current = SOURCE_LOCALE;
const listeners = new Set<(code: string) => void>();
const missingHandlers = new Set<(key: string, locale: string) => void>();
const warned = new Set<string>();

/** Counters exported to telemetry (`loc_missing_key`). */
export const i18nStats = { missing: 0 };

/** Subscribe to missing-key events (telemetry, LQA overlays). Returns an unsubscribe function. */
export function onMissingKey(fn: (key: string, locale: string) => void): () => void {
  missingHandlers.add(fn);
  return () => missingHandlers.delete(fn);
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(fn: (code: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function reportMissing(key: string, locale: string): void {
  i18nStats.missing++;
  for (const fn of missingHandlers) fn(key, locale);
  const id = `${locale}:${key}`;
  if (import.meta.env.DEV && !warned.has(id)) {
    warned.add(id);
    console.warn(`[i18n] missing key "${key}" in ${locale}`);
  }
}

/** True when a locale has a table on disk (or is generated). */
export function isAvailable(code: string): boolean {
  return code === SOURCE_LOCALE || !!localeInfo(code)?.pseudo || `./strings/${code}.json` in LOADERS;
}

/** Load a locale's table (idempotent). Returns false when there is no table for it. */
export async function loadLocale(code: string): Promise<boolean> {
  if (tables.has(code)) return true;
  const info = localeInfo(code);
  if (info?.pseudo) {
    tables.set(code, pseudoTable(EN, info.pseudo));
    return true;
  }
  const loader = LOADERS[`./strings/${code}.json`];
  if (!loader) return false;
  tables.set(code, (await loader()) as Messages);
  return true;
}

/** Switch language. Unknown or unavailable locales fall back to English. Resolves to the active code. */
export async function setLocale(code: string): Promise<string> {
  for (const c of fallbackChain(code)) await loadLocale(c);
  current = tables.has(code) ? code : SOURCE_LOCALE;
  if (typeof document !== 'undefined') document.documentElement.lang = localeInfo(current)?.intl ?? current;
  for (const fn of listeners) fn(current);
  return current;
}

export const getLocale = (): string => current;

/** Intl tag of the active locale (pseudo-locales format like English). */
export const intlLocale = (): string => localeInfo(current)?.intl ?? current;

/** Translate a key. Missing everywhere → the key itself, so gaps are visible on screen. */
export function t(key: string, params?: Params): string {
  for (const code of fallbackChain(current)) {
    const msg = tables.get(code)?.[key];
    if (msg === undefined) continue;
    if (code !== current) reportMissing(key, current);
    try {
      const out = format(msg, params, localeInfo(code)?.intl ?? code);
      return localeInfo(code)?.script === 'hangul' ? resolveParticles(out) : out;
    } catch (e) {
      if (!(e instanceof IcuSyntaxError)) throw e;
      if (import.meta.env.DEV) console.warn(`[i18n] ${e.message}`);
      return msg;
    }
  }
  reportMissing(key, current);
  return key;
}

/** True when the English table defines the key. */
export const hasKey = (key: string): boolean => key in EN;

// ---------------------------------------------------------------- simulation text

/** Namespaces whose English text the simulation still emits verbatim (see docs/loc/keys.md). */
const SOURCE_NAMESPACES = ['label.', 'popup.', 'loss.'];
let sourceIndex: Map<string, string> | null = null;

/** English text → key, for text produced by the simulation. */
export function sourceKey(text: string): string | undefined {
  if (!sourceIndex) {
    sourceIndex = new Map();
    for (const [k, v] of Object.entries(EN)) if (SOURCE_NAMESPACES.some((ns) => k.startsWith(ns)) && !v.includes('{')) sourceIndex.set(v, k);
  }
  return sourceIndex.get(text);
}

/**
 * Localise a string produced by the (DOM-free, deterministic) simulation:
 * rating labels, popups and loss reasons are matched to their keys; vitals
 * popups ("-12", "+20") are reformatted; anything else (story and callout
 * content, which stays English) is returned unchanged.
 */
export function tSource(text: string): string {
  const key = sourceKey(text);
  if (key) return t(key);
  const m = /^([-+])(\d+)$/.exec(text);
  if (m) return t(m[1] === '-' ? 'popup.vitals_loss' : 'popup.vitals_gain', { n: Number(m[2]) });
  return text;
}

// ---------------------------------------------------------------- language menu

/**
 * Languages offered in the options menu: every signed-off locale, plus (in
 * development / LQA builds) pseudo-locales and any locale with a table on disk.
 */
export function menuLocales(dev: boolean = import.meta.env.DEV): LocaleInfo[] {
  return LOCALES.filter((l) => l.shipped || (dev && isAvailable(l.code)));
}
