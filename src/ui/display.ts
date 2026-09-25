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
  /** Reduce Flashing (ENG-0164): 1 = full-screen pulses and damage flashes as authored, 0 = held steady. */
  flash?: number;
  /** Shader quality tier (ENG-0082); the renderer applies it lazily when it changes. */
  quality?: 'low' | 'medium' | 'high';
}

type PrefKeys = 'bloom' | 'grain' | 'vignette' | 'brightness' | 'flicker' | 'chromaticAberration' | 'reduceMotion' | 'reduceFlashing';
type AmountKeys = 'bloomAmount' | 'grainAmount' | 'chromaAmount' | 'flickerAmount' | 'shaderQuality';

/** 0–100 % amount behind a toggle (ENG-0164): the toggle switches the effect, the slider scales it. */
const amount = (on: boolean, pct: number | undefined): number => (on ? Math.min(100, Math.max(0, pct ?? 100)) / 100 : 0);

export function displayPrefs(s: Pick<Settings, PrefKeys> & Partial<Pick<Settings, AmountKeys>>): DisplayPrefs {
  return {
    bloom: amount(s.bloom, s.bloomAmount),
    grain: amount(s.grain, s.grainAmount),
    vignette: s.vignette ? 1 : 0,
    gamma: s.brightness,
    // Reduced Motion / Reduced Flashing hold the candle flicker still (UIX-0152/0027).
    flicker: amount(s.flicker && !s.reduceMotion && !s.reduceFlashing, s.flickerAmount),
    chroma: amount(s.chromaticAberration, s.chromaAmount),
    still: s.reduceMotion ? 1 : 0,
    flash: s.reduceFlashing ? 0 : 1,
    quality: s.shaderQuality,
  };
}
