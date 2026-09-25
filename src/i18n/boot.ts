import { saveSettings, settings } from '../core/settings';
import { menuLocales, setLocale } from './index';
import { negotiate } from './locales';

/**
 * Pick and load the interface language before the first frame:
 * `?lang=<code>` (LQA / screenshots) > the saved setting > the system languages.
 */
export async function initLocale(): Promise<string> {
  const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (param) return setLocale(param);
  const offered = menuLocales();
  const wanted = settings.language && offered.some((l) => l.code === settings.language) ? settings.language : negotiate(typeof navigator !== 'undefined' ? navigator.languages : [], offered);
  return setLocale(wanted);
}

/** Options-menu language switch: step through the offered languages and persist the choice. */
export async function cycleLanguage(dir: number, current: string): Promise<string> {
  const list = menuLocales();
  const i = Math.max(0, list.findIndex((l) => l.code === current));
  const next = list[(i + dir + list.length) % list.length].code;
  settings.language = next;
  saveSettings();
  return setLocale(next);
}
