import type { Vec } from '../core/math';
import { alphaOf, hex, withAlpha, type RGBA } from './color';
import { bakeLut, GRADES, LUT_SIZE } from './lut';
import { fallbackHighlight, GlyphAtlas, readableFont, type FontId, type Glyph } from './text';
import { graphemes, TextLayouter, type LayoutOptions, type LaidGlyph, type TextLayout, type TextMeasurer } from './textLayout';
import { BRIGHT_FS, CREATURE_FS, DOWN_FS, FLUID_FS, FULL_VS, IMAGE_FS, IMAGE_VS, PORTRAIT_FS, POST_FS, RECT_VS, SCENE_FS, UP_FS } from './shaders';
import { BATCH_FS, BATCH_UNITS, BATCH_VS, FALLBACK_VS, FXAA_FS } from './batch-shaders';
import { fallbackPlan, FULL_CAPS, probeCaps, toMediump, type FallbackPlan, type GpuCaps } from './caps';
import { emptyStats, GpuTimer, type FlushReason, type FrameStats } from './profiler';
import { PostPipeline } from './postPasses';
import { bakedNoise } from './noiseBake';
import { fleshVariantKey, isQuality, SHADER_TIERS, type Quality } from './quality';
import { fleshShaderSource } from './shaders/flesh';
import { shakeOffset } from './shake';
import { GlRegistry } from './registry';
import { GlStateCache } from './stateCache';
import { SpriteBank, type SpriteOpts } from './sprites';
import { RenderTargetPool, type Target } from './targets';
import { checkerPixels, Texture } from './texture';
import { scissorRect } from './viewport';
import { UI_ART_FS } from '../art/uiShader';
import { AILMENT_FS } from './shaders/ailment';
import { PLATE_FS } from './shaders/plate';
import { SPECIES_PROFILES, type SpeciesLook } from '../surgery/species';
import { Renderer3D, type Scene3D } from './renderer3d';
import type { CurveAtlas } from './curves';
import { resolveBloom, type BloomSpec } from './bloom';
import { PARTICLE_FS, PARTICLE_SIZE_RANGE, PARTICLE_VS } from './shaders/particle';

/** Bilinear upsample of a reduced-resolution layer. */
export const UPSAMPLE_FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 o;
void main() { o = vec4(texture(u_tex, v_uv).rgb, 1.0); }`;
import type { DisplayPrefs } from '../ui/display';

const TAU = Math.PI * 2;
/** LQA fallback-glyph tint (LOC-0025). */
const MAGENTA: RGBA = hex('#ff00ff');

/** '#rrggbb' → [r, g, b] in 0..1. */
const rgb01 = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const MAX_VERTS = 60000;
/** Index budget: quads use 6 indices over 4 vertices (ENG-0020). */
const MAX_INDICES = 90000;
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
  /** Extra letter spacing in em (0.12 for engraved caps labels). */
  tracking?: number;
  /** Soft shadow: the shadow is drawn as a small blurred halo instead of one hard offset copy. */
  soft?: boolean;
}

export interface ImageHandle {
  tex: WebGLTexture | null;
  w: number;
  h: number;
  ready: boolean;
}

export interface PlateOpts {
  radius?: number;
  chamfer?: boolean;
  top?: RGBA;
  bottom?: RGBA;
  border?: RGBA;
  borderW?: number;
  inset?: RGBA;
  insetD?: number;
  bevel?: number;
  /** [alpha, blur px, offset y px]; alpha 0 disables. */
  shadow?: [number, number, number];
  glow?: RGBA;
  glowR?: number;
  grain?: number;
  alpha?: number;
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
  /** Tissue warp scale [x, y] about `center` (ART-0298, src/art/tissueWarp.ts); omitted = rim-only swell. */
  warp?: [number, number];
  light: Vec;
  corrupt: number;
  /** Voronoi edge softness per organ (smaller = crisper membranes). */
  cellSoft?: number;
  /** Base roughness per organ (0.35–0.6). */
  rough?: number;
  /** Gore level (UIX-0155): 0 full, 1 reduced, 2 minimal. */
  gore?: number;
  /** Up to 3 lights: position (virtual px), height, intensity, colour. */
  lights?: { x: number; y: number; h: number; i: number; col: [number, number, number] }[];
  /** The patient's people: skin, hide depth, scattering and blood (src/surgery/species.ts). */
  species?: SpeciesLook;
  /** Where the curse flows to (the Malison, virtual px); the corruption veins crawl toward it. Defaults to the field centre. */
  corruptAt?: Vec;
  /** Per-pixel corruption painted by the curse's sources (ENG-0099): the map and its view px → UV transform. Replaces the rim-in `corrupt` spread. */
  curseMap?: { tex: WebGLTexture; xf: Float32Array } | null;
  /** Venue (ENG-0272/0274): 0 hospice, 1 field triage, 2 forensic slab. */
  venue?: number;
  /** The Hour's corruption palette (src/art/curse.ts): vein glow and secondary (necrosis/scar) colour. */
  curse?: { vein: readonly [number, number, number]; accent: readonly [number, number, number] };
}

export interface PostParams {
  litany: number;
  danger: number;
  /** Screen offset in virtual px; ignored when `trauma` is given. */
  shake: Vec;
  /**
   * Trauma-based shake (ENG-0051): the sim's decaying `op.shake` (0–12) already multiplied by the
   * player's screen-shake setting. The renderer derives a smooth-noise offset from it and
   * presentation time, so the scene passes no random jitter and the sim stays pure.
   */
  trauma?: number;
  /** Bloom preset per scene type, with an optional intensity override (ENG-0149); a number is a menu-preset intensity. */
  bloom: BloomSpec;
  /** Chromatic aberration strength (curses, damage). */
  chroma?: number;
  /** Colour grade: multiplicative tint and lift, per chapter/location. */
  tint?: [number, number, number];
  lift?: [number, number, number];
  /** Colour grade: two named LUTs (see render/lut.ts) and the blend between them. */
  lutA?: string;
  lutB?: string;
  lutMix?: number;
  /** Litany ripple origin (0..1 screen, y up) and seconds since invoked. */
  litanyCenter?: [number, number];
  litanyAge?: number;
  /** Heartbeat pulse 0..1 (drives the low-vitals edge pulse). */
  beat?: number;
  /** Malison presence 0..1 (ink creeps from the frame edges). */
  curse?: number;
  /** Compline's silence 0..1 (ART-0258): desaturate and chalk-hatch the frame. */
  silence?: number;
  /** [flatline 0..1, victory 0..1] outcome transitions. */
  outcome?: [number, number];
  /** Bloom threshold override (per scene preset). */
  bloomThreshold?: number;
  /** Scrying Lens: centre (virtual px), radius (virtual px), strength 0..1. */
  lens?: [number, number, number, number];
  /** Hexstone refraction regions (ENG-0106): up to 6 of [x, y, radius px, strength], view px. */
  refract?: readonly [number, number, number, number][];
  /** Heat-shimmer regions (ENG-0263): up to 4 of [x, y, radius px, strength 0..1], view px. */
  shimmer?: readonly [number, number, number, number][];
  /** Damage flash: direction from screen centre (virtual px) and intensity 0..1. */
  hurt?: [number, number, number];
  /** Depth-of-field blur for menu backdrops, in virtual px (0 = sharp). */
  defocus?: number;
  /** Operating lamp: ellipse centre and radii in virtual px, and how dark the surround falls (0..1). */
  spot?: { cx: number; cy: number; rx: number; ry: number; k: number };
}

export interface GfxOptions {
  /** Override the probed capabilities (tests, forced fallbacks). */
  caps?: GpuCaps;
  plan?: Partial<FallbackPlan>;
}

/**
 * A baked text run (ENG-0177): the glyphs of one string in one face and raster tier with their pen
 * positions (layout units, kerning applied), reused while the atlas page is unchanged so labels
 * drawn every frame skip segmentation, glyph lookups and kerning.
 */
interface TextRun {
  gen: number;
  base: Glyph[];
  tiered: Glyph[];
  pens: Float32Array;
  width: number;
}
const MAX_RUNS = 4096;

/** Options for drawing a laid-out text block (`Gfx.drawLayout`). */
export interface DrawLayoutOpts {
  /** Default glyph colour (spans with `[color]` override it). */
  color?: RGBA;
  color2?: RGBA;
  shadow?: RGBA | false;
  /** Glyphs revealed (typewriter, ENG-0175); all when omitted. */
  reveal?: number;
  /** Draws inline icons and key caps (`[icon=…]`, `[key=…]`) at the pen position; x/y are the glyph box's left and baseline. */
  icon?: (g: Gfx, icon: NonNullable<LaidGlyph['icon']>, x: number, baseline: number, size: number, w: number) => void;
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
  readonly stateCache: GlStateCache;
  /** Every GL object, for leak counts, VRAM budget and context restore (ENG-0198). */
  readonly registry: GlRegistry;
  /** Player display options as renderer multipliers (UIX-0105); the shell refreshes it every frame. */
  readonly displayPrefs: DisplayPrefs = { bloom: 1, grain: 1, vignette: 1, gamma: 1, flicker: 1, chroma: 1, still: 0, flash: 1 };
  /** The post-process pass list with its runtime enable flags (ENG-0146); the debug console toggles passes here. */
  readonly postChain = new PostPipeline();
  readonly caps: GpuCaps;
  readonly plan: FallbackPlan;
  readonly targets: RenderTargetPool;
  readonly sprites = new SpriteBank();
  readonly gpuTimer: GpuTimer;
  /** Per-frame batcher counters (ENG-0024); reset by `resetStats()`. */
  stats: FrameStats = emptyStats();
  /** The last finished frame's counters (for budget reports and automation). */
  lastStats: FrameStats = emptyStats();
  /** World render scale 0.5–1 of the backbuffer (ENG-0181); UI and text always render at native resolution. */
  renderScale = 1;
  /** Shader quality tier in effect (ENG-0082); `setShaderQuality` changes it, `displayPrefs.quality` applies it lazily. */
  shaderQuality: Quality = 'high';
  /** Debug override of the tier's noise source (`live` re-evaluates the noise per pixel for A/B checks). */
  noiseOverride: 'baked' | 'live' | null = null;
  private fleshKey = '';
  /** Baked tiling noise (ENG-0081): fbm + gradient, and voronoi feature distances. */
  private noiseTex: WebGLTexture | null = null;
  private cellsTex: WebGLTexture | null = null;
  private prim!: WebGLProgram;
  private flesh!: WebGLProgram;
  private bright!: WebGLProgram;
  private post!: WebGLProgram;
  private fxaa!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private emptyVao!: WebGLVertexArrayObject;
  private vbo!: WebGLBuffer;
  private f32 = new Float32Array(MAX_VERTS * STRIDE);
  private u32 = new Uint32Array(this.f32.buffer);
  private n = 0;
  /** Indexed batch (ENG-0020): rects, glyphs and sprites are 4 vertices + 6 indices. */
  private idx = new Uint16Array(MAX_INDICES);
  private ni = 0;
  private ibo!: WebGLBuffer;
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
  private creatureProg!: WebGLProgram;
  private downProg!: WebGLProgram;
  private upProg!: WebGLProgram;
  /** Bloom mip chain (1/2 … 1/32). */
  private mips: Target[] = [];
  private luts = new Map<string, WebGLTexture>();
  private pw = 0;
  private ph = 0;
  readonly atlas: GlyphAtlas;
  /** Static text cache (ENG-0177); `textCache = false` bypasses it (A/B timing). */
  private runs = new Map<string, TextRun>();
  textCache = true;
  /** Cached text layouts (ENG-0173) measured with the glyph atlas. */
  readonly layouter: TextLayouter;
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
    const raw = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!raw) throw new Error('WebGL2 is not available on this system.');
    // Every GL call goes through the state cache (ENG-0029): redundant binds and state sets are dropped.
    this.stateCache = new GlStateCache(raw);
    const gl = (this.gl = this.stateCache.gl);
    this.registry = new GlRegistry(gl);
    this.caps = opts.caps ?? (gl.isContextLost() ? FULL_CAPS : probeCaps(gl));
    this.plan = { ...fallbackPlan(this.caps), ...opts.plan };
    this.floatTargets = this.plan.bloomFormat === 'rgba16f';
    this.targets = new RenderTargetPool(this.registry, this.floatTargets);
    this.gpuTimer = new GpuTimer(this.registry);
    this.atlas = new GlyphAtlas(gl, this.registry);
    const atlas = this.atlas;
    const measurer: TextMeasurer = {
      baseSize: atlas.baseSize,
      advance: (c, f) => atlas.glyph(c, f).adv,
      kern: (a, b, f) => atlas.kern(a, b, f),
      get generation() {
        return atlas.generation * 2 + (readableFont() ? 1 : 0);
      },
    };
    this.layouter = new TextLayouter(measurer);
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
    // The flesh program follows the quality tier (ENG-0082) and samples the baked noise (ENG-0081).
    this.fleshKey = '';
    this.compileFlesh();
    this.uploadNoise();
    this.bright = reg.createProgram('bright', FULL_VS, BRIGHT_FS);
        this.post = reg.createProgram('post', FULL_VS, POST_FS);
    this.fxaa = reg.createProgram('fxaa', FALLBACK_VS, FXAA_FS);
    this.fluidProg = reg.createProgram('fluid', FULL_VS, FLUID_FS);
    this.imageProg = reg.createProgram('image', IMAGE_VS, IMAGE_FS);
    this.sceneProg = reg.createProgram('scene', FULL_VS, SCENE_FS);
    this.portraitProg = reg.createProgram('portrait', RECT_VS, PORTRAIT_FS);
    this.creatureProg = reg.createProgram('creature', RECT_VS, CREATURE_FS);
    // Lazily compiled programs belong to the old context after a restore.
    this.sceneProgs.clear();
    this.uiArtProg = null;
    this.plateProg = null;
    this.part = null;
    this.upsampleProg = null;
    this.downProg = reg.createProgram('bloom-down', FULL_VS, DOWN_FS);
    this.upProg = reg.createProgram('bloom-up', FULL_VS, UP_FS);
    // LUT textures belong to the old context after a restore; they are rebaked lazily.
    this.luts.clear();
    this.samples = this.plan.aa === 'msaa' ? Math.min(this.plan.msaaSamples, gl.getParameter(gl.MAX_SAMPLES) as number) : 0;

    this.vao = reg.createVertexArray('batch');
    this.emptyVao = reg.createVertexArray('fullscreen');
    gl.bindVertexArray(this.vao);
    this.vbo = reg.createBuffer('batch');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.f32.byteLength, gl.DYNAMIC_DRAW);
    reg.setBytes(this.vbo, this.f32.byteLength);
    // The element buffer belongs to the batch VAO.
    this.ibo = reg.createBuffer('batch indices');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.idx.byteLength, gl.DYNAMIC_DRAW);
    reg.setBytes(this.ibo, this.idx.byteLength);
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
    this.ni = 0;
    this.pw = this.ph = 0;
    this.msaaFb = this.msaaRb = this.msaaDepth = null;
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

  /** The last field snapshot (ENG-0122): the finished world target at 480×270, until the next one. */
  fieldSnapshot: Target | null = null;
  private snapshotGen = 0;
  private snapshotUrl: { gen: number; url: string | null } = { gen: -1, url: null };

  /**
   * Copy the world target (call after `endWorld`) into a small RGBA8 texture — the results screen
   * shows it and the save slot keeps it as a thumbnail. Returns the snapshot target.
   */
  snapshotWorld(w = 480, h = 270): Target {
    this.flush('program');
    const gl = this.gl;
    const t = this.targets.acquire('field-snapshot', w, h);
    this.bindTarget(t);
    const up = (this.upsampleProg ??= this.registry.createProgram('scene-upsample', FULL_VS, UPSAMPLE_FS));
    gl.useProgram(up);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
    this.bindTex(this.scene.tex, 0);
    gl.uniform1i(this.u(up, 'u_tex'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.drawCalls++;
    gl.enable(gl.BLEND);
    this.applyBlend();
    this.bindTarget(null);
    this.fieldSnapshot = t;
    this.snapshotGen++;
    return t;
  }

  /** The field snapshot as a small JPEG data URL for save-slot thumbnails (cached per snapshot). */
  fieldSnapshotDataUrl(w = 192, h = 108): string | null {
    const t = this.fieldSnapshot;
    if (!t || typeof document === 'undefined') return null;
    if (this.snapshotUrl.gen === this.snapshotGen) return this.snapshotUrl.url;
    let url: string | null;
    try {
      const gl = this.gl;
      const px = new Uint8ClampedArray(t.w * t.h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // GL rows run bottom-up: flip while copying into the canvas.
      const src = document.createElement('canvas');
      src.width = t.w;
      src.height = t.h;
      const ctx = src.getContext('2d')!;
      const img = ctx.createImageData(t.w, t.h);
      for (let y = 0; y < t.h; y++) img.data.set(px.subarray((t.h - 1 - y) * t.w * 4, (t.h - y) * t.w * 4), y * t.w * 4);
      ctx.putImageData(img, 0, 0);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')?.drawImage(src, 0, 0, w, h);
      url = c.toDataURL('image/jpeg', 0.7);
    } catch {
      url = null;
    }
    this.snapshotUrl = { gen: this.snapshotGen, url };
    return url;
  }

  /** The view transform uploaded as `u_xf` (safe-area origin × camera), for custom world-space passes. */
  viewTransform(): Float32Array {
    return this.xf;
  }

  /** Re-apply the batch blend state after a pass changed GL blending directly. */
  resyncBlend(): void {
    this.gl.enable(this.gl.BLEND);
    this.applyBlend();
  }

  /** Current tessellation scale: on-screen pixels per virtual unit including camera zoom (ENG-0050). */
  private lodScale(): number {
    const zoom = this.camera ? Math.hypot(this.camera[0], this.camera[1]) : 1;
    return Math.max(1, zoom * Math.max(1, (this.outH || this.vh) / this.vh));
  }

  /** Call on `webglcontextlost`: every handle is dead. */
  contextLost(): void {
    this.stateCache.reset();
    this.registry.contextLost();
    this.targets.forget();
    this.gpuTimer.reset();
    this.missing = null;
    this.n = 0;
  }

  /** Call on `webglcontextrestored`: recreate programs, buffers, textures, targets and images (ENG-0200). */
  contextRestored(): void {
    this.stateCache.reset();
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
    for (const p of [this.flesh, this.bright, this.post, this.fxaa, this.fluidProg, this.sceneProg]) {
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

  private sectionName = '';
  private sectionStart = 0;

  /** Attribute draw calls since the previous section mark to it, and start `name` (ENG-0232). */
  private section(name: string): void {
    const st = this.stats;
    if (this.sectionName) st.sections[this.sectionName] = (st.sections[this.sectionName] ?? 0) + st.drawCalls - this.sectionStart;
    this.sectionName = name;
    this.sectionStart = st.drawCalls;
  }

  /** Zero the per-frame counters (call at frame start); returns the finished frame's stats. */
  resetStats(): FrameStats {
    this.section('');
    const s = this.stats;
    this.lastStats = s;
    this.stats = emptyStats();
    this.sectionStart = 0;
    return s;
  }

  /** Every texture worth inspecting (ENG-0233): render targets, LUTs, the glyph atlas, baked noise, the field snapshot. */
  debugTextures(): { name: string; tex: WebGLTexture; w: number; h: number; flip: boolean }[] {
    const out: { name: string; tex: WebGLTexture; w: number; h: number; flip: boolean }[] = [];
    for (const k of this.targets.keys()) {
      const t = this.targets.get(k)!;
      out.push({ name: k, tex: t.tex, w: t.w, h: t.h, flip: true });
    }
    for (const [name, tex] of this.luts) out.push({ name: `lut:${name}`, tex, w: LUT_SIZE * LUT_SIZE, h: LUT_SIZE, flip: false });
    out.push({ name: 'glyph-atlas', tex: this.atlas.texture, w: 2048, h: 2048, flip: false });
    if (this.noiseTex) out.push({ name: 'noise-fbm', tex: this.noiseTex, w: 512, h: 512, flip: false });
    if (this.cellsTex) out.push({ name: 'noise-cells', tex: this.cellsTex, w: 512, h: 512, flip: false });
    return out;
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
    // HDR scene target when float render targets are available (ENG-0147).
    this.scene = P.acquire('scene', w, h, { format: this.floatTargets ? 'rgba16f' : 'rgba8', depthStencil: true });
    this.mips = [];
    for (let i = 1; i <= 5; i++) this.mips.push(P.acquire(`bloom${i}`, Math.max(1, w >> i), Math.max(1, h >> i), { format: this.plan.bloomFormat }));
    const hw = Math.max(1, Math.round(w * 0.6));
    const hh = Math.max(1, Math.round(h * 0.6));
    this.surface = P.acquire('surface', hw, hh);
    this.fluid = P.acquire('fluid', hw, hh, { format: this.floatTargets ? 'rgba16f' : 'rgba8' });
    // Multisampled world target, resolved into `scene` before post-processing.
    const gl = this.gl;
    const reg = this.registry;
    reg.release(this.msaaRb);
    reg.release(this.msaaDepth);
    reg.release(this.msaaFb);
    this.msaaFb = this.msaaRb = this.msaaDepth = null;
    if (this.samples > 1) {
      this.msaaRb = reg.createRenderbuffer('msaa world');
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaRb);
      const fmt = this.floatTargets ? gl.RGBA16F : gl.RGBA8;
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, fmt, w, h);
      reg.setBytes(this.msaaRb, w * h * (this.floatTargets ? 8 : 4) * this.samples);
      this.msaaFb = reg.createFramebuffer('msaa world');
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaRb);
      // Depth for the 3D layer.
      this.msaaDepth = reg.createRenderbuffer('msaa world depth');
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH24_STENCIL8, w, h);
      reg.setBytes(this.msaaDepth, w * h * 4 * this.samples);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.msaaDepth);
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
    // The shell mirrors the shaderQuality setting into displayPrefs every frame; apply changes here (ENG-0082).
    const q = this.displayPrefs.quality;
    if (q && q !== this.shaderQuality) this.setShaderQuality(q);
    this.ensureTargets();
    this.gpuTimer.mark('world');
    this.section('world');
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
    this.section('post');
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

    // Bloom v2: soft-knee bright pass into mip 0, box downsample to 1/32, tent upsample back up.
    // Skipped entirely when the pass is off or the player set bloom to 0 % (ENG-0146/0164).
    const m = this.mips;
    const bp = resolveBloom(p.bloom);
    const bloomAmt = bp.intensity * 0.35 * this.displayPrefs.bloom;
    const bloomOn = bloomAmt > 0 && this.postChain.enabled('bloom');
    if (bloomOn) {
      this.bindTarget(m[0]);
      gl.useProgram(this.bright);
      this.bindTex(world, 0);
      gl.uniform1i(this.u(this.bright, 'u_tex'), 0);
      gl.uniform1f(this.u(this.bright, 'u_threshold'), p.bloomThreshold ?? bp.threshold);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(this.downProg);
      gl.uniform1i(this.u(this.downProg, 'u_tex'), 0);
      for (let i = 1; i < m.length; i++) {
        this.bindTarget(m[i]);
        this.bindTex(m[i - 1].tex, 0);
        gl.uniform2f(this.u(this.downProg, 'u_texel'), 1 / m[i - 1].w, 1 / m[i - 1].h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.useProgram(this.upProg);
      gl.uniform1i(this.u(this.upProg, 'u_tex'), 0);
      gl.uniform1f(this.u(this.upProg, 'u_radius'), bp.radius);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = m.length - 1; i > 0; i--) {
        this.bindTarget(m[i - 1]);
        this.bindTex(m[i].tex, 0);
        gl.uniform2f(this.u(this.upProg, 'u_texel'), 1 / m[i].w, 1 / m[i].h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.BLEND);
    }

    // Composite.
    this.bindTarget(null);
    gl.useProgram(this.post);
    this.bindTex(world, 0);
    this.bindTex(m[0].tex, 1);
    gl.uniform1i(this.u(this.post, 'u_scene'), 0);
    gl.uniform1i(this.u(this.post, 'u_bloom'), 1);
    gl.uniform1fv(this.u(this.post, 'u_pass[0]'), this.postChain.flags());
    gl.uniform1f(this.u(this.post, 'u_time'), this.time);
    gl.uniform1f(this.u(this.post, 'u_litany'), p.litany);
    gl.uniform1f(this.u(this.post, 'u_danger'), p.danger);
    // Mip-chain bloom sums five levels; scale so `bloom` keeps its old meaning.
    gl.uniform1f(this.u(this.post, 'u_bloomAmt'), bloomOn ? bloomAmt : 0);
    const dp = this.displayPrefs;
    gl.uniform4f(this.u(this.post, 'u_prefs'), dp.grain, dp.vignette, dp.gamma, dp.still);
    gl.uniform1f(this.u(this.post, 'u_flash'), dp.flash ?? 1);
    gl.uniform1f(this.u(this.post, 'u_beat'), p.beat ?? 0);
    gl.uniform1f(this.u(this.post, 'u_curse'), p.curse ?? 0);
    gl.uniform1f(this.u(this.post, 'u_silence'), p.silence ?? 0);
    gl.uniform2fv(this.u(this.post, 'u_outcome'), p.outcome ?? [0, 0]);
    gl.uniform1f(this.u(this.post, 'u_hdr'), this.floatTargets ? 1 : 0);
    const shake = p.trauma !== undefined ? shakeOffset(p.trauma, this.time, { scale: dp.still ? 0 : 1 }) : p.shake;
    gl.uniform2f(this.u(this.post, 'u_shake'), shake.x / this.vw, -shake.y / this.vh);
    gl.uniform1f(this.u(this.post, 'u_flicker'), Math.sin(this.time * 9.1) * Math.sin(this.time * 3.7) * this.displayPrefs.flicker);
    gl.uniform1f(this.u(this.post, 'u_chroma'), (p.chroma ?? 0) * this.displayPrefs.chroma);
    gl.uniform3fv(this.u(this.post, 'u_tint'), p.tint ?? [1, 1, 1]);
    gl.uniform3fv(this.u(this.post, 'u_lift'), p.lift ?? [0, 0, 0]);
    gl.uniform2f(this.u(this.post, 'u_res'), this.canvas.width, this.canvas.height);
    this.bindTex(this.lut(p.lutA ?? 'candle'), 2);
    this.bindTex(this.lut(p.lutB ?? p.lutA ?? 'candle'), 3);
    gl.uniform1i(this.u(this.post, 'u_lutA'), 2);
    gl.uniform1i(this.u(this.post, 'u_lutB'), 3);
    gl.uniform1f(this.u(this.post, 'u_lutMix'), p.lutMix ?? 0);
    gl.uniform2fv(this.u(this.post, 'u_litanyCenter'), p.litanyCenter ?? [0.5, 0.5]);
    gl.uniform1f(this.u(this.post, 'u_litanyAge'), p.litanyAge ?? 10);
    gl.uniform3fv(this.u(this.post, 'u_hurt'), p.hurt ?? [0, 0, 0]);
    gl.uniform1f(this.u(this.post, 'u_defocus'), (p.defocus ?? 0) * (this.canvas.width / this.vw));
    const sp = p.spot;
    gl.uniform4f(this.u(this.post, 'u_spot'), sp ? sp.cx / this.vw : 0, sp ? 1 - sp.cy / this.vh : 0, sp ? sp.rx / this.vw : 0, sp ? sp.ry / this.vh : 0);
    gl.uniform1f(this.u(this.post, 'u_spotK'), sp?.k ?? 0);
    const ln = p.lens ?? [0, 0, 0, 0];
    gl.uniform4f(this.u(this.post, 'u_lens'), ln[0] / this.vw, 1 - ln[1] / this.vh, ln[2] / this.vh, ln[3]);
    const rf = (p.refract ?? []).slice(0, 6);
    const rfv = new Float32Array(24);
    rf.forEach(([x, y, r, k], i) => rfv.set([x / this.vw, 1 - y / this.vh, r / this.vh, k], i * 4));
    gl.uniform4fv(this.u(this.post, 'u_refract'), rfv);
    gl.uniform1i(this.u(this.post, 'u_refractN'), rf.length);
    const sh = (p.shimmer ?? []).slice(0, 4);
    const shv = new Float32Array(16);
    sh.forEach(([x, y, r, k], i) => shv.set([x / this.vw, 1 - y / this.vh, r / this.vh, k], i * 4));
    gl.uniform4fv(this.u(this.post, 'u_shimmer'), shv);
    gl.uniform1i(this.u(this.post, 'u_shimmerN'), sh.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    this.stats.drawCalls += 6;

    gl.enable(gl.BLEND);
    this.applyBlend();
    this.tf = [1, 0, 0, 1, 0, 0];
    this.setCamera(null);
    this.gpuTimer.mark('ui');
    this.section('ui');
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
    this.section('ui');
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

  /** Baked LUT texture by grade name (cached). */
  private lut(name: string): WebGLTexture {
    let t = this.luts.get(name);
    if (t) return t;
    const gl = this.gl;
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, LUT_SIZE * LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, bakeLut(GRADES[name] ?? GRADES.neutral));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.luts.set(name, t);
    return t;
  }

  // ------------------------------------------------------------ images

  /** Load (once) and return an image handle; draws are skipped until it is ready. */
  image(url: string): ImageHandle {
    const h = this.images.get(url);
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
    this.section('layers');
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
  fluidComposite(light: Vec, look: { blood?: string; pus?: string; bile?: string; gore?: number } = {}): void {
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
    gl.uniform3fv(this.u(pr, 'u_blood'), rgb01(look.blood ?? '#8c0510'));
    gl.uniform3fv(this.u(pr, 'u_pus'), rgb01(look.pus ?? '#c7b24c'));
    gl.uniform3fv(this.u(pr, 'u_bile'), rgb01(look.bile ?? '#0f0a0f'));
    gl.uniform1f(this.u(pr, 'u_gore'), look.gore ?? 0);
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

  /** Restrict drawing to a rect in virtual units (null clears). Used for side-by-side look-dev views. */
  clipRect(r: { x: number; y: number; w: number; h: number } | null): void {
    // One look-dev clip at a time, on top of the scissor stack (ENG-0027).
    if (this.lookDevClip) this.popClip();
    this.lookDevClip = !!r;
    if (r) this.pushClip(r);
  }
  private lookDevClip = false;

  private uiArtProg: WebGLProgram | null = null;
  private plateProg: WebGLProgram | null = null;
  private msaaDepth: WebGLRenderbuffer | null = null;
  private r3d: Renderer3D | null = null;

  /**
   * Procedural UI art (src/art/uiShader.ts) drawn into a rect, premultiplied. `mode` picks the
   * piece (parchment, oak, wax seal, gauge, sand-glass, reliquary, tool icon…); `a` carries its
   * state. `rot` turns the art inside the rect (make the rect large enough to hold it).
   */
  ornament(mode: number, x: number, y: number, w: number, h: number, p: { col?: [number, number, number]; col2?: [number, number, number]; a?: [number, number, number, number]; seed?: number; rot?: number; alpha?: number } = {}): void {
    if (w <= 0 || h <= 0) return;
    this.flush('program');
    this.stats.drawCalls++;
    const gl = this.gl;
    const pr = (this.uiArtProg ??= this.registry.createProgram('ui-art', RECT_VS, UI_ART_FS));
    gl.useProgram(pr);
    this.rectQuad(x, y, w, h);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1i(this.u(pr, 'u_mode'), mode);
    gl.uniform2f(this.u(pr, 'u_size'), w, h);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1f(this.u(pr, 'u_seed'), p.seed ?? 0);
    gl.uniform1f(this.u(pr, 'u_rot'), p.rot ?? 0);
    gl.uniform1f(this.u(pr, 'u_alpha'), p.alpha ?? 1);
    gl.uniform3fv(this.u(pr, 'u_col'), p.col ?? [0.55, 0.06, 0.08]);
    gl.uniform3fv(this.u(pr, 'u_col2'), p.col2 ?? [0.9, 0.8, 0.5]);
    gl.uniform4fv(this.u(pr, 'u_a'), p.a ?? [0, 0, 0, 0]);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.applyBlend();
  }

  /**
   * A UI plate (PLATE_FS): the material every HUD and menu surface is made of. Colours are
   * straight-alpha RGBA numbers. Honours translate/uniform scale of the current transform.
   */
  plate(x: number, y: number, w: number, h: number, o: PlateOpts = {}): void {
    if (w <= 0 || h <= 0) return;
    const t = this.tf;
    const k = Math.hypot(t[0], t[1]) || 1;
    const X = t[0] * x + t[2] * y + t[4];
    const Y = t[1] * x + t[3] * y + t[5];
    const shadow = o.shadow ?? [0.55, 18, 6];
    const pad = Math.ceil(Math.max(shadow[1] + Math.abs(shadow[2]), o.glow ? (o.glowR ?? 16) * 1.5 : 0, 2)) * k;
    this.flush('program');
    this.stats.drawCalls++;
    const gl = this.gl;
    const pr = (this.plateProg ??= this.registry.createProgram('ui-plate', RECT_VS, PLATE_FS));
    gl.useProgram(pr);
    this.rectQuad(X - pad, Y - pad, w * k + pad * 2, h * k + pad * 2);
    const c4 = (c: RGBA | undefined, fallback: [number, number, number, number]): [number, number, number, number] =>
      c === undefined ? fallback : [(c & 0xff) / 255, ((c >>> 8) & 0xff) / 255, ((c >>> 16) & 0xff) / 255, ((c >>> 24) & 0xff) / 255];
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform2f(this.u(pr, 'u_size'), w * k, h * k);
    gl.uniform1f(this.u(pr, 'u_pad'), pad);
    gl.uniform2f(this.u(pr, 'u_shape'), (o.radius ?? 4) * k, o.chamfer ? 1 : 0);
    gl.uniform4fv(this.u(pr, 'u_top'), c4(o.top, [0.09, 0.07, 0.06, 0.92]));
    gl.uniform4fv(this.u(pr, 'u_bot'), c4(o.bottom ?? o.top, [0.04, 0.03, 0.03, 0.94]));
    gl.uniform4fv(this.u(pr, 'u_border'), c4(o.border, [0.72, 0.58, 0.32, 0.9]));
    gl.uniform1f(this.u(pr, 'u_bw'), (o.borderW ?? 1.25) * k);
    gl.uniform4fv(this.u(pr, 'u_inset'), c4(o.inset, [0, 0, 0, 0]));
    gl.uniform1f(this.u(pr, 'u_insetD'), (o.insetD ?? 4) * k);
    gl.uniform1f(this.u(pr, 'u_bevel'), o.bevel ?? 0.6);
    gl.uniform4f(this.u(pr, 'u_shadow'), shadow[0], shadow[1] * k, shadow[2] * k, 0);
    gl.uniform4fv(this.u(pr, 'u_glow'), c4(o.glow, [0, 0, 0, 0]));
    gl.uniform1f(this.u(pr, 'u_glowR'), (o.glowR ?? 16) * k);
    gl.uniform1f(this.u(pr, 'u_grain'), o.grain ?? 1);
    gl.uniform1f(this.u(pr, 'u_alpha'), o.alpha ?? 1);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.applyBlend();
  }

  /** Instanced particle program, VAO, static corner buffer and instance buffer (ENG-0124). */
  private part: { prog: WebGLProgram; vao: WebGLVertexArrayObject; inst: WebGLBuffer; bytes: number } | null = null;

  /**
   * Draw `count` particle instances (layout: particles.ts PARTICLE_STRIDE) in one instanced call
   * with premultiplied `alpha` or additive blending. Curves are sampled from the baked texture.
   */
  drawParticles(data: Float32Array, count: number, blend: 'alpha' | 'add', curves: CurveAtlas): void {
    if (count <= 0) return;
    this.flush('program');
    const gl = this.gl;
    const reg = this.registry;
    if (!this.part) {
      const prog = reg.createProgram('particle', PARTICLE_VS, PARTICLE_FS);
      const vao = reg.createVertexArray('particle');
      gl.bindVertexArray(vao);
      const corners = reg.createBuffer('particle corners');
      gl.bindBuffer(gl.ARRAY_BUFFER, corners);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      reg.setBytes(corners, 32);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      const inst = reg.createBuffer('particle instances');
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      const stride = 48;
      for (let i = 0; i < 3; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, stride, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      gl.bindVertexArray(null);
      this.part = { prog, vao, inst, bytes: 0 };
    }
    const p = this.part;
    const pr = p.prog;
    gl.useProgram(pr);
    gl.bindVertexArray(p.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.inst);
    const bytes = count * 48;
    // Orphan and refill: a fresh store each frame so the driver never waits on last frame's draw.
    if (bytes > p.bytes) {
      p.bytes = Math.max(bytes, 64 * 1024);
      reg.setBytes(p.inst, p.bytes);
    }
    gl.bufferData(gl.ARRAY_BUFFER, p.bytes, gl.STREAM_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 12);
    this.bindTex(curves.texture(gl, reg), 0);
    gl.uniform1i(this.u(pr, 'u_curves'), 0);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniformMatrix3fv(this.u(pr, 'u_xf'), false, this.xf);
    gl.uniform1f(this.u(pr, 'u_sizeRange'), PARTICLE_SIZE_RANGE);
    gl.uniform1f(this.u(pr, 'u_stretch'), 0.03);
    if (blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    this.stats.drawCalls++;
    this.stats.vertices += count * 4;
    this.applyBlend();
  }

  /** The 3D renderer (created on first use). */
  get renderer3d(): Renderer3D {
    return (this.r3d ??= new Renderer3D(this.gl, this.registry));
  }

  /**
   * Draw a 3D scene into the world layer (call between beginWorld and endWorld, usually first so
   * 2D world art lands on top). The 2D batch is flushed first and picks its state back up after.
   */
  draw3D(scene: Scene3D): void {
    this.flush('program');
    const fb = this.msaaFb ?? this.scene.fb;
    this.renderer3d.render(scene, { fb, w: this.scene.w, h: this.scene.h });
    this.stats.drawCalls += this.renderer3d.stats.draws;
    this.gl.viewport(0, 0, this.outW, this.outH);
    this.applyBlend();
  }

  /** Render a 3D scene into an offscreen RGBA target (icons, thumbnails); returns its texture. */
  render3DToTexture(key: string, w: number, h: number, scene: Scene3D): WebGLTexture {
    this.flush('program');
    const t = this.targets.acquire(key, w, h, { depthStencil: true });
    this.renderer3d.render({ ...scene, clearColor: scene.clearColor ?? [0, 0, 0, 0] }, { fb: t.fb, w, h });
    const gl = this.gl;
    // Mipmaps so the icon minifies cleanly to tray size.
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.bindTarget(null);
    this.applyBlend();
    return t.tex;
  }

  /** Shader-drawn creature/effect in a square around (x, y). Modes: 0 Matins, 1 Lauds, 2 hexfire, 3 hexstone glow. */
  creature(mode: number, x: number, y: number, size: number, p: { seed?: number; open?: number; health?: number; flash?: number; dissolve?: number; intensity?: number; blend?: Blend } = {}): void {
    this.flush();
    const gl = this.gl;
    const pr = this.creatureProg;
    gl.useProgram(pr);
    this.rectQuad(x - size / 2, y - size / 2, size, size);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1i(this.u(pr, 'u_mode'), mode);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1f(this.u(pr, 'u_seed'), p.seed ?? 0);
    gl.uniform1f(this.u(pr, 'u_open'), p.open ?? 0);
    gl.uniform1f(this.u(pr, 'u_health'), p.health ?? 1);
    gl.uniform1f(this.u(pr, 'u_flash'), p.flash ?? 0);
    gl.uniform1f(this.u(pr, 'u_dissolve'), p.dissolve ?? 0);
    gl.uniform1f(this.u(pr, 'u_intensity'), p.intensity ?? 1);
    // Premultiplied output.
    if (p.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.applyBlend();
  }

  private ailmentProg: WebGLProgram | null = null;

  /**
   * Procedural ailment and wound art (AILMENT_FS, src/render/shaders/ailment.ts) in a w×h rect
   * centred on (x, y), turned by `rot` so the art's +x follows the entity. Premultiplied.
   * Typed wrappers live in src/art/ailmentArt.ts.
   */
  ailment(mode: number, x: number, y: number, w: number, h: number, p: { rot?: number; seed?: number; a?: readonly number[]; b?: readonly number[]; col?: readonly number[]; alpha?: number; blend?: Blend } = {}): void {
    if (w <= 0 || h <= 0 || (p.alpha ?? 1) <= 0) return;
    this.flush('program');
    this.stats.drawCalls++;
    const gl = this.gl;
    const pr = (this.ailmentProg ??= this.registry.createProgram('ailment', RECT_VS, AILMENT_FS));
    gl.useProgram(pr);
    this.rectQuad(x - w / 2, y - h / 2, w, h);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1i(this.u(pr, 'u_mode'), mode);
    gl.uniform2f(this.u(pr, 'u_size'), w, h);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1f(this.u(pr, 'u_seed'), p.seed ?? 0);
    gl.uniform1f(this.u(pr, 'u_rot'), p.rot ?? 0);
    gl.uniform1f(this.u(pr, 'u_alpha'), p.alpha ?? 1);
    const a = p.a ?? [];
    const b = p.b ?? [];
    const c = p.col ?? [0.1, 0.16, 0.05];
    gl.uniform4f(this.u(pr, 'u_a'), a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0);
    gl.uniform4f(this.u(pr, 'u_b'), b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0);
    gl.uniform3f(this.u(pr, 'u_col'), c[0], c[1], c[2]);
    if (p.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.applyBlend();
  }

  private sceneProgs = new Map<number, WebGLProgram>();
  private upsampleProg: WebGLProgram | null = null;

  /**
   * Shader-rendered story environment over the whole world target. Each location compiles its
   * own specialised program (SCENE_FS with `#define KIND n`) on first use. `light` picks the
   * lighting variant (0 night, 1 dusk, 2 day); `parallax` is a small pointer offset (-1..1).
   * `scale` < 1 renders at reduced resolution and upsamples bilinearly (quality tiers).
   */
  sceneField(kind: number, opts: { light?: number; parallax?: [number, number]; variant?: number; scale?: number } = {}): void {
    this.flush('program');
    this.worldFb();
    this.stats.drawCalls++;
    const gl = this.gl;
    let pr = kind === 0 ? this.sceneProg : this.sceneProgs.get(kind);
    if (!pr) {
      pr = this.registry.createProgram(`scene-${kind}`, FULL_VS, SCENE_FS.replace('#version 300 es', `#version 300 es\n#define KIND ${kind}`));
      this.sceneProgs.set(kind, pr);
    }
    // The quality tier caps the backdrop scale (ENG-0082): Low renders story sets at half resolution.
    const scale = Math.max(0.25, Math.min(1, opts.scale ?? 1, SHADER_TIERS[this.shaderQuality].sceneScale));
    const low = scale < 0.99 ? this.targets.acquire('scene-low', this.outW * scale, this.outH * scale) : null;
    if (low) this.bindTarget(low);
    gl.useProgram(pr);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    gl.uniform2f(this.u(pr, 'u_view'), this.vw, this.vh);
    gl.uniform1f(this.u(pr, 'u_time'), this.time);
    gl.uniform1i(this.u(pr, 'u_kind'), kind);
    gl.uniform1f(this.u(pr, 'u_light'), opts.light ?? 0);
    gl.uniform1f(this.u(pr, 'u_variant'), opts.variant ?? 0);
    gl.uniform2fv(this.u(pr, 'u_parallax'), opts.parallax ?? [0, 0]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (low) {
      this.worldFb();
      const up = (this.upsampleProg ??= this.registry.createProgram('scene-upsample', FULL_VS, UPSAMPLE_FS));
      gl.useProgram(up);
      this.bindTex(low.tex, 0);
      gl.uniform1i(this.u(up, 'u_tex'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND);
  }

  /**
   * Draw the procedural body field over the whole world target. On the Low tier the field renders
   * at `fieldScale` (0.75×) of the world target and is upsampled bilinearly (ENG-0082).
   */
  fleshField(f: FleshParams): void {
    this.flush('program');
    this.worldFb();
    this.stats.drawCalls++;
    const scale = SHADER_TIERS[this.shaderQuality].fieldScale;
    const low = scale < 0.99 ? this.targets.acquire('flesh-low', Math.max(1, Math.round(this.scene.w * scale)), Math.max(1, Math.round(this.scene.h * scale))) : null;
    if (low) this.bindTarget(low);
    // Field coordinates are safe-area space; shaders see the full view, so shift by the margin.
    const at = f.corruptAt ?? f.center;
    this.fleshPass({ ...f, center: { x: f.center.x + this.ox, y: f.center.y + this.oy }, light: { x: f.light.x + this.ox, y: f.light.y + this.oy }, corruptAt: { x: at.x + this.ox, y: at.y + this.oy } });
    if (low) {
      const gl = this.gl;
      this.worldFb();
      const up = (this.upsampleProg ??= this.registry.createProgram('scene-upsample', FULL_VS, UPSAMPLE_FS));
      gl.useProgram(up);
      gl.disable(gl.BLEND);
      this.bindTex(low.tex, 0);
      gl.uniform1i(this.u(up, 'u_tex'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
      this.stats.drawCalls++;
    }
  }

  /** (Re)compile the flesh program for the current tier; a no-op when the variant is unchanged. */
  private compileFlesh(): void {
    const tier = SHADER_TIERS[this.shaderQuality];
    const opts = this.noiseOverride ? { ...tier.flesh, noise: this.noiseOverride } : tier.flesh;
    const key = `${fleshVariantKey(opts)}/${this.plan.fleshVariant}`;
    if (key === this.fleshKey) return;
    const src = fleshShaderSource(opts);
    const prog = this.registry.createProgram('flesh', FULL_VS, this.plan.fleshVariant === 'mediump' ? toMediump(src) : src);
    if (this.fleshKey) {
      this.uniforms.delete(this.flesh);
      this.registry.release(this.flesh);
    }
    this.flesh = prog;
    this.fleshKey = key;
  }

  /** Upload the baked tiling noise textures (ENG-0081); runs at init and after a context restore. */
  private uploadNoise(): void {
    const gl = this.gl;
    const b = bakedNoise();
    const make = (label: string, data: Float32Array, mips: boolean): WebGLTexture => {
      const t = this.registry.createTexture(label);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, b.size, b.size, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.registry.setBytes(t, Math.round(b.size * b.size * 8 * (mips ? 4 / 3 : 1)), label);
      return t;
    };
    // No mip chains: the fbm is only ever magnified (≤1.5 texels/px), and the voronoi distances
    // are sampled up to 4.6 texels/px for the bone pits, which the live shader point-sampled per
    // pixel too — mip filtering would average those pits away rather than match it.
    this.noiseTex = make('noise-fbm', b.fbm, false);
    this.cellsTex = make('noise-cells', b.cells, false);
  }

  /**
   * Switch the shader quality tier (ENG-0082): recompiles the flesh variant when it differs and
   * changes the field/scene render scales from the next draw. `noise` overrides the tier's noise
   * source for A/B comparison in the shader lab.
   */
  setShaderQuality(q: Quality, noise: 'baked' | 'live' | null = this.noiseOverride): void {
    if (!isQuality(q)) return;
    this.shaderQuality = q;
    this.noiseOverride = noise;
    this.compileFlesh();
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
    gl.uniform1i(this.u(pr, 'u_venue'), f.venue ?? 0);
    gl.uniform3fv(this.u(pr, 'u_base'), f.base);
    gl.uniform3fv(this.u(pr, 'u_deep'), f.deep);
    gl.uniform3fv(this.u(pr, 'u_vein'), f.vein);
    gl.uniform1f(this.u(pr, 'u_pulse'), f.pulse);
    gl.uniform2f(this.u(pr, 'u_warp'), f.warp?.[0] ?? 0, f.warp?.[1] ?? 0);
    gl.uniform2f(this.u(pr, 'u_light'), f.light.x, f.light.y);
    gl.uniform1f(this.u(pr, 'u_corrupt'), f.corrupt);
    gl.uniform1f(this.u(pr, 'u_cellSoft'), f.cellSoft ?? 0.08);
    gl.uniform1f(this.u(pr, 'u_rough'), f.rough ?? 0.45);
    gl.uniform1f(this.u(pr, 'u_gore'), f.gore ?? 0);
    const sp = f.species ?? SPECIES_PROFILES.human.look;
    gl.uniform3fv(this.u(pr, 'u_skin'), sp.skin);
    gl.uniform2f(this.u(pr, 'u_layers'), sp.dermis, sp.fat);
    gl.uniform4f(this.u(pr, 'u_sssCol'), sp.sss[0], sp.sss[1], sp.sss[2], sp.sssAmount);
    gl.uniform2f(this.u(pr, 'u_hide'), sp.coarse, sp.scars);
    gl.uniform1f(this.u(pr, 'u_veinAmt'), sp.veinAmount);
    gl.uniform3fv(this.u(pr, 'u_blood'), sp.blood);
    gl.uniform3fv(this.u(pr, 'u_bloodDeep'), sp.bloodDeep);
    gl.uniform1f(this.u(pr, 'u_sheen'), sp.sheen);
    const cat = f.corruptAt ?? f.center;
    gl.uniform2f(this.u(pr, 'u_corruptAt'), cat.x, cat.y);
    const cv = f.curse?.vein ?? [0.62, 0.3, 0.95];
    const ca = f.curse?.accent ?? [0.14, 0.04, 0.16];
    gl.uniform3f(this.u(pr, 'u_curseVein'), cv[0], cv[1], cv[2]);
    gl.uniform3f(this.u(pr, 'u_curseAccent'), ca[0], ca[1], ca[2]);
    const lights = f.lights ?? [{ x: f.light.x, y: f.light.y, h: 0.9, i: 1.4, col: [1, 0.9, 0.78] }];
    const lp = new Float32Array(12);
    const lc = new Float32Array(9);
    lights.slice(0, 3).forEach((l, i) => {
      lp.set([l.x, l.y, l.h, l.i], i * 4);
      lc.set(l.col, i * 3);
    });
    gl.uniform4fv(this.u(pr, 'u_lights[0]'), lp);
    gl.uniform3fv(this.u(pr, 'u_lightCol[0]'), lc);
    this.bindTex(this.surface.tex, 1);
    gl.uniform1i(this.u(pr, 'u_surface'), 1);
    gl.uniform2f(this.u(pr, 'u_surfTexel'), 1 / this.surface.w, 1 / this.surface.h);
    // The curse map (ENG-0099); with none, the sampler points at the surface layer and is ignored.
    if (f.curseMap) {
      this.bindTex(f.curseMap.tex, 4);
      gl.uniformMatrix3fv(this.u(pr, 'u_curseXf'), false, f.curseMap.xf);
    }
    gl.uniform1i(this.u(pr, 'u_curseMap'), f.curseMap ? 4 : 1);
    gl.uniform1f(this.u(pr, 'u_curseOn'), f.curseMap ? 1 : 0);
    // Baked tiling noise (ENG-0081); the live variant ignores the samplers.
    if (this.noiseTex && this.cellsTex) {
      this.bindTex(this.noiseTex, 2);
      this.bindTex(this.cellsTex, 3);
      gl.uniform1i(this.u(pr, 'u_noise'), 2);
      gl.uniform1i(this.u(pr, 'u_cells'), 3);
    }
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
    st.indices += this.ni;
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
    let pm = 0;
    for (let i = 1; i < BATCH_UNITS; i++) {
      const t = this.slots[i];
      if (t && this.premultipliedTex.has(t)) pm |= 1 << i;
    }
    gl.uniform1i(this.u(pr, 'u_pm'), pm);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.n * STRIDE);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.idx, 0, this.ni);
    gl.drawElements(gl.TRIANGLES, this.ni, gl.UNSIGNED_SHORT, 0);
    this.n = 0;
    this.ni = 0;
    for (let i = 1; i < BATCH_UNITS; i++) this.slots[i] = null;
    this.slotCount = 1;
  }

  /** Batch unit for `tex`, flushing when all 8 units are taken (ENG-0031). */
  /** Textures holding premultiplied-alpha pixels (atlas pages exported premultiplied, ART-0037). */
  private premultipliedTex = new WeakSet<WebGLTexture>();

  /** Mark a texture as premultiplied: the batch filters it premultiplied (no dark fringes) and un-premultiplies. */
  markPremultiplied(tex: WebGLTexture): void {
    this.premultipliedTex.add(tex);
  }

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

  private room(verts: number, indices = verts): void {
    if (this.n + verts > MAX_VERTS || this.ni + indices > MAX_INDICES) this.flush('overflow');
  }

  /** Index the three vertices just written as one triangle. */
  private triIdx(): void {
    const b = this.n - 3;
    const ix = this.idx;
    const i = this.ni;
    ix[i] = b;
    ix[i + 1] = b + 1;
    ix[i + 2] = b + 2;
    this.ni = i + 3;
  }

  /** Index the four vertices just written (corners in order) as two triangles: 4 vertices, not 6. */
  private quadIdx(): void {
    const b = this.n - 4;
    const ix = this.idx;
    const i = this.ni;
    ix[i] = b;
    ix[i + 1] = b + 1;
    ix[i + 2] = b + 2;
    ix[i + 3] = b;
    ix[i + 4] = b + 2;
    ix[i + 5] = b + 3;
    this.ni = i + 6;
  }

  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c1: RGBA, c2 = c1, c3 = c1): void {
    if (alphaOf(c1) === 0 && alphaOf(c2) === 0 && alphaOf(c3) === 0) return;
    this.room(3);
    const w = this.atlas.white;
    this.vert(x1, y1, w.u, w.v, c1);
    this.vert(x2, y2, w.u, w.v, c2);
    this.vert(x3, y3, w.u, w.v, c3);
    this.triIdx();
  }

  /** Untextured quad with per-corner colours (top-left, top-right, bottom-right, bottom-left). */
  private colorQuad(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c0: RGBA, c1: RGBA, c2: RGBA, c3: RGBA): void {
    if (alphaOf(c0) === 0 && alphaOf(c1) === 0 && alphaOf(c2) === 0 && alphaOf(c3) === 0) return;
    this.room(4, 6);
    const w = this.atlas.white;
    this.vert(x0, y0, w.u, w.v, c0);
    this.vert(x1, y1, w.u, w.v, c1);
    this.vert(x2, y2, w.u, w.v, c2);
    this.vert(x3, y3, w.u, w.v, c3);
    this.quadIdx();
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
      // Unbalanced restore: back to identity, in place (no allocation, ENG-0226).
      const t = this.tf;
      t[0] = t[3] = 1;
      t[1] = t[2] = t[4] = t[5] = 0;
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
    this.colorQuad(x, y, x + w, y, x + w, y + h, x, y + h, c, c, c, c);
  }

  rectGrad(x: number, y: number, w: number, h: number, top: RGBA, bottom: RGBA): void {
    this.colorQuad(x, y, x + w, y, x + w, y + h, x, y + h, top, top, bottom, bottom);
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
    if (alphaOf(c) === 0 && alphaOf(cEdge) === 0) return;
    const n = this.segs(Math.max(rx, ry));
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const tb = trig(n);
    // An indexed fan (ENG-0020): the centre and each rim vertex are shared, n + 2 vertices for n triangles.
    this.room(n + 2, n * 3);
    const w = this.atlas.white;
    const base = this.n;
    this.vert(x, y, w.u, w.v, c);
    for (let i = 0; i <= n; i++) {
      const ex = tb[i * 2] * rx;
      const ey = tb[i * 2 + 1] * ry;
      this.vert(x + ex * cr - ey * sr, y + ex * sr + ey * cr, w.u, w.v, cEdge);
    }
    const ix = this.idx;
    let k = this.ni;
    for (let i = 1; i <= n; i++) {
      ix[k++] = base;
      ix[k++] = base + i;
      ix[k++] = base + i + 1;
    }
    this.ni = k;
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
    this.colorQuad(a.x + nx, a.y + ny, b.x + nx, b.y + ny, b.x - nx, b.y - ny, a.x - nx, a.y - ny, c, c, c, c);
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
      this.colorQuad(x + c0 * ri, y + s0 * ri, x + c0 * ro, y + s0 * ro, x + c1 * ro, y + s1 * ro, x + c1 * ri, y + s1 * ri, c, c, c, c);
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
    this.room(4, 6);
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
    this.vert(x0, y1, u0, v1, tint);
    this.quadIdx();
    this.texUnit = 0;
    this.restore();
  }

  /** Draw a whole texture into a rect through the batch; `flipV` for render-target textures (GL origin bottom-left). */
  texQuad(tex: WebGLTexture, x: number, y: number, w: number, h: number, tint: RGBA = 0xffffffff, flipV = false): void {
    this.room(4, 6);
    const unit = this.unitFor(tex);
    const v0 = flipV ? 1 : 0;
    const v1 = flipV ? 0 : 1;
    this.texUnit = unit;
    this.vert(x, y, 0, v0, tint);
    this.vert(x + w, y, 1, v0, tint);
    this.vert(x + w, y + h, 1, v1, tint);
    this.vert(x, y + h, 0, v1, tint);
    this.quadIdx();
    this.texUnit = 0;
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
    this.room(36, 54);
    this.texUnit = this.unitFor(f.tex);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) {
        if (xs[i + 1] <= xs[i] || ys[j + 1] <= ys[j]) continue;
        this.vert(xs[i], ys[j], us[i], vs[j], tint);
        this.vert(xs[i + 1], ys[j], us[i + 1], vs[j], tint);
        this.vert(xs[i + 1], ys[j + 1], us[i + 1], vs[j + 1], tint);
        this.vert(xs[i], ys[j + 1], us[i], vs[j + 1], tint);
        this.quadIdx();
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
      this.triIdx();
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

  measure(str: string, size = 20, font: FontId = 'body', tracking = 0): number {
    const r = this.run(str, font, this.atlas.baseSize);
    const n = r.base.length;
    return r.width * (size / this.atlas.baseSize) + (n > 1 ? (n - 1) * tracking * size : 0);
  }

  /** The baked run for `str` in `font` at raster tier `tier` (ENG-0177), built on a miss. */
  private run(str: string, font: FontId, tier: number): TextRun {
    const atlas = this.atlas;
    const key = `${font}${readableFont() ? '~r' : ''}@${tier}|${str}`;
    let r = this.textCache ? this.runs.get(key) : undefined;
    if (r && r.gen === atlas.generation) return r;
    for (let attempt = 0; attempt < 2; attempt++) {
      const gen = atlas.generation;
      const cl = graphemes(str);
      const base: Glyph[] = new Array(cl.length);
      const tiered: Glyph[] = new Array(cl.length);
      const pens = new Float32Array(cl.length);
      let pen = 0;
      for (let i = 0; i < cl.length; i++) {
        const b = atlas.glyph(cl[i], font);
        base[i] = b;
        tiered[i] = tier === atlas.baseSize ? b : atlas.glyph(cl[i], font, tier);
        pens[i] = pen;
        pen += b.adv + (i + 1 < cl.length ? atlas.kern(cl[i], cl[i + 1], font) : 0);
      }
      r = { gen, base, tiered, pens, width: pen };
      // The page wrapped while rasterising this run: the early glyphs are stale, rebuild once.
      if (atlas.generation === gen) break;
    }
    if (this.textCache) {
      if (this.runs.size >= MAX_RUNS) this.runs.clear();
      this.runs.set(key, r!);
    }
    return r!;
  }

  /** Lay out text once and reuse it across frames (ENG-0173): wrap, align, line height, max lines with ellipsis, rich markup. */
  layout(str: string, o: LayoutOptions = {}): TextLayout {
    return this.layouter.layout(str, o);
  }

  /**
   * Draw a layout with its anchor at (x, baseline y of the first line). Glyphs come from the raster
   * tier for the on-screen size; `reveal` limits how many are shown (typewriter).
   */
  drawLayout(l: TextLayout, x: number, y: number, o: DrawLayoutOpts = {}): void {
    const color = o.color ?? 0xffc0dce8;
    if (o.shadow !== false) {
      const sc = o.shadow ?? (0xb0000000 >>> 0);
      this.layoutPass(l, x + l.size * 0.06, y + l.size * 0.08, sc, sc, o.reveal, true, undefined);
    }
    this.layoutPass(l, x, y, color, o.color2 ?? color, o.reveal, false, o.icon);
  }

  private layoutPass(l: TextLayout, x: number, y: number, c: RGBA, c2: RGBA, reveal = Infinity, shadow: boolean, icon: DrawLayoutOpts['icon']): void {
    const atlas = this.atlas;
    const size = l.size;
    const tier = atlas.tier(size * this.pixelScale());
    const ts = size / tier;
    const n = Math.min(l.glyphs.length, reveal);
    for (let i = 0; i < n; i++) {
      const lg = l.glyphs[i];
      const by = y + lg.line * l.lineStep;
      if (lg.icon) {
        if (!shadow && icon) icon(this, lg.icon, x + lg.x, by, size, lg.adv);
        continue;
      }
      if (!lg.ch || lg.ch === ' ') continue;
      const g = atlas.glyph(lg.ch, lg.font, tier);
      if (g.w <= 0) continue;
      const top = by - atlas.ascent(lg.font, tier) * ts;
      const col = shadow ? c : (lg.color ?? c);
      const col2 = shadow ? c2 : (lg.color ?? c2);
      // Faux bold: a second pass nudged right by 3% of the size.
      for (let pass = 0; pass < (lg.bold ? 2 : 1); pass++) this.glyphQuad(g, x + lg.x + pass * size * 0.03, top, ts, col, col2);
    }
  }

  private glyphQuad(g: Glyph, px: number, top: number, ts: number, c: RGBA, c2: RGBA): void {
    this.room(4, 6);
    const x0 = px + g.ox * ts;
    const y0 = top + g.oy * ts;
    const x1 = x0 + g.w * ts;
    const y1 = y0 + g.h * ts;
    this.vert(x0, y0, g.u0, g.v0, c);
    this.vert(x1, y0, g.u1, g.v0, c);
    this.vert(x1, y1, g.u1, g.v1, c2);
    this.vert(x0, y1, g.u0, g.v1, c2);
    this.quadIdx();
  }

  text(str: string, x: number, y: number, o: TextOpts = {}): void {
    const size = o.size ?? 20;
    const font = o.font ?? 'body';
    const color = o.color ?? 0xffc0dce8;
    const tr = o.tracking ?? 0;
    const align = o.align ?? 'left';
    if (o.shadow !== false) {
      const sc = o.shadow ?? (0xb0000000 >>> 0);
      if (o.soft) {
        // Eight faint taps around a downward offset approximate a blurred drop shadow.
        const r = Math.max(1, size * 0.06);
        const a = ((sc >>> 24) & 255) / 255;
        const faint = withAlpha(sc, a * 0.22);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          this.textRaw(str, x + Math.cos(ang) * r, y + size * 0.06 + Math.sin(ang) * r, size, font, faint, align, faint, tr);
        }
      } else this.textRaw(str, x + size * 0.06, y + size * 0.08, size, font, sc, align, sc, tr);
    }
    this.textRaw(str, x, y, size, font, color, align, o.color2 ?? color, tr);
  }

  /** Word-wrapped text; returns the height used. */
  /** Word-wrap `str` to `width` at `size`: the lines `textBlock` would draw. */
  wrap(str: string, width: number, size = 20, font?: FontId): string[] {
    const lines: string[] = [];
    for (const para of str.split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const tryLine = cur ? `${cur} ${word}` : word;
        if (this.measure(tryLine, size, font) > width && cur) {
          lines.push(cur);
          cur = word;
        } else cur = tryLine;
      }
      lines.push(cur);
    }
    return lines;
  }

  textBlock(str: string, x: number, y: number, width: number, o: TextOpts = {}, lineH = 1.35): number {
    const size = o.size ?? 20;
    const lines = this.wrap(str, width, size, o.font);
    lines.forEach((l, i) => this.text(l, x, y + i * size * lineH, o));
    return lines.length * size * lineH;
  }

  /** Output pixels per virtual pixel, including the current transform's scale. */
  private pixelScale(): number {
    const out = this.outW || this.canvas.width;
    return (out / (this.vw || 1280)) * (Math.hypot(this.tf[0], this.tf[1]) || 1);
  }

  private textRaw(str: string, x: number, y: number, size: number, font: FontId, c: RGBA, align: Align, c2: RGBA = c, tracking = 0): void {
    // Layout in base units (so measure() and drawing agree); glyph images from the raster tier
    // nearest the on-screen size, so small text stays crisp and large text stays sharp.
    const s = size / this.atlas.baseSize;
    const tier = this.atlas.tier(size * this.pixelScale());
    const ts = size / tier;
    const r = this.run(str, font, tier);
    const n = r.base.length;
    const w = r.width * s + (n > 1 ? (n - 1) * tracking * size : 0);
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const top = y - this.atlas.ascent(font, tier) * ts;
    const lqa = fallbackHighlight();
    for (let i = 0; i < n; i++) {
      const g = r.tiered[i];
      if (g.w <= 0) continue;
      if (lqa && g.fallback) c = c2 = MAGENTA;
      this.glyphQuad(g, x0 + r.pens[i] * s + i * tracking * size, top, ts, c, c2);
    }
  }
}
