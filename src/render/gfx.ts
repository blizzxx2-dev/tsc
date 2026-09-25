import type { Vec } from '../core/math';
import { alphaOf, type RGBA } from './color';
import { GlyphAtlas, type FontId } from './text';
import { BLUR_FS, BRIGHT_FS, FLESH_FS, FLUID_FS, FULL_VS, IMAGE_FS, IMAGE_VS, POST_FS, PRIM_FS, PRIM_VS } from './shaders';

const TAU = Math.PI * 2;
const MAX_VERTS = 60000;
const STRIDE = 5; // x, y, u, v (f32) + rgba (u32)

export type Blend = 'alpha' | 'add' | 'sum';
export type Align = 'left' | 'center' | 'right';

export interface TextOpts {
  size?: number;
  color?: RGBA;
  /** Optional bottom colour for a vertical gradient (gilt lettering). */
  color2?: RGBA;
  align?: Align;
  font?: FontId;
  shadow?: RGBA | false;
  maxWidth?: number;
}

export interface ImageHandle {
  tex: WebGLTexture | null;
  w: number;
  h: number;
  ready: boolean;
}

export interface ImageOpts {
  alpha?: number;
  /** 0 = original colours, 1 = fully toned to the ink/paper ramp. */
  sepia?: number;
  ink?: [number, number, number];
  paper?: [number, number, number];
  contrast?: number;
  /** Strength of candle pooling/vignette (0 = flat). */
  vignette?: number;
  /** Candle position in 0..1 screen space. */
  light?: [number, number];
  /** Source crop in 0..1 UV space. */
  crop?: { u0: number; v0: number; u1: number; v1: number };
}

export interface FleshParams {
  center: Vec;
  radii: Vec;
  kind: number;
  base: [number, number, number];
  deep: [number, number, number];
  vein: [number, number, number];
  pulse: number;
  light: Vec;
  corrupt: number;
}

export interface PostParams {
  litany: number;
  danger: number;
  shake: Vec;
  bloom: number;
  /** Chromatic aberration strength (curses, damage). */
  chroma?: number;
  /** Colour grade: multiplicative tint and lift, per chapter/location. */
  tint?: [number, number, number];
  lift?: [number, number, number];
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

/**
 * Batched WebGL2 2D renderer in the game's virtual resolution. World drawing
 * goes to an offscreen target that is post-processed (bloom, grade, vignette,
 * Litany ripple); UI drawing goes straight to the screen afterwards.
 */
export class Gfx {
  readonly gl: WebGL2RenderingContext;
  private prim: WebGLProgram;
  private flesh: WebGLProgram;
  private bright: WebGLProgram;
  private blur: WebGLProgram;
  private post: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private emptyVao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private f32 = new Float32Array(MAX_VERTS * STRIDE);
  private u32 = new Uint32Array(this.f32.buffer);
  private n = 0;
  private blend: Blend = 'alpha';
  private tf = [1, 0, 0, 1, 0, 0];
  private stack: number[][] = [];
  private scene!: Target;
  private bloomA!: Target;
  private bloomB!: Target;
  /** Wound/decal layer: R cut depth, G blood stain, B scorch, A swelling. */
  private surface!: Target;
  /** Liquid layer: R blood, G pus, B black bile densities (half-float when available). */
  private fluid!: Target;
  private msaaFb: WebGLFramebuffer | null = null;
  private msaaRb: WebGLRenderbuffer | null = null;
  private samples = 0;
  private floatTargets = false;
  private fluidProg: WebGLProgram;
  private imageProg: WebGLProgram;
  private images = new Map<string, ImageHandle>();
  private pw = 0;
  private ph = 0;
  readonly atlas: GlyphAtlas;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  time = 0;
  /** Current output target size in device pixels. */
  private outW = 0;
  private outH = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly vw: number,
    readonly vh: number,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available on this system.');
    this.gl = gl;
    this.prim = compile(gl, PRIM_VS, PRIM_FS);
    this.flesh = compile(gl, FULL_VS, FLESH_FS);
    this.bright = compile(gl, FULL_VS, BRIGHT_FS);
    this.blur = compile(gl, FULL_VS, BLUR_FS);
    this.post = compile(gl, FULL_VS, POST_FS);
    this.fluidProg = compile(gl, FULL_VS, FLUID_FS);
    this.imageProg = compile(gl, IMAGE_VS, IMAGE_FS);
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);

    this.vao = gl.createVertexArray()!;
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.f32.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * 4, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE * 4, 16);
    gl.bindVertexArray(null);

    this.atlas = new GlyphAtlas(gl);
    gl.enable(gl.BLEND);
    this.applyBlend();
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uniforms.get(p);
    if (!m) this.uniforms.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  private makeTarget(w: number, h: number, float = false): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  private freeTarget(t: Target | undefined): void {
    if (!t) return;
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }

  private ensureTargets(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === this.pw && h === this.ph) return;
    this.freeTarget(this.scene);
    this.freeTarget(this.bloomA);
    this.freeTarget(this.bloomB);
    this.freeTarget(this.surface);
    this.freeTarget(this.fluid);
    this.scene = this.makeTarget(w, h);
    const bw = Math.max(1, w >> 2);
    const bh = Math.max(1, h >> 2);
    this.bloomA = this.makeTarget(bw, bh);
    this.bloomB = this.makeTarget(bw, bh);
    const hw = Math.max(1, Math.round(w * 0.6));
    const hh = Math.max(1, Math.round(h * 0.6));
    this.surface = this.makeTarget(hw, hh);
    this.fluid = this.makeTarget(hw, hh, this.floatTargets);
    // Multisampled world target, resolved into `scene` before post-processing.
    const gl = this.gl;
    if (this.msaaRb) gl.deleteRenderbuffer(this.msaaRb);
    if (this.msaaFb) gl.deleteFramebuffer(this.msaaFb);
    this.msaaFb = this.msaaRb = null;
    if (this.samples > 1) {
      this.msaaRb = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
      this.msaaFb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaRb);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.msaaFb = null;
    }
    this.pw = w;
    this.ph = h;
  }

  private bindTarget(t: Target | null): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    this.outW = t ? t.w : this.canvas.width;
    this.outH = t ? t.h : this.canvas.height;
    gl.viewport(0, 0, this.outW, this.outH);
  }

  // ------------------------------------------------------------ frame

  /** Start the world layer (post-processed). */
  beginWorld(clear: [number, number, number] = [0.02, 0.015, 0.015]): void {
    this.ensureTargets();
    if (this.msaaFb) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.msaaFb);
      this.outW = this.scene.w;
      this.outH = this.scene.h;
      this.gl.viewport(0, 0, this.outW, this.outH);
    } else this.bindTarget(this.scene);
    this.gl.clearColor(clear[0], clear[1], clear[2], 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  /** Finish the world layer, run post-processing to the screen, and switch to the UI layer. */
  endWorld(p: PostParams): void {
    this.flush();
    const gl = this.gl;
    if (this.msaaFb) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fb);
      gl.blitFramebuffer(0, 0, this.scene.w, this.scene.h, 0, 0, this.scene.w, this.scene.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    // Bright pass → quarter res, then separable blur.
    this.bindTarget(this.bloomA);
    gl.useProgram(this.bright);
    this.bindTex(this.scene.tex, 0);
    gl.uniform1i(this.u(this.bright, 'u_tex'), 0);
    gl.uniform1f(this.u(this.bright, 'u_threshold'), 0.78);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.blur);
    gl.uniform1i(this.u(this.blur, 'u_tex'), 0);
    for (let i = 0; i < 2; i++) {
      this.bindTarget(this.bloomB);
      this.bindTex(this.bloomA.tex, 0);
      gl.uniform2f(this.u(this.blur, 'u_dir'), 1.5 / this.bloomA.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.bindTarget(this.bloomA);
      this.bindTex(this.bloomB.tex, 0);
      gl.uniform2f(this.u(this.blur, 'u_dir'), 0, 1.5 / this.bloomA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Composite.
    this.bindTarget(null);
    gl.useProgram(this.post);
    this.bindTex(this.scene.tex, 0);
    this.bindTex(this.bloomA.tex, 1);
    gl.uniform1i(this.u(this.post, 'u_scene'), 0);
    gl.uniform1i(this.u(this.post, 'u_bloom'), 1);
    gl.uniform1f(this.u(this.post, 'u_time'), this.time);
    gl.uniform1f(this.u(this.post, 'u_litany'), p.litany);
    gl.uniform1f(this.u(this.post, 'u_danger'), p.danger);
    gl.uniform1f(this.u(this.post, 'u_bloomAmt'), p.bloom);
    gl.uniform2f(this.u(this.post, 'u_shake'), p.shake.x / this.vw, -p.shake.y / this.vh);
    gl.uniform1f(this.u(this.post, 'u_flicker'), Math.sin(this.time * 9.1) * Math.sin(this.time * 3.7));
    gl.uniform1f(this.u(this.post, 'u_chroma'), p.chroma ?? 0);
    gl.uniform3fv(this.u(this.post, 'u_tint'), p.tint ?? [1, 1, 1]);
    gl.uniform3fv(this.u(this.post, 'u_lift'), p.lift ?? [0, 0, 0]);
    gl.uniform2f(this.u(this.post, 'u_res'), this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);

    gl.enable(gl.BLEND);
    this.applyBlend();
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  /** Draw a screen with no world layer (menus, story): UI straight to the screen. */
  beginScreen(clear: [number, number, number] = [0.03, 0.025, 0.025]): void {
    this.bindTarget(null);
    this.gl.clearColor(clear[0], clear[1], clear[2], 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  endFrame(): void {
    this.flush();
  }

  private bindTex(t: WebGLTexture, unit: number): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
  }

  // ------------------------------------------------------------ images

  /** Load (once) and return an image handle; draws are skipped until it is ready. */
  image(url: string): ImageHandle {
    let h = this.images.get(url);
    if (h) return h;
    const handle: ImageHandle = { tex: null, w: 0, h: 0, ready: false };
    this.images.set(url, handle);
    const img = new Image();
    img.onload = () => {
      const gl = this.gl;
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      Object.assign(handle, { tex, w: img.naturalWidth, h: img.naturalHeight, ready: true });
    };
    img.src = url;
    return handle;
  }

  /** Draw an image into a rect (virtual coords) with period grading. */
  drawImage(h: ImageHandle, x: number, y: number, w: number, hgt: number, o: ImageOpts = {}): void {
    if (!h.ready || !h.tex) return;
    this.flush();
    const gl = this.gl;
    const pr = this.imageProg;
    gl.useProgram(pr);
    gl.bindVertexArray(this.vao);
    const c = o.crop ?? { u0: 0, v0: 0, u1: 1, v1: 1 };
    const quad = [x, y, c.u0, c.v0, x + w, y, c.u1, c.v0, x + w, y + hgt, c.u1, c.v1, x, y, c.u0, c.v0, x + w, y + hgt, c.u1, c.v1, x, y + hgt, c.u0, c.v1];
    for (let i = 0; i < 6; i++) {
      const b = i * STRIDE;
      this.f32[b] = quad[i * 4];
      this.f32[b + 1] = quad[i * 4 + 1];
      this.f32[b + 2] = quad[i * 4 + 2];
      this.f32[b + 3] = quad[i * 4 + 3];
      this.u32[b + 4] = 0xffffffff;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, 6 * STRIDE);
    this.bindTex(h.tex, 0);
    gl.uniform1i(this.u(pr, 'u_img'), 0);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1f(this.u(pr, 'u_alpha'), o.alpha ?? 1);
    gl.uniform1f(this.u(pr, 'u_sepia'), o.sepia ?? 0);
    gl.uniform3fv(this.u(pr, 'u_ink'), o.ink ?? [0.08, 0.05, 0.04]);
    gl.uniform3fv(this.u(pr, 'u_paper'), o.paper ?? [0.86, 0.76, 0.58]);
    gl.uniform1f(this.u(pr, 'u_contrast'), o.contrast ?? 1);
    gl.uniform1f(this.u(pr, 'u_vignette'), o.vignette ?? 0);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform2fv(this.u(pr, 'u_light'), o.light ?? [0.5, 0.45]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Cover a rect with an image, cropping to preserve aspect; `pan` 0..1 slides the crop window. */
  drawImageCover(h: ImageHandle, x: number, y: number, w: number, hgt: number, o: ImageOpts & { pan?: [number, number]; zoom?: number } = {}): void {
    if (!h.ready) return;
    const ia = h.w / h.h;
    const ra = w / hgt;
    const z = o.zoom ?? 1;
    let cw = 1 / z;
    let ch = 1 / z;
    if (ia > ra) cw *= ra / ia;
    else ch *= ia / ra;
    const [px, py] = o.pan ?? [0.5, 0.5];
    const u0 = (1 - cw) * px;
    const v0 = (1 - ch) * py;
    this.drawImage(h, x, y, w, hgt, { ...o, crop: { u0, v0, u1: u0 + cw, v1: v0 + ch } });
  }

  // ------------------------------------------------------------ layers

  private worldFb(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb ?? this.scene.fb);
    this.outW = this.scene.w;
    this.outH = this.scene.h;
    gl.viewport(0, 0, this.outW, this.outH);
  }

  /** Begin drawing into an additive data layer (surface or fluid). Colours are data, summed. */
  beginLayer(which: 'surface' | 'fluid'): void {
    this.ensureTargets();
    this.flush();
    this.bindTarget(which === 'surface' ? this.surface : this.fluid);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.blend = 'sum';
    this.applyBlend();
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  endLayer(): void {
    this.flush();
    this.blend = 'alpha';
    this.applyBlend();
  }

  /** Composite the liquid layer into the world as glossy, merging fluid. Call after beginWorld. */
  fluidComposite(light: Vec): void {
    this.flush();
    this.worldFb();
    const gl = this.gl;
    const pr = this.fluidProg;
    gl.useProgram(pr);
    gl.bindVertexArray(this.emptyVao);
    this.bindTex(this.fluid.tex, 0);
    gl.uniform1i(this.u(pr, 'u_fluid'), 0);
    gl.uniform2f(this.u(pr, 'u_texel'), 1 / this.fluid.w, 1 / this.fluid.h);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform2f(this.u(pr, 'u_light'), light.x, light.y);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.applyBlend();
  }

  /** Draw the procedural body field over the whole world target. */
  fleshField(f: FleshParams): void {
    this.flush();
    this.worldFb();
    const gl = this.gl;
    const pr = this.flesh;
    gl.useProgram(pr);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform2f(this.u(pr, 'u_center'), f.center.x, f.center.y);
    gl.uniform2f(this.u(pr, 'u_radii'), f.radii.x, f.radii.y);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1i(this.u(pr, 'u_kind'), f.kind);
    gl.uniform3fv(this.u(pr, 'u_base'), f.base);
    gl.uniform3fv(this.u(pr, 'u_deep'), f.deep);
    gl.uniform3fv(this.u(pr, 'u_vein'), f.vein);
    gl.uniform1f(this.u(pr, 'u_pulse'), f.pulse);
    gl.uniform2f(this.u(pr, 'u_light'), f.light.x, f.light.y);
    gl.uniform1f(this.u(pr, 'u_corrupt'), f.corrupt);
    this.bindTex(this.surface.tex, 1);
    gl.uniform1i(this.u(pr, 'u_surface'), 1);
    gl.uniform2f(this.u(pr, 'u_surfTexel'), 1 / this.surface.w, 1 / this.surface.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
  }

  // ------------------------------------------------------------ batching

  private applyBlend(): void {
    const gl = this.gl;
    if (this.blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else if (this.blend === 'sum') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  setBlend(b: Blend): void {
    if (b === this.blend) return;
    this.flush();
    this.blend = b;
    this.applyBlend();
  }

  flush(): void {
    if (this.n === 0) return;
    const gl = this.gl;
    this.atlas.upload();
    gl.useProgram(this.prim);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.u(this.prim, 'u_view'), this.vw, this.vh);
    this.bindTex(this.atlas.texture, 0);
    gl.uniform1i(this.u(this.prim, 'u_tex'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.n * STRIDE);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    this.n = 0;
  }

  private vert(x: number, y: number, u: number, v: number, c: RGBA): void {
    const t = this.tf;
    const i = this.n * STRIDE;
    this.f32[i] = t[0] * x + t[2] * y + t[4];
    this.f32[i + 1] = t[1] * x + t[3] * y + t[5];
    this.f32[i + 2] = u;
    this.f32[i + 3] = v;
    this.u32[i + 4] = c;
    this.n++;
  }

  private room(verts: number): void {
    if (this.n + verts > MAX_VERTS) this.flush();
  }

  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c1: RGBA, c2 = c1, c3 = c1): void {
    if (alphaOf(c1) === 0 && alphaOf(c2) === 0 && alphaOf(c3) === 0) return;
    this.room(3);
    const w = this.atlas.white;
    this.vert(x1, y1, w.u, w.v, c1);
    this.vert(x2, y2, w.u, w.v, c2);
    this.vert(x3, y3, w.u, w.v, c3);
  }

  // ------------------------------------------------------------ transforms

  save(): void {
    this.stack.push(this.tf.slice());
  }
  restore(): void {
    this.tf = this.stack.pop() ?? [1, 0, 0, 1, 0, 0];
  }
  translate(x: number, y: number): void {
    const t = this.tf;
    t[4] += t[0] * x + t[2] * y;
    t[5] += t[1] * x + t[3] * y;
  }
  rotate(a: number): void {
    const t = this.tf;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const [a0, b0, c0, d0] = t;
    t[0] = a0 * c + c0 * s;
    t[1] = b0 * c + d0 * s;
    t[2] = a0 * -s + c0 * c;
    t[3] = b0 * -s + d0 * c;
  }
  scale(sx: number, sy = sx): void {
    const t = this.tf;
    t[0] *= sx;
    t[1] *= sx;
    t[2] *= sy;
    t[3] *= sy;
  }

  // ------------------------------------------------------------ shapes

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    this.tri(x, y, x + w, y, x + w, y + h, c);
    this.tri(x, y, x + w, y + h, x, y + h, c);
  }

  rectGrad(x: number, y: number, w: number, h: number, top: RGBA, bottom: RGBA): void {
    this.tri(x, y, x + w, y, x + w, y + h, top, top, bottom);
    this.tri(x, y, x + w, y + h, x, y + h, top, bottom, bottom);
  }

  rectLine(x: number, y: number, w: number, h: number, lw: number, c: RGBA): void {
    this.rect(x, y, w, lw, c);
    this.rect(x, y + h - lw, w, lw, c);
    this.rect(x, y + lw, lw, h - 2 * lw, c);
    this.rect(x + w - lw, y + lw, lw, h - 2 * lw, c);
  }

  private segs(r: number): number {
    return Math.max(12, Math.min(64, Math.round(r * 0.7)));
  }

  circle(x: number, y: number, r: number, c: RGBA): void {
    this.ellipse(x, y, r, r, 0, c);
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, c: RGBA, cEdge = c): void {
    const n = this.segs(Math.max(rx, ry));
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    let px = x + cr * rx;
    let py = y + sr * rx;
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * TAU;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      const nx = x + ex * cr - ey * sr;
      const ny = y + ex * sr + ey * cr;
      this.tri(x, y, px, py, nx, ny, c, cEdge, cEdge);
      px = nx;
      py = ny;
    }
  }

  /** Radial gradient disc. */
  circleGrad(x: number, y: number, r: number, inner: RGBA, outer: RGBA): void {
    this.ellipse(x, y, r, r, 0, inner, outer);
  }

  /** Soft additive light: stand-in for canvas shadowBlur. */
  glow(x: number, y: number, r: number, c: RGBA): void {
    const prev = this.blend;
    this.setBlend('add');
    this.circleGrad(x, y, r, c, c & 0x00ffffff);
    this.setBlend(prev);
  }

  /** Filled polygon, fanned from its centroid (fine for star-shaped outlines). */
  poly(pts: Vec[], c: RGBA, cCenter = c): void {
    if (pts.length < 3) return;
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      this.tri(cx, cy, a.x, a.y, b.x, b.y, cCenter, c, c);
    }
  }

  line(a: Vec, b: Vec, w: number, c: RGBA, round = true): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    if (l === 0) {
      if (round) this.circle(a.x, a.y, w / 2, c);
      return;
    }
    const nx = (-dy / l) * (w / 2);
    const ny = (dx / l) * (w / 2);
    this.tri(a.x + nx, a.y + ny, b.x + nx, b.y + ny, b.x - nx, b.y - ny, c);
    this.tri(a.x + nx, a.y + ny, b.x - nx, b.y - ny, a.x - nx, a.y - ny, c);
    if (round && w > 3) {
      this.circle(a.x, a.y, w / 2, c);
      this.circle(b.x, b.y, w / 2, c);
    }
  }

  polyline(pts: Vec[], w: number, c: RGBA, closed = false): void {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1], pts[i], w, c, i === 1 || w > 3);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1], pts[0], w, c);
  }

  dashed(pts: Vec[], w: number, c: RGBA, dash: number, gap: number, offset = 0): void {
    let phase = ((offset % (dash + gap)) + dash + gap) % (dash + gap);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      let s = 0;
      while (s < l) {
        const inDash = phase < dash;
        const run = Math.min(l - s, inDash ? dash - phase : dash + gap - phase);
        if (inDash) {
          const t0 = s / l;
          const t1 = (s + run) / l;
          this.line({ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }, w, c, false);
        }
        s += run;
        phase = (phase + run) % (dash + gap);
      }
    }
  }

  /** Stroked arc from angle a0 sweeping `frac` of a full turn (clockwise from top by default). */
  arc(x: number, y: number, r: number, w: number, c: RGBA, frac = 1, a0 = -Math.PI / 2): void {
    const f = Math.max(0, Math.min(1, frac));
    if (f <= 0) return;
    const n = Math.max(6, Math.round(this.segs(r) * f));
    const ri = r - w / 2;
    const ro = r + w / 2;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (i / n) * TAU * f;
      const t1 = a0 + ((i + 1) / n) * TAU * f;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      this.tri(x + c0 * ri, y + s0 * ri, x + c0 * ro, y + s0 * ro, x + c1 * ro, y + s1 * ro, c);
      this.tri(x + c0 * ri, y + s0 * ri, x + c1 * ro, y + s1 * ro, x + c1 * ri, y + s1 * ri, c);
    }
  }

  quadCurve(a: Vec, ctrl: Vec, b: Vec, w: number, c: RGBA, steps = 12): void {
    const pts: Vec[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push({ x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y });
    }
    this.polyline(pts, w, c);
  }

  // ------------------------------------------------------------ text

  measure(str: string, size = 20, font: FontId = 'body'): number {
    return this.atlas.measure(str, font) * (size / this.atlas.baseSize);
  }

  text(str: string, x: number, y: number, o: TextOpts = {}): void {
    const size = o.size ?? 20;
    const font = o.font ?? 'body';
    const color = o.color ?? 0xffc0dce8;
    if (o.shadow !== false) this.textRaw(str, x + size * 0.06, y + size * 0.08, size, font, o.shadow ?? (0xb0000000 >>> 0), o.align ?? 'left');
    this.textRaw(str, x, y, size, font, color, o.align ?? 'left', o.color2 ?? color);
  }

  /** Word-wrapped text; returns the height used. */
  textBlock(str: string, x: number, y: number, width: number, o: TextOpts = {}, lineH = 1.35): number {
    const size = o.size ?? 20;
    const lines: string[] = [];
    for (const para of str.split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const tryLine = cur ? `${cur} ${word}` : word;
        if (this.measure(tryLine, size, o.font) > width && cur) {
          lines.push(cur);
          cur = word;
        } else cur = tryLine;
      }
      lines.push(cur);
    }
    lines.forEach((l, i) => this.text(l, x, y + i * size * lineH, o));
    return lines.length * size * lineH;
  }

  private textRaw(str: string, x: number, y: number, size: number, font: FontId, c: RGBA, align: Align, c2: RGBA = c): void {
    const s = size / this.atlas.baseSize;
    const w = this.atlas.measure(str, font) * s;
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const top = y - this.atlas.ascent(font) * s;
    for (const ch of str) {
      const g = this.atlas.glyph(ch, font);
      if (g.w > 0) {
        this.room(6);
        const x0 = cx + g.ox * s;
        const y0 = top + g.oy * s;
        const x1 = x0 + g.w * s;
        const y1 = y0 + g.h * s;
        this.vert(x0, y0, g.u0, g.v0, c);
        this.vert(x1, y0, g.u1, g.v0, c);
        this.vert(x1, y1, g.u1, g.v1, c2);
        this.vert(x0, y0, g.u0, g.v0, c);
        this.vert(x1, y1, g.u1, g.v1, c2);
        this.vert(x0, y1, g.u0, g.v1, c2);
      }
      cx += g.adv * s;
    }
  }
}
