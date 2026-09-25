/**
 * Gameplay loudness capture (opt-in: AUDIO_CAPTURE=<out.wav>). Replays Chapter
 * operations back to back through the full audio system on an offline context
 * and writes the mix as a 32-bit float WAV for `scripts/audio-loudness.mjs`.
 * Run via `node scripts/audio-capture.mjs`.
 */
import { writeFileSync } from 'node:fs';
import { OfflineAudioContext } from 'node-web-audio-api';
import { expect, it } from 'vitest';
import { AudioSystem } from '../../src/audio/system';
import { allOperations } from '../../src/content/campaign';
import { replay } from './replay';

const OUT = process.env.AUDIO_CAPTURE;
const SR = Number(process.env.AUDIO_SR ?? 22050);
const MINUTES = Number(process.env.AUDIO_MINUTES ?? 10);

function wavFloat(chs: Float32Array[], sr: number): Buffer {
  const n = chs[0].length;
  const buf = Buffer.alloc(44 + n * chs.length * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * chs.length * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(chs.length, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * chs.length * 4, 28);
  buf.writeUInt16LE(chs.length * 4, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * chs.length * 4, 40);
  let p = 44;
  for (let i = 0; i < n; i++) for (const c of chs) (buf.writeFloatLE(c[i], p), (p += 4));
  return buf;
}

it.runIf(OUT)(
  'renders a gameplay capture',
  async () => {
    const ops = allOperations();
    const lengths = ops.map((d) => replay(d).op.elapsed + 3);
    let total = 0;
    const plan: typeof ops = [];
    for (let i = 0; total < MINUTES * 60; i = (i + 1) % ops.length) {
      plan.push(ops[i]);
      total += lengths[i];
    }
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * total), SR);
    const sys = new AudioSystem(() => ctx as unknown as BaseAudioContext);
    let t = 0.05;
    sys.engine.clock = () => t;
    sys.engine.offline = true;
    Object.assign(sys.engine.prefs, { muted: false, master: 100, music: 80, sfx: 90, ambience: 70, ui: 70, voice: 100, mono: false, dynamicRange: 'full', heartbeat: 'low', captions: false });
    sys.unlock();
    sys.kind = 'operation';
    let offset = 0;
    for (const def of plan) {
      const r = replay(def, sys, (time, s) => {
        t = offset + time;
        s.music.update();
        s.amb.update(1 / 60);
      });
      offset += r.op.elapsed + 3;
      t = offset;
      sys.op.end();
    }
    const buf = await ctx.startRendering();
    writeFileSync(OUT!, wavFloat([buf.getChannelData(0), buf.getChannelData(1)], SR));
    expect(buf.length).toBeGreaterThan(SR * 60);
  },
  3_600_000,
);
