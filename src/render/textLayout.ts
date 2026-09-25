/**
 * Text layout engine (ENG-0173) with grapheme clusters (ENG-0176), kerning (ENG-0168), rich-text
 * markup (ENG-0174) and typewriter timing (ENG-0175). Pure TypeScript: glyph metrics come from a
 * `TextMeasurer` (the glyph atlas in the game, a table in tests), so layouts are testable in Node.
 *
 * A layout is a list of positioned glyphs (grapheme clusters or inline icons) grouped in lines,
 * computed once and cached (LRU) by string + options, so labels drawn every frame are not re-laid
 * out, and the typewriter reveals a layout that never reflows as it types.
 */
import type { RGBA } from './color';
import { hex } from './color';
import type { FontId } from './text';

// ------------------------------------------------------------------ grapheme clusters (ENG-0176)

/** Combining marks, variation selectors, ZWJ and surrogates: strings containing none split per code point. */
// eslint-disable-next-line no-misleading-character-class -- deliberately lists combining marks
const COMPLEX = /[̀-ͯ҃-҉֑-ֽؐ-ًؚ-ٟั-ฺ᪰-᫿᷀-᷿‌‍⃐-⃿︀-️︠-︯\ud800-\udfff]/;
let segmenter: { segment(s: string): Iterable<{ segment: string }> } | null | undefined;

/**
 * User-perceived characters of `str`, NFC-normalised, so "e" + U+0301 is one precomposed "é" and a
 * base letter with stacked combining marks (or an emoji ZWJ sequence) stays one glyph. Fast path for
 * plain text: no normalisation or segmentation when nothing could combine.
 */
export function graphemes(str: string): string[] {
  if (!COMPLEX.test(str)) return [...str];
  const s = str.normalize('NFC');
  if (segmenter === undefined) {
    const I = Intl as unknown as { Segmenter?: new (loc?: string, o?: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> } };
    segmenter = I.Segmenter ? new I.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  // No Intl.Segmenter: attach combining marks to the preceding code point.
  const out: string[] = [];
  for (const cp of s) {
    // eslint-disable-next-line no-misleading-character-class -- deliberately lists combining marks
    if (out.length && /^[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︀-️︠-︯‍]$/.test(cp)) out[out.length - 1] += cp;
    else out.push(cp);
  }
  return out;
}

// ------------------------------------------------------------------ metrics

export interface TextMeasurer {
  /** Size the advances below are measured at. */
  readonly baseSize: number;
  /** Advance of one grapheme cluster, at `baseSize`. */
  advance(cluster: string, font: FontId): number;
  /** Kerning adjustment between two adjacent clusters (negative = tighter), at `baseSize`. */
  kern(a: string, b: string, font: FontId): number;
  /** Bumped whenever cached metrics become stale (font load, readable-font swap). */
  readonly generation?: number;
}

// ------------------------------------------------------------------ rich text (ENG-0174)

/** Named colours for `[color=…]`. */
export const TEXT_COLORS: Record<string, RGBA> = {
  blood: hex('#c0141e'),
  gold: hex('#e6c77a'),
  bone: hex('#e8dcc0'),
  ink: hex('#1a1210'),
  curse: hex('#b070ff'), // curse-violet: the [color=curse] span is curse content by definition
  bile: hex('#9ab040'),
  pus: hex('#d8c060'),
  dim: hex('#a89c80'),
  white: hex('#ffffff'),
};

export interface SpanStyle {
  font?: FontId;
  bold?: boolean;
  italic?: boolean;
  color?: RGBA;
}

export type RichToken = { kind: 'text'; text: string; style: SpanStyle } | { kind: 'icon'; id: string; style: SpanStyle } | { kind: 'key'; action: string; style: SpanStyle };

const TAG = /\[(\/?)(b|i|color|font|icon|key)(?:=([^\]\s]+))?\]/g;
const FONTS: readonly FontId[] = ['body', 'display', 'italic'];

const parseColor = (v: string | undefined): RGBA | undefined => {
  if (!v) return undefined;
  if (TEXT_COLORS[v] !== undefined) return TEXT_COLORS[v];
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) ? hex(v) : undefined;
};

/**
 * Parse `[b]`, `[i]`, `[color=blood|#hex]`, `[font=display|body|italic]` (each closed by its
 * `[/tag]`, nestable) and the self-closing `[icon=lancet]` and `[key=Litany]`. Malformed or
 * unknown tags stay literal text, so translated strings can never lose characters.
 */
export function parseRich(str: string): RichToken[] {
  const out: RichToken[] = [];
  const stack: { tag: string; prev: SpanStyle }[] = [];
  let style: SpanStyle = {};
  let last = 0;
  const text = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === 'text' && prev.style === style) prev.text += t;
    else out.push({ kind: 'text', text: t, style });
  };
  for (const m of str.matchAll(TAG)) {
    const [whole, close, tag, val] = m;
    const at = m.index ?? 0;
    let next: SpanStyle | null = null;
    let ok = true;
    if (close) {
      const top = stack[stack.length - 1];
      if (top && top.tag === tag && !val) {
        stack.pop();
        next = top.prev;
      } else ok = false;
    } else if (tag === 'icon' || tag === 'key') {
      if (!val) ok = false;
    } else if (tag === 'b' || tag === 'i') {
      if (val) ok = false;
      else next = { ...style, [tag === 'b' ? 'bold' : 'italic']: true };
    } else if (tag === 'color') {
      const c = parseColor(val);
      if (c === undefined) ok = false;
      else next = { ...style, color: c };
    } else if (tag === 'font') {
      if (!FONTS.includes(val as FontId)) ok = false;
      else next = { ...style, font: val as FontId };
    }
    if (!ok) continue;
    text(str.slice(last, at));
    last = at + whole.length;
    if (tag === 'icon' && !close) out.push({ kind: 'icon', id: val!, style });
    else if (tag === 'key' && !close) out.push({ kind: 'key', action: val!, style });
    else if (next) {
      if (!close) stack.push({ tag, prev: style });
      style = next;
    }
  }
  text(str.slice(last));
  return out;
}

/** Plain text of a rich string (tags removed, icons/keys dropped) — for measuring alt text and logs. */
export const stripRich = (str: string): string =>
  parseRich(str)
    .map((t) => (t.kind === 'text' ? t.text : ''))
    .join('');

// ------------------------------------------------------------------ layout (ENG-0173)

export interface InlineIcon {
  kind: 'icon' | 'key';
  /** Icon id (`lancet`) or the resolved key label (`Q`, `LT`). */
  id: string;
  /** Action id for keys, so a renderer can re-resolve on device change. */
  action?: string;
}

export interface LaidGlyph {
  /** Grapheme cluster ('' for icons). */
  ch: string;
  /** Pen x of the glyph's origin relative to the layout anchor, in px at `size`. */
  x: number;
  /** Line index (baseline y = anchor y + line × lineStep). */
  line: number;
  /** Advance in px at `size` (includes tracking, not kerning). */
  adv: number;
  font: FontId;
  bold?: boolean;
  color?: RGBA;
  icon?: InlineIcon;
}

export interface LaidLine {
  /** Glyph index range [start, end). */
  start: number;
  end: number;
  width: number;
  /** x of the line's left edge relative to the anchor (alignment). */
  x: number;
}

export interface TextLayout {
  glyphs: LaidGlyph[];
  lines: LaidLine[];
  /** Widest line (px). */
  width: number;
  /** lines × lineStep. */
  height: number;
  size: number;
  /** Baseline-to-baseline distance (px). */
  lineStep: number;
  /** Lines were dropped to honour `maxLines` (the last shown line ends in the ellipsis). */
  truncated: boolean;
}

export type Align = 'left' | 'center' | 'right';

export interface LayoutOptions {
  size?: number;
  font?: FontId;
  /** Wrap width in px (no wrapping when omitted). */
  maxWidth?: number;
  align?: Align;
  /** Line height as a multiple of `size` (default 1.35, as `Gfx.textBlock`). */
  lineHeight?: number;
  /** Keep at most this many lines; the last one is ellipsised. */
  maxLines?: number;
  ellipsis?: string;
  /** Extra letter spacing in em. */
  tracking?: number;
  /** Parse `[b]`/`[color]`/`[icon]`… markup. */
  rich?: boolean;
  /** Resolve `[key=Name]` to the current input glyph label. */
  resolveKey?: (name: string) => string;
  /** Inline icon advance in em (default 1.1). */
  iconEm?: number;
}

interface Item {
  ch: string;
  font: FontId;
  bold?: boolean;
  color?: RGBA;
  icon?: InlineIcon;
  /** Advance at `size`, tracking included. */
  adv: number;
}

const isSpace = (ch: string) => ch === ' ' || ch === ' ' || ch === '　';

/**
 * Lays out text with cached results. `layout()` returns the same object for the same string and
 * options until the measurer's generation changes, so callers may keep it across frames.
 */
export class TextLayouter {
  private cache = new Map<string, TextLayout>();
  private gen = -1;
  hits = 0;
  misses = 0;

  constructor(
    private m: TextMeasurer,
    readonly capacity = 512,
  ) {}

  layout(str: string, o: LayoutOptions = {}): TextLayout {
    const gen = this.m.generation ?? 0;
    if (gen !== this.gen) {
      this.cache.clear();
      this.gen = gen;
    }
    const key = `${o.size ?? 20}|${o.font ?? 'body'}|${o.maxWidth ?? ''}|${o.align ?? 'left'}|${o.lineHeight ?? ''}|${o.maxLines ?? ''}|${o.ellipsis ?? ''}|${o.tracking ?? 0}|${o.rich ? 1 : 0}|${o.iconEm ?? ''}|${str}`;
    const hit = this.cache.get(key);
    // A cached rich layout is valid while every [key=…] still resolves to the same label (rebinding, device swap).
    const keysOk = (l: TextLayout) => !o.resolveKey || l.glyphs.every((g) => !g.icon?.action || o.resolveKey!(g.icon.action) === g.icon.id);
    if (hit && keysOk(hit)) {
      // LRU: move to the back.
      this.cache.delete(key);
      this.cache.set(key, hit);
      this.hits++;
      return hit;
    }
    this.misses++;
    const out = layoutText(this.m, str, o);
    this.cache.set(key, out);
    if (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!);
    return out;
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Lay out `str` (uncached). */
export function layoutText(m: TextMeasurer, str: string, o: LayoutOptions = {}): TextLayout {
  const size = o.size ?? 20;
  const baseFont = o.font ?? 'body';
  const k = size / m.baseSize;
  const tr = (o.tracking ?? 0) * size;
  const items: Item[] = [];
  const push = (text: string, st: SpanStyle) => {
    const font = st.font ?? (st.italic ? (baseFont === 'italic' ? 'body' : 'italic') : baseFont);
    for (const ch of graphemes(text)) items.push({ ch, font, bold: st.bold, color: st.color, adv: ch === '\n' ? 0 : m.advance(ch, font) * k + tr });
  };
  if (o.rich) {
    for (const t of parseRich(str)) {
      if (t.kind === 'text') push(t.text, t.style);
      else {
        const font = t.style.font ?? baseFont;
        const label = t.kind === 'key' ? (o.resolveKey?.(t.action) ?? t.action) : t.id;
        const w = t.kind === 'key' ? Math.max(size * 1.1, graphemes(label).reduce((s, c) => s + m.advance(c, 'body') * k * 0.8, 0) + size * 0.6) : size * (o.iconEm ?? 1.1);
        items.push({ ch: '', font, color: t.style.color, adv: w + size * 0.12, icon: { kind: t.kind, id: label, action: t.kind === 'key' ? t.action : undefined } });
      }
    }
  } else push(str, {});

  // Kerning between neighbours of the same face, folded into the left glyph's advance.
  const kerned = items.map((it, i) => {
    const nx = items[i + 1];
    return nx && !it.icon && !nx.icon && it.font === nx.font && it.ch !== '\n' && nx.ch !== '\n' ? it.adv + m.kern(it.ch, nx.ch, it.font) * k : it.adv;
  });

  // Greedy wrap: break at spaces; a word wider than the line breaks between clusters.
  const max = o.maxWidth ?? Infinity;
  const rows: [number, number][] = [];
  let start = 0;
  let w = 0;
  let lastSpace = -1;
  let wAtSpace = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.ch === '\n') {
      rows.push([start, i]);
      start = i + 1;
      w = 0;
      lastSpace = -1;
      continue;
    }
    if (isSpace(it.ch)) {
      lastSpace = i;
      wAtSpace = w;
    }
    const nw = w + kerned[i];
    if (nw > max + 1e-6 && i > start && !isSpace(it.ch)) {
      if (lastSpace >= start) {
        rows.push([start, lastSpace]);
        start = lastSpace + 1;
        w = w - wAtSpace - kerned[lastSpace];
        lastSpace = -1;
      } else {
        rows.push([start, i]);
        start = i;
        w = 0;
      }
    }
    w += kerned[i];
  }
  rows.push([start, items.length]);

  // maxLines + ellipsis.
  let truncated = false;
  const ell = o.ellipsis ?? '…';
  if (o.maxLines !== undefined && rows.length > o.maxLines) {
    truncated = true;
    rows.length = Math.max(0, o.maxLines);
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const font = items[Math.max(lastRow[0], lastRow[1] - 1)]?.font ?? baseFont;
      const ew = graphemes(ell).reduce((s, c) => s + m.advance(c, font) * k + tr, 0);
      let end = lastRow[1];
      const width = (a: number, b: number) => {
        let s = 0;
        for (let i = a; i < b; i++) s += i === b - 1 ? items[i].adv : kerned[i];
        return s;
      };
      while (end > lastRow[0] && (width(lastRow[0], end) + ew > max || isSpace(items[end - 1].ch))) end--;
      const tail: Item[] = graphemes(ell).map((ch) => ({ ch, font, adv: m.advance(ch, font) * k + tr, color: items[end - 1]?.color }));
      items.splice(end, lastRow[1] - end, ...tail);
      kerned.splice(end, lastRow[1] - end, ...tail.map((t) => t.adv));
      lastRow[1] = end + tail.length;
      items.length = lastRow[1];
      kerned.length = lastRow[1];
    }
  }

  const lineStep = size * (o.lineHeight ?? 1.35);
  const glyphs: LaidGlyph[] = [];
  const lines: LaidLine[] = [];
  let widest = 0;
  rows.forEach(([a, b], li) => {
    // Trailing spaces do not count toward alignment width.
    let e = b;
    while (e > a && isSpace(items[e - 1].ch)) e--;
    let lw = 0;
    for (let i = a; i < e; i++) lw += i === e - 1 ? items[i].adv - tr : kerned[i];
    lw = Math.max(0, lw);
    const lx = o.align === 'center' ? -lw / 2 : o.align === 'right' ? -lw : 0;
    const s0 = glyphs.length;
    let x = lx;
    for (let i = a; i < b; i++) {
      const it = items[i];
      glyphs.push({ ch: it.ch, x, line: li, adv: it.adv, font: it.font, bold: it.bold, color: it.color, icon: it.icon });
      x += kerned[i];
    }
    lines.push({ start: s0, end: glyphs.length, width: lw, x: lx });
    widest = Math.max(widest, lw);
  });
  return { glyphs, lines, width: widest, height: lines.length * lineStep, size, lineStep, truncated };
}

// ------------------------------------------------------------------ typewriter (ENG-0175)

/** Extra pause after a glyph, in seconds at speed 1. */
export const PUNCTUATION_PAUSE: Record<string, number> = {
  '.': 0.32,
  '!': 0.32,
  '?': 0.32,
  '…': 0.36,
  '—': 0.2,
  ',': 0.12,
  ';': 0.16,
  ':': 0.16,
  '。': 0.32,
  '、': 0.12,
};

/**
 * Per-glyph reveal timing over a finished layout: glyph `i` appears at `times[i]` seconds; a
 * sentence stop or comma holds the next glyph back (only at the end of a punctuation run, and never
 * after the final glyph). The layout is computed once, so revealed text never reflows.
 */
export class Typewriter {
  readonly times: Float64Array;
  t = 0;

  constructor(
    /** A layout, or any glyph list (the story VN passes its plain line's characters). */
    readonly layout: { readonly glyphs: readonly { ch: string }[] },
    /** Characters per second at speed 1. */
    cps = 40,
    pauses: Record<string, number> = PUNCTUATION_PAUSE,
  ) {
    const g = layout.glyphs;
    this.times = new Float64Array(g.length);
    let at = 0;
    for (let i = 0; i < g.length; i++) {
      this.times[i] = at;
      at += 1 / cps;
      const p = pauses[g[i].ch];
      const next = g[i + 1];
      if (p && next && pauses[next.ch] === undefined) at += p;
    }
  }

  /** Advance by `dt` seconds scaled by `speed` (text-speed setting, fast-forward). */
  update(dt: number, speed = 1): void {
    this.t += dt * speed;
  }

  /** Number of glyphs revealed. */
  get visible(): number {
    return this.visibleAt(this.t);
  }

  /** Number of glyphs revealed `t` seconds (at speed 1) into the line. */
  visibleAt(t: number): number {
    const ts = this.times;
    let lo = 0;
    let hi = ts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  get done(): boolean {
    return this.visible >= this.times.length;
  }

  /** Total reveal time at speed 1. */
  get duration(): number {
    return this.times.length ? this.times[this.times.length - 1] : 0;
  }

  /** Reveal everything now. */
  skip(): void {
    this.t = Math.max(this.t, this.duration);
  }
}
