/**
 * Every shader program the game can build, variant by variant (ENG-0083): the base programs, the
 * mediump flesh fallback, each story-scene KIND and the lazily compiled UI programs. `compileCatalog`
 * compiles and links them all in a throwaway WebGL2 context, so CI can fail on a broken variant by
 * name before a player's GPU ever sees it.
 */
import { BRIGHT_FS, CREATURE_FS, DOWN_FS, FLESH_FS, FLUID_FS, FULL_VS, IMAGE_FS, IMAGE_VS, PORTRAIT_FS, POST_FS, RECT_VS, SCENE_FS, UP_FS } from './shaders';
import { BATCH_FS, BATCH_VS, FALLBACK_VS, FXAA_FS } from './batch-shaders';
import { toMediump } from './caps';
import { UI_ART_FS } from '../art/uiShader';
import { PLATE_FS } from './shaders/plate';
import { UPSAMPLE_FS } from './gfx';
import { PBR_FS, PBR_VS, SHADOW_FS, SHADOW_VS } from './renderer3d';
import { fleshShaderSource } from './shaders/flesh';
import { QUALITIES, SHADER_TIERS } from './quality';
import { formatShaderLog, shaderDefines } from './registry';
import { PARTICLE_FS, PARTICLE_VS } from './shaders/particle';
import { BLOOD_DECAL_FS, COVERAGE_FS, COVERAGE_VS, DECAL_VS, SCORCH_DECAL_FS, STAMP_FS, STAMP_VS } from './shaders/decal';

export interface ShaderVariant {
  name: string;
  vs: string;
  fs: string;
}

/** Story-scene KINDs (src/scenes/backdrop.ts SCENE_KIND). */
export const SCENE_KINDS = 16;

export function shaderCatalog(): ShaderVariant[] {
  const list: ShaderVariant[] = [
    { name: 'batch', vs: BATCH_VS, fs: BATCH_FS },
    { name: 'flesh', vs: FULL_VS, fs: FLESH_FS },
    { name: 'flesh (mediump)', vs: FULL_VS, fs: toMediump(FLESH_FS) },
    { name: 'bright', vs: FULL_VS, fs: BRIGHT_FS },
    { name: 'post', vs: FULL_VS, fs: POST_FS },
    { name: 'fxaa', vs: FALLBACK_VS, fs: FXAA_FS },
    { name: 'fluid', vs: FULL_VS, fs: FLUID_FS },
    { name: 'image', vs: IMAGE_VS, fs: IMAGE_FS },
    { name: 'portrait', vs: RECT_VS, fs: PORTRAIT_FS },
    { name: 'creature', vs: RECT_VS, fs: CREATURE_FS },
    { name: 'bloom-down', vs: FULL_VS, fs: DOWN_FS },
    { name: 'bloom-up', vs: FULL_VS, fs: UP_FS },
    { name: 'ui-art', vs: RECT_VS, fs: UI_ART_FS },
    { name: 'ui-plate', vs: RECT_VS, fs: PLATE_FS },
    { name: 'scene-upsample', vs: FULL_VS, fs: UPSAMPLE_FS },
    { name: 'pbr', vs: PBR_VS, fs: PBR_FS },
    { name: 'pbr-shadow', vs: SHADOW_VS, fs: SHADOW_FS },
    { name: 'particle', vs: PARTICLE_VS, fs: PARTICLE_FS },
    { name: 'decal-stamp', vs: STAMP_VS, fs: STAMP_FS },
    { name: 'decal-blood', vs: DECAL_VS, fs: BLOOD_DECAL_FS },
    { name: 'decal-coverage', vs: COVERAGE_VS, fs: COVERAGE_FS },
    { name: 'decal-scorch', vs: DECAL_VS, fs: SCORCH_DECAL_FS },
  ];
  // Quality tiers (ENG-0082): each tier's flesh variant, with its mediump fallback, plus the live-noise A/B variant.
  for (const q of QUALITIES) {
    const fs = fleshShaderSource(SHADER_TIERS[q].flesh);
    list.push({ name: `flesh (${q})`, vs: FULL_VS, fs }, { name: `flesh (${q}, mediump)`, vs: FULL_VS, fs: toMediump(fs) });
    list.push({ name: `flesh (${q}, live noise)`, vs: FULL_VS, fs: fleshShaderSource({ ...SHADER_TIERS[q].flesh, noise: 'live' }) });
  }
  for (let k = 0; k < SCENE_KINDS; k++) list.push({ name: `scene KIND ${k}`, vs: FULL_VS, fs: k === 0 ? SCENE_FS : SCENE_FS.replace('#version 300 es', `#version 300 es\n#define KIND ${k}`) });
  return list;
}

export interface ShaderFailure {
  name: string;
  stage: 'vertex' | 'fragment' | 'link';
  log: string;
}

/** Compile and link every variant; returns the failures (empty when all build). */
export function compileCatalog(gl: WebGL2RenderingContext, variants = shaderCatalog()): ShaderFailure[] {
  const fails: ShaderFailure[] = [];
  const compile = (type: number, src: string): WebGLShader | string => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    const log = gl.getShaderInfoLog(s) ?? 'unknown error';
    gl.deleteShader(s);
    return log;
  };
  for (const v of variants) {
    const vs = compile(gl.VERTEX_SHADER, v.vs);
    const fs = compile(gl.FRAGMENT_SHADER, v.fs);
    if (typeof vs === 'string') fails.push({ name: v.name, stage: 'vertex', log: vs });
    if (typeof fs === 'string') fails.push({ name: v.name, stage: 'fragment', log: fs });
    if (typeof vs !== 'string' && typeof fs !== 'string') {
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) fails.push({ name: v.name, stage: 'link', log: gl.getProgramInfoLog(p) ?? 'unknown error' });
      gl.deleteProgram(p);
    }
    if (typeof vs !== 'string') gl.deleteShader(vs);
    if (typeof fs !== 'string') gl.deleteShader(fs);
  }
  return fails;
}

/**
 * Boot-time parallel compile (ENG-0202): with KHR_parallel_shader_compile every variant's compile
 * and link are issued at once and polled (COMPLETION_STATUS_KHR) between frames, so the boot screen
 * keeps animating while the driver works — and the driver's program cache is warm when the renderer
 * builds the same sources. Without the extension, variants compile a few per frame. Failures carry
 * the variant's defines and the offending source lines.
 */
export async function precompileCatalog(
  gl: WebGL2RenderingContext,
  variants: ShaderVariant[] = shaderCatalog(),
  onProgress: (done: number, total: number) => void = () => undefined,
  nextFrame: () => Promise<void> = () => new Promise((r) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(() => r()) : setTimeout(r, 0))),
): Promise<ShaderFailure[]> {
  const ext = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  const jobs = variants.map((v) => {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    return { v, vs, fs, p: gl.createProgram()!, started: false, done: false };
  });
  const start = (j: (typeof jobs)[number]) => {
    gl.shaderSource(j.vs, j.v.vs);
    gl.shaderSource(j.fs, j.v.fs);
    gl.compileShader(j.vs);
    gl.compileShader(j.fs);
    gl.attachShader(j.p, j.vs);
    gl.attachShader(j.p, j.fs);
    gl.linkProgram(j.p);
    j.started = true;
  };
  if (ext) for (const j of jobs) start(j);
  const fails: ShaderFailure[] = [];
  const finish = (j: (typeof jobs)[number]) => {
    j.done = true;
    if (!gl.getProgramParameter(j.p, gl.LINK_STATUS)) {
      const stages: [WebGLShader, 'vertex' | 'fragment', string][] = [
        [j.vs, 'vertex', j.v.vs],
        [j.fs, 'fragment', j.v.fs],
      ];
      let reported = false;
      for (const [sh, stage, src] of stages)
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          fails.push({ name: variantName(j.v), stage, log: formatShaderLog(gl.getShaderInfoLog(sh) ?? 'unknown error', src) });
          reported = true;
        }
      if (!reported) fails.push({ name: variantName(j.v), stage: 'link', log: gl.getProgramInfoLog(j.p) ?? 'unknown error' });
    }
    gl.deleteShader(j.vs);
    gl.deleteShader(j.fs);
    gl.deleteProgram(j.p);
  };
  let done = 0;
  while (done < jobs.length) {
    if (ext) {
      for (const j of jobs)
        if (!j.done && gl.getProgramParameter(j.p, ext.COMPLETION_STATUS_KHR)) {
          finish(j);
          done++;
        }
    } else {
      // No extension: a handful per frame so the boot screen stays responsive.
      for (const j of jobs.filter((x) => !x.done).slice(0, 4)) {
        start(j);
        finish(j);
        done++;
      }
    }
    onProgress(done, jobs.length);
    if (done < jobs.length) await nextFrame();
  }
  return fails;
}

const variantName = (v: ShaderVariant) => {
  const d = shaderDefines(v.fs);
  return d.length ? `${v.name} [${d.join(' ')}]` : v.name;
};
