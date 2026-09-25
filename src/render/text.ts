export type FontId = 'body' | 'display' | 'italic';

export const FONT_FAMILIES: Record<FontId, { style: string; family: string }> = {
  body: { style: 'normal', family: '"IM Fell English", "Palatino Linotype", "Book Antiqua", Georgia, serif' },
  italic: { style: 'italic', family: '"IM Fell English", "Palatino Linotype", Georgia, serif' },
  display: { style: 'normal', family: '"UnifrakturMaguntia", "IM Fell English", Georgia, serif' },
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
}

const SIZE = 2048;
const PAD = 6;

/**
 * Glyphs are rasterised on demand (with a 2D canvas used purely as a pixel
 * source) into one WebGL texture, so all text batches with the shapes.
 */
export class GlyphAtlas {
  readonly baseSize = 56;
  readonly texture: WebGLTexture;
  readonly white = { u: 1 / SIZE, v: 1 / SIZE };
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glyphs = new Map<string, Glyph>();
  private penX = 8;
  private penY = 0;
  private rowH = 0;
  private dirty = true;
  private metrics = new Map<FontId, { ascent: number; descent: number }>();

  constructor(private gl: WebGL2RenderingContext) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;
    // Solid white block in the corner for untextured primitives.
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, 4, 4);
    this.texture = gl.createTexture()!;
    this.upload();
  }

  private font(f: FontId): string {
    const { style, family } = FONT_FAMILIES[f];
    return `${style} ${this.baseSize}px ${family}`;
  }

  ascent(f: FontId): number {
    return this.metricsFor(f).ascent;
  }

  private metricsFor(f: FontId): { ascent: number; descent: number } {
    let m = this.metrics.get(f);
    if (!m) {
      this.ctx.font = this.font(f);
      const tm = this.ctx.measureText('Hgjy|');
      m = { ascent: Math.ceil(tm.actualBoundingBoxAscent + 4), descent: Math.ceil(tm.actualBoundingBoxDescent + 4) };
      this.metrics.set(f, m);
    }
    return m;
  }

  glyph(ch: string, f: FontId): Glyph {
    const key = f + ch;
    let g = this.glyphs.get(key);
    if (g) return g;
    const ctx = this.ctx;
    ctx.font = this.font(f);
    const adv = ctx.measureText(ch).width;
    const m = this.metricsFor(f);
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
    }
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, this.penX + PAD + 4, this.penY + PAD + m.ascent);
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
    };
    this.penX += w + 2;
    this.rowH = Math.max(this.rowH, h);
    this.glyphs.set(key, g);
    this.dirty = true;
    return g;
  }

  measure(str: string, f: FontId): number {
    let w = 0;
    for (const ch of str) w += this.glyph(ch, f).adv;
    this.upload();
    return w;
  }

  /** Upload pending glyphs. Called lazily before drawing. */
  upload(): void {
    if (!this.dirty) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.dirty = false;
  }

  /** Rasterise the common character set up front so play never hitches. */
  warm(): void {
    const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’—…•×';
    for (const f of ['body', 'display', 'italic'] as FontId[]) for (const ch of chars) this.glyph(ch, f);
    this.upload();
  }
}
