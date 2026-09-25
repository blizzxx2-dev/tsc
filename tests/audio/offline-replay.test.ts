/**
 * Offline audio tests: the real engine rendered through node-web-audio-api's
 * OfflineAudioContext on a simulated clock — a full boss replay for clipping,
 * ducking depth, and loop stop timing.
 */
import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { AudioSystem } from '../../src/audio/system';
import { dbToGain } from '../../src/audio/mixer';
import { allOperations } from '../../src/content/campaign';
import { offlineEngine, stats } from './offline';
import { replay } from './replay';

const rmsDb = (chs: Float32Array[], a: number, b: number) => 20 * Math.log10(Math.max(1e-9, stats(chs, a, b).rms));

describe('offline renders', () => {
  it('op1-5 boss replay (music, ambience, SFX, heartbeat) never exceeds −0.5 dBFS', async () => {
    const def = allOperations().find((d) => d.id === 'op1-5')!;
    // Dry run for the length.
    const seconds = Math.ceil(replay(def).op.elapsed) + 6;
    // Peak safety is rate-independent; 8 kHz keeps this long render quick (AUDIO_SR overrides).
    const sr = Number(process.env.AUDIO_SR ?? 8000);
    const ctx = new OfflineAudioContext(2, sr * seconds, sr);
    const sys = new AudioSystem(() => ctx as unknown as BaseAudioContext);
    let t = 0.05;
    sys.engine.clock = () => t;
    sys.engine.offline = true;
    Object.assign(sys.engine.prefs, { muted: false, master: 100, music: 80, sfx: 90, ambience: 70, ui: 70, voice: 100, mono: false, dynamicRange: 'full', heartbeat: 'always', captions: false });
    sys.unlock();
    sys.kind = 'operation';
    const r = replay(def, sys, (time, s) => {
      t = time + 0.05;
      s.music.update();
      s.amb.update(1 / 60);
    });
    expect(r.op.status).toBe('won');
    expect(r.played.length).toBeGreaterThan(100);
    const buf = await ctx.startRendering();
    const chs = [buf.getChannelData(0), buf.getChannelData(1)];
    const s = stats(chs);
    expect(s.finite).toBe(true);
    expect(s.peak).toBeLessThanOrEqual(dbToGain(-0.5));
    expect(s.rms).toBeGreaterThan(0.005);
  }, 120_000);

  it('a bark ducks the music bus by 8 dB', async () => {
    const { ctx, engine } = offlineEngine(4);
    let t = 0;
    engine.clock = () => t;
    const o = ctx.createOscillator();
    o.frequency.value = 220;
    o.connect(engine.buses.music.input as unknown as AudioNode as never);
    o.start(0);
    for (; t < 4; t += 1 / 60) {
      if (Math.abs(t - 2) < 1 / 120) engine.ducker.trigger('bark', t, 1.2);
      engine.update(1 / 60);
    }
    const buf = await ctx.startRendering();
    const chs = [buf.getChannelData(0), buf.getChannelData(1)];
    const before = rmsDb(chs, 1.0, 1.9);
    const during = rmsDb(chs, 2.4, 3.1);
    expect(before - during).toBeGreaterThan(6.5);
    expect(before - during).toBeLessThan(9.5);
    expect(Math.abs(rmsDb(chs, 3.8, 4) - before)).toBeLessThan(1.5);
  });

  it('a held-tool loop is silent within 50 ms of release', async () => {
    const { ctx, engine } = offlineEngine(2);
    let t = 0.2;
    engine.clock = () => t;
    const h = engine.startLoop('loop.brand.sizzle', { material: 0 });
    for (; t < 1; t += 1 / 60) engine.update(1 / 60);
    engine.stopLoop(h);
    for (; t < 2; t += 1 / 60) engine.update(1 / 60);
    const buf = await ctx.startRendering();
    const chs = [buf.getChannelData(0), buf.getChannelData(1)];
    expect(stats(chs, 0.5, 0.95).rms).toBeGreaterThan(0.005);
    expect(stats(chs, 1.06, 2).peak).toBeLessThan(0.002);
  });
});
