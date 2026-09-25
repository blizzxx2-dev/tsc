/**
 * Visual cues for sound: closed captions for sound events, subtitles for voice
 * lines, and the pure models behind them. Drawing lives in `captions-view.ts`.
 */
import { subtitleCards, type SubtitleCard } from './i18n';

export interface Caption {
  text: string;
  /** −1 (left) … 1 (right); 0 = centred / unknown. */
  side: number;
  born: number;
  until: number;
}

export const CAPTION_TIME = 2.6;
export const MAX_CAPTIONS = 3;

/** Active sound captions, de-duplicated and capped. Times are in real seconds. */
export class CaptionFeed {
  items: Caption[] = [];
  now = 0;

  update(dt: number): void {
    this.now += dt;
    if (this.items.length) this.items = this.items.filter((c) => c.until > this.now);
  }

  push(text: string, side = 0, hold = CAPTION_TIME): void {
    const cur = this.items.find((c) => c.text === text);
    if (cur) {
      cur.until = Math.max(cur.until, this.now + hold);
      cur.side = side;
      return;
    }
    this.items.push({ text, side, born: this.now, until: this.now + hold });
    while (this.items.length > MAX_CAPTIONS) this.items.shift();
  }

  clear(): void {
    this.items.length = 0;
  }
}

export interface Subtitle {
  speaker: string;
  color: string;
  text: string;
  born: number;
  until: number;
  /** Cards (≤ 2 lines each) timed across the line. */
  cards: SubtitleCard[];
}

/** Voice-line subtitles: one card at a time, timed to the line. */
export class SubtitleFeed {
  current: Subtitle | null = null;
  now = 0;
  /** Characters per subtitle line (set from the text size). */
  width = 60;

  update(dt: number): void {
    this.now += dt;
    if (this.current && this.current.until <= this.now) this.current = null;
  }

  show(speaker: string, color: string, text: string, duration: number): void {
    const d = Math.max(1.2, duration);
    this.current = { speaker, color, text, born: this.now, until: this.now + d, cards: subtitleCards(text, d, this.width) };
  }

  /** Lines of the card on screen now. */
  lines(): string[] {
    const c = this.current;
    if (!c) return [];
    const t = this.now - c.born;
    const card = c.cards.find((k) => t >= k.start && t < k.start + k.duration) ?? c.cards[c.cards.length - 1];
    return card?.lines ?? [];
  }

  clear(): void {
    this.current = null;
  }
}

/** Split a subtitle into at most two lines of roughly `width` characters. */
export function wrapSubtitle(text: string, width = 60): string[] {
  if (text.length <= width) return [text];
  const words = text.split(' ');
  const lines: string[] = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > width && lines.length < 2) lines.push(w);
    else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  return lines;
}
