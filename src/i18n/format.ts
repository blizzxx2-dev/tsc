import { numberFormat } from './icu';
import { intlLocale } from './index';

/**
 * Locale-aware numbers and clocks for the HUD and results (LOC-0009).
 * Grouping follows CLDR: FR groups with U+202F, PL with U+00A0 (from five
 * digits), DE with a period — both space characters are in every baked glyph set.
 */
export function formatNumber(n: number, locale: string = intlLocale()): string {
  return numberFormat(locale, 'integer').format(n);
}

const pad2 = new Map<string, Intl.NumberFormat>();

/** m:ss for timers, with locale digits. Negative and fractional input is clamped/floored. */
export function formatClock(seconds: number, locale: string = intlLocale()): string {
  const s = Math.max(0, Math.floor(seconds));
  let f = pad2.get(locale);
  if (!f) pad2.set(locale, (f = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })));
  return `${numberFormat(locale, 'integer').format(Math.floor(s / 60))}:${f.format(s % 60)}`;
}

/** HUD vitals 0–99: rounded up, always two digits ("07"), locale digits. */
export function formatVitals(v: number, locale: string = intlLocale()): string {
  let f = pad2.get(locale);
  if (!f) pad2.set(locale, (f = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })));
  return f.format(Math.max(0, Math.ceil(v)));
}

/** Space characters locale number formats can produce; glyph lists must include them. */
export const FORMAT_SPACES = [' ', ' '] as const;
