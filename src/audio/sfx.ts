/**
 * The designed sound set, synthesised. Each recipe renders one variation of an
 * event into the voice's output node and returns the absolute time it ends.
 * Palette (see docs/audio/sfx-direction.md): steel, horn, wood, glass, wax, wet
 * leather, embers and church bronze — no modern beeps.
 *
 * `v` selects a variation (stable character per index); cosmetic jitter uses
 * Math.random. `p` carries event parameters (intensity, pan-independent data).
 */
import { AMBIENCE_LOOPS } from './beds';
import { LATER_LOOPS, LATER_RECIPES } from './sfx-later';
import { BELL, CLAY, GLASS, glide, HANDBELL, PLATE, rnd, STEEL, WOOD, type Synth, type Vowel } from './synth';

export type Params = Record<string, number>;
export type Recipe = (s: Synth, v: number, p: Params) => number;

export interface LoopVoice {
  /** Set a named parameter (0..1 unless documented otherwise) at audio time `now`. */
  set(name: string, value: number, now: number): void;
  /** Called every frame with the context time; schedules granular detail ahead. */
  tick?(now: number): void;
  /** Fade out over `fade` seconds from `at` and release sources. Returns end time. */
  stop(at: number, fade: number): number;
}
export type LoopRecipe = (s: Synth, p: Params) => LoopVoice;

/** Stable pseudo-random value in [0,1) for a variation index and salt. */
export const vr = (v: number, salt = 0): number => {
  const x = Math.sin((v + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const pick = <T>(list: readonly T[], v: number): T => list[v % list.length];
const max = (...xs: number[]): number => Math.max(...xs);
const semis = (n: number): number => 2 ** (n / 12);

// ---------------------------------------------------------------- shared gestures

function wetSquelch(s: Synth, at: number, dur: number, gain: number, lo = 250, hi = 900): number {
  const e1 = s.burst({ color: 'pink', at, dur, a: 0.01, f: hi, f1: lo, q: 2.5, gain: gain * 0.9 });
  const e2 = s.burst({ color: 'brown', at, dur: dur * 0.8, type: 'lowpass', f: 700, gain: gain * 0.7 });
  const e3 = s.bubbles(Math.round(4 + dur * 20), lo, hi, dur * 0.7, gain * 0.35, at);
  return max(e1, e2, e3);
}

function pop(s: Synth, at: number, gain: number, f = 260): number {
  s.burst({ at, dur: 0.03, f: 1400, q: 0.8, gain: gain * 0.5 });
  return s.tone(f, 0.06, { f1: f * 0.35, gain, at });
}

function steelTick(s: Synth, at: number, f: number, gain: number): number {
  return s.modal(f, STEEL, { at, gain, strike: gain * 0.6, decay: 0.6 });
}

function paper(s: Synth, at: number, dur: number, gain: number, f = 2500, f1 = 900): number {
  // Paper: bandpassed noise with a flutter of tiny crackles.
  const a = s.burst({ at, dur, a: dur * 0.3, f, f1, q: 0.9, gain });
  const b = s.crackle({ at, dur: dur * 0.8, gain: gain * 0.6, hp: 2500, rate: 1.5 });
  return max(a, b);
}

function whoosh(s: Synth, at: number, dur: number, gain: number, f0 = 500, f1 = 2400): number {
  const g = s.gain(0);
  const f = s.filt('bandpass', f0 * s.k, 1.4, g);
  f.frequency.setValueAtTime(f0 * s.k, s.at(at));
  f.frequency.exponentialRampToValueAtTime(f1 * s.k, s.at(at + dur * 0.55));
  f.frequency.exponentialRampToValueAtTime(f0 * 0.8 * s.k, s.at(at + dur));
  s.noise('pink', at, dur, f);
  g.gain.setValueAtTime(0.0001, s.at(at));
  g.gain.linearRampToValueAtTime(gain, s.at(at + dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, s.at(at + dur));
  return s.at(at + dur);
}

/** A soft reversed swell (Litany end warning, rejoin warning). */
function swell(s: Synth, at: number, dur: number, gain: number, f = 900, f1 = 3200): number {
  const g = s.gain(0);
  const flt = s.filt('bandpass', f * s.k, 2, g);
  flt.frequency.exponentialRampToValueAtTime(f1 * s.k, s.at(at + dur));
  s.noise('pink', at, dur, flt);
  g.gain.setValueAtTime(0.0001, s.at(at));
  g.gain.exponentialRampToValueAtTime(gain, s.at(at + dur * 0.97));
  g.gain.linearRampToValueAtTime(0.0001, s.at(at + dur));
  return s.at(at + dur);
}

/** Choir chord: several formant voices on the given semitone offsets from `root`. */
function choir(s: Synth, root: number, chord: readonly number[], at: number, dur: number, gain: number, v: Vowel = 'a', a = 0.4, r = 0.8): number {
  let end = 0;
  for (const n of chord) end = max(end, s.vox(root * semis(n), v, { at: at + Math.random() * 0.04, dur, a, r, gain: gain / Math.sqrt(chord.length), vib: [rnd(4.5, 5.5), 12], breath: 0.05 }));
  return end;
}

function bellStrike(s: Synth, f: number, at: number, gain: number, decay = 1): number {
  s.burst({ at, dur: 0.02, f: f * 3, q: 1, gain: gain * 0.4 });
  return s.modal(f, BELL, { at, gain, decay, detune: 0.004 });
}

/** Cloth rustle: soft noise with a grainy flutter. */
function cloth(s: Synth, dur: number, gain: number, lp: number): number {
  const a = s.burst({ dur, type: 'lowpass', f: lp, gain, color: 'pink', a: dur * 0.3 });
  const b = s.crackle({ dur, gain: gain * 1.5, hp: 1200, rate: 0.6, a: dur * 0.2 });
  return max(a, b);
}

function knock(s: Synth, at: number, f: number, gain: number): number {
  s.burst({ at, dur: 0.02, type: 'lowpass', f: 1800, gain: gain * 0.5, color: 'brown' });
  return s.modal(f, WOOD, { at, gain });
}

function metalScrape(s: Synth, at: number, dur: number, gain: number, f = 5200, f1 = 2400): number {
  s.burst({ at, dur, f, f1, q: 9, gain: gain * 0.7 });
  return s.burst({ at, dur: dur * 0.8, type: 'highpass', f: 3500, gain: gain * 0.4 });
}

/** A formant-synth patient vocal. Voice type: 0 man, 1 woman, 2 elder, 3 deep (dwarves, orcs, hornfolk, giants). */
const VOICE_F0 = [118, 215, 100, 88];
const VOICE_SHIFT = [1, 1.17, 0.97, 0.9];
function patientVox(s: Synth, type: number, vowel: Vowel, dur: number, contour: readonly (readonly [number, number])[], gain: number, rough = 0, breath = 0.2): number {
  const f0 = VOICE_F0[type % 4];
  const jitter = type === 2 ? [7, 40] as const : [5, 14] as const;
  return s.vox(f0 * contour[0][1], vowel, { dur, a: 0.03, r: 0.15, gain, shift: VOICE_SHIFT[type % 4], glide: contour.slice(1).map(([t, m]) => [t, f0 * m] as const), vib: jitter, breath, rough: rough + (type === 3 ? 0.4 : 0) });
}

// ---------------------------------------------------------------- one-shot recipes

export const RECIPES: Record<string, Recipe> = {
  // ------------------------------------------------ Lancet
  'sfx.lancet.touch': (s, v) => max(steelTick(s, 0, 3000 + vr(v) * 900, 0.08), s.burst({ dur: 0.04, type: 'lowpass', f: 1400, gain: 0.12, color: 'pink' })),
  'sfx.lancet.cut': (s, v) => max(s.burst({ dur: 0.13, f: 5200 + vr(v) * 1500, f1: 1900, q: 1.6, gain: 0.3, color: 'white' }), wetSquelch(s, 0.03, 0.12, 0.08, 600, 1600)),
  'sfx.lancet.open': (s, v) => max(wetSquelch(s, 0, 0.32 + vr(v) * 0.1, 0.35, 220, 800), s.thump(110, 60, 0.18, 0.12, 0.02)),
  'sfx.lancet.slip': (s, v) => max(metalScrape(s, 0, 0.18, 0.18, 6200 + vr(v) * 800, 2200), steelTick(s, 0, 2600, 0.05)),
  'sfx.lancet.air': (s, v) => max(whoosh(s, 0, 0.24 + vr(v) * 0.06, 0.2, 600, 2800), s.burst({ at: 0.05, dur: 0.12, f: 7000, q: 6, gain: 0.03 })),
  'sfx.lancet.nick': (s, v) => max(s.burst({ dur: 0.06, f: 4200 + vr(v) * 800, f1: 2400, q: 2, gain: 0.3 }), steelTick(s, 0, 3400, 0.07), s.bubbles(3, 500, 1100, 0.05, 0.1, 0.01)),

  // ------------------------------------------------ Tongs
  'sfx.tongs.click': (s, v) => max(steelTick(s, 0, 2100 + vr(v) * 300, 0.12), steelTick(s, 0.045 + vr(v, 1) * 0.02, 2500 + vr(v, 2) * 300, 0.1)),
  'sfx.tongs.grabFlesh': (s, v) => max(steelTick(s, 0, 2300 + vr(v) * 300, 0.1), wetSquelch(s, 0.01, 0.12, 0.18, 300, 900)),
  'sfx.tongs.grabHard': (s, v) => max(steelTick(s, 0, 2300 + vr(v) * 300, 0.12), s.modal(1300 + vr(v, 1) * 400, WOOD, { at: 0.005, gain: 0.14, strike: 0.08 })),
  'sfx.extract.arrow': (s, v) => max(pop(s, 0, 0.3, 240 + vr(v) * 60), wetSquelch(s, 0, 0.18, 0.2), knock(s, 0.05, 620 + vr(v, 1) * 120, 0.14), whoosh(s, 0.02, 0.2, 0.06, 700, 1800)),
  'sfx.extract.bolt': (s, v) => max(pop(s, 0, 0.36, 200 + vr(v) * 40), wetSquelch(s, 0, 0.2, 0.22), knock(s, 0.05, 480 + vr(v, 1) * 90, 0.18), steelTick(s, 0.07, 1900, 0.06)),
  'sfx.extract.shot': (s, v) => max(pop(s, 0, 0.3, 300), wetSquelch(s, 0, 0.14, 0.18), s.modal(520 + vr(v) * 80, WOOD, { at: 0.04, gain: 0.12, decay: 0.7 })),
  'sfx.extract.tooth': (s, v) => max(s.burst({ dur: 0.16, type: 'highpass', f: 2200, gain: 0.08, color: 'crackle', rate: 1.8 }), pop(s, 0.12, 0.26, 280 + vr(v) * 50), steelTick(s, 0.16, 3600, 0.05)),
  'sfx.extract.glass': (s, v) => max(pop(s, 0, 0.24), s.modal(3200 + vr(v) * 900, GLASS, { at: 0.04, gain: 0.08, decay: 0.6 }), s.modal(4100 + vr(v, 1) * 800, GLASS, { at: 0.07, gain: 0.05, decay: 0.4 })),
  'sfx.extract.shard': (s, v) => max(pop(s, 0, 0.26), s.modal(1800 + vr(v) * 400, STEEL, { at: 0.04, gain: 0.08 })),
  'sfx.extract.hexstone': (s, v) => max(pop(s, 0, 0.28, 220), s.modal(660 * semis(vr(v) * 2), GLASS, { at: 0.03, gain: 0.14, decay: 2 }), s.modal(699 * semis(vr(v) * 2), GLASS, { at: 0.03, gain: 0.1, decay: 2 }), s.whisper(['i', 'u'], { at: 0.05, dur: 0.6, gain: 0.05 })),
  'sfx.tongs.dish': (s, v) => max(s.modal(840 + vr(v) * 160, PLATE, { gain: 0.1, strike: 0.08 }), s.modal(1900, STEEL, { at: 0.08 + vr(v, 1) * 0.05, gain: 0.04 })),

  // ------------------------------------------------ Leech-pipe
  'sfx.leech.slurp': (s, v) => max(s.bubbles(9, 180, 700, 0.25, 0.22), s.burst({ at: 0.18, dur: 0.18, f: 1300, f1: 280, q: 3, gain: 0.3, color: 'pink' }), s.burst({ dur: 0.3, type: 'lowpass', f: 600, gain: 0.18, color: 'brown', a: 0.1 }) + vr(v) * 0),

  // ------------------------------------------------ Gut thread
  'sfx.thread.pierce': (s, v, p) => {
    const step = Math.min(12, p.step ?? 0);
    return max(s.burst({ dur: 0.03, f: 2600, q: 1.4, gain: 0.2 }), s.modal(1800 * semis(step), STEEL, { gain: 0.05, decay: 0.5 }), s.bubbles(2, 700, 1300, 0.02, 0.06, 0.01) + vr(v) * 0);
  },
  'sfx.thread.zip': (s, v) => s.burst({ dur: 0.14 + vr(v) * 0.05, f: 1500, f1: 4200, q: 3, gain: 0.08, a: 0.03 }),
  'sfx.thread.knot': (s, v) => max(s.burst({ dur: 0.1, f: 1800, f1: 4000, q: 3, gain: 0.09, a: 0.02 }), s.burst({ at: 0.12, dur: 0.1, f: 2000, f1: 4400, q: 3, gain: 0.09, a: 0.02 }), knock(s, 0.24, 360 + vr(v) * 60, 0.12), s.tone(95, 0.12, { at: 0.24, type: 'sawtooth', lp: 500, gain: 0.03 })),

  // ------------------------------------------------ Saint's salve
  'sfx.salve.lid': (s, v) => max(s.modal(1050 + vr(v) * 150, CLAY, { gain: 0.14, strike: 0.08 }), s.burst({ at: 0.03, dur: 0.12, f: 1600, q: 1, gain: 0.04 })),
  'sfx.salve.seal': (s, v) => {
    const notes = [0, 3, 7, 10, 12].map((n) => 1175 * semis(n + pick([0, 2, -2], v)));
    let end = 0;
    notes.forEach((f, i) => (end = max(end, s.tone(f, 0.5, { at: i * 0.05, gain: 0.04, a: 0.02, vib: [6, 8] }))));
    return max(end, s.burst({ dur: 0.5, type: 'highpass', f: 6000, gain: 0.03, a: 0.1 }));
  },

  // ------------------------------------------------ Tincture
  'sfx.tincture.clink': (s, v) => max(s.modal(2700 + vr(v) * 500, GLASS, { gain: 0.08, decay: 0.4 }), s.modal(3300 + vr(v, 1) * 500, GLASS, { at: 0.06, gain: 0.04, decay: 0.3 })),
  'sfx.tincture.done': (s, v) => {
    const root = pick([587, 659, 523], v);
    return max(swell(s, 0, 0.35, 0.06, 500, 2400), ...[0, 4, 7, 12].map((n, i) => s.modal(root * semis(n), GLASS, { at: 0.3 + i * 0.07, gain: 0.05, decay: 1.2 })));
  },
  'sfx.tincture.ready': (s) => s.modal(2400, GLASS, { gain: 0.035, decay: 0.3 }),

  // ------------------------------------------------ Cautery brand
  'sfx.brand.quench': (s, v) => max(s.burst({ dur: 0.6 + vr(v) * 0.2, type: 'highpass', f: 1800, f1: 5200, gain: 0.14, a: 0.01 }), s.bubbles(6, 600, 1600, 0.2, 0.06)),

  // ------------------------------------------------ Scrying lens
  'sfx.lens.found': (s, v) => {
    const root = pick([880, 988, 784], v);
    return max(...[0, 7, 12, 16].map((n, i) => s.modal(root * semis(n), GLASS, { at: i * 0.08, gain: 0.07, decay: 1.4 })), swell(s, 0, 0.3, 0.04, 1500, 5000));
  },

  // ------------------------------------------------ Tool pick-up (one per instrument)
  'sfx.tool.lancet': (s) => max(metalScrape(s, 0, 0.16, 0.1, 7000, 3500), steelTick(s, 0.12, 3300, 0.06)),
  'sfx.tool.tongs': (s) => max(steelTick(s, 0, 2100, 0.08), steelTick(s, 0.05, 2400, 0.07), s.tone(180, 0.18, { at: 0.02, vib: [22, 60], gain: 0.04, type: 'triangle' })),
  'sfx.tool.leech': (s) => max(s.modal(1500, GLASS, { gain: 0.07, decay: 0.3 }), s.bubble(420, 0.05, 0.1, 0.03)),
  'sfx.tool.thread': (s) => max(s.burst({ dur: 0.1, f: 1800, f1: 4200, q: 3, gain: 0.07, a: 0.02 }), knock(s, 0.1, 900, 0.05)),
  'sfx.tool.salve': (s) => s.modal(1080, CLAY, { gain: 0.12, strike: 0.06 }),
  'sfx.tool.tincture': (s) => max(s.modal(2900, GLASS, { gain: 0.07, decay: 0.4 }), s.modal(3500, GLASS, { at: 0.05, gain: 0.04, decay: 0.3 })),
  'sfx.tool.brand': (s) => max(s.modal(380, PLATE, { gain: 0.08, strike: 0.1, decay: 0.4 }), s.crackle({ dur: 0.3, gain: 0.12, hp: 1500 })),
  'sfx.tool.lens': (s) => max(s.tone(1320, 0.5, { gain: 0.03, a: 0.05, vib: [5, 10] }), s.tone(1980, 0.4, { gain: 0.015, a: 0.05 })),
  'sfx.tool.deny': (s) => max(knock(s, 0, 190, 0.14), s.burst({ dur: 0.05, type: 'lowpass', f: 500, gain: 0.08, color: 'brown' })),

  // ------------------------------------------------ Bleeding
  'sfx.blood.drip': (s, v) => s.bubble(900 + vr(v) * 700, 0.04, 0.1),
  'sfx.blood.flooded': (s, v) => max(s.burst({ dur: 0.1, type: 'lowpass', f: 1300, gain: 0.25, color: 'pink' }), s.bubbles(6, 200, 600, 0.12, 0.14), s.thump(90, 50, 0.12, 0.12) + vr(v) * 0),

  // ------------------------------------------------ Embedded objects
  'sfx.hexstone.pulse': (s, v) => max(s.modal(330, GLASS, { gain: 0.08, decay: 2.2 }), s.modal(333.5, GLASS, { gain: 0.06, decay: 2.2 }), s.whisper(pick([['i', 'e', 'u'], ['u', 'a'], ['e', 'i']] as Vowel[][], v), { dur: 1.1, gain: 0.05, at: 0.1 })),
  'sfx.barb.tear': (s, v) => max(s.burst({ dur: 0.35 + vr(v) * 0.1, f: 1500, f1: 700, q: 1.2, gain: 0.3, color: 'crackle', rate: 0.8 }), wetSquelch(s, 0.05, 0.3, 0.3, 200, 700), s.thump(80, 45, 0.2, 0.15)),

  // ------------------------------------------------ Burns
  'sfx.burn.crack': (s, v) => max(s.crackle({ dur: 0.12, gain: 0.5, hp: 1400, rate: 1.4 }), s.burst({ dur: 0.015, f: 3000 + vr(v) * 1500, q: 2, gain: 0.2 })),
  'sfx.burn.dressed': (s, v) => max(s.burst({ dur: 0.9, type: 'highpass', f: 2200, f1: 7000, gain: 0.08, a: 0.05 }), s.modal(1318 * semis(pick([0, 2, -1], v)), GLASS, { at: 0.3, gain: 0.05, decay: 1 })),

  // ------------------------------------------------ Plague
  'sfx.bubo.creak': (s, v) => {
    const g = s.gain(0.06);
    const bp = s.filt('bandpass', 700 + vr(v) * 200, 4, g);
    s.osc('sawtooth', 60 + vr(v, 1) * 30, 0, 0.45, bp, { f1: 45, vib: [13, 90] });
    return s.env(g.gain, 0, 0.1, 0.35, 0.08);
  },
  'sfx.bubo.lance': (s, v) => max(pop(s, 0, 0.3, 320 + vr(v) * 60), wetSquelch(s, 0.02, 0.35, 0.3, 180, 600)),
  'sfx.bubo.burst': (s) => max(s.thump(90, 40, 0.3, 0.3), wetSquelch(s, 0, 0.5, 0.45, 150, 520)),
  'sfx.rot.purged': (s, v) => max(swell(s, 0, 0.3, 0.05, 700, 3000), s.tone(523 * semis(pick([0, 2], v)), 0.9, { at: 0.25, gain: 0.04, a: 0.05, vib: [5, 6] }), s.tone(784 * semis(pick([0, 2], v)), 0.8, { at: 0.3, gain: 0.025, a: 0.05 })),

  // ------------------------------------------------ Venom
  'sfx.venom.neutralise': (s, v) => max(s.bubbles(28, 1600, 4200, 0.5, 0.05), s.modal(1568 * semis(vr(v) * 2), GLASS, { at: 0.35, gain: 0.05 })),

  // ------------------------------------------------ Grubs & spiderlings
  'sfx.grub.seared': (s, v) => max(s.tone(1900 + vr(v) * 500, 0.22, { f1: 3100, gain: 0.05, vib: [30, 80], type: 'triangle' }), s.tone(2600, 0.18, { at: 0.18, f1: 1100, gain: 0.04, vib: [30, 80], type: 'triangle' }), s.crackle({ dur: 0.35, gain: 0.3, hp: 2500 }), pop(s, 0.05, 0.1, 500)),
  // Three distinct dying squeals (GAM-0085): a rising whistle, a chirping pair, a falling wail. `variant` picks one.
  'sfx.grub.squeal': (s, v, p) => {
    const k = (p.variant ?? v) % 3;
    if (k === 0) return s.tone(1700, 0.28, { f1: 3400, gain: 0.045, vib: [40, 90], type: 'triangle' });
    if (k === 1) return max(s.tone(2400, 0.1, { f1: 2900, gain: 0.04, type: 'triangle' }), s.tone(2600, 0.12, { at: 0.13, f1: 3300, gain: 0.04, type: 'triangle' }));
    return s.tone(3200, 0.34, { f1: 1200, gain: 0.045, vib: [25, 70], type: 'sawtooth' });
  },
  'sfx.grub.plucked': (s, v) => max(s.tone(1500 + vr(v) * 400, 0.12, { f1: 2600, gain: 0.05, type: 'triangle', vib: [25, 60] }), wetSquelch(s, 0, 0.08, 0.1, 400, 1000)),
  'sfx.grub.burrow': (s, v) => max(s.burst({ dur: 0.4, type: 'lowpass', f: 900, f1: 250, gain: 0.12, color: 'pink', a: 0.05 }), s.bubbles(4, 250, 500, 0.3, 0.05) + vr(v) * 0),
  'sfx.spider.seared': (s, v) => max(s.tone(2600 + vr(v) * 500, 0.14, { f1: 3800, gain: 0.04, vib: [40, 90], type: 'triangle' }), s.crackle({ dur: 0.25, gain: 0.3, hp: 3000 })),
  'sfx.eggsac.lance': (s, v) => max(pop(s, 0, 0.3, 260 + vr(v) * 50), wetSquelch(s, 0.01, 0.3, 0.32, 180, 650)),
  'sfx.eggsac.hatch': (s, v) => max(s.thump(120, 50, 0.2, 0.25), wetSquelch(s, 0, 0.4, 0.4, 160, 700), ...Array.from({ length: 14 }, (_, i) => s.burst({ at: 0.15 + i * 0.03 + Math.random() * 0.02, dur: 0.012, f: 3000 + vr(v, i) * 1500, q: 3, gain: 0.08 }))),

  // ------------------------------------------------ Curse-sigil
  'sfx.sigil.crack': (s, v) => max(s.crackle({ dur: 0.2, gain: 0.4, hp: 1200, rate: 0.8 }), s.modal(1200 + vr(v) * 400, GLASS, { gain: 0.07, decay: 0.5 }), s.thump(140, 70, 0.1, 0.08)),
  'sfx.sigil.broken': (s, v) => {
    const shards = Array.from({ length: 12 }, (_, i) => s.modal(2000 + vr(v, i) * 3500, GLASS, { at: Math.random() * 0.25, gain: 0.04, decay: 0.8 }));
    return max(...shards, s.burst({ dur: 0.4, type: 'highpass', f: 3000, gain: 0.18 }), bellStrike(s, 440 * semis(pick([0, -2, 3], v)), 0.02, 0.1, 0.8), s.thump(100, 45, 0.3, 0.2));
  },
  'sfx.sigil.lash': (s, v) => max(s.burst({ dur: 0.05, f: 3000, q: 0.7, gain: 0.35 }), s.burst({ at: 0.03, dur: 0.3, type: 'highpass', f: 2500, f1: 800, gain: 0.08 }), s.whisper(['a', 'i'], { at: 0, dur: 0.4, gain: 0.06, shift: 0.8 + vr(v) * 0.2 })),

  // ------------------------------------------------ Patient vocals (0 man, 1 woman, 2 elder, 3 deep)
  'sfx.patient.moan': (s, v, p) => patientVox(s, p.voice ?? 0, pick(['o', 'u', 'a'] as Vowel[], v), 0.9, [[0, 1.05], [0.5, 0.92], [0.9, 0.8]], 0.12, 0.1, 0.25),
  'sfx.patient.pain': (s, v, p) => patientVox(s, p.voice ?? 0, pick(['a', 'e'] as Vowel[], v), 0.32, [[0, 1.5], [0.08, 2.1], [0.32, 1.3]], 0.16, 0.2, 0.3),
  'sfx.patient.relief': (s, v, p) => max(s.whisper(['a', 'o'], { dur: 0.8, gain: 0.07, shift: VOICE_SHIFT[(p.voice ?? 0) % 4] }), patientVox(s, p.voice ?? 0, 'o', 0.35, [[0, 1], [0.35, 0.85]], 0.04, 0, 0.5) + vr(v) * 0),
  'sfx.patient.death': (s, v, p) => {
    let end = patientVox(s, p.voice ?? 0, 'a', 0.9, [[0, 0.9], [0.9, 0.6]], 0.08, 0.6, 0.4);
    for (let i = 0; i < 5; i++) end = max(end, s.burst({ at: 0.9 + i * 0.13 + vr(v, i) * 0.04, dur: 0.07, type: 'lowpass', f: 500, gain: 0.08 * (1 - i / 6), color: 'brown' }));
    return end;
  },

  // ------------------------------------------------ Malison of Matins
  'sfx.matins.shroud': (s, v) => max(choir(s, 147 * semis(pick([0, 1], v)), [0, 1, 7, 12], 0, 0.9, 0.12, 'o', 0.6, 0.6), swell(s, 0, 1.2, 0.05, 300, 1500)),
  'sfx.malison.rend': (s, v) => max(s.burst({ dur: 0.45, f: 1200, f1: 500, q: 1, gain: 0.3, color: 'crackle', rate: 0.7 }), wetSquelch(s, 0.05, 0.35, 0.3, 150, 600), s.vox(70 + vr(v) * 10, 'o', { dur: 0.5, a: 0.05, r: 0.2, gain: 0.08, rough: 0.8 })),
  'sfx.matins.shriek': (s, v) => {
    const d = s.drive(6);
    const f = 640 + vr(v) * 160;
    const e = s.vox(f, 'e', { dur: 0.45, a: 0.02, r: 0.2, gain: 0.07, glide: [[0.1, f * 1.5], [0.45, f * 1.1]], vib: [9, 60], dest: d, breath: 0.3 });
    return max(e, s.crackle({ dur: 0.3, gain: 0.2, hp: 2000 }));
  },
  'sfx.matins.shed': (s, v) => max(wetSquelch(s, 0, 0.3, 0.25, 180, 700), ...Array.from({ length: 8 }, (_, i) => s.burst({ at: 0.1 + i * 0.04, dur: 0.012, f: 2800 + vr(v, i) * 1500, q: 3, gain: 0.06 }))),
  'sfx.matins.split': (s, v) => max(s.thump(70, 30, 0.8, 0.35), s.crackle({ dur: 0.5, gain: 0.5, hp: 600, rate: 0.6 }), ...Array.from({ length: 6 }, (_, i) => s.modal(1500 + vr(v, i) * 2500, GLASS, { at: 0.05 + Math.random() * 0.2, gain: 0.04 })), choir(s, 110, [0, 1, 6], 0, 0.5, 0.1, 'a', 0.02, 0.4)),
  'sfx.matins.rejoinWarn': (s) => max(swell(s, 0, 2, 0.16, 400, 3000), s.whisper(['i', 'e', 'i', 'u'], { dur: 2, gain: 0.08 }), s.tone(220, 2, { f1: 330, gain: 0.03, a: 1.8, type: 'sawtooth', lp: 900 }), s.tone(233, 2, { f1: 349, gain: 0.03, a: 1.8, type: 'sawtooth', lp: 900 })),
  'sfx.matins.rejoin': (s) => max(s.thump(60, 28, 0.9, 0.4), choir(s, 98, [0, 1, 6, 12], 0, 0.6, 0.12, 'o', 0.01, 0.5)),
  'sfx.malison.unmade': (s, v) => max(s.thump(55, 25, 1.4, 0.4), choir(s, 196 * semis(pick([0, 1], v)), [0, 3, 7, 12], 0, 1.2, 0.12, 'a', 0.02, 1.4), bellStrike(s, 98, 0.3, 0.16, 1.4), s.crackle({ dur: 1, gain: 0.25, hp: 700 })),

  // ------------------------------------------------ Malison of Lauds
  'sfx.lauds.silenced': (s, v, p) => {
    const f = 330 * semis(p.note ?? pick([0, 3, 7, 10], v));
    const e = s.vox(f, 'a', { dur: 0.08, a: 0.005, r: 0.05, gain: 0.1 });
    return max(e, s.burst({ at: 0.07, dur: 0.02, f: 2000, q: 1, gain: 0.08 }), s.burst({ at: 0.06, dur: 0.3, type: 'highpass', f: 3000, gain: 0.04 }));
  },
  'sfx.lauds.recall': (s) => max(choir(s, 196, [0, 4, 7, 11], 0, 1.4, 0.14, 'a', 1.2, 0.6), swell(s, 0, 1.4, 0.06, 600, 2600)),
  'sfx.lauds.hymn': (s, v) => {
    const root = 262 * semis(pick([0, 2, -1], v));
    // A verse that builds for 0.68 s (the ring's travel) before the tear lands.
    return max(choir(s, root, [0, 4, 7, 11, 14], 0, 0.6, 0.18, 'a', 0.5, 0.3), swell(s, 0, 0.66, 0.1, 500, 4000));
  },
  'sfx.lauds.hymnBlast': (s) => max(s.thump(80, 35, 0.5, 0.35), s.burst({ dur: 0.4, f: 900, f1: 300, q: 0.7, gain: 0.3, color: 'crackle', rate: 0.7 }), choir(s, 131, [0, 1, 6, 12], 0, 0.25, 0.14, 'a', 0.01, 0.4)),
  'sfx.lauds.submerge': (s) => max(s.bubbles(14, 120, 420, 0.7, 0.22), s.burst({ dur: 0.9, type: 'lowpass', f: 1200, f1: 150, gain: 0.25, color: 'brown', a: 0.05 })),
  'sfx.lauds.surface': (s) => max(s.bubbles(8, 200, 600, 0.2, 0.2), ...[0, 7, 12].map((n, i) => s.modal(784 * semis(n), GLASS, { at: 0.05 + i * 0.05, gain: 0.07, decay: 1 })), choir(s, 196, [0, 7, 12], 0.05, 0.4, 0.1, 'o', 0.03, 0.5)),
  'sfx.lauds.shatter': (s, v) => max(s.thump(90, 40, 0.5, 0.35), ...Array.from({ length: 16 }, (_, i) => s.modal(1200 + vr(v, i) * 3000, GLASS, { at: Math.random() * 0.3, gain: 0.045, decay: 1 })), s.burst({ dur: 0.5, type: 'highpass', f: 2500, gain: 0.18 })),
  'sfx.lauds.death': (s) => {
    const e = choir(s, 262, [0, 4, 7, 12], 0, 1.4, 0.14, 'a', 0.02, 1);
    return max(e, bellStrike(s, 131, 0.4, 0.16, 1.5), s.thump(60, 30, 1, 0.3));
  },

  // ------------------------------------------------ Hour bells (boss intro cards)
  'sfx.bell.matins': (s) => max(...[0, 2.4, 4.8].map((t) => bellStrike(s, 110, t, 0.22, 1.4))),
  'sfx.bell.lauds': (s) => {
    const peal = [392, 349, 330, 294, 262, 247];
    let end = 0;
    for (let round = 0; round < 2; round++) peal.forEach((f, i) => (end = max(end, bellStrike(s, f, round * 1.9 + i * 0.3, 0.11, 0.6))));
    return end;
  },
  'sfx.bell.prime': (s) => max(bellStrike(s, 147, 0, 0.2), bellStrike(s, 196, 1.2, 0.14), bellStrike(s, 196, 1.6, 0.12)),
  'sfx.bell.terce': (s) => max(...[0, 0.9, 1.8].map((t) => bellStrike(s, 165, t, 0.18, 0.9))),
  'sfx.bell.sext': (s) => max(...[0, 0.5, 1, 1.5, 2, 2.5].map((t, i) => bellStrike(s, i % 2 ? 220 : 247, t, 0.13, 0.7))),
  'sfx.bell.none': (s) => max(...Array.from({ length: 9 }, (_, i) => bellStrike(s, 87, i * 1.6, 0.18, 1.2))),
  'sfx.bell.vespers': (s) => max(...[330, 294, 262, 247, 220].map((f, i) => bellStrike(s, f, i * 0.45, 0.12, 0.9))),
  'sfx.bell.compline': (s) => max(bellStrike(s, 73, 0, 0.26, 2), choir(s, 147, [0, 7, 12], 0.8, 2.2, 0.08, 'u', 1.2, 1.5)),

  // ------------------------------------------------ Ratings (≤ 400 ms)
  'sfx.rate.cool': (s, v, p) => {
    const f = 1568 * semis(pick([0, 2, -1, 4], v));
    let end = max(s.modal(f, HANDBELL, { gain: 0.1, decay: 0.3, strike: 0.04 }), s.modal(f * 1.5, HANDBELL, { at: 0.06, gain: 0.06, decay: 0.25 }), s.thump(120, 70, 0.08, 0.1, 0.01), paper(s, 0.01, 0.06, 0.05, 3000, 1500));
    if ((p.tier ?? 0) > 0) end = max(end, s.vox(392 * semis(p.tier === 1 ? 7 : p.tier === 2 ? 12 : 16), 'a', { dur: 0.25, a: 0.03, r: 0.15, gain: 0.05 }));
    return end;
  },
  'sfx.rate.good': (s, v, p) => {
    let end = s.modal(1175 * semis(pick([0, 2, 3], v)), GLASS, { gain: 0.07, decay: 0.45 });
    if ((p.tier ?? 0) > 0) end = max(end, s.vox(392 * semis(p.tier === 1 ? 7 : p.tier === 2 ? 12 : 16), 'o', { dur: 0.2, a: 0.03, r: 0.12, gain: 0.04 }));
    return end;
  },
  'sfx.rate.bad': (s, v) => max(knock(s, 0, 160 + vr(v) * 30, 0.22), s.burst({ dur: 0.08, type: 'lowpass', f: 400, gain: 0.12, color: 'brown' })),
  'sfx.rate.miss': (s, v) => {
    const f = 196 * semis(pick([0, 1, -1], v));
    return max(s.pluck(f, { gain: 0.22, dur: 0.4, bright: 0.4 }), s.pluck(f * semis(6), { gain: 0.16, dur: 0.4, bright: 0.4, at: 0.02 }), s.burst({ dur: 0.15, type: 'lowpass', f: 1300, gain: 0.12, color: 'pink' }), s.bubbles(4, 250, 700, 0.1, 0.08));
  },
  'sfx.combo.tier': (s, _v, p) => {
    const tier = p.tier ?? 1;
    const notes = tier >= 3 ? [0, 4, 7, 12] : tier === 2 ? [0, 7, 12] : [0, 7];
    return choir(s, 392, notes, 0, 0.5, 0.1, 'a', 0.08, 0.5);
  },
  'sfx.combo.break': (s, v) => max(s.pluck(330 * semis(vr(v) * 2), { gain: 0.25, dur: 0.3, bright: 0.95 }), s.burst({ dur: 0.04, f: 3500, q: 1, gain: 0.12 }), s.tone(330, 0.2, { f1: 180, gain: 0.03, type: 'triangle' })),

  // ------------------------------------------------ Vitals & death & timer
  'sfx.vitals.warn60': (s, v) => max(...[0, 0.16].map((t, i) => s.modal(1380 + vr(v, i) * 30, HANDBELL, { at: t, gain: 0.08, strike: 0.03 }))),
  'sfx.vitals.warn30': (s, v) => max(...[0, 0.12, 0.24, 0.36].map((t, i) => s.modal(1450 + vr(v, i) * 40, HANDBELL, { at: t, gain: 0.09, strike: 0.03 }))),
  'sfx.vitals.warn15': (s, v) => max(...Array.from({ length: 8 }, (_, i) => s.modal(1520 + vr(v, i) * 50, HANDBELL, { at: i * 0.08, gain: 0.09, strike: 0.03, decay: 0.5 }))),
  'sfx.death.knell': (s) => {
    const drone = s.gain(0);
    const lp = s.filt('lowpass', 300, 0.7, drone);
    for (const f of [41, 41.3, 61.7]) s.osc('sawtooth', f, 0.2, 5, lp);
    const e = s.ahr(drone.gain, 0.2, 1, 2.5, 1.5, 0.08);
    return max(e, bellStrike(s, 82, 0, 0.3, 1.8), bellStrike(s, 82, 2.6, 0.2, 1.8));
  },
  'sfx.timer.tick': (s, v) => s.modal(v % 2 ? 1750 : 1500, WOOD, { gain: 0.1, strike: 0.04 }),
  'sfx.timer.up': (s) => max(bellStrike(s, 196, 0, 0.2, 1), bellStrike(s, 196, 0.8, 0.15, 1)),
  'sfx.vitals.heal': (s, v, p) => {
    const n = Math.max(1, Math.min(5, Math.round((p.amount ?? 10) / 6)));
    let end = swell(s, 0, 0.3, 0.03, 400, 1800);
    for (let i = 0; i < n; i++) end = max(end, s.modal(784 * semis([0, 2, 4, 7, 9][i] + pick([0, 2], v)), GLASS, { at: 0.1 + i * 0.07, gain: 0.04, decay: 0.8 }));
    return end;
  },
  'sfx.vitals.hurt': (s, _v, p) => {
    const a = Math.min(1, (p.amount ?? 5) / 12);
    return max(s.thump(75 + a * 10, 38, 0.18 + a * 0.12, 0.15 + a * 0.2), s.burst({ dur: 0.1, type: 'lowpass', f: 700, gain: 0.08 + a * 0.1, color: 'brown' }));
  },
  'sfx.heart.beat': (s, _v, p) => {
    const str = p.strength ?? 0.5;
    const muff = p.muffle ?? 0;
    const dest = s.filt('lowpass', 900 - muff * 650, 0.7);
    const gap = p.gap ?? 0.16;
    const lub = s.thump(58, 38, 0.14, 0.14 + str * 0.26, 0, dest);
    const dub = s.thump(74, 50, 0.1, (0.1 + str * 0.16) * (1 - muff * 0.4), gap, dest);
    return max(lub, dub);
  },
  'sfx.heart.pulseTick': (s) => s.modal(2200, HANDBELL, { gain: 0.025, decay: 0.12 }),
  'sfx.phase.clear': (s, v, p) => {
    const root = p.root ?? 294;
    return max(...[0, 4, 7].map((n, i) => s.pluck(root * semis(n + 12 + pick([0, 0, 2], v) * 0), { at: i * 0.11, gain: 0.18, dur: 1, bright: 0.55 })), s.modal(root * 4, GLASS, { at: 0.33, gain: 0.04, decay: 1 }));
  },

  // ------------------------------------------------ Litany of Stillness
  'sfx.litany.vertex': (s, _v, p) => {
    const step = [0, 2, 4, 7, 9][Math.min(4, p.step ?? 0)];
    return max(s.modal(784 * semis(step), GLASS, { gain: 0.06, decay: 1.2 }), s.tone(784 * semis(step) * 2, 0.6, { gain: 0.012, a: 0.05, vib: [6, 10] }));
  },
  'sfx.litany.fizzle': (s) => max(s.burst({ dur: 0.5, type: 'highpass', f: 4000, f1: 900, gain: 0.08, a: 0.02 }), s.tone(311, 0.5, { f1: 220, gain: 0.03, type: 'triangle' }), s.tone(330, 0.5, { f1: 233, gain: 0.03, type: 'triangle' })),
  'sfx.litany.spent': (s) => max(knock(s, 0, 150, 0.16), s.modal(392, BELL, { at: 0.02, gain: 0.04, decay: 0.3 })),
  'sfx.litany.invoke': (s, v) => {
    // A whispered "Be still…" then a choral swell.
    const w = max(s.whisper(['i', 'i'], { dur: 0.22, gain: 0.1 }), s.burst({ at: 0.24, dur: 0.28, type: 'highpass', f: 4200, gain: 0.07, a: 0.05 }), s.whisper(['i', 'u'], { at: 0.5, dur: 0.35, gain: 0.08 }));
    const root = 196 * semis(pick([0, 2], v));
    return max(w, choir(s, root, [0, 7, 12, 16, 19], 0.35, 1.8, 0.2, 'a', 0.9, 1.6), bellStrike(s, root * 2, 0.4, 0.06, 1.6));
  },
  'sfx.litany.endWarn': (s) => max(swell(s, 0, 1.5, 0.12, 300, 2500), s.tone(392, 1.5, { gain: 0.001, a: 1.45, type: 'triangle' }), choir(s, 196, [0, 7], 0.2, 1.1, 0.06, 'u', 1.1, 0.1)),
  'sfx.litany.exhale': (s) => max(s.whisper(['a', 'o', 'u'], { dur: 0.9, gain: 0.07, shift: 0.9 }), s.modal(147, BELL, { at: 0.1, gain: 0.08, decay: 0.8 })),

  // ------------------------------------------------ UI
  'ui.hover': (s, v) => s.burst({ dur: 0.03, f: 4200 + vr(v) * 1200, q: 2, gain: 0.025, a: 0.008 }),
  'ui.confirm': (s, v) => max(s.thump(95 + vr(v) * 10, 55, 0.12, 0.2), s.burst({ dur: 0.08, type: 'lowpass', f: 1000, gain: 0.08, color: 'pink', a: 0.01 }), knock(s, 0.01, 700, 0.04)),
  'ui.back': (s, v) => paper(s, 0, 0.25 + vr(v) * 0.05, 0.06, 2600, 800),
  'ui.tab': (s, v) => paper(s, 0, 0.14 + vr(v) * 0.03, 0.05, 3200, 1200),
  'ui.slider': (s, v) => s.modal(1900 + vr(v) * 200, WOOD, { gain: 0.05 }),
  'ui.toggle': (s, v) => max(steelTick(s, 0, 1700 + vr(v) * 200, 0.06), knock(s, 0.03, 900, 0.05)),
  'ui.error': (s) => max(s.pluck(147, { gain: 0.18, dur: 0.35, bright: 0.3 }), s.pluck(156, { gain: 0.14, dur: 0.35, bright: 0.3, at: 0.015 })),
  'ui.pauseOpen': (s, v) => cloth(s, 0.32 + vr(v) * 0.1, 0.07, 2600),
  'ui.pauseClose': (s, v) => cloth(s, 0.26 + vr(v) * 0.08, 0.06, 2100),
  'ui.save': (s, v) => max(s.burst({ dur: 0.4, type: 'highpass', f: 3200, gain: 0.05, color: 'crackle', rate: 2.2, a: 0.03 }), s.burst({ dur: 0.35, f: 2400 + vr(v) * 400, q: 4, gain: 0.02, a: 0.05 })),
  'ui.vn.advance': (s, v) => s.burst({ dur: 0.025, f: 3000 + vr(v) * 800, q: 1.5, gain: 0.04 }),
  'ui.vn.blip': (s, _v, p) => s.vox(p.f0 ?? 180, pick(['a', 'o', 'e'] as Vowel[], Math.floor(Math.random() * 3)), { dur: 0.03, a: 0.005, r: 0.03, gain: 0.05 }),
  'ui.vn.pageTurn': (s, v) => paper(s, 0, 0.45 + vr(v) * 0.1, 0.07, 2200, 700),
  'ui.vn.whoosh': (s, v) => whoosh(s, 0, 0.6 + vr(v) * 0.2, 0.06, 300, 1400),
  'ui.vn.portrait': (s, v) => cloth(s, 0.2 + vr(v) * 0.05, 0.04, 1900),
  'ui.results.tally': (s, v) => s.modal(1300 + vr(v) * 150, WOOD, { gain: 0.08, strike: 0.03 }),
  'ui.results.seal': (s, _v, p) => {
    const rank = p.rank ?? 2; // 0 XS, 1 S, 2 A, 3 B, 4 C
    const stamp = max(s.thump(90, 50, 0.16, 0.25), s.burst({ dur: 0.1, type: 'lowpass', f: 900, gain: 0.1, color: 'pink' }));
    if (rank === 0) return max(stamp, choir(s, 262, [0, 4, 7, 12, 16], 0.05, 0.9, 0.2, 'a', 0.05, 1), bellStrike(s, 523, 0.05, 0.1));
    if (rank === 1) return max(stamp, bellStrike(s, 392, 0.03, 0.14));
    if (rank === 2) return max(stamp, s.modal(1047, GLASS, { at: 0.03, gain: 0.08, decay: 1 }), s.modal(1568, GLASS, { at: 0.08, gain: 0.05, decay: 0.8 }));
    return stamp;
  },
  'ui.results.best': (s) => max(...[0, 4, 7, 12].map((n, i) => s.pluck(392 * semis(n), { at: i * 0.09, gain: 0.18, dur: 1.2, bright: 0.6 })), bellStrike(s, 784, 0.4, 0.06)),
  'ui.brief.unroll': (s, v) => max(paper(s, 0, 0.7 + vr(v) * 0.2, 0.06, 1800, 600), knock(s, 0.65, 500, 0.05)),
  'ui.brief.scrubIn': (s, v) => {
    const splash = max(s.bubbles(20, 300, 1500, 0.4, 0.07), s.burst({ dur: 0.35, type: 'lowpass', f: 2200, gain: 0.14, color: 'pink', a: 0.01 }));
    const rattle = Array.from({ length: 6 }, (_, i) => steelTick(s, 0.35 + i * 0.05 + Math.random() * 0.03, 1800 + vr(v, i) * 1400, 0.05));
    return max(splash, ...rattle, s.modal(760, PLATE, { at: 0.4, gain: 0.05 }));
  },

  // ------------------------------------------------ Ambience emitters
  'amb.bell': (s, v) => bellStrike(s, pick([147, 165, 131], v), 0, 0.08, 1.2),
  'amb.dog': (s, v) => {
    let end = 0;
    const n = 1 + (v % 3);
    for (let i = 0; i < n; i++) end = max(end, s.vox(380 + vr(v, i) * 80, 'a', { at: i * 0.32, dur: 0.1, a: 0.01, r: 0.08, gain: 0.05, glide: [[0.1, 250]], rough: 0.5, breath: 0.6 }));
    return end;
  },
  'amb.crow': (s, v) => {
    let end = 0;
    for (let i = 0; i < 2 + (v % 2); i++) end = max(end, s.vox(720 + vr(v, i) * 100, 'a', { at: i * 0.45, dur: 0.22, a: 0.01, r: 0.06, gain: 0.03, glide: [[0.22, 500]], rough: 1, breath: 0.8, shift: 1.6 }));
    return end;
  },
  'amb.cough': (s, v) => {
    let end = 0;
    for (let i = 0; i < 2 + (v % 2); i++) end = max(end, s.burst({ at: i * 0.28, dur: 0.14, f: 700 + vr(v, i) * 200, q: 1.5, gain: 0.07, color: 'pink', a: 0.01 }), s.vox(130, 'a', { at: i * 0.28, dur: 0.06, a: 0.01, r: 0.08, gain: 0.02, rough: 1 }));
    return end;
  },
  'amb.watchman': (s, v) => {
    const f = 150 + vr(v) * 20;
    return max(s.vox(f, 'o', { dur: 0.8, a: 0.1, r: 0.4, gain: 0.03, glide: [[0.6, f * 1.12], [0.8, f]] }), s.vox(f * 1.12, 'a', { at: 1.1, dur: 1.2, a: 0.1, r: 0.6, gain: 0.03, glide: [[1.2, f * 0.9]] }));
  },
  'amb.drunk': (s, v) => {
    const tune = [0, 2, 4, 2, 0, -3, 0];
    const f = 140 + vr(v) * 20;
    let end = 0;
    tune.forEach((n, i) => (end = max(end, s.vox(f * semis(n + (Math.random() - 0.5) * 0.8), pick(['a', 'o', 'e'] as Vowel[], i + v), { at: i * 0.38, dur: 0.3, a: 0.04, r: 0.1, gain: 0.025, vib: [5, 30] }))));
    return end;
  },
  'amb.cart': (s, v) => {
    let end = 0;
    for (let i = 0; i < 10; i++) end = max(end, knock(s, i * 0.28 + Math.random() * 0.05, 180 + vr(v, i) * 60, 0.04));
    return max(end, s.burst({ dur: 3, type: 'lowpass', f: 250, gain: 0.05, color: 'brown', a: 1 }));
  },
  'amb.owl': (s, v) => max(s.tone(410 + vr(v) * 30, 0.35, { f1: 380, gain: 0.03, a: 0.05 }), s.tone(410, 0.6, { at: 0.55, f1: 370, gain: 0.03, a: 0.05, vib: [8, 20] })),
  'amb.drip': (s, v) => s.bubble(700 + vr(v) * 900, 0.05, 0.08),
  'amb.armour': (s, v) => max(...Array.from({ length: 3 }, (_, i) => steelTick(s, i * 0.09 + Math.random() * 0.03, 1400 + vr(v, i) * 900, 0.04))),
  'amb.horse': (s, v) => max(s.burst({ dur: 0.5, f: 500 + vr(v) * 100, q: 1.2, gain: 0.05, color: 'pink', a: 0.05 }), s.vox(210, 'e', { at: 0.2, dur: 0.5, a: 0.02, r: 0.3, gain: 0.02, rough: 1.2, glide: [[0.5, 150]] })),
  'amb.choirHum': (s, v) => choir(s, pick([131, 147, 110], v), [0, 7, 12], 0, 3, 0.05, 'u', 1.5, 2),
  ...LATER_RECIPES,
};

// ---------------------------------------------------------------- loops

interface LoopKit {
  sources: AudioScheduledSourceNode[];
  master: GainNode;
}

function kit(s: Synth, level = 1): LoopKit {
  const master = s.gain(0);
  master.gain.setValueAtTime(0.0001, s.at(0));
  master.gain.exponentialRampToValueAtTime(level, s.at(0.03));
  return { sources: [], master };
}

function bed(s: Synth, k: LoopKit, color: 'white' | 'pink' | 'brown' | 'crackle', dest: AudioNode, rate = 1): AudioBufferSourceNode {
  const src = s.ctx.createBufferSource();
  src.buffer = s.bank.get(color);
  src.loop = true;
  src.playbackRate.value = rate;
  src.connect(dest);
  src.start(s.at(0), Math.random() * 1.8);
  k.sources.push(src);
  return src;
}

function drone(s: Synth, k: LoopKit, type: OscillatorType, f: number, dest: AudioNode, detune = 0): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  o.connect(dest);
  o.start(s.at(0));
  k.sources.push(o);
  return o;
}

function lfo(s: Synth, k: LoopKit, rate: number, depth: number, target: AudioParam): OscillatorNode {
  const o = s.ctx.createOscillator();
  const g = s.ctx.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  o.connect(g);
  g.connect(target);
  o.start(s.at(0));
  k.sources.push(o);
  return o;
}

function stopKit(k: LoopKit, at: number, fade: number): number {
  const end = at + Math.max(0.01, fade);
  k.master.gain.cancelScheduledValues(at);
  k.master.gain.setValueAtTime(Math.max(0.0001, k.master.gain.value), at);
  k.master.gain.exponentialRampToValueAtTime(0.0001, end);
  for (const src of k.sources) {
    try {
      src.stop(end + 0.02);
    } catch {
      // Already stopped.
    }
  }
  k.sources.length = 0;
  return end;
}

const smooth = (p: AudioParam, v: number, now: number, tau = 0.05): void => {
  glide(p, v, now, tau * 3);
};

/** Stochastic grain scheduler used by loops (drips, clicks, bubbles). */
class Grains {
  next = 0;
  constructor(
    private s: Synth,
    private fire: (at: number) => void,
    public rate: () => number,
  ) {}
  tick(now: number): void {
    const r = this.rate();
    if (r <= 0) {
      this.next = now;
      return;
    }
    if (this.next < now) this.next = now + Math.random() / r;
    while (this.next < now + 0.12) {
      this.fire(this.next);
      this.next += (-Math.log(1 - Math.random() * 0.999) / r);
    }
  }
  /** Fire a grain at an absolute context time via a nested voice. */
  at(t: number, dest: AudioNode, fn: (s: Synth) => void): void {
    const { k, st, t0, out } = this.s;
    this.s.begin(t, dest, k, st);
    fn(this.s);
    this.s.begin(t0, out, k, st);
  }
}

/** Clicks: a short ringing decaying sinusoid added into `d` at sample `at`. */
function click(d: Float32Array, at: number, sr: number, f: number, amp: number, ms: number): void {
  const n = Math.floor((sr * ms) / 1000);
  const w = (2 * Math.PI * f) / sr;
  for (let i = 0; i < n && at + i < d.length; i++) d[at + i] += amp * Math.sin(w * i) * Math.exp((-5 * i) / n);
}

/** Grub chitter: bursts of 3–5 clicks, irregular gaps. */
function chitterTexture(s: Synth): AudioBuffer {
  return s.bank.texture('chitter', 3, (d, sr) => {
    let t = 0;
    while (t < 2.9) {
      const clicks = 3 + Math.floor(Math.random() * 3);
      for (let c = 0; c < clicks; c++) click(d, Math.floor((t + c * (0.006 + Math.random() * 0.004)) * sr), sr, 3200 + Math.random() * 1800, 0.5 + Math.random() * 0.5, 2.5);
      t += 0.04 + Math.random() * 0.06 + (Math.random() < 0.15 ? 0.25 + Math.random() * 0.2 : 0);
    }
  });
}

/** Spiderling skitter: a patter of tiny leg clicks. */
function skitterTexture(s: Synth): AudioBuffer {
  return s.bank.texture('skitter', 2, (d, sr) => {
    for (let t = 0; t < 1.98; t += 0.012 + Math.random() * 0.05) click(d, Math.floor(t * sr), sr, 2400 + Math.random() * 2500, 0.3 + Math.random() * 0.7, 1.2);
  });
}

function textureLoop(s: Synth, k: LoopKit, buf: AudioBuffer, dest: AudioNode, rate = 1): AudioBufferSourceNode {
  const src = s.ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = rate;
  src.connect(dest);
  src.start(s.at(0), Math.random() * buf.duration);
  k.sources.push(src);
  return src;
}

function simpleLoop(s: Synth, build: (k: LoopKit, params: Params) => { set?: (n: string, v: number, now: number) => void; grains?: Grains[] }, init: Params, level = 1): LoopVoice {
  const k = kit(s, level);
  const params: Params = { ...init };
  const b = build(k, params);
  // Apply the initial parameters through the same path as later changes.
  for (const [n, v] of Object.entries(params)) b.set?.(n, v, s.at(0));
  return {
    set(n, v, now) {
      params[n] = v;
      b.set?.(n, v, now);
    },
    tick(now) {
      for (const g of b.grains ?? []) g.tick(now);
    },
    stop(at, fade) {
      if (b.grains) for (const g of b.grains) g.rate = () => 0;
      return stopKit(k, at, fade);
    },
  };
}

export const LOOPS: Record<string, LoopRecipe> = {
  // Lancet cutting: stroke speed drives gain and brightness.
  'loop.lancet.cut': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0, k.master);
      const bp = s.filt('bandpass', 2400, 1.1, g);
      bed(s, k, 'pink', bp);
      const wet = s.gain(0, k.master);
      const lp = s.filt('lowpass', 700, 0.8, wet);
      bed(s, k, 'brown', lp);
      const apply = (now: number) => {
        const sp = Math.min(1, params.speed ?? 0);
        smooth(g.gain, 0.02 + sp * 0.2, now);
        smooth(bp.frequency, 1800 + sp * 2600, now);
        smooth(wet.gain, 0.05 + sp * 0.12, now);
      };
      apply(s.at(0));
      const grains = new Grains(s, (t) => grains.at(t, k.master, (x) => x.bubble(500 + Math.random() * 900, 0.03, 0.05)), () => 4 + (params.speed ?? 0) * 18);
      return { set: (_n, _v, now) => apply(now), grains: [grains] };
    }, p),

  // Tongs pulling strain: distance from origin raises a stick-slip creak.
  'loop.tongs.strain': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0, k.master);
      const bp = s.filt('bandpass', 420, 3, g);
      const o = drone(s, k, 'sawtooth', 48, bp);
      lfo(s, k, 11, 25, o.frequency);
      const wet = s.gain(0, k.master);
      bed(s, k, 'brown', s.filt('lowpass', 500, 0.7, wet));
      const apply = (now: number) => {
        const d = Math.min(1, params.dist ?? 0);
        smooth(g.gain, 0.01 + d * 0.09, now);
        smooth(o.frequency, 40 + d * 45, now);
        smooth(bp.frequency, 350 + d * 400, now);
        smooth(wet.gain, 0.03 + d * 0.1, now);
      };
      apply(s.at(0));
      return { set: (_n, _v, now) => apply(now) };
    }, p),

  // Leech suction: ichor 0 blood / 1 pus / 2 black bile; intensity from pool size.
  'loop.leech.suck': (s, p) =>
    simpleLoop(s, (k, params) => {
      const ichor = params.ichor ?? 0;
      const g = s.gain(0.05, k.master);
      const bp = s.filt('bandpass', [900, 600, 380][ichor] ?? 900, 2, g);
      bed(s, k, 'pink', bp);
      lfo(s, k, 5.5, 200, bp.frequency);
      const [lo, hi, gg] = [
        [350, 950, 0.14],
        [180, 480, 0.18],
        [110, 280, 0.22],
      ][ichor] ?? [350, 950, 0.14];
      const grains = new Grains(s, (t) => grains.at(t, k.master, (x) => x.bubble(lo + Math.random() * (hi - lo), 0.04 + ichor * 0.02, gg)), () => 6 + (params.intensity ?? 0.5) * 22 - ichor * 3);
      return {
        set: (_n, _v, now) => smooth(g.gain, 0.03 + (params.intensity ?? 0.5) * 0.06, now),
        grains: [grains],
      };
    }, p),

  // Salve smear: gated by stroke movement.
  'loop.salve.smear': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0, k.master);
      bed(s, k, 'pink', s.filt('lowpass', 1300, 0.7, g));
      const grains = new Grains(s, (t) => grains.at(t, k.master, (x) => x.bubble(300 + Math.random() * 500, 0.03, 0.04)), () => (params.gate ?? 0) * 10);
      return { set: (_n, _v, now) => smooth(g.gain, (params.gate ?? 0) * 0.12, now, 0.04), grains: [grains] };
    }, p),

  // Tincture plunger: pressure rises with progress.
  'loop.tincture.plunge': (s, p) =>
    simpleLoop(s, (k, params) => {
      const hiss = s.gain(0.02, k.master);
      bed(s, k, 'white', s.filt('bandpass', 3200, 3, hiss));
      const tg = s.gain(0.015, k.master);
      const o = drone(s, k, 'sine', 300, tg);
      return {
        set: (_n, _v, now) => {
          const pr = params.progress ?? 0;
          smooth(o.frequency, 300 + pr * 420, now);
          smooth(hiss.gain, 0.02 + pr * 0.03, now);
        },
      };
    }, p),

  // Brand idle ember hum while the brand is in hand.
  'loop.brand.ember': (s, p) =>
    simpleLoop(s, (k) => {
      bed(s, k, 'crackle', s.filt('highpass', 1800, 0.6, s.gain(0.1, k.master)), 0.6);
      bed(s, k, 'brown', s.filt('lowpass', 160, 0.8, s.gain(0.08, k.master)));
      return {};
    }, p),

  // Brand contact sizzle; material 0 flesh, 1 grub, 2 sigil, 3 Malison.
  'loop.brand.sizzle': (s, p) =>
    simpleLoop(s, (k, params) => {
      const mat = params.material ?? 0;
      const sz = s.gain(0.14, k.master);
      const hp = s.filt('highpass', 3000, 0.7, sz);
      bed(s, k, 'white', hp);
      lfo(s, k, 17, 0.07, sz.gain);
      bed(s, k, 'crackle', s.filt('highpass', 1200, 0.6, s.gain(0.25, k.master)), 1.3);
      const grains: Grains[] = [];
      if (mat === 0) {
        // Healthy flesh: a rising warning hiss.
        const warn = s.gain(0.0001, k.master);
        bed(s, k, 'white', s.filt('bandpass', 5200, 4, warn));
        warn.gain.exponentialRampToValueAtTime(0.1, s.at(1.2));
      } else if (mat === 1) {
        const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.tone(2000 + Math.random() * 1600, 0.06, { f1: 3200, gain: 0.02, type: 'triangle' })), () => 7);
        grains.push(gr);
      } else if (mat === 2) {
        const w = s.gain(0.07, k.master);
        const bp = s.filt('bandpass', 900, 3, w);
        bed(s, k, 'white', bp);
        lfo(s, k, 0.7, 500, bp.frequency);
        const dr = s.gain(0.03, k.master);
        const lp = s.filt('lowpass', 400, 0.8, dr);
        drone(s, k, 'sawtooth', 73.4, lp);
        drone(s, k, 'sawtooth', 77.8, lp);
      } else {
        const growl = s.gain(0.05, k.master);
        const lp = s.filt('lowpass', 700, 1, growl);
        const o = drone(s, k, 'sawtooth', 55, lp);
        lfo(s, k, 31, 30, o.frequency);
        const drv = s.drive(4, growl);
        drone(s, k, 'sawtooth', 110.5, drv);
      }
      return { grains };
    }, p),

  // Scrying lens: glass-harmonica hum; proximity raises a shimmering upper voice.
  'loop.lens.hum': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0.03, k.master);
      drone(s, k, 'sine', 880, g);
      drone(s, k, 'sine', 1320, s.gain(0.4, g));
      lfo(s, k, 3.2, 0.012, g.gain);
      const sh = s.gain(0, k.master);
      const o = drone(s, k, 'sine', 1760, sh);
      const l = lfo(s, k, 6, 0, sh.gain);
      const grains = new Grains(s, (t) => grains.at(t, k.master, (x) => x.modal(2600 + Math.random() * 2400, GLASS, { gain: 0.012, decay: 0.3 })), () => (params.prox ?? 0) * 9);
      return {
        set: (_n, _v, now) => {
          const pr = params.prox ?? 0;
          smooth(sh.gain, pr * 0.03, now, 0.1);
          smooth(o.frequency, 1760 + pr * 440, now, 0.1);
          smooth(l.frequency, 4 + pr * 8, now, 0.1);
        },
        grains: [grains],
      };
    }, p),

  // Bleeding trickle: severity 0..1.
  'loop.bleed.trickle': (s, p) =>
    simpleLoop(s, (k, params) => {
      const flow = s.gain(0.0, k.master);
      bed(s, k, 'pink', s.filt('bandpass', 1100, 1.5, flow));
      const grains = new Grains(s, (t) => grains.at(t, k.master, (x) => x.bubble(800 + Math.random() * 1200, 0.03, 0.06)), () => 1 + (params.severity ?? 0) * 12);
      return { set: (_n, _v, now) => smooth(flow.gain, (params.severity ?? 0) * 0.05, now, 0.3), grains: [grains] };
    }, p),

  // Burn beds: 0 fire, 1 acid, 2 hexfire.
  'loop.burn.bed': (s, p) =>
    simpleLoop(s, (k, params) => {
      const src = params.source ?? 0;
      if (src === 1) {
        const f = s.gain(0.08, k.master);
        bed(s, k, 'white', s.filt('highpass', 5000, 0.7, f));
        lfo(s, k, 23, 0.05, f.gain);
        const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.bubble(2500 + Math.random() * 2500, 0.015, 0.02)), () => 25);
        return { grains: [gr] };
      }
      bed(s, k, 'crackle', s.filt('highpass', 900, 0.5, s.gain(0.22, k.master)), 0.7);
      bed(s, k, 'brown', s.filt('lowpass', 220, 0.7, s.gain(0.08, k.master)));
      if (src === 2) {
        const w = s.gain(0.05, k.master);
        const bp = s.filt('bandpass', 1100, 3, w);
        bed(s, k, 'white', bp);
        lfo(s, k, 0.5, 600, bp.frequency);
        const d = s.gain(0.02, k.master);
        drone(s, k, 'sine', 220, d);
        drone(s, k, 'sine', 223.3, d);
      }
      return {};
    }, p),

  // Rot creep: slow wet squelch.
  'loop.rot.creep': (s, p) =>
    simpleLoop(s, (k) => {
      const g = s.gain(0.05, k.master);
      const lp = s.filt('lowpass', 450, 1.5, g);
      bed(s, k, 'brown', lp);
      lfo(s, k, 0.3, 200, lp.frequency);
      const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.bubble(120 + Math.random() * 200, 0.09, 0.06)), () => 1.5);
      return { grains: [gr] };
    }, p),

  // Venom: hiss and tingle scaled by spread.
  'loop.venom.hiss': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0.02, k.master);
      bed(s, k, 'white', s.filt('bandpass', 5200, 1.5, g));
      const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.tone(5000 + Math.random() * 2500, 0.02, { gain: 0.012 })), () => 2 + (params.spread ?? 0) * 14);
      return { set: (_n, _v, now) => smooth(g.gain, 0.01 + (params.spread ?? 0) * 0.06, now, 0.3), grains: [gr] };
    }, p),

  // Grub chitter.
  'loop.grub.chitter': (s, p) =>
    simpleLoop(s, (k) => {
      bed(s, k, 'brown', s.filt('lowpass', 600, 0.7, s.gain(0.02, k.master)));
      textureLoop(s, k, chitterTexture(s), s.gain(0.5, k.master), 0.9 + Math.random() * 0.2);
      return {};
    }, p),

  // Spiderling skitter.
  'loop.spider.skitter': (s, p) =>
    simpleLoop(s, (k) => {
      textureLoop(s, k, skitterTexture(s), s.gain(0.45, k.master), 0.9 + Math.random() * 0.25);
      return {};
    }, p),

  // Curse-sigil whispering.
  'loop.sigil.whisper': (s, p) =>
    simpleLoop(s, (k) => {
      for (const f of [700, 1200, 2400]) {
        const w = s.gain(0.035, k.master);
        const bp = s.filt('bandpass', f, 6, w);
        bed(s, k, 'white', bp);
        lfo(s, k, 0.2 + Math.random() * 0.5, f * 0.3, bp.frequency);
        lfo(s, k, 0.7 + Math.random(), 0.03, w.gain);
      }
      const d = s.gain(0.03, k.master);
      const lp = s.filt('lowpass', 350, 0.8, d);
      drone(s, k, 'sawtooth', 65.4, lp);
      drone(s, k, 'sawtooth', 69.3, lp);
      return {};
    }, p),

  // Egg sac throb; urgency 0..1 quickens the pulse.
  'loop.eggsac.pulse': (s, p) =>
    simpleLoop(s, (k, params) => {
      const gr = new Grains(s, (t) =>
        gr.at(t, k.master, (x) => {
          x.thump(70, 45, 0.18, 0.12 + (params.urgency ?? 0) * 0.12);
          x.bubbles(2, 200, 400, 0.05, 0.05);
        }), () => 0.8 + (params.urgency ?? 0) * 4);
      return { grains: [gr] };
    }, p),

  // Malison of Matins: veiled drone. open 0/1 lifts the filter.
  'loop.matins.drone': (s, p) =>
    simpleLoop(s, (k, params) => {
      const g = s.gain(0.09, k.master);
      const lp = s.filt('lowpass', 380, 1.2, g);
      for (const [f, d] of [
        [49, 0],
        [49.4, 0],
        [73.4, 5],
        [51.9, -3],
      ] as const)
        drone(s, k, 'sawtooth', f, lp, d);
      lfo(s, k, 0.13, 120, lp.frequency);
      const wh = s.gain(0.02, k.master);
      const bp = s.filt('bandpass', 1500, 5, wh);
      bed(s, k, 'white', bp);
      lfo(s, k, 0.4, 700, bp.frequency);
      return { set: (_n, _v, now) => smooth(lp.frequency, (params.open ?? 0) ? 900 : 380, now, 0.4) };
    }, p),

  // One Lauds Voice: a sustained sung note (note = semitone offset).
  'loop.lauds.voice': (s, p) =>
    simpleLoop(s, (k, params) => {
      const f = 262 * semis(params.note ?? 0);
      const env = s.gain(0.035, k.master);
      const sum = s.gain(1, env);
      for (const [ff, bw, gg] of [
        [800, 80, 1],
        [1150, 90, 0.5],
        [2900, 120, 0.25],
      ] as const) {
        const band = s.filt('bandpass', ff, ff / bw, s.gain(gg * 2.2, sum));
        for (const det of [-6, 7]) {
          const o = drone(s, k, 'sawtooth', f, band, det);
          lfo(s, k, 5 + Math.random(), 14, o.detune);
        }
      }
      return { set: (_n, _v, now) => smooth(env.gain, 0.035 * (1 - (params.silence ?? 0) * 0.8), now, 0.1) };
    }, p),

  // Litany star trail: shimmering partials while the right button draws.
  'loop.litany.trail': (s, p) =>
    simpleLoop(s, (k) => {
      for (const f of [2093, 2637, 3136, 3951]) {
        const pg = s.gain(0.006, k.master);
        drone(s, k, 'sine', f * (1 + (Math.random() - 0.5) * 0.004), pg);
        lfo(s, k, 3 + Math.random() * 7, 0.005, pg.gain);
      }
      const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.modal(3000 + Math.random() * 3000, GLASS, { gain: 0.02, decay: 0.25 })), () => 12);
      return { grains: [gr] };
    }, p),

  // Low-vitals tinnitus: a faint high ring with slow beating.
  'loop.tinnitus': (s, p) =>
    simpleLoop(s, (k) => {
      const g = s.gain(0.006, k.master);
      drone(s, k, 'sine', 6400, g);
      drone(s, k, 'sine', 6403, g);
      return {};
    }, p),

  // Curse corruption bed: whispering choir, gain driven by `level`.
  'loop.curse.bed': (s, p) =>
    simpleLoop(s, (k, params) => {
      const lvl = s.gain(0, k.master);
      for (const f of [600, 1000, 1900, 2700]) {
        const w = s.gain(0.03, lvl);
        const bp = s.filt('bandpass', f, 7, w);
        bed(s, k, 'white', bp);
        lfo(s, k, 0.15 + Math.random() * 0.3, f * 0.25, bp.frequency);
      }
      const hum = s.gain(0.02, lvl);
      const bank = s.filt('bandpass', 450, 4, hum);
      for (const f of [110, 116.5, 164.8]) drone(s, k, 'sawtooth', f, bank);
      const apply = (now: number) => smooth(lvl.gain, Math.min(1, params.level ?? 0), now, 0.5);
      apply(s.at(0));
      return { set: (_n, _v, now) => apply(now) };
    }, p),

  // Results score roll: rapid abacus ticks.
  'loop.results.roll': (s, p) =>
    simpleLoop(s, (k) => {
      const gr = new Grains(s, (t) => gr.at(t, k.master, (x) => x.modal(1400 + Math.random() * 200, WOOD, { gain: 0.04 })), () => 18);
      return { grains: [gr] };
    }, p),

  // Quill writing on the chart.
  'loop.brief.quill': (s, p) =>
    simpleLoop(s, (k) => {
      const g = s.gain(0.03, k.master);
      bed(s, k, 'crackle', s.filt('highpass', 3000, 0.6, g), 2.2);
      lfo(s, k, 3.5, 0.025, g.gain);
      return {};
    }, p),
  ...AMBIENCE_LOOPS,
  ...LATER_LOOPS,
};
