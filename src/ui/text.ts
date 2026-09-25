/**
 * Text bounds (UIX-0011): single-line text that never spills out of its widget.
 * `fitText` shrinks nothing — it ellipsises at the given width — and in dev
 * builds logs the widget id and string once when a string overflows, so the
 * pseudo-locale and text-scale runs produce a clean overflow report.
 */
import type { Gfx, TextOpts } from '../render/gfx';
import { hex, type RGBA } from '../render/color';
import type { FontId } from '../render/text';

const logged = new Set<string>();
/** Overflow reports gathered this session (dev overlay, tests). */
export const overflowLog: { id: string; text: string; width: number; max: number }[] = [];

function report(id: string, text: string, width: number, max: number): void {
  const key = `${id}\u0000${text}`;
  if (logged.has(key)) return;
  logged.add(key);
  overflowLog.push({ id, text, width, max });
  if (import.meta.env?.DEV) console.warn(`[ui] text overflow in "${id}": ${Math.round(width)}px > ${Math.round(max)}px — ${text}`);
}

/** Longest prefix of `str` (plus an ellipsis) that fits `max` px. */
export function ellipsize(measure: (s: string) => number, str: string, max: number): string {
  if (measure(str) <= max) return str;
  const ell = '…';
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(str.slice(0, mid).trimEnd() + ell) <= max) lo = mid;
    else hi = mid - 1;
  }
  return str.slice(0, lo).trimEnd() + ell;
}

/** Draw one line of text clipped with an ellipsis at `max` px. Returns the drawn width. */
export function fitText(g: Gfx, id: string, str: string, x: number, y: number, max: number, o: TextOpts = {}): number {
  const size = o.size ?? 20;
  const font: FontId = o.font ?? 'body';
  const m = (s: string) => g.measure(s, size, font);
  const w = m(str);
  if (w <= max) {
    g.text(str, x, y, o);
    return w;
  }
  report(id, str, w, max);
  const cut = ellipsize(m, str, max);
  g.text(cut, x, y, o);
  return m(cut);
}

/** Word-wrap `str` into lines no wider than `width` (same rule as `Gfx.textBlock`). */
export function wrapLines(measure: (s: string) => number, str: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of str.split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const tryLine = cur ? `${cur} ${word}` : word;
      if (measure(tryLine) > width && cur) {
        lines.push(cur);
        cur = word;
      } else cur = tryLine;
    }
    lines.push(cur);
  }
  return lines;
}

/** Height a wrapped block will take, without drawing it. */
export function blockHeight(g: Gfx, str: string, width: number, size: number, font: FontId = 'body', lineH = 1.35): number {
  return wrapLines((s) => g.measure(s, size, font), str, width).length * size * lineH;
}

/**
 * Wrapped text limited to `maxLines`; the last visible line is ellipsised and the
 * overflow logged. Returns the laid-out height.
 */
export function fitBlock(g: Gfx, id: string, str: string, x: number, y: number, width: number, maxLines: number, o: TextOpts = {}, lineH = 1.35): number {
  const size = o.size ?? 20;
  const font = o.font ?? 'body';
  const m = (s: string) => g.measure(s, size, font);
  let lines = wrapLines(m, str, width);
  if (lines.length > maxLines) {
    report(id, str, lines.length, maxLines);
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = ellipsize(m, `${lines[maxLines - 1]} …`, width);
  }
  lines.forEach((l, i) => g.text(l, x, y + i * size * lineH, o));
  return lines.length * size * lineH;
}

// ---- inline emphasis markup (UIX-0134) -----------------------------------------------------
// Story text (and any shared caller) may carry `*italic*` runs and `{term}` key terms (Malison,
// Litany, Hollow Choir), which are lettered in gold. The markers are stripped for measuring and
// typing out, so a line's reveal count and its localisation ids are unchanged.

/** Style bits per character of the plain text. */
export const STYLE_ITALIC = 1;
export const STYLE_TERM = 2;

export interface Marked {
  /** The text with markers removed. */
  plain: string;
  /** One style bitmask per code point of `plain`. */
  style: number[];
}

/** Parse `*italic*` and `{term}` markers. An unmatched marker stays literal. */
export function parseMarkup(str: string): Marked {
  const chars = [...str];
  const plain: string[] = [];
  const style: number[] = [];
  let italic = false;
  let term = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '*' && (italic || chars.indexOf('*', i + 1) > i)) {
      italic = !italic;
      continue;
    }
    if (c === '{' && !term && chars.indexOf('}', i + 1) > i) {
      term = true;
      continue;
    }
    if (c === '}' && term) {
      term = false;
      continue;
    }
    plain.push(c);
    style.push((italic ? STYLE_ITALIC : 0) | (term ? STYLE_TERM : 0));
  }
  return { plain: plain.join(''), style };
}

/** The text with markers removed. */
export const stripMarkup = (str: string): string => parseMarkup(str).plain;

/** A run of same-styled characters within a laid-out line. */
export interface RichRun {
  text: string;
  style: number;
}

/** Word-wrap marked-up text: lines of runs, measured per style (so italics wrap correctly). */
export function wrapRich(measure: (s: string, style: number) => number, str: string, width: number): RichRun[][] {
  const { plain, style } = parseMarkup(str);
  const chars = [...plain];
  const runsOf = (a: number, b: number): RichRun[] => {
    const out: RichRun[] = [];
    for (let i = a; i < b; i++) {
      const last = out[out.length - 1];
      if (last && last.style === style[i]) last.text += chars[i];
      else out.push({ text: chars[i], style: style[i] });
    }
    return out;
  };
  const widthOf = (a: number, b: number) => runsOf(a, b).reduce((w, r) => w + measure(r.text, r.style), 0);
  const lines: RichRun[][] = [];
  let start = 0;
  for (let i = 0; i <= chars.length; i++) {
    if (i < chars.length && chars[i] !== '\n') continue;
    // One paragraph [start, i): break at spaces.
    let lineStart = start;
    let lastSpace = -1;
    for (let j = start; j <= i; j++) {
      const atEnd = j === i;
      if (!atEnd && chars[j] !== ' ') continue;
      if (widthOf(lineStart, j) > width && lastSpace >= lineStart) {
        lines.push(runsOf(lineStart, lastSpace));
        lineStart = lastSpace + 1;
      }
      if (atEnd) lines.push(runsOf(lineStart, i));
      else lastSpace = j;
    }
    start = i + 1;
  }
  return lines;
}

export interface RichOpts extends TextOpts {
  /** Colour of `{term}` runs (gold by default). */
  termColor?: RGBA;
  /** Font for `*italic*` runs; a base font that is already italic swaps to roman. */
  italicFont?: FontId;
}

const richCache = new Map<string, RichRun[][]>();

/** INK.gold (#e6c77a) as packed ABGR, the default term colour. */
const TERM_GOLD: RGBA = hex('#e6c77a');

/**
 * Draw marked-up text word-wrapped to `width`, revealing only the first `shown` plain characters
 * (typewriter), and return the height used. Runs are drawn left to right with their own font and
 * colour, so a gold term or an italic aside sits inline with the body text.
 */
export function drawRich(g: Gfx, str: string, x: number, y: number, width: number, o: RichOpts = {}, lineH = 1.35, shown = Infinity): number {
  const size = o.size ?? 20;
  const base: FontId = o.font ?? 'body';
  const italic: FontId = base === 'italic' ? 'body' : (o.italicFont ?? 'italic');
  const fontOf = (style: number) => (style & STYLE_ITALIC ? italic : base);
  // The wrap is computed once per string and style and reused while it types out (ENG-0175).
  const key = `${size}|${base}|${italic}|${width}|${str}`;
  let lines = richCache.get(key);
  if (!lines) {
    lines = wrapRich((s, st) => g.measure(s, size, fontOf(st)), str, width);
    if (richCache.size > 128) richCache.delete(richCache.keys().next().value!);
    richCache.set(key, lines);
  }
  const gold = o.termColor ?? TERM_GOLD;
  let left = shown;
  lines.forEach((runs, i) => {
    let cx = x;
    for (const r of runs) {
      if (left <= 0) return;
      const chars = [...r.text];
      const text = chars.length > left ? chars.slice(0, left).join('') : r.text;
      left -= chars.length;
      const font = fontOf(r.style);
      g.text(text, cx, y + i * size * lineH, { ...o, font, color: r.style & STYLE_TERM ? gold : o.color });
      cx += g.measure(text, size, font);
    }
    left -= 1; // the space or newline the wrap consumed
  });
  return lines.length * size * lineH;
}
