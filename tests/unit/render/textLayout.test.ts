/** ENG-0168 kerning, ENG-0173 layout, ENG-0174 rich text, ENG-0175 typewriter, ENG-0176 graphemes, ENG-0177 static text cache. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { graphemes, layoutText, parseRich, stripRich, TEXT_COLORS, TextLayouter, Typewriter, type TextMeasurer } from '../../../src/render/textLayout';
import { fakeCanvas, fakeGl } from '../../fakegl';

/** Every cluster 10 units wide at base size 10 (so px = size), with a -3 kern on AV/To/Wa. */
const KERN: Record<string, number> = { AV: -3, To: -3, Wa: -3 };
const metric: TextMeasurer = { baseSize: 10, advance: () => 10, kern: (a, b) => KERN[a + b] ?? 0 };

describe('grapheme clusters (ENG-0176)', () => {
  it('keeps combining diacritics with their base letter and precomposes them (NFC)', () => {
    expect(graphemes('é')).toEqual(['é']);
    expect(graphemes('Zażółć')).toEqual(['Z', 'a', 'ż', 'ó', 'ł', 'ć']);
    expect(graphemes('mañana')).toEqual(['m', 'a', 'ñ', 'a', 'n', 'a']);
    // A base with a mark that has no precomposed form still stays one cluster.
    expect(graphemes('q̣̇x')).toHaveLength(2);
    expect(graphemes('Straße, élève, Ärzte, Łódź')).toHaveLength(26);
  });

  it('lays out a decomposed string exactly like its precomposed spelling', () => {
    const a = layoutText(metric, 'Crème brûlée');
    const b = layoutText(metric, 'Crème brûlée');
    expect(a.width).toBe(b.width);
    expect(a.glyphs.map((g) => g.ch)).toEqual(b.glyphs.map((g) => g.ch));
  });
});

describe('layout engine (ENG-0173) and kerning (ENG-0168)', () => {
  it('applies kerning pairs so AV, To and Wa measure narrower than unkerned', () => {
    for (const s of ['AV', 'To', 'Wa']) expect(layoutText(metric, s, { size: 10 }).width).toBeLessThan(20);
    expect(layoutText(metric, 'AB', { size: 10 }).width).toBe(20);
  });

  it('wraps at spaces, aligns lines and reports size', () => {
    const l = layoutText(metric, 'aaa bbb ccc', { size: 10, maxWidth: 75 });
    expect(l.lines).toHaveLength(2);
    expect(l.lines[0].width).toBe(70);
    expect(l.height).toBeCloseTo(2 * 13.5);
    const c = layoutText(metric, 'aaa bbb ccc', { size: 10, maxWidth: 75, align: 'center' });
    expect(c.lines[1].x).toBe(-15);
    const r = layoutText(metric, 'ab', { size: 10, align: 'right' });
    expect(r.glyphs[0].x).toBe(-20);
  });

  it('breaks words longer than the line between clusters and honours newlines', () => {
    const l = layoutText(metric, 'abcdefgh\nij', { size: 10, maxWidth: 35 });
    expect(
      l.lines.map((ln) =>
        l.glyphs
          .slice(ln.start, ln.end)
          .map((g) => g.ch)
          .join(''),
      ),
    ).toEqual(['abc', 'def', 'gh', 'ij']);
  });

  it('clamps to maxLines with an ellipsis that fits the width', () => {
    const l = layoutText(metric, 'one two three four five', { size: 10, maxWidth: 80, maxLines: 2 });
    expect(l.truncated).toBe(true);
    expect(l.lines).toHaveLength(2);
    const last = l.glyphs
      .slice(l.lines[1].start, l.lines[1].end)
      .map((g) => g.ch)
      .join('');
    expect(last.endsWith('…')).toBe(true);
    expect(l.lines[1].width).toBeLessThanOrEqual(80);
  });

  it('caches layouts (same object) and invalidates on a new measurer generation', () => {
    const m = { ...metric, generation: 0 };
    const lay = new TextLayouter(m);
    const a = lay.layout('Hold fast', { size: 20 });
    expect(lay.layout('Hold fast', { size: 20 })).toBe(a);
    expect(lay.layout('Hold fast', { size: 22 })).not.toBe(a);
    m.generation = 1;
    expect(lay.layout('Hold fast', { size: 20 })).not.toBe(a);
    expect(lay.hits).toBe(1);
  });
});

describe('rich text (ENG-0174)', () => {
  it('parses bold, italic, colours, fonts, icons and keys, nesting spans', () => {
    const t = parseRich('Use [b]the [color=blood]lancet[/color][/b] [icon=lancet] then [key=Litany]. [font=display]Amen[/font] [i]quietly[/i]');
    const texts = t.filter((x) => x.kind === 'text');
    const lancet = texts.find((x) => x.kind === 'text' && x.text === 'lancet')!;
    expect(lancet.style).toMatchObject({ bold: true, color: TEXT_COLORS.blood });
    expect(t.find((x) => x.kind === 'icon')).toMatchObject({ id: 'lancet' });
    expect(t.find((x) => x.kind === 'key')).toMatchObject({ action: 'Litany' });
    expect(texts.find((x) => x.kind === 'text' && x.text === 'Amen')!.style.font).toBe('display');
    expect(texts.find((x) => x.kind === 'text' && x.text === 'quietly')!.style.italic).toBe(true);
    expect(stripRich('[b]a[/b] [color=#ff0000]b[/color]')).toBe('a b');
  });

  it('keeps malformed or unknown tags as literal text', () => {
    expect(stripRich('[x]odd[/x] [b=1]x [color=nope]y[/color] [/b]')).toBe('[x]odd[/x] [b=1]x [color=nope]y[/color] [/b]');
    expect(stripRich('[b]unclosed')).toBe('unclosed');
  });

  it('lays out inline icons and resolved key caps as boxes, and re-lays out when a binding changes', () => {
    let label = 'Q';
    const lay = new TextLayouter(metric);
    const opts = { size: 20, rich: true, resolveKey: () => label };
    const a = lay.layout('Press [key=Litany] now [icon=lancet]', opts);
    const key = a.glyphs.find((g) => g.icon?.kind === 'key')!;
    expect(key.icon).toMatchObject({ id: 'Q', action: 'Litany' });
    expect(a.glyphs.find((g) => g.icon?.kind === 'icon')!.icon!.id).toBe('lancet');
    expect(lay.layout('Press [key=Litany] now [icon=lancet]', opts)).toBe(a);
    label = 'LB';
    expect(lay.layout('Press [key=Litany] now [icon=lancet]', opts).glyphs.find((g) => g.icon?.kind === 'key')!.icon!.id).toBe('LB');
  });
});

describe('typewriter (ENG-0175)', () => {
  it('reveals at the given rate with pauses after sentence stops and commas', () => {
    const l = layoutText(metric, 'Hi. Yes, go');
    const tw = new Typewriter(l, 10);
    // 'H','i' then '.' — the space after the full stop waits an extra 0.32 s.
    expect(tw.times[3] - tw.times[2]).toBeCloseTo(0.1 + 0.32);
    expect(tw.times[8] - tw.times[7]).toBeCloseTo(0.1 + 0.12);
    tw.update(0.25);
    expect(tw.visible).toBe(3);
    expect(tw.done).toBe(false);
    tw.skip();
    expect(tw.done).toBe(true);
    expect(tw.visible).toBe(l.glyphs.length);
  });

  it('pauses once at the end of a punctuation run, and never after the last glyph', () => {
    const tw = new Typewriter(layoutText(metric, 'What?! No...'), 10);
    const gaps = Array.from(tw.times.slice(1), (t, i) => +(t - tw.times[i]).toFixed(3));
    expect(gaps.filter((g) => g > 0.1 + 1e-6)).toHaveLength(1);
    expect(tw.duration).toBeCloseTo(1.1 + 0.32);
  });
});

describe('Gfx text with kerning and the static text cache (ENG-0168, ENG-0177)', () => {
  const g0 = globalThis as unknown as { document?: unknown };
  const prev = g0.document;
  beforeAll(() => {
    // A 2D canvas that measures 20 px per character with AV/To/Wa kerned 4 px tighter.
    const ctx2d = new Proxy({} as Record<string, unknown>, {
      get(_t, k) {
        if (k === 'measureText')
          return (s: string) => {
            const cl = [...s];
            let w = 20 * cl.length;
            for (let i = 0; i + 1 < cl.length; i++) if (['AV', 'To', 'Wa'].includes(cl[i] + cl[i + 1])) w -= 4;
            return { width: w, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 12 };
          };
        if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
        return () => undefined;
      },
      set: () => true,
    });
    g0.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
  });
  afterAll(() => {
    g0.document = prev;
  });

  it('measures kerned pairs narrower in Gfx.measure', async () => {
    const { Gfx } = await import('../../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    for (const s of ['AV', 'To', 'Wa']) expect(g.measure(s, 56)).toBeLessThan(g.measure('AB', 56));
    expect(g.measure('AB', 56)).toBe(40);
  });

  it('draws unchanged labels from baked runs at least twice as fast as re-laying them out', async () => {
    const { Gfx } = await import('../../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const labels = [
      'SCORE',
      'TIME BONUS',
      'VITALS BONUS',
      'LONGEST CHAIN',
      'Cool',
      'Good',
      'Bad',
      'Miss',
      '12,480',
      'Rank',
      'Next Operation',
      'Retry',
      'Return to the Hospice',
    ];
    const frame = () => {
      for (const l of labels) {
        g.text(l, 100, 100, { size: 22, shadow: false });
        g.text(l, 100, 100, { size: 18, font: 'display', align: 'right', shadow: false });
      }
      g.flush();
    };
    // Interleave the two modes round by round and keep each one's best round, so a burst of load
    // from other test workers lands on both sides instead of skewing one.
    const round = (on: boolean) => {
      g.textCache = on;
      frame();
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) frame();
      return performance.now() - t0;
    };
    let uncached = Infinity;
    let cached = Infinity;
    for (let r = 0; r < 9; r++) {
      uncached = Math.min(uncached, round(false));
      cached = Math.min(cached, round(true));
    }
    expect(cached).toBeLessThan(uncached * 0.5);
  });
});
