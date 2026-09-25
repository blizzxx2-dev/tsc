/**
 * Every locale the game knows about. `shipped` is true only once the language's
 * lead reviewer has signed `docs/loc/signoff/<code>-demo.md` (enforced by
 * tests/i18n.test.ts); unshipped languages stay out of the language menu and the
 * Steamworks language list. Pseudo-locales are development/QA tools.
 */
export type Script = 'latin' | 'cyrillic' | 'han' | 'kana' | 'hangul' | 'pseudo';

export interface LocaleInfo {
  /** BCP 47 tag used for file names (`strings/<code>.json`) and settings. */
  code: string;
  /** Endonym, shown in the language menu. */
  name: string;
  /** Tag passed to Intl (plural rules, number formats). */
  intl: string;
  /** Locales tried after this one, before English. */
  fallback: string[];
  script: Script;
  /** Signed off for release (see docs/loc/signoff). */
  shipped: boolean;
  /** Phase the language is scheduled for (docs/loc/languages.md). */
  phase: 'Demo' | 'Demo-stretch' | 'Beta' | 'Post' | 'dev';
  /** Reading-speed factor relative to English, for callout display time. */
  reading: number;
  pseudo?: 'qps' | 'qps-long' | 'qps-cjk';
}

export const SOURCE_LOCALE = 'en';

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', name: 'English', intl: 'en', fallback: [], script: 'latin', shipped: true, phase: 'Demo', reading: 1 },
  { code: 'de', name: 'Deutsch', intl: 'de', fallback: [], script: 'latin', shipped: false, phase: 'Demo', reading: 0.9 },
  { code: 'fr', name: 'Français', intl: 'fr', fallback: [], script: 'latin', shipped: false, phase: 'Demo', reading: 0.9 },
  { code: 'es-ES', name: 'Español (España)', intl: 'es-ES', fallback: [], script: 'latin', shipped: false, phase: 'Demo', reading: 0.9 },
  { code: 'pl', name: 'Polski', intl: 'pl', fallback: [], script: 'latin', shipped: false, phase: 'Demo', reading: 0.9 },
  { code: 'pt-BR', name: 'Português (Brasil)', intl: 'pt-BR', fallback: [], script: 'latin', shipped: false, phase: 'Demo', reading: 0.9 },
  { code: 'ru', name: 'Русский', intl: 'ru', fallback: [], script: 'cyrillic', shipped: false, phase: 'Demo-stretch', reading: 0.9 },
  { code: 'zh-Hans', name: '简体中文', intl: 'zh-Hans', fallback: [], script: 'han', shipped: false, phase: 'Demo-stretch', reading: 1 },
  { code: 'it', name: 'Italiano', intl: 'it', fallback: [], script: 'latin', shipped: false, phase: 'Beta', reading: 0.9 },
  { code: 'ja', name: '日本語', intl: 'ja', fallback: [], script: 'kana', shipped: false, phase: 'Beta', reading: 1 },
  { code: 'ko', name: '한국어', intl: 'ko', fallback: [], script: 'hangul', shipped: false, phase: 'Beta', reading: 1 },
  { code: 'qps', name: '⟦Ƥšéüðö⟧', intl: 'en', fallback: [], script: 'pseudo', shipped: false, phase: 'dev', reading: 0.8, pseudo: 'qps' },
  { code: 'qps-long', name: '⟦Ƥšéüðö Łöñĝ⟧', intl: 'en', fallback: [], script: 'pseudo', shipped: false, phase: 'dev', reading: 0.8, pseudo: 'qps-long' },
  { code: 'qps-cjk', name: 'Ｐｓｅｕｄｏ－ＣＪＫ', intl: 'en', fallback: [], script: 'pseudo', shipped: false, phase: 'dev', reading: 1, pseudo: 'qps-cjk' },
];

export const localeInfo = (code: string): LocaleInfo | undefined => LOCALES.find((l) => l.code === code);

/** Full lookup chain for a locale, always ending in English (e.g. pt-BR → en). */
export function fallbackChain(code: string): string[] {
  const info = localeInfo(code);
  const chain = [code, ...(info?.fallback ?? [])];
  if (!chain.includes(SOURCE_LOCALE)) chain.push(SOURCE_LOCALE);
  return chain;
}

/** Pick a locale from the browser/OS preference list, in order (exact tag, then same language). */
export function negotiate(preferred: readonly string[], available: readonly LocaleInfo[] = LOCALES.filter((l) => l.shipped)): string {
  for (const want of preferred) {
    const exact = available.find((l) => l.code.toLowerCase() === want.toLowerCase());
    if (exact) return exact.code;
    const lang = want.split('-')[0].toLowerCase();
    const loose = available.find((l) => l.code.split('-')[0].toLowerCase() === lang);
    if (loose) return loose.code;
  }
  return SOURCE_LOCALE;
}
