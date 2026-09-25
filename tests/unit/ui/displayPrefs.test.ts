/** ENG-0164: post settings (toggle + 0–100 % amount, reduce-flashing) map to renderer multipliers. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA } from '../../../src/core/settings/schema';
import { normaliseLegacyAmounts, validateSettings } from '../../../src/core/settings/validate';
import { displayPrefs } from '../../../src/ui/display';

describe('display prefs', () => {
  it('defaults give full-strength effects, flashing allowed and the high tier', () => {
    const p = displayPrefs(DEFAULT_SETTINGS);
    expect(p).toMatchObject({ bloom: 1, grain: 1, chroma: 1, flicker: 1, vignette: 1, still: 0, flash: 1, quality: 'high' });
  });

  it('amount sliders scale each effect and the toggle switches it off', () => {
    const s = { ...DEFAULT_SETTINGS, bloomAmount: 40, grainAmount: 25, chromaAmount: 0, flickerAmount: 60 };
    expect(displayPrefs(s)).toMatchObject({ bloom: 0.4, grain: 0.25, chroma: 0, flicker: 0.6 });
    expect(displayPrefs({ ...s, bloom: false, grain: false }).bloom).toBe(0);
    expect(displayPrefs({ ...s, bloom: false, grain: false }).grain).toBe(0);
    // An old caller without amount keys still gets the toggle semantics.
    const { bloomAmount: _b, grainAmount: _g, chromaAmount: _c, flickerAmount: _f, ...legacy } = DEFAULT_SETTINGS;
    expect(displayPrefs(legacy).bloom).toBe(1);
  });

  it('reduce-flashing holds flashes steady and stills the flicker; reduce-motion keeps flashes', () => {
    expect(displayPrefs({ ...DEFAULT_SETTINGS, reduceFlashing: true })).toMatchObject({ flash: 0, flicker: 0 });
    expect(displayPrefs({ ...DEFAULT_SETTINGS, reduceMotion: true })).toMatchObject({ flash: 1, flicker: 0, still: 1 });
  });

  it('schema exposes the amounts as 0–100 sliders in the graphics category', () => {
    for (const k of ['bloomAmount', 'grainAmount', 'chromaAmount', 'flickerAmount'] as const) {
      const def = SETTINGS_SCHEMA.find((d) => d.key === k);
      expect(def).toMatchObject({ category: 'graphics', widget: 'slider', type: 'number', min: 0, max: 100 });
      expect(DEFAULT_SETTINGS[k]).toBe(100);
    }
  });

  it('migrates numeric toggle strengths from older files and clamps out-of-range amounts', () => {
    const w: string[] = [];
    expect(normaliseLegacyAmounts({ bloom: 0.5, grain: 0, flicker: 75, chromaticAberration: true }, w)).toMatchObject({
      bloom: true,
      bloomAmount: 50,
      grain: false,
      flicker: true,
      flickerAmount: 75,
      chromaticAberration: true,
    });
    expect(w).toHaveLength(3);
    const r = validateSettings({ bloom: 0.5, bloomAmount: 250, grainAmount: -5 });
    expect(r.settings).toMatchObject({ bloom: true, bloomAmount: 100, grainAmount: 0 });
    // A v1 file that only knew the toggles keeps the default 100 %.
    expect(validateSettings({ bloom: false }).settings).toMatchObject({ bloom: false, bloomAmount: 100 });
  });
});
