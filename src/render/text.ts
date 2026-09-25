export type FontId = 'body' | 'display' | 'italic';

/** Readable-font option (UIX-0150): body and italic text in Atkinson Hyperlegible; titles keep the blackletter. */
const READABLE = '"Atkinson Hyperlegible", Verdana, "Segoe UI", sans-serif';
let readable = false;
export function setReadableFont(on: boolean): void {
  readable = on;
}
export const readableFont = (): boolean => readable;

/** LQA builds tint glyphs that came from a fallback face magenta (LOC-0025). */
let highlightFallback = false;
export function setFallbackHighlight(on: boolean): void {
  highlightFallback = on;
}
export const fallbackHighlight = (): boolean => highlightFallback;

/**
 * UI typography: Cinzel (engraved Roman capitals) for titles, banners and labels; EB Garamond for
 * body text and narration. Both OFL, with Latin Extended subsets for PL/CS/HU.
 */
export const FONT_FAMILIES: Record<FontId, { style: string; weight: number; family: string }> = {
  body: { style: 'normal', weight: 500, family: '"EB Garamond", "Palatino Linotype", "Book Antiqua", Georgia, serif' },
  italic: { style: 'italic', weight: 500, family: '"EB Garamond", "Palatino Linotype", Georgia, serif' },
  display: { style: 'normal', weight: 600, family: '"Cinzel", "Trajan Pro", "EB Garamond", Georgia, serif' },
};

export interface Glyph {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  adv: number;
  /** Rasterised from a fallback face: the intended font lacks this character. */
  fallback?: boolean;
}

import type { GlRegistry } from './registry';

const SIZE = 2048;
const PAD = 6;

/**
 * Glyphs are rasterised on demand (with a 2D canvas used purely as a pixel
 * source) into one WebGL texture, so all text batches with the shapes.
 */
export class GlyphAtlas {
  /** Layout size: `measure`/advances are in these units, whatever tier a glyph is drawn from. */
  readonly baseSize = 56;
  /** Raster tiers (px): text is drawn from the smallest tier at least as large as its on-screen size. */
  static readonly TIERS = [16, 24, 36, 56, 84] as const;
  texture: WebGLTexture;
  readonly white = { u: 1 / SIZE, v: 1 / SIZE };
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glyphs = new Map<string, Glyph>();
  private penX = 8;
  private penY = 0;
  private rowH = 0;
  private dirty = true;
  /** Region changed since the last upload (ENG-0171); `full` forces a whole-page upload. */
  private dirtyRect = { x0: SIZE, y0: SIZE, x1: 0, y1: 0 };
  private full = true;
  private metrics = new Map<string, { ascent: number; descent: number }>();

  constructor(
    private gl: WebGL2RenderingContext,
    private registry?: GlRegistry,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    // Solid white block in the corner for untextured primitives.
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, 4, 4);
    this.texture = this.createTexture();
    this.upload();
    // After a context loss the page is re-uploaded whole from the retained canvas.
    registry?.onRestore(() => {
      this.texture = this.createTexture();
      this.full = this.dirty = true;
      this.upload();
    }, 5);
  }

  private createTexture(): WebGLTexture {
    const t = this.registry ? this.registry.createTexture('glyph-atlas') : this.gl.createTexture()!;
    this.registry?.setBytes(t, Math.round(SIZE * SIZE * 4 * (4 / 3)));
    return t;
  }

  private markDirty(x: number, y: number, w: number, h: number): void {
    const d = this.dirtyRect;
    d.x0 = Math.min(d.x0, x);
    d.y0 = Math.min(d.y0, y);
    d.x1 = Math.max(d.x1, Math.min(SIZE, x + w));
    d.y1 = Math.max(d.y1, Math.min(SIZE, y + h));
    this.dirty = true;
  }

  private font(f: FontId, px: number = this.baseSize): string {
    const { style, weight, family } = FONT_FAMILIES[f];
    return `${style} ${weight} ${px}px ${readable && f !== 'display' ? READABLE : family}`;
  }

  /** Cache key for a face: the readable swap gets its own glyphs and metrics. */
  private face(f: FontId, px: number = this.baseSize): string {
    return (readable && f !== 'display' ? `${f}~r` : f) + '@' + px;
  }

  /** The raster tier for text drawn `screenPx` tall. */
  tier(screenPx: number): number {
    for (const t of GlyphAtlas.TIERS) if (t >= screenPx * 0.95) return t;
    return GlyphAtlas.TIERS[GlyphAtlas.TIERS.length - 1];
  }

  ascent(f: FontId, px: number = this.baseSize): number {
    return this.metricsFor(f, px).ascent;
  }

  private metricsFor(f: FontId, px: number = this.baseSize): { ascent: number; descent: number } {
    let m = this.metrics.get(this.face(f, px));
    if (!m) {
      this.ctx.font = this.font(f, px);
      const tm = this.ctx.measureText('Hgjy|');
      const padK = px / this.baseSize;
      m = { ascent: Math.ceil(tm.actualBoundingBoxAscent + 4 * padK), descent: Math.ceil(tm.actualBoundingBoxDescent + 4 * padK) };
      this.metrics.set(this.face(f, px), m);
    }
    return m;
  }

  glyph(ch: string, f: FontId, px: number = this.baseSize): Glyph {
    const key = this.face(f, px) + ch;
    let g = this.glyphs.get(key);
    if (g) return g;
    const ctx = this.ctx;
    ctx.font = this.font(f, px);
    const adv = ctx.measureText(ch).width;
    const m = this.metricsFor(f, px);
    if (ch === ' ') {
      g = { u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0, ox: 0, oy: 0, adv };
      this.glyphs.set(key, g);
      return g;
    }
    const w = Math.ceil(adv + PAD * 2 + 8);
    const h = m.ascent + m.descent + PAD * 2;
    if (this.penY === 0) this.penY = 8;
    if (this.penX + w > SIZE) {
      this.penX = 8;
      this.penY += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.penY + h > SIZE) {
      // Atlas full: start over. Rare, and glyphs re-rasterise lazily.
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 4, 4);
      this.glyphs.clear();
      this.penX = 8;
      this.penY = 8;
      this.rowH = 0;
      this.full = true;
    }
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, this.penX + PAD + 4, this.penY + PAD + m.ascent);
    const fallback = this.isFallback(ch, f);
    ctx.font = this.font(f, px);
    g = {
      u0: this.penX / SIZE,
      v0: this.penY / SIZE,
      u1: (this.penX + w) / SIZE,
      v1: (this.penY + h) / SIZE,
      w,
      h,
      ox: -PAD - 4,
      oy: -PAD,
      adv,
      fallback,
    };
    this.markDirty(this.penX, this.penY, w, h);
    this.penX += w + 2;
    this.rowH = Math.max(this.rowH, h);
    this.glyphs.set(key, g);
    return g;
  }

  /**
   * Did the intended face supply `ch`? If it did not, the browser fell through to the next family,
   * so the character measures the same as in two different generic fonts on their own.
   */
  private isFallback(ch: string, f: FontId): boolean {
    const ctx = this.ctx;
    const face = this.font(f);
    const primary = face.slice(0, face.indexOf(',') >= 0 ? face.indexOf(',') : face.length);
    const [style, weight, size] = face.split(' ');
    const w = (font: string) => {
      ctx.font = font;
      return ctx.measureText(ch).width;
    };
    const generic = (g: string) => `${style} ${weight} ${size} ${g}`;
    return w(`${primary}, monospace`) === w(generic('monospace')) && w(`${primary}, cursive`) === w(generic('cursive'));
  }

  measure(str: string, f: FontId): number {
    let w = 0;
    for (const ch of str) w += this.glyph(ch, f).adv;
    this.upload();
    return w;
  }

  /**
   * Upload pending glyphs; returns true if anything was uploaded. Only the
   * changed rectangle goes up via texSubImage2D (ENG-0171) — the whole page
   * is sent just once, and again after the atlas wraps or the context returns.
   */
  upload(): boolean {
    if (!this.dirty) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const d = this.dirtyRect;
    if (this.full) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else if (d.x1 > d.x0 && d.y1 > d.y0) {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      const px = this.ctx.getImageData(d.x0, d.y0, w, h);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, d.x0, d.y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px.data);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    this.full = false;
    this.dirty = false;
    d.x0 = d.y0 = SIZE;
    d.x1 = d.y1 = 0;
    return true;
  }

  /** Rasterise the common character set up front so play never hitches. */
  warm(): void {
    const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’—…•×';
    for (const f of ['body', 'display', 'italic'] as FontId[]) for (const ch of chars) this.glyph(ch, f);
    this.upload();
  }
}
