import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rng } from '../../src/core/math';
import { MusicPlayer } from '../../src/audio/music/player';
import { MUSIC_STATES, themeFor, transition } from '../../src/audio/music/state';
import { HOURS, LAYERS, loopSeconds, THEMES, type LayerId } from '../../src/audio/music/themes';
import { offlineEngine, stats } from './offline';
import { AudioEngine } from '../../src/audio/engine';
import { INSTRUMENTS, type InstId } from '../../src/audio/music/instruments';
import { FakeContext } from './fake-context';

async function renderTheme(id: string, layers: Partial<Record<LayerId, number>>, seconds: number): Promise<Float32Array[]> {
  const { ctx, engine } = offlineEngine(seconds);
  const player = new MusicPlayer(engine);
  (player as unknown as { startTrack(id: string, at: number, fade: number): void }).startTrack(id, 0, 0.01);
  for (const l of LAYERS) player.setLayer(l, layers[l] ?? 0);
  // Offline contexts don't advance before rendering: schedule the whole window up front.
  player.update(seconds);
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}

describe('music state machine', () => {
  it('quantises story/menu changes to the bar and cuts to silence on failure', () => {
    expect(transition('title', 'story-calm')).toBe('bar');
    expect(transition('story-calm', 'story-tense')).toBe('bar');
    expect(transition('operation', 'failure')).toBe('cut');
    expect(transition('boss', 'failure')).toBe('cut');
    expect(transition('operation', 'victory')).toBe('beat');
    expect(transition('op-intro', 'operation')).toBe('continue');
    expect(transition('briefing', 'op-intro')).toBe('urgent');
    expect(transition('operation', 'boss')).toBe('urgent');
    expect(transition('victory', 'results')).toBe('bar');
    expect(transition('title', 'title')).toBe('none');
  });

  it('every state maps to a theme that exists (or to silence)', () => {
    for (const s of MUSIC_STATES) {
      for (const ctx of [{}, { chapter: 2 }, { hour: 'lauds' as const }, { won: false }]) {
        const t = themeFor(s, ctx);
        if (t !== null) expect(THEMES[t], `${s} → ${t}`).toBeDefined();
      }
    }
    expect(themeFor('operation', { chapter: 1 })).toBe('opA');
    expect(themeFor('operation', { chapter: 2 })).toBe('opB');
    expect(themeFor('failure')).toBeNull();
  });

  it('has a boss theme for every Malison hour', () => {
    for (const h of HOURS) expect(THEMES[h], h).toBeDefined();
  });

  it('demo tracks meet their loop lengths', () => {
    const len = (id: string) => loopSeconds(THEMES[id]);
    expect(len('title')).toBeGreaterThanOrEqual(120);
    expect(len('title')).toBeLessThanOrEqual(180);
    for (const id of ['opA', 'opB']) expect(len(id), id).toBeGreaterThanOrEqual(110);
    for (const id of ['hospice', 'tense', 'sorrow']) {
      expect(len(id), id).toBeGreaterThanOrEqual(90);
      expect(len(id), id).toBeLessThanOrEqual(150);
    }
    expect(len('briefing')).toBeGreaterThanOrEqual(60);
    expect(len('briefing')).toBeLessThanOrEqual(90);
  });
});

describe('procedural themes render', () => {
  // The synth's noise and detune use Math.random; seed it so the level checks are repeatable.
  beforeEach(() => {
    const rng = new Rng(1234);
    vi.spyOn(Math, 'random').mockImplementation(() => rng.next());
  });
  afterEach(() => vi.restoreAllMocks());

  for (const id of Object.keys(THEMES)) {
    it(`${id}: full stack is audible and leaves headroom`, async () => {
      const all = Object.fromEntries(LAYERS.map((l) => [l, l === 'stillness' ? 0 : 1]));
      const chs = await renderTheme(id, all, 6);
      const s = stats(chs, 0.5, 6);
      expect(s.finite).toBe(true);
      expect(s.rms, 'rms').toBeGreaterThan(0.004);
      // Music sits under SFX and VO: peaks stay below −6 dBFS even with every stem up.
      expect(s.peak, 'peak').toBeLessThan(0.5);
    });
  }

  it('each operation stem is audible on its own', async () => {
    for (const l of ['bed', 'pulse', 'tension', 'danger', 'clock', 'flow', 'stillness'] as LayerId[]) {
      const chs = await renderTheme('opA', { [l]: 1 }, 4);
      expect(stats(chs, 0.2, 4).rms, l).toBeGreaterThan(0.001);
    }
  });
});

describe('stem sync', () => {
  it('every stem stays on one bar clock: no drift after 20 minutes', () => {
    const ctx = new FakeContext();
    const engine = new AudioEngine(() => ctx as unknown as BaseAudioContext);
    engine.offline = true;
    engine.unlock();
    const player = new MusicPlayer(engine);
    const notes: { t: number; layer: unknown }[] = [];
    const saved = { ...INSTRUMENTS };
    for (const k of Object.keys(INSTRUMENTS) as InstId[]) INSTRUMENTS[k] = (s, _f, _d, _v, dest) => void notes.push({ t: s.t0, layer: dest });
    try {
      (player as unknown as { startTrack(id: string, at: number, fade: number): void }).startTrack('opA', 0.5, 0.01);
      for (const l of LAYERS) player.setLayer(l, 1);
      player.update(20 * 60);
    } finally {
      Object.assign(INSTRUMENTS, saved);
    }
    const spb = 60 / THEMES.opA.bpm;
    const bar = spb * THEMES.opA.beats;
    expect(notes.length).toBeGreaterThan(5000);
    // Every note, on every stem, falls on the shared sixteenth/triplet grid of its bar.
    const grid = spb / 12;
    for (const n of notes) {
      const k = Math.floor((n.t - 0.5) / bar + 1e-9);
      const within = n.t - 0.5 - k * bar;
      expect(Math.abs(within / grid - Math.round(within / grid)) * grid).toBeLessThan(0.001);
    }
    const last = Math.max(...notes.map((n) => n.t));
    expect(last).toBeGreaterThan(19 * 60);
    // All eight stems produced notes in the final minute.
    const lateLayers = new Set(notes.filter((n) => n.t > 19 * 60).map((n) => n.layer));
    expect(lateLayers.size).toBe(8);
  });
});
