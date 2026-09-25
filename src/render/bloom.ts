/**
 * Bloom presets per scene type, as data (ENG-0149): ./bloomPresets.json holds each preset's
 * intensity, bright-pass threshold and upsample radius. `PostParams.bloom` names a preset, optionally
 * with an intensity override; a bare number is still read as an intensity for the menu preset
 * (look-dev tools use it).
 */
import PRESETS from './bloomPresets.json';

export type BloomPresetId = 'operation' | 'malison' | 'story' | 'menu' | 'title' | 'none';

export interface BloomPreset {
  intensity: number;
  threshold: number;
  radius: number;
}

export type BloomSpec = BloomPresetId | { preset: BloomPresetId; intensity?: number } | number;

export const BLOOM_PRESETS: Readonly<Record<BloomPresetId, BloomPreset>> = PRESETS;

/** The effective bloom for a spec: the preset's values with any intensity override applied. */
export function resolveBloom(spec: BloomSpec): BloomPreset {
  if (typeof spec === 'number') return { ...BLOOM_PRESETS.menu, intensity: spec };
  if (typeof spec === 'string') return BLOOM_PRESETS[spec] ?? BLOOM_PRESETS.menu;
  const p = BLOOM_PRESETS[spec.preset] ?? BLOOM_PRESETS.menu;
  return spec.intensity === undefined ? p : { ...p, intensity: spec.intensity };
}
