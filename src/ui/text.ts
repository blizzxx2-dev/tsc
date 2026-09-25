/**
 * Text bounds (UIX-0011): single-line text that never spills out of its widget.
 * `fitText` shrinks nothing — it ellipsises at the given width — and in dev
 * builds logs the widget id and string once when a string overflows, so the
 * pseudo-locale and text-scale runs produce a clean overflow report.
 */
import type { Gfx, TextOpts } from '../render/gfx';
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
