/**
 * The procedural consort: early-modern instruments voiced from the synthesis
 * toolkit. Each plays one note at an absolute time into a destination node.
 * Palette per the music brief: hurdy-gurdy, viol, positive organ, plainchant
 * voices, lute, recorder, shawm, sackbut, frame drum, tabor and church bells.
 *
 * Sustained voices use cached PeriodicWaves (filtered saws, organ registrations,
 * formant vowels computed per note) so a note costs one or two oscillators and
 * an envelope rather than a filter chain — the score runs many notes a second.
 */
import { BELL, GLASS, WOOD, type Synth, type Vowel } from '../synth';

export type InstId =
  | 'organ'
  | 'gurdy'
  | 'drone'
  | 'viol'
  | 'violTrem'
  | 'violPizz'
  | 'choir'
  | 'choirU'
  | 'chant'
  | 'bell'
  | 'chime'
  | 'lute'
  | 'recorder'
  | 'shawm'
  | 'sackbut'
  | 'drum'
  | 'tabor'
  | 'tick'
  | 'pad'
  | 'scrape';

export const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const ftom = (f: number): number => Math.round(69 + 12 * Math.log2(f / 440));

type Play = (s: Synth, f: number, dur: number, vel: number, dest: AudioNode) => void;

// ---------------------------------------------------------------- spectra

const harmonicsFor = (f: number, top = 9000): number => Math.max(4, Math.min(96, Math.floor(top / f)));
/** Two-pole lowpass magnitude. */
const lp2 = (hz: number, fc: number): number => 1 / Math.sqrt(1 + (hz / fc) ** 4);
/** Resonant peak (Lorentzian) of gain `g` dB at `fc` with bandwidth `bw`. */
const peak = (hz: number, fc: number, bw: number, g: number): number => 1 + (10 ** (g / 20) - 1) / (1 + ((hz - fc) / (bw / 2)) ** 2);

const VOWELS: Record<Vowel, readonly (readonly [number, number, number])[]> = {
  a: [
    [800, 110, 1],
    [1150, 120, 0.5],
    [2900, 160, 0.25],
  ],
  e: [
    [400, 90, 1],
    [1700, 130, 0.4],
    [2600, 160, 0.25],
  ],
  i: [
    [290, 80, 1],
    [2100, 130, 0.3],
    [2950, 160, 0.2],
  ],
  o: [
    [450, 90, 1],
    [800, 100, 0.55],
    [2830, 140, 0.15],
  ],
  u: [
    [325, 80, 1],
    [700, 90, 0.35],
    [2530, 130, 0.1],
  ],
};

function vowelWave(s: Synth, v: Vowel, f: number): PeriodicWave {
  const m = ftom(f);
  const f0 = mtof(m);
  return s.bank.wave(`vowel:${v}:${m}`, harmonicsFor(f0, 5000), (k) => {
    const hz = k * f0;
    let env = 0.02;
    for (const [F, bw, g] of VOWELS[v]) env += g / (1 + ((hz - F) / (bw / 2)) ** 2);
    return env / k ** 0.6;
  });
}

function sawWave(s: Synth, key: string, f: number, shape: (hz: number) => number): PeriodicWave {
  const m = ftom(f);
  const f0 = mtof(m);
  return s.bank.wave(`${key}:${m}`, harmonicsFor(f0), (k) => shape(k * f0) / k);
}

/** One or more detuned oscillators on a wave through an attack-hold-release envelope. */
function waveVoice(s: Synth, w: PeriodicWave, f: number, dur: number, gain: number, dest: AudioNode, a: number, r: number, detunes: readonly number[] = [0], vib?: readonly [number, number]): GainNode {
  const env = s.gain(0, dest);
  for (const d of detunes) {
    const o = s.osc('sine', f, 0, dur + r + 0.05, env, { detune: d, vib });
    o.setPeriodicWave(w);
  }
  s.ahr(env.gain, 0, a, Math.max(0.02, dur - a), r, gain / Math.sqrt(detunes.length));
  return env;
}

// ---------------------------------------------------------------- instruments

const organ: Play = (s, f, dur, vel, dest) => {
  // Principal 8', octave 4', twelfth, fifteenth and a soft 16' — voiced on a sub-octave fundamental.
  const w = s.bank.wave('organ', 9, (k) => ({ 1: 0.25, 2: 1, 4: 0.45, 6: 0.22, 8: 0.18 })[k] ?? 0);
  waveVoice(s, w, f / 2, dur, vel * 0.09, dest, 0.04, 0.2);
  s.burst({ dur: 0.03, f: Math.min(8000, f * 4), q: 2, gain: vel * 0.015, dest });
};

const gurdy: Play = (s, f, dur, vel, dest) => {
  const w = sawWave(s, 'gurdy', f, (hz) => lp2(hz, 3200) * peak(hz, 950, 500, 6));
  waveVoice(s, w, f, dur, vel * 0.06, dest, 0.03, 0.1, [-4, 5]);
  s.burst({ dur: 0.012, f: 2200, q: 2, gain: vel * 0.02, dest });
};

const drone: Play = (s, f, dur, vel, dest) => {
  const w = sawWave(s, 'drone', f, (hz) => lp2(hz, 1100));
  waveVoice(s, w, f, dur, vel * 0.045, dest, 0.3, 0.4, [-3]);
  waveVoice(s, w, f * 1.5, dur, vel * 0.03, dest, 0.3, 0.4, [4]);
};

function violCore(s: Synth, f: number, dur: number, vel: number, dest: AudioNode, a: number, trem: boolean): void {
  const w = sawWave(s, 'viol', f, (hz) => lp2(hz, 2600) * peak(hz, 520, 400, 5));
  const g = s.gain(1, dest);
  waveVoice(s, w, f, dur, vel * 0.07, g, a, 0.25, [0], [5.4, 11]);
  if (trem) {
    // Tremolo around 0.55 ± 0.45 of the note's level (the LFO adds to the gain param).
    g.gain.value = 0.55;
    const l = s.ctx.createOscillator();
    const lg = s.ctx.createGain();
    l.frequency.value = 9;
    lg.gain.value = 0.45;
    l.connect(lg);
    lg.connect(g.gain);
    l.start(s.at(0));
    l.stop(s.at(dur + 0.4));
  }
}

const viol: Play = (s, f, dur, vel, dest) => violCore(s, f, dur, vel, dest, 0.12, false);
const violTrem: Play = (s, f, dur, vel, dest) => violCore(s, f, dur, vel, dest, 0.05, true);
const violPizz: Play = (s, f, _dur, vel, dest) => {
  s.pluck(f, { gain: vel * 0.3, dur: 0.6, bright: 0.35, dest });
};

const choirOf =
  (v: Vowel, a: number): Play =>
  (s, f, dur, vel, dest) => {
    waveVoice(s, vowelWave(s, v, f), f, Math.max(0.1, dur - a * 0.5), vel * 0.1, dest, a, 0.4, [-6, 7]);
  };

const chant: Play = (s, f, dur, vel, dest) => {
  // Plainchant: a unison of men's voices, slightly spread.
  waveVoice(s, vowelWave(s, 'o', f), f, Math.max(0.1, dur - 0.05), vel * 0.1, dest, 0.08, 0.2, [-5, 6]);
};

const bell: Play = (s, f, _dur, vel, dest) => {
  s.burst({ dur: 0.02, f: f * 3, q: 1, gain: vel * 0.03, dest });
  s.modal(f, BELL, { gain: vel * 0.08, dest, detune: 0.004 });
};

const chime: Play = (s, f, _dur, vel, dest) => {
  s.modal(f, GLASS, { gain: vel * 0.05, dest, decay: 1.6 });
};

const lute: Play = (s, f, _dur, vel, dest) => {
  s.pluck(f, { gain: vel * 0.28, dur: 1.4, bright: 0.55, dest });
};

const recorder: Play = (s, f, dur, vel, dest) => {
  const w = s.bank.wave('recorder', 4, (k) => [0, 1, 0.12, 0.05, 0.02][k] ?? 0);
  waveVoice(s, w, f, dur, vel * 0.06, dest, 0.04, 0.08, [0], [5, 7]);
};

const shawm: Play = (s, f, dur, vel, dest) => {
  const m = ftom(f);
  const f0 = mtof(m);
  const w = s.bank.wave(`shawm:${m}`, harmonicsFor(f0, 7000), (k) => ((k % 2 ? 1 : 0.55) / k) * peak(k * f0, 1300, 700, 9) * (k * f0 < 280 ? 0.3 : 1));
  waveVoice(s, w, f, dur, vel * 0.035, dest, 0.03, 0.08, [0, 6], [6, 9]);
};

const sackbut: Play = (s, f, dur, vel, dest) => {
  const g = s.gain(vel * 0.05, dest);
  const env = s.gain(0, g);
  const lp = s.filt('lowpass', f * 1.5, 1.2, env);
  lp.frequency.setValueAtTime(f * 1.5, s.at(0));
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), s.at(0.07));
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 3.5), s.at(0.3));
  s.osc('sawtooth', f, 0, dur + 0.15, lp, { vib: [5, 7] });
  s.ahr(env.gain, 0, 0.05, Math.max(0.03, dur - 0.07), 0.12, 1);
};

// Percussion is rendered once per pitch into a buffer (JS synthesis) and replayed: the
// score fires many hits a second, and a buffer voice is one node instead of a dozen.
function hit(s: Synth, buf: AudioBuffer, gain: number, dest: AudioNode): void {
  const src = s.ctx.createBufferSource();
  src.buffer = buf;
  const g = s.gain(gain, dest);
  src.connect(g);
  src.start(s.at(0));
}

/** One-pole filtered noise helper state. */
function noiseBurst(d: Float32Array, sr: number, amp: number, decay: number, lpHz: number, hpHz: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * lpHz) / sr);
  const b = Math.exp((-2 * Math.PI * hpHz) / sr);
  let lp = 0;
  let prev = 0;
  let hp = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t / decay);
    if (env < 1e-4) break;
    lp += a * (Math.random() * 2 - 1 - lp);
    hp = b * (hp + lp - prev);
    prev = lp;
    d[i] += amp * env * hp;
  }
}

function sineDrop(d: Float32Array, sr: number, f0: number, f1: number, drop: number, amp: number, decay: number): void {
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.002);
    const f = f1 + (f0 - f1) * Math.exp(-t / drop);
    ph += (2 * Math.PI * f) / sr;
    d[i] += amp * env * Math.sin(ph);
  }
}

const drum: Play = (s, f, _dur, vel, dest) => {
  const buf = s.bank.texture(`drum:${Math.round(f)}`, 0.5, (d, sr) => {
    sineDrop(d, sr, f, f * 0.6, 0.06, 1, 0.13);
    noiseBurst(d, sr, 0.9, 0.015, 3000, 500);
  });
  hit(s, buf, vel * 0.24, dest);
};

const tabor: Play = (s, f, _dur, vel, dest) => {
  const buf = s.bank.texture(`tabor:${Math.round(f)}`, 0.3, (d, sr) => {
    sineDrop(d, sr, f * 2, f * 1.4, 0.03, 1, 0.045);
    noiseBurst(d, sr, 1.6, 0.025, 9000, 2500);
  });
  hit(s, buf, vel * 0.18, dest);
};

const tick: Play = (s, f, _dur, vel, dest) => {
  const buf = s.bank.texture(`tick:${Math.round(f)}`, 0.15, (d, sr) => {
    for (const [r, dec, g] of WOOD.slice(0, 2)) sineDrop(d, sr, f * r, f * r, 1, g, dec * 0.4);
    noiseBurst(d, sr, 0.5, 0.003, 8000, 1500);
  });
  hit(s, buf, vel * 0.1, dest);
};

const pad: Play = (s, f, dur, vel, dest) => {
  waveVoice(s, vowelWave(s, 'u', f), f, Math.max(0.2, dur - 0.4), vel * 0.08, dest, 0.6, 0.9, [-5, 6]);
  s.tone(f * 2, dur + 0.5, { gain: vel * 0.008, a: 0.8, dest });
};

const scrape: Play = (s, f, dur, vel, dest) => {
  // A bowed string dragged hard and choked: the failure cut.
  const g = s.gain(vel * 0.12, dest);
  const env = s.gain(0, g);
  const bp = s.filt('bandpass', f * 3, 2, env);
  s.osc('sawtooth', f, 0, dur, bp, { f1: f * 0.7, vib: [17, 60] });
  s.noise('white', 0, dur, s.filt('bandpass', 1800, 1.5, s.gain(0.6, env)));
  s.ahr(env.gain, 0, 0.02, dur * 0.8, dur * 0.2, 1);
};

export const INSTRUMENTS: Record<InstId, Play> = {
  organ,
  gurdy,
  drone,
  viol,
  violTrem,
  violPizz,
  choir: choirOf('a', 0.25),
  choirU: choirOf('u', 0.35),
  chant,
  bell,
  chime,
  lute,
  recorder,
  shawm,
  sackbut,
  drum,
  tabor,
  tick,
  pad,
  scrape,
};
