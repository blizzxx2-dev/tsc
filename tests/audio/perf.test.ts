/** Opt-in render-cost benchmark: AUDIO_PERF=1 npx vitest run tests/audio/perf.test.ts */
import { it } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';
import { AudioSystem } from '../../src/audio/system';
import { LAYERS } from '../../src/audio/music/themes';

async function timeIt(label: string, setup: (sys: AudioSystem) => void, seconds = 10) {
  const sr = 48000;
  const ctx = new OfflineAudioContext(2, sr * seconds, sr);
  const sys = new AudioSystem(() => ctx as unknown as BaseAudioContext);
  let t = 0.05;
  sys.engine.clock = () => t;
  sys.engine.offline = true;
  sys.unlock();
  setup(sys);
  for (; t < seconds; t += 1 / 60) {
    sys.music.update();
    sys.amb.update(1 / 60);
    sys.engine.update(1 / 60);
  }
  const t0 = performance.now();
  await ctx.startRendering();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(28)} ${(ms / (seconds * 10)).toFixed(1)}% of real time`);
}

it.runIf(process.env.AUDIO_PERF)('audio render cost per component (48 kHz, % of one core)', async () => {
  for (const l of LAYERS) await timeIt(`opA only ${l}`, (s) => { s.music.setState('operation', { chapter: 1 }); for (const x of LAYERS) s.music.setLayer(x, x === l ? 1 : 0); s.engine.setSpace('none'); });
  await timeIt('empty (buses, no reverb)', () => {});
  await timeIt('theatre reverb only', (s) => s.engine.setSpace('theatre'));
  await timeIt('chapel reverb only', (s) => s.engine.setSpace('chapel'));
  await timeIt('theatre ambience + reverb', (s) => s.amb.set('theatre'));
  await timeIt('night ambience', (s) => { s.amb.set('night'); s.engine.setSpace('none'); });
  await timeIt('opA bed+pulse', (s) => { s.music.setState('operation', { chapter: 1 }); s.engine.setSpace('none'); });
  await timeIt('opA all layers', (s) => { s.music.setState('operation', { chapter: 1 }); for (const l of LAYERS) s.music.setLayer(l, 1); s.engine.setSpace('none'); });
  await timeIt('matins all layers', (s) => { s.music.setState('boss', { hour: 'matins' }); for (const l of LAYERS) s.music.setLayer(l, 1); s.engine.setSpace('none'); });
  await timeIt('title', (s) => { s.music.setState('title'); s.engine.setSpace('none'); });
  await timeIt('curse bed', (s) => { s.amb.setCurse(1, 10); s.engine.setSpace('none'); });
  await timeIt('lauds voices x4', (s) => { for (let i = 0; i < 4; i++) s.engine.startLoop('loop.lauds.voice', { note: i * 3 }); });
  await timeIt('grub x3 + sizzle + bleed', (s) => { for (let i = 0; i < 3; i++) s.engine.startLoop('loop.grub.chitter'); s.engine.startLoop('loop.brand.sizzle', { material: 2 }); s.engine.startLoop('loop.bleed.trickle', { severity: 1 }); });
}, 600000);
