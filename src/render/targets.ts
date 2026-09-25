import type { GlRegistry } from './registry';

/** Render-target pixel formats (ENG-0107). RGBA16F falls back to RGBA8 without float render support. */
export type TargetFormat = 'rgba8' | 'r8' | 'rg8' | 'rgba16f';

export interface TargetOpts {
  format?: TargetFormat;
  /** Attach a DEPTH24_STENCIL8 renderbuffer (stencil masks, ENG-0028). */
  depthStencil?: boolean;
  filter?: 'linear' | 'nearest';
}

export interface Target {
  key: string;
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
  format: TargetFormat;
  depth: WebGLRenderbuffer | null;
  bytes: number;
}

export const BYTES_PER_PIXEL: Record<TargetFormat, number> = { rgba8: 4, r8: 1, rg8: 2, rgba16f: 8 };

/** Internal format / format / type triple for each target format. */
export function glFormat(gl: WebGL2RenderingContext, f: TargetFormat): [number, number, number] {
  switch (f) {
    case 'r8':
      return [gl.R8, gl.RED, gl.UNSIGNED_BYTE];
    case 'rg8':
      return [gl.RG8, gl.RG, gl.UNSIGNED_BYTE];
    case 'rgba16f':
      return [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT];
    default:
      return [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
  }
}

/**
 * Keyed pool of offscreen render targets. `acquire` returns the existing target
 * when size and format still match and recreates it otherwise; every byte is
 * accounted in the GL registry so the VRAM budget sees targets too.
 */
export class RenderTargetPool {
  private targets = new Map<string, Target>();

  constructor(
    private reg: GlRegistry,
    /** Whether RGBA16F is colour-renderable (EXT_color_buffer_float). */
    public floatRenderable: boolean,
  ) {}

  /** Resolve a requested format to one this GPU can render to. */
  resolve(f: TargetFormat): TargetFormat {
    return f === 'rgba16f' && !this.floatRenderable ? 'rgba8' : f;
  }

  acquire(key: string, w: number, h: number, opts: TargetOpts = {}): Target {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    const format = this.resolve(opts.format ?? 'rgba8');
    const depth = !!opts.depthStencil;
    const cur = this.targets.get(key);
    if (cur && cur.w === w && cur.h === h && cur.format === format && !!cur.depth === depth) return cur;
    if (cur) this.free(cur);
    const t = this.create(key, w, h, format, depth, opts.filter ?? 'linear');
    this.targets.set(key, t);
    return t;
  }

  get(key: string): Target | undefined {
    return this.targets.get(key);
  }

  release(key: string): void {
    const t = this.targets.get(key);
    if (!t) return;
    this.free(t);
    this.targets.delete(key);
  }

  releaseAll(): void {
    for (const t of this.targets.values()) this.free(t);
    this.targets.clear();
  }

  /** After context loss every handle is dead: forget them so the next acquire recreates. */
  forget(): void {
    this.targets.clear();
  }

  get size(): number {
    return this.targets.size;
  }

  bytes(): number {
    let n = 0;
    for (const t of this.targets.values()) n += t.bytes;
    return n;
  }

  keys(): string[] {
    return [...this.targets.keys()];
  }

  private create(key: string, w: number, h: number, format: TargetFormat, depth: boolean, filter: 'linear' | 'nearest'): Target {
    const gl = this.reg.gl;
    const tex = this.reg.createTexture(`target:${key}`);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const [ifmt, fmt, type] = glFormat(gl, format);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = this.reg.createFramebuffer(`target:${key}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let rb: WebGLRenderbuffer | null = null;
    let bytes = w * h * BYTES_PER_PIXEL[format];
    if (depth) {
      rb = this.reg.createRenderbuffer(`target:${key}:depth`);
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb);
      this.reg.setBytes(rb, w * h * 4);
      bytes += w * h * 4;
    }
    this.reg.setBytes(tex, w * h * BYTES_PER_PIXEL[format]);
    // Never leave a render target bound to a texture unit: sampling it while drawing into it is a feedback loop.
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { key, fb, tex, w, h, format, depth: rb, bytes };
  }

  private free(t: Target): void {
    this.reg.release(t.fb);
    this.reg.release(t.tex);
    this.reg.release(t.depth);
  }
}
