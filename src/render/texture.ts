import type { GlRegistry } from './registry';

export interface TextureOpts {
  /** `trilinear` = mipmapped LINEAR_MIPMAP_LINEAR (ENG-0036). */
  filter?: 'nearest' | 'linear' | 'trilinear';
  wrap?: 'clamp' | 'repeat' | 'mirror';
  /** Generate mipmaps (implied by `trilinear`). */
  mips?: boolean;
  /** Anisotropic filtering level when EXT_texture_filter_anisotropic exists (0 = off). */
  anisotropy?: number;
  /** Store premultiplied alpha. */
  premultiply?: boolean;
  label?: string;
}

export type TextureSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageData | { width: number; height: number; data: Uint8Array };

/** Estimated VRAM for an RGBA8 texture, with the 4/3 mip-chain overhead when mipmapped. */
export function textureBytes(w: number, h: number, mips: boolean): number {
  return Math.round(w * h * 4 * (mips ? 4 / 3 : 1));
}

/**
 * A GPU texture that remembers its source so it can be re-uploaded after a
 * context loss (ENG-0030/0200), with byte size tracked for the VRAM budget.
 */
export class Texture {
  tex: WebGLTexture;
  readonly w: number;
  readonly h: number;
  readonly bytes: number;
  private unsubscribe: () => void;
  private disposed = false;

  constructor(
    private reg: GlRegistry,
    private source: TextureSource,
    readonly opts: TextureOpts = {},
  ) {
    this.w = source.width;
    this.h = source.height;
    const mips = opts.filter === 'trilinear' || !!opts.mips;
    this.bytes = textureBytes(this.w, this.h, mips);
    this.tex = this.upload();
    this.unsubscribe = reg.onRestore(() => {
      if (!this.disposed) this.tex = this.upload();
    }, 10);
  }

  private upload(): WebGLTexture {
    const gl = this.reg.gl;
    const o = this.opts;
    const tex = this.reg.createTexture(o.label ?? `texture ${this.w}×${this.h}`);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const s = this.source;
    // ImageBitmaps are premultiplied (or not) at decode time; everything else at upload.
    const bitmap = typeof ImageBitmap !== 'undefined' && s instanceof ImageBitmap;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!o.premultiply && !bitmap);
    if (isRaw(s)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, s.width, s.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, s.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s as TexImageSource);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const mips = o.filter === 'trilinear' || !!o.mips;
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    const mag = o.filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    const min = o.filter === 'nearest' ? (mips ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST) : mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
    const wrap = o.wrap === 'repeat' ? gl.REPEAT : o.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (o.anisotropy && mips) {
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, o.anisotropy);
    }
    this.reg.setBytes(tex, this.bytes);
    return tex;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.reg.release(this.tex);
    if (typeof ImageBitmap !== 'undefined' && this.source instanceof ImageBitmap) this.source.close();
  }
}

/** Raw RGBA8 pixels (tests, generated textures) rather than a DOM image source. */
function isRaw(s: TextureSource): s is { width: number; height: number; data: Uint8Array } {
  return 'data' in s && s.data instanceof Uint8Array;
}

/** Decode an image off the main thread (ENG-0211). `premultiply` bakes premultiplied alpha at decode time. */
export async function decodeImage(blob: Blob, premultiply = false): Promise<ImageBitmap> {
  return createImageBitmap(blob, { premultiplyAlpha: premultiply ? 'premultiply' : 'none', colorSpaceConversion: 'none' });
}

/** 64×64 magenta/black checker — the missing-texture fallback (ENG-0210). */
export function checkerPixels(size = 64, cell = 8): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const i = (y * size + x) * 4;
      data[i] = on ? 255 : 0;
      data[i + 1] = 0;
      data[i + 2] = on ? 255 : 0;
      data[i + 3] = 255;
    }
  return { width: size, height: size, data };
}
