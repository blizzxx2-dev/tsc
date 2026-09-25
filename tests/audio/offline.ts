/** Offline rendering helpers: the real engine on node-web-audio-api's OfflineAudioContext. */
import { OfflineAudioContext } from 'node-web-audio-api';
import { AudioEngine } from '../../src/audio/engine';

export const SR = 22050;

export interface Rendered {
  chs: Float32Array[];
  engine: AudioEngine;
}

export function offlineEngine(seconds: number, sr = SR): { ctx: OfflineAudioContext; engine: AudioEngine } {
  const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
  const engine = new AudioEngine();
  engine.prefs.muted = false;
  engine.prefs.master = 100;
  engine.prefs.music = 100;
  engine.prefs.sfx = 100;
  engine.prefs.ui = 100;
  engine.prefs.ambience = 100;
  engine.prefs.voice = 100;
  engine.prefs.mono = false;
  engine.prefs.dynamicRange = 'full';
  engine.prefs.captions = true;
  engine.prefs.heartbeat = 'low';
  engine.prefs.patientVox = true;
  engine.prefs.reduceStress = false;
  engine.offline = true;
  engine.build(ctx as unknown as BaseAudioContext);
  return { ctx, engine };
}

export async function render(fn: (e: AudioEngine) => void, seconds: number, sr = SR): Promise<Float32Array[]> {
  const { ctx, engine } = offlineEngine(seconds, sr);
  fn(engine);
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}

/**
 * Render an offline context in chunks: the simulation is advanced `chunk` seconds at a time while
 * the renderer is suspended, so nodes are created just before they sound and the engine's due
 * clean-ups (`flushDeferred`) take finished ones out of the graph. A graph holding every voice of a
 * whole boss fight at once renders quadratically slower.
 */
export async function renderChunked(ctx: OfflineAudioContext, engine: AudioEngine, advance: (to: number) => void, chunk = 1): Promise<Float32Array[]> {
  const seconds = ctx.length / ctx.sampleRate;
  advance(chunk);
  for (let at = chunk; at < seconds - chunk / 2; at += chunk) {
    const to = at + chunk;
    void ctx.suspend(at).then(() => {
      engine.flushDeferred(at);
      advance(to);
      void ctx.resume();
    });
  }
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}

/** Peak and RMS (linear) over [from, to) seconds. */
export function stats(chs: Float32Array[], from = 0, to = Infinity, sr = SR): { peak: number; rms: number; finite: boolean } {
  let peak = 0;
  let sum = 0;
  let n = 0;
  let finite = true;
  for (const d of chs) {
    const a = Math.floor(from * sr);
    const b = Math.min(d.length, Math.floor(to * sr));
    for (let i = a; i < b; i++) {
      const x = d[i];
      if (!Number.isFinite(x)) finite = false;
      peak = Math.max(peak, Math.abs(x));
      sum += x * x;
      n++;
    }
  }
  return { peak, rms: n ? Math.sqrt(sum / n) : 0, finite };
}
