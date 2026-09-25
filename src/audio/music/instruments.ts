/**
 * The procedural consort: early-modern instruments voiced from the synthesis
 * toolkit. Each plays one note at an absolute time into a destination node.
 * Palette per the music brief: hurdy-gurdy, viol, positive organ, plainchant
 * voices, lute, recorder, shawm, sackbut, frame drum, tabor and church bells.
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

type Play = (s: Synth, f: number, dur: number, vel: number, dest: AudioNode) => void;

function voiceGain(s: Synth, vel: number, dest: AudioNode): GainNode {
  return s.gain(vel, dest);
}

const organ: Play = (s, f, dur, vel, dest) => {
  const g = voiceGain(s, vel * 0.09, dest);
  const env = s.gain(0, g);
  for (const [r, a] of [
    [1, 1],
    [2, 0.45],
    [3, 0.22],
    [4, 0.18],
    [0.5, 0.25],
  ] as const)
    s.osc('sine', f * r, 0, dur + 0.25, s.gain(a, env));
  s.ahr(env.gain, 0, 0.04, Math.max(0.05, dur - 0.05), 0.2, 1);
  s.burst({ dur: 0.03, f: Math.min(8000, f * 4), q: 2, gain: vel * 0.02, dest });
};

const gurdy: Play = (s, f, dur, vel, dest) => {
  const g = voiceGain(s, vel * 0.05, dest);
  const env = s.gain(0, g);
  const body = s.filt('lowpass', 3200, 0.7, env);
  const peak = s.filt('peaking', 950, 1.2, body, 6);
  for (const det of [-4, 5]) s.osc('sawtooth', f, 0, dur + 0.15, peak, { detune: det });
  s.noise('pink', 0, dur + 0.15, s.filt('bandpass', f * 2, 3, s.gain(0.4, env)));
  s.ahr(env.gain, 0, 0.03, Math.max(0.03, dur - 0.04), 0.1, 1);
  s.burst({ dur: 0.012, f: 2200, q: 2, gain: vel * 0.02, dest });
};

const drone: Play = (s, f, dur, vel, dest) => {
  const g = voiceGain(s, vel * 0.04, dest);
  const env = s.gain(0, g);
  const lp = s.filt('lowpass', 1100, 0.7, env);
  s.osc('sawtooth', f, 0, dur + 0.4, lp, { detune: -3 });
  s.osc('sawtooth', f * 1.5, 0, dur + 0.4, s.gain(0.6, lp), { detune: 4 });
  s.ahr(env.gain, 0, 0.3, Math.max(0.1, dur - 0.3), 0.4, 1);
};

function violCore(s: Synth, f: number, dur: number, vel: number, dest: AudioNode, a: number, trem: boolean): void {
  const g = voiceGain(s, vel * 0.06, dest);
  const env = s.gain(0, g);
  const lp = s.filt('lowpass', 2600, 0.7, env);
  const body = s.filt('peaking', 520, 1.4, lp, 5);
  s.osc('sawtooth', f, 0, dur + 0.3, body, { vib: [5.4, 11] });
  s.noise('pink', 0, dur + 0.3, s.filt('bandpass', Math.min(8000, f * 3), 2, s.gain(0.25, env)));
  s.ahr(env.gain, 0, a, Math.max(0.05, dur - a), 0.25, 1);
  if (trem) {
    const l = s.ctx.createOscillator();
    const lg = s.ctx.createGain();
    l.frequency.value = 9;
    // Tremolo depth relative to the note's level (the LFO adds to the gain param).
    lg.gain.value = vel * 0.06 * 0.5;
    l.connect(lg);
    lg.connect(g.gain);
    l.start(s.at(0));
    l.stop(s.at(dur + 0.4));
  }
}

const viol: Play = (s, f, dur, vel, dest) => violCore(s, f, dur, vel, dest, 0.12, false);
const violTrem: Play = (s, f, dur, vel, dest) => violCore(s, f, dur, vel, dest, 0.05, true);
const violPizz: Play = (s, f, _dur, vel, dest) => {
  s.pluck(f, { gain: vel * 0.3, dur: 0.6, bright: 0.35, dest: s.filt('lowpass', 1800, 0.7, dest) });
};

const choirOf =
  (v: Vowel, a: number): Play =>
  (s, f, dur, vel, dest) => {
    s.vox(f, v, { dur: Math.max(0.1, dur - a * 0.5), a, r: 0.4, gain: vel * 0.07, vib: [4.8, 10], breath: 0.06, dest });
  };

const chant: Play = (s, f, dur, vel, dest) => {
  // Plainchant: a unison of men's voices, slightly spread.
  for (const det of [-5, 0, 6]) s.vox(f * 2 ** (det / 1200), 'o', { dur: Math.max(0.1, dur - 0.05), a: 0.08, r: 0.2, gain: vel * 0.035, vib: [4.5 + Math.random(), 8], breath: 0.05, dest });
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
  const g = voiceGain(s, vel * 0.06, dest);
  const env = s.gain(0, g);
  s.osc('sine', f, 0, dur + 0.1, env, { vib: [5, 7] });
  s.osc('triangle', f * 2, 0, dur + 0.1, s.gain(0.12, env));
  s.noise('pink', 0, dur + 0.1, s.filt('bandpass', Math.min(9000, f * 2), 4, s.gain(0.3, env)));
  s.ahr(env.gain, 0, 0.04, Math.max(0.03, dur - 0.06), 0.08, 1);
};

const shawm: Play = (s, f, dur, vel, dest) => {
  const g = voiceGain(s, vel * 0.035, dest);
  const env = s.gain(0, g);
  const nasal = s.filt('peaking', 1300, 1.3, s.filt('highpass', 280, 0.7, env), 9);
  s.osc('square', f, 0, dur + 0.1, nasal, { vib: [6, 9] });
  s.osc('sawtooth', f, 0, dur + 0.1, s.gain(0.6, nasal), { detune: 6 });
  s.ahr(env.gain, 0, 0.03, Math.max(0.03, dur - 0.05), 0.08, 1);
};

const sackbut: Play = (s, f, dur, vel, dest) => {
  const g = voiceGain(s, vel * 0.05, dest);
  const env = s.gain(0, g);
  const lp = s.filt('lowpass', f * 1.5, 1.2, env);
  lp.frequency.setValueAtTime(f * 1.5, s.at(0));
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), s.at(0.07));
  lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 3.5), s.at(0.3));
  s.osc('sawtooth', f, 0, dur + 0.15, lp, { vib: [5, 7] });
  s.ahr(env.gain, 0, 0.05, Math.max(0.03, dur - 0.07), 0.12, 1);
};

const drum: Play = (s, f, _dur, vel, dest) => {
  s.thump(f, f * 0.6, 0.35, vel * 0.24, 0, dest);
  s.burst({ dur: 0.05, f: 1400, q: 0.8, gain: vel * 0.06, dest, color: 'pink' });
};

const tabor: Play = (s, f, _dur, vel, dest) => {
  s.thump(f * 2, f * 1.4, 0.12, vel * 0.18, 0, dest);
  s.burst({ dur: 0.06, type: 'highpass', f: 2500, gain: vel * 0.08, dest });
};

const tick: Play = (s, f, _dur, vel, dest) => {
  s.modal(f, WOOD, { gain: vel * 0.1, dest, strike: vel * 0.03 });
};

const pad: Play = (s, f, dur, vel, dest) => {
  s.vox(f, 'u', { dur: Math.max(0.2, dur - 0.4), a: 0.6, r: 0.9, gain: vel * 0.06, vib: [4.5, 8], breath: 0.1, dest });
  s.tone(f * 2, dur + 0.5, { gain: vel * 0.008, a: 0.8, dest });
};

const scrape: Play = (s, f, dur, vel, dest) => {
  // A bowed string dragged hard and choked: the failure cut.
  const g = voiceGain(s, vel * 0.12, dest);
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
