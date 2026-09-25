import quirkTable from './quirks.json';

/**
 * GPU capability probe (ENG-0190), tier classification (ENG-0191), driver quirks
 * (ENG-0192) and the fallback matrix (ENG-0193). Everything past `probeCaps` is
 * pure so it is unit-tested with synthetic capability sets.
 */
export interface GpuCaps {
  maxTextureSize: number;
  maxSamples: number;
  /** RGBA16F/RGBA32F colour-renderable (EXT_color_buffer_float). */
  floatRT: boolean;
  /** Half-float colour-renderable (float or EXT_color_buffer_half_float). */
  halfFloatRT: boolean;
  /** Linear filtering of 32-bit float textures. */
  floatLinear: boolean;
  /** Max anisotropy (0 when EXT_texture_filter_anisotropic is missing). */
  anisotropy: number;
  timerQuery: boolean;
  parallelCompile: boolean;
  /** Fragment shaders support highp floats. */
  highpFS: boolean;
  renderer: string;
  vendor: string;
  /** SwiftShader/llvmpipe-style software rasteriser. */
  software: boolean;
}

export type Tier = 'low' | 'medium' | 'high';
export const TIERS: readonly Tier[] = ['low', 'medium', 'high'];

export type QuirkFlag = 'software' | 'noFloatTargets' | 'noMsaa' | 'noTimerQuery' | 'noParallelCompile';

export interface Quirk {
  match: string;
  tier?: Tier;
  workarounds?: QuirkFlag[];
  note?: string;
}

export const QUIRKS: readonly Quirk[] = (quirkTable as { quirks: Quirk[] }).quirks;

const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function probeCaps(gl: WebGL2RenderingContext): GpuCaps {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || 'unknown');
  const vendor = String((dbg && gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) || gl.getParameter(gl.VENDOR) || 'unknown');
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  const halfFloatRT = floatRT || !!gl.getExtension('EXT_color_buffer_half_float');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  return {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxSamples: gl.getParameter(gl.MAX_SAMPLES) as number,
    floatRT,
    halfFloatRT,
    floatLinear: !!gl.getExtension('OES_texture_float_linear'),
    anisotropy: aniso ? (gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 0,
    timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    parallelCompile: !!gl.getExtension('KHR_parallel_shader_compile'),
    highpFS: !!hp && hp.precision > 0,
    renderer,
    vendor,
    software: SOFTWARE_RE.test(renderer),
  };
}

/** One log line per launch. */
export function describeCaps(c: GpuCaps): string {
  return (
    `GPU: ${c.renderer} (${c.vendor}) · maxTex ${c.maxTextureSize} · MSAA ${c.maxSamples}× · floatRT ${c.floatRT} · halfRT ${c.halfFloatRT} · ` +
    `aniso ${c.anisotropy} · timer ${c.timerQuery} · parallel ${c.parallelCompile} · highp ${c.highpFS}${c.software ? ' · SOFTWARE' : ''}`
  );
}

export function matchQuirks(c: GpuCaps, table: readonly Quirk[] = QUIRKS): Quirk[] {
  return table.filter((q) => {
    try {
      return new RegExp(q.match, 'i').test(c.renderer);
    } catch {
      return false;
    }
  });
}

const minTier = (a: Tier, b: Tier): Tier => (TIERS.indexOf(a) <= TIERS.indexOf(b) ? a : b);

/**
 * Classify the GPU. `benchMs` is the measured cost of one flesh pass scaled to
 * 1080p (see Gfx.benchmarkFlesh): <2.5 ms → High, <7 ms → Medium, else Low.
 * Capability gaps and quirks can only lower the result; a quirk `tier` of
 * `high` may raise an unmeasured default.
 */
export function classifyTier(c: GpuCaps, benchMs?: number, table: readonly Quirk[] = QUIRKS): { tier: Tier; reasons: string[] } {
  const reasons: string[] = [];
  let tier: Tier = benchMs === undefined ? 'medium' : benchMs < 2.5 ? 'high' : benchMs < 7 ? 'medium' : 'low';
  reasons.push(benchMs === undefined ? 'no benchmark: default medium' : `flesh pass ${benchMs.toFixed(2)} ms @1080p`);
  const quirks = matchQuirks(c, table);
  if (benchMs === undefined && quirks.some((q) => q.tier === 'high')) tier = 'high';
  if (c.software) {
    tier = 'low';
    reasons.push('software renderer');
  }
  if (!c.highpFS) {
    tier = 'low';
    reasons.push('no highp in fragment shaders');
  }
  if (c.maxTextureSize < 4096) {
    tier = minTier(tier, 'low');
    reasons.push(`MAX_TEXTURE_SIZE ${c.maxTextureSize}`);
  }
  if (!c.halfFloatRT) {
    tier = minTier(tier, 'medium');
    reasons.push('no float render targets');
  }
  for (const q of quirks)
    if (q.tier && q.tier !== 'high') {
      tier = minTier(tier, q.tier);
      reasons.push(`quirk: ${q.note ?? q.match}`);
    }
  return { tier, reasons };
}

export interface FallbackPlan {
  /** Bloom/HDR target format. */
  bloomFormat: 'rgba16f' | 'rgba8';
  /** World anti-aliasing: multisampled world target, or an FXAA pass. */
  aa: 'msaa' | 'fxaa';
  msaaSamples: number;
  /** Largest texture page we create (sprite/glyph atlases split into pages of this size). */
  atlasPageSize: number;
  /** GPU pass timings in the profiler; CPU scopes only when false. */
  gpuProfiler: boolean;
  /** `mediump` compiles the flesh field with mediump floats for FS-precision-limited GPUs. */
  fleshVariant: 'full' | 'mediump';
  /** Anisotropy to request on mipmapped sprite pages (0 = off). */
  anisotropy: number;
  parallelCompile: boolean;
}

/** The fallback matrix (ENG-0193). */
export function fallbackPlan(c: GpuCaps, table: readonly Quirk[] = QUIRKS): FallbackPlan {
  const flags = new Set(matchQuirks(c, table).flatMap((q) => q.workarounds ?? []));
  const floatOk = c.floatRT && !flags.has('noFloatTargets');
  const msaa = c.maxSamples >= 4 && !flags.has('noMsaa');
  return {
    bloomFormat: floatOk ? 'rgba16f' : 'rgba8',
    aa: msaa ? 'msaa' : 'fxaa',
    msaaSamples: msaa ? 4 : 0,
    atlasPageSize: Math.min(4096, c.maxTextureSize),
    gpuProfiler: c.timerQuery && !flags.has('noTimerQuery'),
    fleshVariant: c.highpFS ? 'full' : 'mediump',
    anisotropy: Math.min(8, c.anisotropy),
    parallelCompile: c.parallelCompile && !flags.has('noParallelCompile'),
  };
}

/** Rewrite a fragment shader to mediump floats (the `mediump` flesh variant). */
export function toMediump(src: string): string {
  return src.replace(/precision\s+highp\s+float\s*;/g, 'precision mediump float;').replace(/\bhighp\b/g, 'mediump');
}

/** Caps for a GPU that has everything — the baseline for tests and headless tools. */
export const FULL_CAPS: GpuCaps = {
  maxTextureSize: 16384,
  maxSamples: 8,
  floatRT: true,
  halfFloatRT: true,
  floatLinear: true,
  anisotropy: 16,
  timerQuery: true,
  parallelCompile: true,
  highpFS: true,
  renderer: 'ANGLE (Test GPU)',
  vendor: 'Test',
  software: false,
};
