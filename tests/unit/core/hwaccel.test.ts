/** ENG-0194: software rasterisers force the Low tier and get a one-time "hardware acceleration is off" notice. */
import { describe, expect, it } from 'vitest';
import { classifyTier, FULL_CAPS, probeCaps } from '../../../src/render/caps';
import { HWACCEL_HELP_URL, softwareRenderPlan, SOFTWARE_TIER } from '../../../src/platform/hwaccel';
import { fakeGl } from '../../fakegl';

const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('software rendering detection (ENG-0194)', () => {
  for (const renderer of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Microsoft Basic Render Driver',
  ]) {
    it(`recognises "${renderer.slice(0, 24)}…" and forces Low`, () => {
      const caps = probeCaps(fakeGl({ renderer }).gl);
      expect(caps.software).toBe(true);
      expect(classifyTier(caps, 1).tier).toBe('low');
      expect(softwareRenderPlan(caps, memStore()).forceLow).toBe(true);
    });
  }

  it('shows the notice once per machine, with a help link', () => {
    const store = memStore();
    const caps = { ...FULL_CAPS, software: true };
    expect(softwareRenderPlan(caps, store)).toEqual({ forceLow: true, notify: true });
    expect(softwareRenderPlan(caps, store)).toEqual({ forceLow: true, notify: false });
    expect(HWACCEL_HELP_URL).toMatch(/^https:\/\//);
    expect(SOFTWARE_TIER).toMatchObject({ shaderQuality: 'low', particleQuality: 'low' });
  });

  it('leaves hardware renderers alone', () => {
    expect(softwareRenderPlan(probeCaps(fakeGl({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)' }).gl), memStore())).toEqual({
      forceLow: false,
      notify: false,
    });
  });
});
