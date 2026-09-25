import type { Vec } from '../core/math';
import { alphaOf, type RGBA } from './color';
import { GlyphAtlas, type FontId } from './text';
import { BLUR_FS, BRIGHT_FS, FLESH_FS, FLUID_FS, FULL_VS, IMAGE_FS, IMAGE_VS, PORTRAIT_FS, POST_FS, RECT_VS, SCENE_FS } from './shaders';
import { BATCH_FS, BATCH_UNITS, BATCH_VS, FALLBACK_VS, FXAA_FS } from './batch-shaders';
import { fallbackPlan, FULL_CAPS, probeCaps, toMediump, type FallbackPlan, type GpuCaps } from './caps';
import { emptyStats, GpuTimer, type FlushReason, type FrameStats } from './profiler';
import { GlRegistry } from './registry';
import { SpriteBank, type SpriteOpts } from './sprites';
import { RenderTargetPool, type Target } from './targets';
import { checkerPixels, Texture } from './texture';
import { scissorRect } from './viewport';

const TAU = Math.PI * 2;
const MAX_VERTS = 60000;
const STRIDE = 6; // x, y, u, v (f32) + rgba (u32) + texture unit (f32)
const UNITS = Array.from({ length: BATCH_UNITS }, (_, i) => i);
/** Scratch vectors for shape helpers (no per-call allocation, ENG-0225/0226). */
const SA: Vec = { x: 0, y: 0 };
const SB: Vec = { x: 0, y: 0 };

export type Blend = 'alpha' | 'add' | 'sum' | 'multiply' | 'screen';
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

export interface GfxOptions {
  /** Override the probed capabilities (tests, forced fallbacks). */
  caps?: GpuCaps;
  plan?: Partial<FallbackPlan>;
}

/** Unit-circle cos/sin tables per segment count (ENG-0023). */
const trigTables = new Map<number, Float32Array>();
function trig(n: number): Float32Array {
  let t = trigTables.get(n);
  if (!t) {
    t = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      t[i * 2] = Math.cos((i / n) * TAU);
      t[i * 2 + 1] = Math.sin((i / n) * TAU);
    }
    trigTables.set(n, t);
  }
  return t;
}

/**
 * Batched WebGL2 2D renderer in the game's virtual resolution. World drawing
 * goes to an offscreen target that is post-processed (bloom, grade, vignette,
 * Litany ripple); UI drawing goes straight to the screen afterwards.
 */
export class Gfx {
  readonly gl: WebGL2RenderingContext;
  /** Every GL object, for leak counts, VRAM budget and context restore (ENG-0198). */
  readonly registry: GlRegistry;
  readonly caps: GpuCaps;
  readonly plan: FallbackPlan;
  readonly targets: RenderTargetPool;
  readonly sprites = new SpriteBank();
  readonly gpuTimer: GpuTimer;
  /** Per-frame batcher counters (ENG-0024); reset by `resetStats()`. */
  stats: FrameStats = emptyStats();
  /** World render scale 0.5–1 of the backbuffer (ENG-0181); UI and text always render at native resolution. */
  renderScale = 1;
  private prim!: WebGLProgram;
  private flesh!: WebGLProgram;
  private bright!: WebGLProgram;
  private blur!: WebGLProgram;
  private post!: WebGLProgram;
  private fxaa!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private emptyVao!: WebGLVertexArrayObject;
  private vbo!: WebGLBuffer;
  private f32 = new Float32Array(MAX_VERTS * STRIDE);
  private u32 = new Uint32Array(this.f32.buffer);
  private n = 0;
  private blend: Blend = 'alpha';
  private tf = [1, 0, 0, 1, 0, 0];
  private stack: number[][] = [];
  private depth = 0;
  /** Texture bound to each batch unit (unit 0 = glyph atlas). */
  private slots: (WebGLTexture | null)[] = new Array(BATCH_UNITS).fill(null);
  private slotCount = 1;
  /** Texture unit written into vertices by `vert()` (0 = atlas/shapes). */
  private texUnit = 0;
  /** View transform uploaded as `u_xf`: aspect-policy origin × camera (ENG-0045/0182). */
  private xf = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  private camera: number[] | null = null;
  /** Margin (virtual units) left of / above the 1280×720 safe area on wide/tall windows. */
  ox = 0;
  oy = 0;
  private clipStack: { x: number; y: number; w: number; h: number }[] = [];
  private missing: Texture | null = null;
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
  private fluidProg!: WebGLProgram;
  private imageProg!: WebGLProgram;
  private sceneProg!: WebGLProgram;
  private portraitProg!: WebGLProgram;
  private images = new Map<string, ImageHandle>();
  /** Decoded image sources kept for re-upload after a context loss (ENG-0200). */
  private imageSources = new Map<ImageHandle, TexImageSource>();
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
    /** Visible view size in virtual units — the 1280×720 safe area plus aspect-ratio margins (see `setView`). */
    public vw: number,
    public vh: number,
    opts: GfxOptions = {},
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available on this system.');
    this.gl = gl;
    this.registry = new GlRegistry(gl);
    this.caps = opts.caps ?? (gl.isContextLost() ? FULL_CAPS : probeCaps(gl));
    this.plan = { ...fallbackPlan(this.caps), ...opts.plan };
    this.floatTargets = this.plan.bloomFormat === 'rgba16f';
    this.targets = new RenderTargetPool(this.registry, this.floatTargets);
    this.gpuTimer = new GpuTimer(this.registry);
    this.atlas = new GlyphAtlas(gl, this.registry);
    this.init();
    // Restore order: our programs/buffers first, then textures (order 10), then everything else.
    this.registry.onRestore(() => this.init(), 0);
  }

  /** Create programs, buffers and state. Runs at construction and again after a context restore. */
  private init(): void {
    const gl = this.gl;
    const reg = this.registry;
    this.uniforms.clear();
    // Extensions are per context: re-enable them after a restore or float targets come back incomplete.
    for (const e of ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'EXT_texture_filter_anisotropic', 'OES_texture_float_linear']) gl.getExtension(e);
    this.prim = reg.createProgram('batch', BATCH_VS, BATCH_FS);
    this.flesh = reg.createProgram('flesh', FULL_VS, this.plan.fleshVariant === 'mediump' ? toMediump(FLESH_FS) : FLESH_FS);
    this.bright = reg.createProgram('bright', FULL_VS, BRIGHT_FS);
    this.blur = reg.createProgram('blur', FULL_VS, BLUR_FS);
    this.post = reg.createProgram('post', FULL_VS, POST_FS);
    this.fxaa = reg.createProgram('fxaa', FALLBACK_VS, FXAA_FS);
    this.fluidProg = reg.createProgram('fluid', FULL_VS, FLUID_FS);
    this.imageProg = reg.createProgram('image', IMAGE_VS, IMAGE_FS);
    this.sceneProg = reg.createProgram('scene', FULL_VS, SCENE_FS);
    this.portraitProg = reg.createProgram('portrait', RECT_VS, PORTRAIT_FS);
    this.samples = this.plan.aa === 'msaa' ? Math.min(this.plan.msaaSamples, gl.getParameter(gl.MAX_SAMPLES) as number) : 0;

    this.vao = reg.createVertexArray('batch');
    this.emptyVao = reg.createVertexArray('fullscreen');
    gl.bindVertexArray(this.vao);
    this.vbo = reg.createBuffer('batch');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.f32.byteLength, gl.DYNAMIC_DRAW);
    reg.setBytes(this.vbo, this.f32.byteLength);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * 4, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE * 4, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE * 4, 20);
    gl.bindVertexArray(null);

    this.n = 0;
    this.pw = this.ph = 0;
    this.msaaFb = this.msaaRb = null;
    gl.enable(gl.BLEND);
    this.applyBlend();
  }

  // ------------------------------------------------------------ view, camera, context

  /**
   * Set the visible view (ENG-0182/0183): `w`×`h` virtual units, with the
   * 1280×720 safe area inset by `ox`,`oy`. Game code keeps drawing in
   * safe-area coordinates; the margins show more world (drape, backdrop).
   */
  setView(w: number, h: number, ox: number, oy: number): void {
    this.flush('camera');
    this.vw = w;
    this.vh = h;
    this.ox = ox;
    this.oy = oy;
    this.updateXf();
  }

  /** Visible rect in safe-area coordinates (for full-bleed fills). */
  viewRect(): { x: number; y: number; w: number; h: number } {
    return { x: -this.ox, y: -this.oy, w: this.vw, h: this.vh };
  }

  /** World camera matrix [a,b,c,d,e,f] (Camera2D.matrix()), or null for identity. Applied on the GPU (ENG-0045). */
  setCamera(m: ArrayLike<number> | null): void {
    if (m === null && this.camera === null) return;
    this.flush('camera');
    this.camera = m ? Array.from(m) : null;
    this.updateXf();
  }

  private updateXf(): void {
    const m = this.camera ?? [1, 0, 0, 1, 0, 0];
    const x = this.xf;
    // Column-major mat3 of T(ox, oy) · M.
    x[0] = m[0];
    x[1] = m[1];
    x[2] = 0;
    x[3] = m[2];
    x[4] = m[3];
    x[5] = 0;
    x[6] = m[4] + this.ox;
    x[7] = m[5] + this.oy;
    x[8] = 1;
  }

  /** Current tessellation scale: on-screen pixels per virtual unit including camera zoom (ENG-0050). */
  private lodScale(): number {
    const zoom = this.camera ? Math.hypot(this.camera[0], this.camera[1]) : 1;
    return Math.max(1, zoom * Math.max(1, (this.outH || this.vh) / this.vh));
  }

  /** Call on `webglcontextlost`: every handle is dead. */
  contextLost(): void {
    this.registry.contextLost();
    this.targets.forget();
    this.gpuTimer.reset();
    this.missing = null;
    this.n = 0;
  }

  /** Call on `webglcontextrestored`: recreate programs, buffers, textures, targets and images (ENG-0200). */
  contextRestored(): void {
    this.registry.contextRestored();
    this.gpuTimer.rebind();
    for (const [h, src] of this.imageSources) this.uploadImage(h, src);
  }

  /**
   * First-launch GPU micro-benchmark (ENG-0191): time the flesh pass for up to
   * `budgetMs`, returning ms per pass scaled to a 1920×1080 target.
   */
  benchmarkFlesh(budgetMs = 2000): number {
    const gl = this.gl;
    this.ensureTargets();
    const t = this.targets.acquire('bench', 960, 540);
    const f: FleshParams = { center: { x: 660, y: 410 }, radii: { x: 430, y: 250 }, kind: 0, base: [0.6, 0.2, 0.2], deep: [0.3, 0.05, 0.05], vein: [0.3, 0.1, 0.3], pulse: 0.5, light: { x: 440, y: 60 }, corrupt: 0.2 };
    const run = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      this.outW = t.w;
      this.outH = t.h;
      gl.viewport(0, 0, t.w, t.h);
      this.fleshPass(f);
    };
    run();
    gl.finish();
    const start = performance.now();
    let n = 0;
    while (performance.now() - start < budgetMs && n < 60) {
      run();
      gl.finish();
      n++;
    }
    const ms = (performance.now() - start) / Math.max(1, n);
    this.targets.release('bench');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ms * ((1920 * 1080) / (t.w * t.h));
  }

  /** Draw every program once off-screen so first use in play never hitches (ENG-0203). */
  prewarm(): void {
    const gl = this.gl;
    const t = this.targets.acquire('prewarm', 64, 36);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    this.outW = t.w;
    this.outH = t.h;
    gl.viewport(0, 0, t.w, t.h);
    gl.bindVertexArray(this.emptyVao);
    this.bindTex(this.atlas.texture, 1);
    this.bindTex(this.atlas.texture, 0);
    for (const p of [this.flesh, this.bright, this.blur, this.post, this.fxaa, this.fluidProg, this.sceneProg]) {
      gl.useProgram(p);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.rect(0, 0, 4, 4, 0xffffffff);
    this.flush('end');
    gl.useProgram(this.portraitProg);
    this.rectQuad(0, 0, 4, 4);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.useProgram(this.imageProg);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.finish();
    this.targets.release('prewarm');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Zero the per-frame counters (call at frame start); returns the finished frame's stats. */
  resetStats(): FrameStats {
    const s = this.stats;
    this.stats = emptyStats();
    return s;
  }

  private u(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.uniforms.get(p);
    if (!m) this.uniforms.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  /** World target size: the backbuffer scaled by the render-scale setting (ENG-0181). */
  worldSize(): { w: number; h: number } {
    const s = Math.max(0.5, Math.min(1, this.renderScale));
    return { w: Math.max(1, Math.round(this.canvas.width * s)), h: Math.max(1, Math.round(this.canvas.height * s)) };
  }

  private ensureTargets(): void {
    const { w, h } = this.worldSize();
    if (w === this.pw && h === this.ph && this.scene && this.targets.get('scene') === this.scene) return;
    const P = this.targets;
    this.scene = P.acquire('scene', w, h);
    const bw = Math.max(1, w >> 2);
    const bh = Math.max(1, h >> 2);
    this.bloomA = P.acquire('bloomA', bw, bh, { format: this.plan.bloomFormat });
    this.bloomB = P.acquire('bloomB', bw, bh, { format: this.plan.bloomFormat });
    const hw = Math.max(1, Math.round(w * 0.6));
    const hh = Math.max(1, Math.round(h * 0.6));
    this.surface = P.acquire('surface', hw, hh);
    this.fluid = P.acquire('fluid', hw, hh, { format: this.floatTargets ? 'rgba16f' : 'rgba8' });
    // Multisampled world target, resolved into `scene` before post-processing.
    const gl = this.gl;
    const reg = this.registry;
    reg.release(this.msaaRb);
    reg.release(this.msaaFb);
    this.msaaFb = this.msaaRb = null;
    if (this.samples > 1) {
      this.msaaRb = reg.createRenderbuffer('msaa world');
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA8, w, h);
      reg.setBytes(this.msaaRb, w * h * 4 * this.samples);
      this.msaaFb = reg.createFramebuffer('msaa world');
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
    this.gpuTimer.mark('world');
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
    this.flush('end');
    this.gpuTimer.mark('post');
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
    const world = this.antialiasWorld();

    // Bright pass → quarter res, then separable blur.
    this.bindTarget(this.bloomA);
    gl.useProgram(this.bright);
    this.bindTex(world, 0);
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
    this.bindTex(world, 0);
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
    this.stats.drawCalls += 6;

    gl.enable(gl.BLEND);
    this.applyBlend();
    this.tf = [1, 0, 0, 1, 0, 0];
    this.setCamera(null);
    this.gpuTimer.mark('ui');
  }

  /** FXAA fallback when the world target has no MSAA (ENG-0193); returns the texture post should read. */
  private antialiasWorld(): WebGLTexture {
    if (this.plan.aa !== 'fxaa' || this.msaaFb) return this.scene.tex;
    const gl = this.gl;
    const out = this.targets.acquire('fxaa', this.scene.w, this.scene.h);
    this.bindTarget(out);
    gl.useProgram(this.fxaa);
    this.bindTex(this.scene.tex, 0);
    gl.uniform1i(this.u(this.fxaa, 'u_tex'), 0);
    gl.uniform2f(this.u(this.fxaa, 'u_texel'), 1 / this.scene.w, 1 / this.scene.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.drawCalls++;
    return out.tex;
  }

  /** Draw a screen with no world layer (menus, story): UI straight to the screen. */
  beginScreen(clear: [number, number, number] = [0.03, 0.025, 0.025]): void {
    this.gpuTimer.mark('ui');
    this.setCamera(null);
    this.bindTarget(null);
    this.gl.clearColor(clear[0], clear[1], clear[2], 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  endFrame(): void {
    this.flush('end');
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
      this.imageSources.set(handle, img);
      this.uploadImage(handle, img);
    };
    img.src = url;
    return handle;
  }

  private uploadImage(handle: ImageHandle, img: TexImageSource): void {
    const gl = this.gl;
    const tex = this.registry.createTexture('image');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const el = img as HTMLImageElement;
    const w = el.naturalWidth ?? (img as ImageBitmap).width;
    const h = el.naturalHeight ?? (img as ImageBitmap).height;
    this.registry.setBytes(tex, Math.round(w * h * 4 * (4 / 3)));
    this.stats.textureUploads++;
    Object.assign(handle, { tex, w, h, ready: true });
  }

  /** Draw an image into a rect (virtual coords) with period grading. */
  drawImage(h: ImageHandle, x: number, y: number, w: number, hgt: number, o: ImageOpts = {}): void {
    if (!h.ready || !h.tex) return;
    this.flush('program');
    x += this.ox;
    y += this.oy;
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
      this.f32[b + 5] = 0;
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
    this.flush('program');
    this.gpuTimer.mark('layers');
    this.bindTarget(which === 'surface' ? this.surface : this.fluid);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.blend = 'sum';
    this.applyBlend();
    this.tf = [1, 0, 0, 1, 0, 0];
  }

  endLayer(): void {
    this.flush('end');
    this.blend = 'alpha';
    this.applyBlend();
  }

  /** Composite the liquid layer into the world as glossy, merging fluid. Call after beginWorld. */
  fluidComposite(light: Vec): void {
    this.flush('program');
    this.worldFb();
    this.stats.drawCalls++;
    light = { x: light.x + this.ox, y: light.y + this.oy };
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

  /** Upload one quad covering a rect with 0..1 UVs, using the batch VBO. */
  private rectQuad(x: number, y: number, w: number, h: number): void {
    x += this.ox;
    y += this.oy;
    const q = [x, y, 0, 0, x + w, y, 1, 0, x + w, y + h, 1, 1, x, y, 0, 0, x + w, y + h, 1, 1, x, y + h, 0, 1];
    for (let i = 0; i < 6; i++) {
      const b = i * STRIDE;
      this.f32[b] = q[i * 4];
      this.f32[b + 1] = q[i * 4 + 1];
      this.f32[b + 2] = q[i * 4 + 2];
      this.f32[b + 3] = q[i * 4 + 3];
      this.u32[b + 4] = 0xffffffff;
      this.f32[b + 5] = 0;
    }
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, 6 * STRIDE);
  }

  /** Raymarched, candle-lit character bust drawn into a rect (see PORTRAIT_FS). */
  portrait(x: number, y: number, w: number, h: number, p: { style: number; rim: [number, number, number]; cloth: [number, number, number]; skin: [number, number, number]; active: number; seed: number; talk: number; beard?: number; hair?: [number, number, number] }): void {
    this.flush('program');
    this.stats.drawCalls++;
    const gl = this.gl;
    const pr = this.portraitProg;
    gl.useProgram(pr);
    this.rectQuad(x, y, w, h);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1i(this.u(pr, 'u_style'), p.style);
    gl.uniform3fv(this.u(pr, 'u_rim'), p.rim);
    gl.uniform3fv(this.u(pr, 'u_cloth'), p.cloth);
    gl.uniform3fv(this.u(pr, 'u_skin'), p.skin);
    gl.uniform1f(this.u(pr, 'u_active'), p.active);
    gl.uniform1f(this.u(pr, 'u_seed'), p.seed);
    gl.uniform1f(this.u(pr, 'u_talk'), p.talk);
    gl.uniform1i(this.u(pr, 'u_beard'), p.beard ?? 0);
    gl.uniform3fv(this.u(pr, 'u_hair'), p.hair ?? [0.12, 0.08, 0.06]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Shader-rendered story environment (0 hospice … 5 camp) over the whole world target. */
  sceneField(kind: number): void {
    this.flush('program');
    this.worldFb();
    this.stats.drawCalls++;
    const gl = this.gl;
    const pr = this.sceneProg;
    gl.useProgram(pr);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1i(this.u(pr, 'u_kind'), kind);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }

  /** Draw the procedural body field over the whole world target. */
  fleshField(f: FleshParams): void {
    this.flush('program');
    this.worldFb();
    this.stats.drawCalls++;
    // Field coordinates are safe-area space; shaders see the full view, so shift by the margin.
    this.fleshPass({ ...f, center: { x: f.center.x + this.ox, y: f.center.y + this.oy }, light: { x: f.light.x + this.ox, y: f.light.y + this.oy } });
  }

  private fleshPass(f: FleshParams): void {
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
    // Multiply: dst × src, faded toward dst by alpha. Screen: 1 − (1 − dst)(1 − src).
    else if (this.blend === 'multiply') gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    else if (this.blend === 'screen') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  setBlend(b: Blend): void {
    if (b === this.blend) return;
    this.flush('blend');
    this.blend = b;
    this.applyBlend();
  }

  get currentBlend(): Blend {
    return this.blend;
  }

  /** Draw with a blend mode, restoring the previous one even if `fn` throws (ENG-0026). */
  withBlend(b: Blend, fn: () => void): void {
    const prev = this.blend;
    this.setBlend(b);
    try {
      fn();
    } finally {
      this.setBlend(prev);
    }
  }

  flush(reason: FlushReason = 'program'): void {
    if (this.n === 0) return;
    const gl = this.gl;
    const st = this.stats;
    st.drawCalls++;
    st.vertices += this.n;
    st.flushes[reason]++;
    if (this.atlas.upload()) st.textureUploads++;
    const pr = this.prim;
    gl.useProgram(pr);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniformMatrix3fv(this.u(pr, 'u_xf'), false, this.xf);
    this.slots[0] = this.atlas.texture;
    for (let i = BATCH_UNITS - 1; i >= 0; i--) this.bindTex(this.slots[i] ?? this.atlas.texture, i);
    gl.uniform1iv(this.u(pr, 'u_tex'), UNITS);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.n * STRIDE);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    this.n = 0;
    for (let i = 1; i < BATCH_UNITS; i++) this.slots[i] = null;
    this.slotCount = 1;
  }

  /** Batch unit for `tex`, flushing when all 8 units are taken (ENG-0031). */
  private unitFor(tex: WebGLTexture): number {
    for (let i = 1; i < this.slotCount; i++) if (this.slots[i] === tex) return i;
    if (this.slotCount >= BATCH_UNITS) this.flush('texture');
    this.slots[this.slotCount] = tex;
    return this.slotCount++;
  }

  private vert(x: number, y: number, u: number, v: number, c: RGBA): void {
    const t = this.tf;
    const i = this.n * STRIDE;
    this.f32[i] = t[0] * x + t[2] * y + t[4];
    this.f32[i + 1] = t[1] * x + t[3] * y + t[5];
    this.f32[i + 2] = u;
    this.f32[i + 3] = v;
    this.u32[i + 4] = c;
    this.f32[i + 5] = this.texUnit;
    this.n++;
  }

  private room(verts: number): void {
    if (this.n + verts > MAX_VERTS) this.flush('overflow');
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
    // Pooled stack entries: no allocation per save() in steady state (ENG-0225).
    let e = this.stack[this.depth];
    if (!e) this.stack.push((e = [0, 0, 0, 0, 0, 0]));
    for (let i = 0; i < 6; i++) e[i] = this.tf[i];
    this.depth++;
  }
  restore(): void {
    if (this.depth === 0) {
      this.tf = [1, 0, 0, 1, 0, 0];
      return;
    }
    const e = this.stack[--this.depth];
    for (let i = 0; i < 6; i++) this.tf[i] = e[i];
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
    return Math.max(12, Math.min(64, Math.round(r * 0.7 * this.lodScale())));
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
    const tb = trig(n);
    for (let i = 1; i <= n; i++) {
      const ex = tb[i * 2] * rx;
      const ey = tb[i * 2 + 1] * ry;
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
          SA.x = a.x + (b.x - a.x) * t0;
          SA.y = a.y + (b.y - a.y) * t0;
          SB.x = a.x + (b.x - a.x) * t1;
          SB.y = a.y + (b.y - a.y) * t1;
          this.line(SA, SB, w, c, false);
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
    // Same output as polyline over the sampled points, without building an array (ENG-0225).
    SA.x = a.x;
    SA.y = a.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      SB.x = u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x;
      SB.y = u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y;
      this.line(SA, SB, w, c, i === 1 || w > 3);
      SA.x = SB.x;
      SA.y = SB.y;
    }
  }

  // ------------------------------------------------------------ sprites, meshes, clipping

  /** Magenta checker bound in place of any missing sprite frame (ENG-0210). */
  private missingTexture(): Texture {
    if (!this.missing) this.missing = new Texture(this.registry, checkerPixels(), { filter: 'nearest', label: 'missing-checker' });
    return this.missing;
  }

  /**
   * Draw a sprite-sheet frame (ENG-0032) centred on its pivot at (x, y).
   * Frames from up to 7 pages batch with shapes and text in one draw call.
   */
  sprite(frameId: string, x: number, y: number, o: SpriteOpts = {}): void {
    const f = this.sprites.get(frameId);
    let tex: WebGLTexture;
    let u0 = 0, v0 = 0, u1 = 1, v1 = 1, fw = 32, fh = 32, px = 0.5, py = 0.5;
    if (f) {
      ({ tex, u0, v0, u1, v1, w: fw, h: fh, px, py } = f);
    } else {
      if (import.meta.env.DEV) console.warn(`sprite: missing frame "${frameId}"`);
      tex = this.missingTexture().tex;
    }
    if (o.pivot) {
      px = o.pivot.x;
      py = o.pivot.y;
    }
    const sx = (typeof o.scale === 'object' ? o.scale.x : o.scale ?? 1) * (o.flipX ? -1 : 1);
    const sy = (typeof o.scale === 'object' ? o.scale.y : o.scale ?? 1) * (o.flipY ? -1 : 1);
    let tint = (o.tint ?? 0xffffffff) >>> 0;
    if (o.alpha !== undefined) tint = ((Math.round(((tint >>> 24) & 255) * Math.max(0, Math.min(1, o.alpha))) << 24) | (tint & 0xffffff)) >>> 0;
    this.room(6);
    const unit = this.unitFor(tex);
    this.save();
    this.translate(x, y);
    if (o.rot) this.rotate(o.rot);
    this.scale(sx, sy);
    const x0 = -px * fw;
    const y0 = -py * fh;
    const x1 = x0 + fw;
    const y1 = y0 + fh;
    this.texUnit = unit;
    this.vert(x0, y0, u0, v0, tint);
    this.vert(x1, y0, u1, v0, tint);
    this.vert(x1, y1, u1, v1, tint);
    this.vert(x0, y0, u0, v0, tint);
    this.vert(x1, y1, u1, v1, tint);
    this.vert(x0, y1, u0, v1, tint);
    this.texUnit = 0;
    this.restore();
  }

  /**
   * Nine-slice a frame into `r` (ENG-0035): corners keep their pixel size,
   * edges stretch along one axis, the centre stretches both. `insets` are in
   * frame pixels (left, top, right, bottom).
   */
  nineSlice(frameId: string, r: { x: number; y: number; w: number; h: number }, insets: { l: number; t: number; r: number; b: number }, tint: RGBA = 0xffffffff): void {
    const f = this.sprites.get(frameId);
    if (!f) return this.sprite(frameId, r.x + r.w / 2, r.y + r.h / 2, { scale: { x: r.w / 32, y: r.h / 32 } });
    const du = (f.u1 - f.u0) / f.w;
    const dv = (f.v1 - f.v0) / f.h;
    // Corners shrink proportionally only if the rect is smaller than the two insets.
    const k = Math.min(1, r.w / Math.max(1, insets.l + insets.r), r.h / Math.max(1, insets.t + insets.b));
    const xs = [r.x, r.x + insets.l * k, r.x + r.w - insets.r * k, r.x + r.w];
    const ys = [r.y, r.y + insets.t * k, r.y + r.h - insets.b * k, r.y + r.h];
    const us = [f.u0, f.u0 + insets.l * du, f.u1 - insets.r * du, f.u1];
    const vs = [f.v0, f.v0 + insets.t * dv, f.v1 - insets.b * dv, f.v1];
    this.room(54);
    this.texUnit = this.unitFor(f.tex);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) {
        if (xs[i + 1] <= xs[i] || ys[j + 1] <= ys[j]) continue;
        this.vert(xs[i], ys[j], us[i], vs[j], tint);
        this.vert(xs[i + 1], ys[j], us[i + 1], vs[j], tint);
        this.vert(xs[i + 1], ys[j + 1], us[i + 1], vs[j + 1], tint);
        this.vert(xs[i], ys[j], us[i], vs[j], tint);
        this.vert(xs[i + 1], ys[j + 1], us[i + 1], vs[j + 1], tint);
        this.vert(xs[i], ys[j + 1], us[i], vs[j + 1], tint);
      }
    this.texUnit = 0;
  }

  /**
   * Textured indexed mesh (ENG-0039): `verts`/`uvs` are flat [x,y,…] arrays,
   * `indices` triangles; `tex` a texture, a sprite frame id (uvs are then
   * frame-relative 0..1) or null for untextured (vertex colour only).
   */
  mesh(verts: ArrayLike<number>, uvs: ArrayLike<number> | null, indices: ArrayLike<number>, tex: WebGLTexture | string | null, color: RGBA = 0xffffffff): void {
    let u0 = 0, v0 = 0, su = 1, sv = 1;
    let t: WebGLTexture | null = null;
    if (typeof tex === 'string') {
      const f = this.sprites.get(tex);
      t = f ? f.tex : this.missingTexture().tex;
      if (f) {
        u0 = f.u0;
        v0 = f.v0;
        su = f.u1 - f.u0;
        sv = f.v1 - f.v0;
      }
    } else t = tex;
    const w = this.atlas.white;
    for (let i = 0; i + 2 < indices.length; i += 3) {
      this.room(3);
      this.texUnit = t ? this.unitFor(t) : 0;
      for (let k = 0; k < 3; k++) {
        const j = indices[i + k];
        const u = t && uvs ? u0 + uvs[j * 2] * su : w.u;
        const v = t && uvs ? v0 + uvs[j * 2 + 1] * sv : w.v;
        this.vert(verts[j * 2], verts[j * 2 + 1], u, v, color);
      }
    }
    this.texUnit = 0;
  }

  /**
   * Push a scissor clip in safe-area virtual coordinates (ENG-0027); nested
   * clips intersect. Only valid on the screen (UI) layer or world target; the
   * rect is converted to device pixels of the current target.
   */
  pushClip(r: { x: number; y: number; w: number; h: number }): void {
    this.flush('clip');
    const top = this.clipStack[this.clipStack.length - 1];
    let c = { ...r };
    if (top) {
      const x0 = Math.max(top.x, c.x);
      const y0 = Math.max(top.y, c.y);
      const x1 = Math.min(top.x + top.w, c.x + c.w);
      const y1 = Math.min(top.y + top.h, c.y + c.h);
      c = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    }
    this.clipStack.push(c);
    this.applyClip();
  }

  popClip(): void {
    this.flush('clip');
    this.clipStack.pop();
    this.applyClip();
  }

  private applyClip(): void {
    const gl = this.gl;
    const c = this.clipStack[this.clipStack.length - 1];
    if (!c) {
      gl.disable(gl.SCISSOR_TEST);
      return;
    }
    const d = scissorRect(c, { w: this.vw, h: this.vh, ox: this.ox, oy: this.oy }, this.outW || this.canvas.width, this.outH || this.canvas.height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(d.x, d.y, d.w, d.h);
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
