/**
 * Shader quality tiers (ENG-0082): what each `shaderQuality` setting (Low/Medium/High, chosen by
 * the GPU tier on first launch and overridable in Options) selects in the renderer. One table so
 * the flesh variant, the story-scene render scale and the field's internal resolution move together.
 */
import type { FleshShaderOpts } from './shaders/flesh';

export type Quality = 'low' | 'medium' | 'high';

export interface ShaderTier {
  /** Flesh shader variant: noise source, live octaves, SSS, spec AA (src/render/shaders/flesh.ts). */
  flesh: FleshShaderOpts;
  /** Internal resolution of the flesh field relative to the world target (upsampled bilinearly). */
  fieldScale: number;
  /** Upper bound on the story-scene backdrop render scale (src/scenes/backdrop.ts passes its own). */
  sceneScale: number;
}

export const SHADER_TIERS: Readonly<Record<Quality, ShaderTier>> = Object.freeze({
  high: { flesh: { noise: 'baked', octaves: 4, sss: true, specAA: true }, fieldScale: 1, sceneScale: 1 },
  medium: { flesh: { noise: 'baked', octaves: 3, sss: true, specAA: false }, fieldScale: 1, sceneScale: 0.75 },
  low: { flesh: { noise: 'baked', octaves: 2, sss: false, specAA: false }, fieldScale: 0.75, sceneScale: 0.5 },
});

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

export const isQuality = (v: unknown): v is Quality => typeof v === 'string' && (QUALITIES as readonly string[]).includes(v);

/** Stable key for a flesh variant, so a tier change only recompiles when the shader source differs. */
export const fleshVariantKey = (o: FleshShaderOpts): string => `${o.noise}/${o.octaves}/${o.sss ? 'sss' : 'nosss'}/${o.specAA ? 'aa' : 'noaa'}`;
