import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { encode } from '../src/core/save/codec';
import { ACTIONS, DEFAULT_BINDINGS, DEFAULT_SETTINGS, SETTINGS_SCHEMA, settingsMetadata, type Settings } from '../src/core/settings/schema';
import { applyPreset, defaultsFor, detectPreset, findConflicts, readSettings, rebind, sanitizeBindings, validateSettings } from '../src/core/settings/validate';
import { applyDeckPreset, autoDetect, frameCapFor, gpuTier, resolveLanguage } from '../src/core/settings/detect';
import { onSettingChange, resetSettings, setSetting, settings } from '../src/core/settings';

describe('settings validation', () => {
  it('clamps out-of-range values, drops unknown keys, defaults missing keys', () => {
    const { settings: s, warnings } = validateSettings({ volume: 7, renderScale: 0.1, frameCap: 143, bogus: 1, displayMode: 'exclusive', vsync: 'yes' });
    expect(s.volume).toBe(1);
    expect(s.renderScale).toBe(0.5);
    expect(s.frameCap).toBe(144); // snapped to the nearest listed cap
    expect('bogus' in s).toBe(false);
    expect(s.displayMode).toBe(DEFAULT_SETTINGS.displayMode);
    expect(s.vsync).toBe(DEFAULT_SETTINGS.vsync);
    expect(s.textSpeed).toBe(DEFAULT_SETTINGS.textSpeed);
    expect(warnings.some((w) => w.includes('bogus'))).toBe(true);
    expect(warnings.some((w) => w.includes('volume'))).toBe(true);
  });

  it('a corrupt file yields defaults plus a warning', () => {
    const r = readSettings('{"format":"suture-and-steel","kind":"settings","sum":"deadbeef","data":{"volume":0.1}}');
    expect(r.settings.volume).toBe(DEFAULT_SETTINGS.volume);
    expect(r.warnings[0]).toMatch(/corrupt/);
    expect(readSettings('not json').warnings[0]).toMatch(/corrupt/);
  });

  it('migrates the v1 localStorage settings object', () => {
    const r = readSettings(readFileSync('tests/fixtures/saves/settings-v1.json', 'utf8'));
    expect(r.found).toBe(true);
    expect(r.settings).toMatchObject({ volume: 0.4, shake: 0.5, timerAssist: 1.5, litanyKey: true, reduceFlashing: true, version: 2 });
  });

  it('round-trips through the checksummed envelope', () => {
    const s: Settings = { ...structuredClone(DEFAULT_SETTINGS), volume: 0.3, colorFilter: 'tritanopia' };
    expect(readSettings(encode('settings', s)).settings).toEqual(s);
  });
});

describe('input bindings', () => {
  it('defaults are conflict-free and cover every action', () => {
    expect(findConflicts(DEFAULT_BINDINGS)).toEqual([]);
    expect(Object.keys(DEFAULT_BINDINGS).sort()).toEqual([...ACTIONS].sort());
  });

  it('rebinding to a used key swaps the two actions', () => {
    const b = { ...DEFAULT_BINDINGS };
    expect(rebind(b, 'litany', 'Digit1')).toBe('tool1');
    expect(b.litany).toBe('Digit1');
    expect(b.tool1).toBe('Space');
    expect(findConflicts(b)).toEqual([]);
    expect(() => rebind(b, 'pause', '../evil')).toThrow();
  });

  it('conflicting stored bindings are reset to defaults with a warning', () => {
    const warnings: string[] = [];
    const b = sanitizeBindings({ ...DEFAULT_BINDINGS, tool2: 'Digit1', pause: 'bad key!' }, warnings);
    expect(findConflicts(b)).toEqual([]);
    expect(b.tool1).toBe('Digit1');
    expect(b.tool2).toBe('Digit2');
    expect(b.pause).toBe('Escape');
    expect(warnings.length).toBe(2);
  });
});

describe('presets, reset, metadata', () => {
  it('preset members follow the preset and custom is detected', () => {
    const s = structuredClone(DEFAULT_SETTINGS) as Settings;
    applyPreset(s, 'low');
    expect(s).toMatchObject({ antialias: 'off', particleQuality: 'low', bloom: false });
    expect(detectPreset(s)).toBe('low');
    s.bloom = true;
    expect(detectPreset(s)).toBe('custom');
  });

  it('per-category defaults touch only that category', () => {
    const audio = defaultsFor('audio');
    expect(Object.keys(audio).sort()).toEqual(['ambience', 'audioOffset', 'music', 'muteWhenUnfocused', 'muted', 'sfx', 'voice', 'volume']);
    expect(Object.keys(defaultsFor(null)).length).toBe(SETTINGS_SCHEMA.length);
  });

  it('metadata export describes every setting for the options screen', () => {
    const meta = settingsMetadata();
    const keys = Object.keys(DEFAULT_SETTINGS).filter((k) => k !== 'version');
    expect(meta.map((m) => m.key).sort()).toEqual(keys.sort());
    for (const m of meta) {
      expect(m.labelKey).toBe(`settings.${m.key}`);
      expect(m.category).toBeTruthy();
      expect(m.widget).toBeTruthy();
    }
    expect(meta.find((m) => m.key === 'vsync')?.requiresRestart).toBe(true);
    expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
  });
});

describe('first-launch detection', () => {
  it('maps GPUs to tiers', () => {
    expect(gpuTier('Google SwiftShader')).toBe('low');
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('high');
    expect(gpuTier('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)')).toBe('low');
    expect(gpuTier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)')).toBe('medium');
    expect(gpuTier('AMD Custom GPU 0405 (radeonsi, vangogh, LLVM 15)')).toBe('medium');
    expect(gpuTier('Apple M1')).toBe('medium');
    expect(gpuTier('Apple M2 Pro')).toBe('high');
    expect(gpuTier(null)).toBe('medium');
  });

  it('matches the display refresh to a frame cap', () => {
    expect(frameCapFor(59.94)).toBe(60);
    expect(frameCapFor(143.9)).toBe(144);
    expect(frameCapFor(165)).toBe(165);
    expect(frameCapFor(NaN)).toBe(0);
  });

  it('resolves language: explicit → Steam → OS → English', () => {
    const shipped = ['en', 'de', 'pt-BR'];
    expect(resolveLanguage('de', 'french', 'fr-FR', shipped)).toBe('de');
    expect(resolveLanguage('auto', 'german', 'fr-FR', shipped)).toBe('de');
    expect(resolveLanguage('auto', 'brazilian', 'en-US', shipped)).toBe('pt-BR');
    expect(resolveLanguage('auto', null, 'de-AT', shipped)).toBe('de');
    expect(resolveLanguage('auto', 'japanese', 'ja-JP', shipped)).toBe('en');
    expect(resolveLanguage('xx', null, null, shipped)).toBe('en');
  });

  it('the Steam Deck preset overrides hardware detection', () => {
    const s = structuredClone(DEFAULT_SETTINGS) as Settings;
    autoDetect(s, { gpuRenderer: 'NVIDIA GeForce RTX 4090', refreshHz: 90, steamLanguage: 'english', osLocale: 'en-US', isDeck: true });
    expect(s).toMatchObject({ displayMode: 'fullscreen', preset: 'medium', frameCap: 60, uiScale: 1.15 });
    const d = structuredClone(DEFAULT_SETTINGS) as Settings;
    autoDetect(d, { gpuRenderer: 'NVIDIA GeForce RTX 4090', refreshHz: 144, steamLanguage: null, osLocale: 'en-GB', isDeck: false });
    expect(d).toMatchObject({ preset: 'high', frameCap: 144, language: 'auto' });
    const deck = structuredClone(DEFAULT_SETTINGS) as Settings;
    applyDeckPreset(deck);
    expect(validateSettings(deck).warnings).toEqual([]);
  });
});

describe('settings service', () => {
  it('emits change events and keeps the preset consistent', () => {
    const seen: [string, unknown][] = [];
    const off = onSettingChange('*', (v, k) => seen.push([k, v]));
    setSetting('preset', 'low');
    expect(settings.antialias).toBe('off');
    setSetting('antialias', 'msaa4');
    expect(settings.preset).toBe('custom');
    settings.muted = !settings.muted; // direct mutation, as the options scene does
    setSetting('volume', 0.2);
    expect(seen.map(([k]) => k)).toEqual(expect.arrayContaining(['preset', 'antialias', 'bloom', 'muted', 'volume']));
    off();
    resetSettings('graphics');
    expect(settings.preset).toBe(DEFAULT_SETTINGS.preset);
    expect(settings.volume).toBe(0.2);
    resetSettings();
    expect(settings.volume).toBe(DEFAULT_SETTINGS.volume);
  });
});
