/**
 * Audio debug overlay (F4): active voices by bus, bus RMS/peak meters, the
 * snapshot stack, music state/section/layers, loaded banks and decoded memory,
 * output latency, and the last 20 events fired (fallbacks marked).
 */
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { BusId } from './events';
import { LAYERS } from './music/themes';
import type { AudioSystem } from './system';

const BUSES: BusId[] = ['music', 'world', 'hud', 'ui', 'vo', 'ambience'];
const toDb = (x: number): number => (x <= 1e-6 ? -99 : 20 * Math.log10(x));

export function drawAudioDebug(g: Gfx, sys: AudioSystem): void {
  const eng = sys.engine;
  const x = 16;
  let y = 120;
  g.rect(x - 8, y - 22, 430, 560, hex('#000000', 0.78));
  const line = (s: string, c = '#d8e8d0', size = 14) => {
    g.text(s, x, y, { size, color: hex(c), shadow: false, font: 'body' });
    y += size + 4;
  };
  line('AUDIO  (F4)', '#f5d76e', 16);
  const lat = eng.latency();
  line(`ctx ${eng.ctx ? (eng.ctx as AudioContext).state ?? 'offline' : 'locked'}  sr ${eng.ctx?.sampleRate ?? 0}  latency ${Math.round((lat.base + lat.output) * 1000)} ms`);
  const byBus = eng.voices.byBus();
  line(`voices ${eng.voices.count()} / 48   loops ${eng.activeLoops}`);
  for (const b of BUSES) {
    const m = eng.ready ? eng.meter(b) : { rms: 0, peak: 0 };
    const rmsDb = toDb(m.rms);
    const pkDb = toDb(m.peak);
    const w = 150;
    const by = y - 10;
    g.text(`${b.padEnd(8)} ${String(byBus[b] ?? 0).padStart(2)}`, x, y, { size: 13, color: hex('#c8d8c0'), shadow: false });
    g.rect(x + 110, by, w, 8, hex('#203020'));
    g.rect(x + 110, by, Math.max(0, Math.min(1, (rmsDb + 60) / 60)) * w, 8, hex('#60c070'));
    const px = x + 110 + Math.max(0, Math.min(1, (pkDb + 60) / 60)) * w;
    g.rect(px - 1, by - 2, 2, 12, hex(pkDb > -3 ? '#ff5040' : '#f0e0a0'));
    g.text(`${rmsDb.toFixed(0)} / ${pkDb.toFixed(0)} dB`, x + 270, y, { size: 12, color: hex('#a0b0a0'), shadow: false });
    y += 17;
  }
  line(`snapshots: ${eng.snapshots.list().join(' > ')}`);
  const mu = sys.music;
  line(`music: ${mu.state} / ${mu.track?.theme.id ?? '—'} / ${mu.section ?? '—'}  (${mu.lastTransition})${mu.litany ? '  STILLNESS' : ''}`);
  line(`layers: ${LAYERS.map((l) => `${l[0]}${l[1]}${Math.round(mu.layerTarget(l) * 9)}`).join(' ')}`);
  line(`ambience: ${sys.amb.current ?? '—'}   space: ${eng.space}`);
  line(`banks: ${eng.assets.loaded().join(', ') || '—'}   ${(eng.assets.memoryBytes() / 1048576).toFixed(1)} MB`);
  line(`fallback plays: ${eng.fallbackPlays}`, eng.fallbackPlays ? '#ff9060' : '#a0b0a0');
  y += 4;
  line('last events:', '#f5d76e');
  for (const e of [...eng.log].reverse()) line(`${e.t.toFixed(2).padStart(7)}  ${e.bus.padEnd(8)} ${e.id}${e.fallback ? '  [FALLBACK]' : ''}`, e.fallback ? '#ff9060' : '#b0c0b0', 12);
}
