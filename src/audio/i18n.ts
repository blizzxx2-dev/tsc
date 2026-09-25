/**
 * Localised captions and subtitles. Caption tables are keyed by event id and
 * subtitle tables by VO line id (`line.xxxxxxxx`, see vo.ts), one table per
 * language. Missing keys fall back to English. Long translations are split into
 * several subtitle cards (max two lines each) timed across the voice line, so
 * languages that run 30 %+ longer never cram or overrun.
 */

export interface AudioStrings {
  captions?: Record<string, string>;
  subtitles?: Record<string, string>;
}

const TABLES = new Map<string, AudioStrings>();
let lang = 'en';

export function registerAudioStrings(language: string, table: AudioStrings): void {
  const cur = TABLES.get(language) ?? {};
  TABLES.set(language, { captions: { ...cur.captions, ...table.captions }, subtitles: { ...cur.subtitles, ...table.subtitles } });
}

export function setAudioLanguage(language: string): void {
  lang = language;
}

export function audioLanguage(): string {
  return lang;
}

export function captionFor(eventId: string, english: string): string {
  return TABLES.get(lang)?.captions?.[eventId] ?? english;
}

export function subtitleFor(lineId: string, english: string): string {
  return TABLES.get(lang)?.subtitles?.[lineId] ?? english;
}

export interface SubtitleCard {
  lines: string[];
  /** Seconds from the start of the voice line. */
  start: number;
  duration: number;
}

/**
 * Split a subtitle into cards of at most two lines of `width` characters,
 * timed in proportion to their length across `duration` seconds.
 */
export function subtitleCards(text: string, duration: number, width = 60): SubtitleCard[] {
  const words = text.split(/\s+/).filter(Boolean);
  const cards: string[][] = [];
  let cur: string[] = [''];
  for (const w of words) {
    const line = cur[cur.length - 1];
    if (!line || (line + ' ' + w).length <= width) cur[cur.length - 1] = line ? `${line} ${w}` : w;
    else if (cur.length < 2) cur.push(w);
    else {
      cards.push(cur);
      cur = [w];
    }
  }
  if (cur[0]) cards.push(cur);
  const total = cards.reduce((a, c) => a + c.join(' ').length, 0) || 1;
  let t = 0;
  return cards.map((lines) => {
    const d = (duration * lines.join(' ').length) / total;
    const card = { lines, start: t, duration: d };
    t += d;
    return card;
  });
}
