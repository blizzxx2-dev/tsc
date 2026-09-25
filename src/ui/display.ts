/**
 * Display options → renderer multipliers (UIX-0105/0076/0152). Kept pure so
 * the mapping is unit-testable; the shell copies the result into
 * `gfx.displayPrefs` every frame, so every change previews live.
 */
import type { Settings } from '../core/settings';

export interface DisplayPrefs {
  bloom: number;
  grain: number;
  vignette: number;
  /** Brightness as a gamma exponent (>1 brightens). */
  gamma: number;
  flicker: number;
  chroma: number;
  /** Reduced Motion: no Litany ripple or screen-space wobble (the sepia tint stays). */
  still: number;
}

export function displayPrefs(s: Pick<Settings, 'bloom' | 'grain' | 'vignette' | 'brightness' | 'flicker' | 'chromaticAberration' | 'reduceMotion' | 'reduceFlashing'>): DisplayPrefs {
  return {
    bloom: s.bloom ? 1 : 0,
    grain: s.grain ? 1 : 0,
    vignette: s.vignette ? 1 : 0,
    gamma: s.brightness,
    // Reduced Motion / Reduced Flashing hold the candle flicker still (UIX-0152/0027).
    flicker: s.flicker && !s.reduceMotion && !s.reduceFlashing ? 1 : 0,
    chroma: s.chromaticAberration ? 1 : 0,
    still: s.reduceMotion ? 1 : 0,
  };
}
