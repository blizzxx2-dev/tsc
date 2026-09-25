/**
 * Designed sets for Chapters 3–5 and the disciplines (full game): dragon-breath
 * burns and gangrene, growth excision, petrification, monster wounds, the six
 * later Malison hours (generated from one processing chain per hour), triage /
 * diagnosis / bone-setting, and the later ambiences.
 */
import { BELL, CLAY, GLASS, rnd, STEEL, WOOD, type Partial as ModalPartial, type Synth, type Vowel } from './synth';
import type { LoopRecipe, Params, Recipe } from './sfx';

const max = (...xs: number[]): number => Math.max(...xs);
const semis = (n: number): number => 2 ** (n / 12);
const vr = (v: number, salt = 0): number => {
  const x = Math.sin((v + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Fired stone / petrified crust. */
const STONE: readonly ModalPartial[] = [
  [1, 0.05, 1],
  [1.83, 0.035, 0.6],
  [2.94, 0.025, 0.4],
  [4.1, 0.02, 0.2],
];

function wet(s: Synth, at: number, dur: number, gain: number, lo = 200, hi = 800): number {
  return max(s.burst({ color: 'pink', at, dur, a: 0.01, f: hi, f1: lo, q: 2.2, gain: gain * 0.8 }), s.bubbles(Math.round(3 + dur * 18), lo, hi, dur * 0.7, gain * 0.3, at));
}

function tear(s: Synth, at: number, dur: number, gain: number, f = 1400): number {
  return s.burst({ at, dur, f, f1: f * 0.5, q: 1.1, gain, color: 'crackle', rate: 0.8 });
}

// ---------------------------------------------------------------- loops helper (self-contained)

interface Kit {
  srcs: AudioScheduledSourceNode[];
  out: GainNode;
  grains: ((now: number) => void)[];
  set: Record<string, (v: number, now: number) => void>;
}

function loopOf(build: (s: Synth, k: Kit, p: Params) => void): LoopRecipe {
  return (s, p) => {
    const out = s.gain(0);
    out.gain.setValueAtTime(0.0001, s.at(0));
    out.gain.exponentialRampToValueAtTime(1, s.at(0.05));
    const k: Kit = { srcs: [], out, grains: [], set: {} };
    build(s, k, p);
    for (const [n, v] of Object.entries(p)) k.set[n]?.(v, s.at(0));
    return {
      set: (n, v, now) => k.set[n]?.(v, now),
      tick: (now) => k.grains.forEach((g) => g(now)),
      stop: (at, fade) => {
        out.gain.cancelScheduledValues(at);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), at);
        out.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.01, fade));
        for (const x of k.srcs)
          try {
            x.stop(at + fade + 0.05);
          } catch {
            // Already stopped.
          }
        k.grains.length = 0;
        return at + fade;
      },
    };
  };
}

function noiseSrc(s: Synth, k: Kit, color: 'white' | 'pink' | 'brown' | 'crackle', dest: AudioNode, rate = 1): void {
  const n = s.ctx.createBufferSource();
  n.buffer = s.bank.get(color);
  n.loop = true;
  n.playbackRate.value = rate;
  n.connect(dest);
  n.start(s.at(0), Math.random() * 1.8);
  k.srcs.push(n);
}

function oscSrc(s: Synth, k: Kit, type: OscillatorType, f: number, dest: AudioNode, detune = 0): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  o.connect(dest);
  o.start(s.at(0));
  k.srcs.push(o);
  return o;
}

function lfoTo(s: Synth, k: Kit, rate: number, depth: number, p: AudioParam): void {
  const g = s.ctx.createGain();
  g.gain.value = depth;
  g.connect(p);
  oscSrc(s, k, 'sine', rate, g);
}

function grains(s: Synth, k: Kit, rate: () => number, fire: (x: Synth) => void): void {
  let next = 0;
  k.grains.push((now) => {
    const r = rate();
    if (r <= 0) return;
    if (next < now) next = now + Math.random() / r;
    while (next < now + 0.15) {
      const { t0, out, k: pk, st } = s;
      s.begin(next, k.out);
      fire(s);
      s.begin(t0, out, pk, st);
      next += -Math.log(1 - Math.random() * 0.999) / r;
    }
  });
}

// ---------------------------------------------------------------- Malison hours (AUD-0132)

export const LATER_HOURS = ['prime', 'terce', 'sext', 'none', 'vespers', 'compline'] as const;
export type LaterHour = (typeof LATER_HOURS)[number];
export const HOUR_KINDS = ['intro', 'telegraph', 'attack', 'hit', 'phase', 'summon', 'shield', 'shieldBreak', 'submerge', 'weaken', 'death'] as const;
export type HourKind = (typeof HOUR_KINDS)[number];

interface HourVoice {
  root: number;
  vowel: Vowel;
  /** Interval set of the hour's chord (semitones). */
  chord: readonly number[];
  /** Timbre: extra growl / sour detune / heat shimmer / organ weight. */
  sour: number;
  shimmer: number;
  bell: number;
}

/** Each hour's colour, all through the Matins chain: choir + creature voice, reversed whispers, −5 st. */
export const HOUR_VOICE: Record<LaterHour, HourVoice> = {
  prime: { root: 220, vowel: 'o', chord: [0, 7, 12], sour: 0, shimmer: 0.2, bell: 147 },
  terce: { root: 131, vowel: 'a', chord: [0, 4, 7], sour: 0.45, shimmer: 0, bell: 165 },
  sext: { root: 147, vowel: 'e', chord: [0, 1, 7], sour: 0.1, shimmer: 1, bell: 220 },
  none: { root: 87, vowel: 'u', chord: [0, 3, 7], sour: 0, shimmer: 0, bell: 87 },
  vespers: { root: 165, vowel: 'a', chord: [0, 3, 7, 10], sour: 0.15, shimmer: 0.3, bell: 196 },
  compline: { root: 110, vowel: 'o', chord: [0, 1, 7, 12, 13], sour: 0.2, shimmer: 0.1, bell: 73 },
};

function hourChoir(s: Synth, h: HourVoice, at: number, dur: number, gain: number, a = 0.3, r = 0.6, shift = 0): number {
  let end = 0;
  for (const n of h.chord) {
    end = max(end, s.vox(h.root * semis(n + shift), h.vowel, { at: at + Math.random() * 0.03, dur, a, r, gain: gain / Math.sqrt(h.chord.length), breath: 0.08 }));
    if (h.sour) end = max(end, s.vox(h.root * semis(n + shift) * 2 ** (h.sour / 12), h.vowel, { at, dur, a, r, gain: (gain * 0.5) / Math.sqrt(h.chord.length) }));
  }
  if (h.shimmer) end = max(end, s.burst({ at, dur: dur + r, type: 'highpass', f: 5000, gain: 0.02 * h.shimmer, a }));
  return end;
}

function hourRecipe(hour: LaterHour, kind: HourKind): Recipe {
  const h = HOUR_VOICE[hour];
  const bell = (s: Synth, at: number, g: number) => max(s.burst({ at, dur: 0.02, f: h.bell * 3, q: 1, gain: g * 0.3 }), s.modal(h.bell, BELL, { at, gain: g, detune: 0.004 }));
  switch (kind) {
    case 'intro':
      return (s) => max(hourChoir(s, h, 0, 1.6, 0.14, 1.2, 1), bell(s, 0.2, 0.14), s.whisper(['i', 'u', 'a'], { at: 0.4, dur: 1.4, gain: 0.05, shift: 0.9 }));
    case 'telegraph':
      // A rising warning at least 0.5 s before the blow lands.
      return (s) => max(hourChoir(s, h, 0, 0.7, 0.12, 0.6, 0.15, 0), s.burst({ dur: 0.75, type: 'bandpass', f: 600, f1: 3000, q: 2, gain: 0.08, a: 0.7, color: 'pink' }));
    case 'attack':
      return (s, v) => max(s.thump(80, 35, 0.4, 0.3), tear(s, 0, 0.4, 0.25), hourChoir(s, h, 0, 0.25, 0.12, 0.01, 0.3, pickN([0, -1, 1], v)));
    case 'hit': {
      return (s, v) => {
        const f = h.root * 4 * semis(vr(v) * 3);
        return max(s.vox(f, 'e', { dur: 0.35, a: 0.02, r: 0.2, gain: 0.07, glide: [[0.1, f * 1.4], [0.35, f]], vib: [9, 60], dest: s.drive(5), breath: 0.3 }), s.crackle({ dur: 0.25, gain: 0.2, hp: 2000 }));
      };
    }
    case 'phase':
      return (s) => max(bell(s, 0, 0.16), hourChoir(s, h, 0.05, 0.8, 0.14, 0.05, 0.8, -5), s.thump(60, 30, 0.8, 0.3));
    case 'summon':
      return (s, v) => max(wet(s, 0, 0.35, 0.25), ...Array.from({ length: 8 }, (_, i) => s.burst({ at: 0.1 + i * 0.04, dur: 0.012, f: 2600 + vr(v, i) * 1600, q: 3, gain: 0.06 })), s.whisper(['i', 'e'], { dur: 0.6, gain: 0.05 }));
    case 'shield':
      return (s) => max(hourChoir(s, h, 0, 0.9, 0.1, 0.5, 0.4, 12), s.modal(h.root * 8, GLASS, { at: 0.1, gain: 0.05, decay: 1.4 }));
    case 'shieldBreak':
      return (s, v) => max(...Array.from({ length: 10 }, (_, i) => s.modal(1800 + vr(v, i) * 3000, GLASS, { at: Math.random() * 0.2, gain: 0.04 })), s.burst({ dur: 0.35, type: 'highpass', f: 3000, gain: 0.15 }), s.thump(110, 50, 0.2, 0.15));
    case 'submerge':
      return (s) => max(s.bubbles(12, 120, 420, 0.6, 0.2), s.burst({ dur: 0.8, type: 'lowpass', f: 1100, f1: 150, gain: 0.22, color: 'brown', a: 0.05 }));
    case 'weaken':
      return (s) => max(hourChoir(s, h, 0, 0.5, 0.1, 0.02, 0.5, -1), wet(s, 0, 0.3, 0.2));
    case 'death':
      return (s) => max(s.thump(55, 25, 1.4, 0.38), hourChoir(s, h, 0, 1.3, 0.14, 0.02, 1.4, -5), bell(s, 0.3, 0.16), s.crackle({ dur: 1, gain: 0.2, hp: 700 }));
  }
}

const pickN = <T>(list: readonly T[], v: number): T => list[v % list.length];

function hourDrone(hour: LaterHour): LoopRecipe {
  const h = HOUR_VOICE[hour];
  return loopOf((s, k) => {
    const g = s.gain(0.08, k.out);
    const lp = s.filt('lowpass', 420, 1.1, g);
    for (const [n, d] of [
      [0, 0],
      [0, 7],
      [7, -4],
    ] as const)
      oscSrc(s, k, 'sawtooth', (h.root / 2) * semis(n), lp, d + h.sour * 100 * (n === 7 ? 1 : 0));
    lfoTo(s, k, 0.12, 140, lp.frequency);
    const wh = s.gain(0.02, k.out);
    const bp = s.filt('bandpass', 1400, 5, wh);
    noiseSrc(s, k, 'white', bp);
    lfoTo(s, k, 0.35, 600, bp.frequency);
    if (h.shimmer) {
      const sh = s.gain(0.01 * h.shimmer, k.out);
      noiseSrc(s, k, 'white', s.filt('highpass', 6000, 0.7, sh));
      lfoTo(s, k, 13, 0.008 * h.shimmer, sh.gain);
    }
  });
}

// ---------------------------------------------------------------- one-shots

export const LATER_RECIPES: Record<string, Recipe> = {
  // Dragon-breath burns and gangrene (AUD-0128).
  'sfx.burn.blister': (s, v) => max(...Array.from({ length: 5 }, (_, i) => s.bubble(300 + vr(v, i) * 500, 0.05, 0.12, i * 0.06 + Math.random() * 0.03)), s.crackle({ dur: 0.3, gain: 0.3, hp: 1500 })),
  'sfx.gangrene.debride': (s, v) => max(wet(s, 0, 0.3, 0.25, 150, 500), tear(s, 0.02, 0.25, 0.15, 900 + vr(v) * 300)),
  // Growth excision (AUD-0129).
  'sfx.growth.severed': (s, v) => max(wet(s, 0, 0.4, 0.3, 160, 600), s.thump(100, 50, 0.2, 0.15), tear(s, 0, 0.2, 0.2, 1800 + vr(v) * 400)),
  'sfx.growth.remove': (s, v) => max(wet(s, 0, 0.5, 0.3, 140, 500), s.modal(820 + vr(v) * 120, [[1, 0.9, 1], [1.59, 0.7, 0.6], [2.14, 0.5, 0.45]], { at: 0.45, gain: 0.08, strike: 0.08 })),
  // Petrification (AUD-0130): chip pitch rises as the crust thins (param depth 0 = surface … 1 = deep).
  'sfx.stone.chip': (s, v, p) => {
    const f = 1500 + (1 - (p.depth ?? 0.5)) * 1400 + vr(v) * 200;
    return max(s.modal(f, STONE, { gain: 0.12, strike: 0.12 }), s.burst({ at: 0.01, dur: 0.12, type: 'highpass', f: 2500, gain: 0.05, color: 'crackle', rate: 1.5 }));
  },
  'sfx.stone.crumble': (s, v) => max(...Array.from({ length: 18 }, (_, i) => s.modal(700 + vr(v, i) * 2200, STONE, { at: Math.random() * 0.6, gain: 0.03 })), s.burst({ dur: 0.7, type: 'lowpass', f: 1400, gain: 0.08, color: 'pink', a: 0.05 })),
  'sfx.stone.reveal': (s) => max(wet(s, 0, 0.25, 0.15, 300, 900), s.modal(1175, GLASS, { at: 0.15, gain: 0.05, decay: 1 }), s.modal(1568, GLASS, { at: 0.22, gain: 0.035, decay: 0.9 })),
  // Monster wounds (AUD-0131).
  'sfx.fang.grind': (s, v) => max(s.burst({ dur: 0.45, type: 'bandpass', f: 2600 + vr(v) * 600, q: 3, gain: 0.12, color: 'crackle', rate: 2 }), s.tone(180 + vr(v, 1) * 40, 0.45, { type: 'sawtooth', gain: 0.02, vib: [23, 80], lp: 1200 }), s.thump(160, 90, 0.08, 0.08, 0.4)),
  'sfx.claw.rake': (s, v) => {
    const n = 3 + (v % 2);
    return max(...Array.from({ length: n }, (_, i) => tear(s, i * 0.05, 0.22, 0.18, 1600 + vr(v, i) * 700)), wet(s, 0.05, 0.3, 0.15));
  },
  'sfx.larva.pop': (s, v) => max(s.bubble(500 + vr(v) * 400, 0.05, 0.15), s.tone(2200 + vr(v, 1) * 800, 0.08, { f1: 3200, gain: 0.03, type: 'triangle' })),
  // Disciplines (AUD-0133).
  'sfx.triage.tag': (s, v) => max(s.thump(100, 60, 0.1, 0.18), s.burst({ dur: 0.06, type: 'lowpass', f: 1400, gain: 0.08, color: 'pink' }), s.modal(700 + vr(v) * 80, WOOD, { at: 0.005, gain: 0.05 }), s.burst({ at: 0.08, dur: 0.18, f: 2600, f1: 900, q: 1, gain: 0.04 })),
  'sfx.bone.crepitus': (s, v) => max(s.burst({ dur: 0.35, type: 'bandpass', f: 1200 + vr(v) * 300, q: 1.2, gain: 0.18, color: 'crackle', rate: 1.2 }), s.tone(140, 0.35, { type: 'sawtooth', gain: 0.02, vib: [31, 90], lp: 700 })),
  'sfx.bone.snap': (s, v) => max(s.burst({ dur: 0.02, f: 2500 + vr(v) * 500, q: 0.8, gain: 0.35 }), s.modal(420 + vr(v, 1) * 80, CLAY, { gain: 0.14, strike: 0.1 }), s.thump(90, 50, 0.18, 0.2, 0.01)),
  'amb.battle': (s, v) => {
    // Distant volley or cannon: low boom, then a rolling crackle of muskets.
    const cannon = v % 3 === 0;
    let end = s.thump(cannon ? 45 : 70, 25, cannon ? 1.2 : 0.4, cannon ? 0.12 : 0.05);
    if (!cannon) for (let i = 0; i < 12; i++) end = max(end, s.burst({ at: i * 0.05 + Math.random() * 0.1, dur: 0.12, type: 'lowpass', f: 900, gain: 0.03, color: 'brown' }));
    return max(end, s.burst({ dur: 1.5, type: 'lowpass', f: 300, gain: 0.04, color: 'brown', a: 0.05 }));
  },
  'amb.rats': (s, v) => max(...Array.from({ length: 10 }, (_, i) => s.burst({ at: i * 0.03 + Math.random() * 0.02, dur: 0.01, f: 2200 + vr(v, i) * 1500, q: 2, gain: 0.03 })), s.tone(3200 + vr(v) * 800, 0.08, { f1: 4200, gain: 0.01, at: 0.2, type: 'triangle' })),
  'amb.slosh': (s, v) => max(s.bubbles(6, 150, 500, 0.4, 0.06), s.burst({ dur: 0.6, type: 'lowpass', f: 900 + vr(v) * 200, gain: 0.06, color: 'pink', a: 0.2 })),
  'amb.crowd': (s, v) => {
    let end = 0;
    for (let i = 0; i < 6; i++) end = max(end, s.vox(110 + vr(v, i) * 90, (['a', 'o', 'e'] as Vowel[])[i % 3], { at: Math.random() * 0.8, dur: 0.6 + Math.random() * 0.5, a: 0.1, r: 0.3, gain: 0.012, rough: 0.3, breath: 0.5 }));
    return end;
  },
  'amb.sentry': (s, v) => {
    const f = 130 + vr(v) * 20;
    return max(s.vox(f, 'o', { dur: 0.7, a: 0.08, r: 0.3, gain: 0.025 }), s.vox(f * 0.9, 'a', { at: 0.9, dur: 0.9, a: 0.1, r: 0.4, gain: 0.025 }), steel(s, 1.9, 0.02));
  },
};

function steel(s: Synth, at: number, gain: number): number {
  return s.modal(1600 + rnd(0, 600), STEEL, { at, gain });
}

for (const hour of LATER_HOURS) for (const kind of HOUR_KINDS) LATER_RECIPES[`sfx.hour.${hour}.${kind}`] = hourRecipe(hour, kind);

// ---------------------------------------------------------------- loops

export const LATER_LOOPS: Record<string, LoopRecipe> = {
  // Dragon-breath: a roaring ember bed.
  'loop.burn.dragon': loopOf((s, k) => {
    const roar = s.gain(0.1, k.out);
    const lp = s.filt('lowpass', 420, 0.9, roar);
    noiseSrc(s, k, 'brown', lp);
    lfoTo(s, k, 0.4, 180, lp.frequency);
    noiseSrc(s, k, 'crackle', s.filt('highpass', 700, 0.5, s.gain(0.35, k.out)), 0.9);
    grains(s, k, () => 3, (x) => x.bubble(250 + Math.random() * 350, 0.05, 0.08));
  }),
  // Gangrene: necrotic wet crackle.
  'loop.gangrene': loopOf((s, k) => {
    noiseSrc(s, k, 'crackle', s.filt('bandpass', 900, 0.8, s.gain(0.2, k.out)), 0.5);
    noiseSrc(s, k, 'brown', s.filt('lowpass', 400, 1.2, s.gain(0.04, k.out)));
    grains(s, k, () => 2.5, (x) => x.bubble(140 + Math.random() * 220, 0.08, 0.07));
  }),
  // Amputation-grade bone saw, strokes at `speed` (0..1).
  'loop.saw.bone': loopOf((s, k, p) => {
    const g = s.gain(0.001, k.out);
    const bp = s.filt('bandpass', 1500, 1.4, g);
    noiseSrc(s, k, 'white', bp);
    const res = s.gain(0.02, k.out);
    oscSrc(s, k, 'sawtooth', 190, s.filt('bandpass', 380, 6, res));
    const stroke = s.ctx.createOscillator();
    const sg = s.ctx.createGain();
    stroke.frequency.value = 2 + (p.speed ?? 0.5) * 3;
    sg.gain.value = 0.11;
    stroke.connect(sg);
    sg.connect(g.gain);
    stroke.start(s.at(0));
    k.srcs.push(stroke);
    k.set.speed = (v, now) => stroke.frequency.setValueAtTime(2 + v * 3, now);
  }),
  // Growth excision: fibrous tearing while encircling.
  'loop.growth.encircle': loopOf((s, k, p) => {
    const g = s.gain(0.08, k.out);
    const bp = s.filt('bandpass', 1300, 1, g);
    noiseSrc(s, k, 'crackle', bp, 0.8);
    grains(s, k, () => 4 + (p.speed ?? 0.5) * 10, (x) => x.bubble(400 + Math.random() * 600, 0.03, 0.05));
    k.set.speed = (v, now) => g.gain.setValueAtTime(0.03 + v * 0.1, now);
  }),
  // Petrification: stone creeping over flesh.
  'loop.stone.creep': loopOf((s, k) => {
    const g = s.gain(0.1, k.out);
    const lp = s.filt('lowpass', 700, 1.5, g);
    noiseSrc(s, k, 'crackle', lp, 0.35);
    noiseSrc(s, k, 'brown', s.filt('lowpass', 160, 0.8, s.gain(0.05, k.out)));
    grains(s, k, () => 1.5, (x) => x.modal(900 + Math.random() * 800, STONE, { gain: 0.02 }));
  }),
  // Larvae swarm: many small voices.
  'loop.larvae.swarm': loopOf((s, k) => {
    noiseSrc(s, k, 'brown', s.filt('lowpass', 700, 0.8, s.gain(0.03, k.out)));
    grains(s, k, () => 26, (x) => x.burst({ dur: 0.007, f: 2800 + Math.random() * 2200, q: 3, gain: 0.04 }));
    grains(s, k, () => 4, (x) => x.bubble(300 + Math.random() * 500, 0.04, 0.04));
  }),
  // The ear trumpet: listening to the chest through horn.
  'loop.eartrumpet': loopOf((s, k, p) => {
    const horn = s.filt('peaking', 900, 2, s.filt('bandpass', 600, 0.8, s.gain(1, k.out)), 8);
    noiseSrc(s, k, 'pink', s.gain(0.02, horn));
    let beat = 0;
    grains(s, k, () => (p.bpm ?? 72) / 60, (x) => {
      beat++;
      x.thump(55, 38, 0.12, 0.25, 0, horn);
      x.thump(70, 50, 0.09, 0.15, 0.16, horn);
      if (beat % 4 === 0) x.burst({ dur: 1.2, type: 'bandpass', f: 500, q: 0.8, gain: 0.05, a: 0.5, color: 'pink', dest: horn });
    });
  }),
  // Later ambiences (AUD-0134).
  'loop.amb.pyre': loopOf((s, k) => {
    noiseSrc(s, k, 'crackle', s.filt('highpass', 600, 0.5, s.gain(0.14, k.out)), 0.8);
    noiseSrc(s, k, 'brown', s.filt('lowpass', 300, 0.7, s.gain(0.1, k.out)));
    const crowd = s.gain(0.012, k.out);
    noiseSrc(s, k, 'pink', s.filt('bandpass', 450, 0.9, crowd));
    lfoTo(s, k, 0.08, 0.006, crowd.gain);
  }),
  'loop.amb.cathedral': loopOf((s, k) => {
    noiseSrc(s, k, 'brown', s.filt('lowpass', 250, 0.7, s.gain(0.04, k.out)));
    const hum = s.gain(0.004, k.out);
    for (const f of [98, 147, 196]) oscSrc(s, k, 'sine', f, hum, Math.random() * 6 - 3);
    lfoTo(s, k, 0.05, 0.003, hum.gain);
  }),
  'loop.amb.catacombs': loopOf((s, k) => {
    const w = s.gain(0.04, k.out);
    const bp = s.filt('bandpass', 250, 1.2, w);
    noiseSrc(s, k, 'brown', bp);
    lfoTo(s, k, 0.06, 80, bp.frequency);
    grains(s, k, () => 0.5, (x) => x.bubble(900 + Math.random() * 900, 0.06, 0.05));
  }),
  'loop.amb.armycamp': loopOf((s, k) => {
    noiseSrc(s, k, 'crackle', s.filt('highpass', 900, 0.5, s.gain(0.07, k.out)), 0.6);
    const wind = s.gain(0.05, k.out);
    const bp = s.filt('bandpass', 380, 0.9, wind);
    noiseSrc(s, k, 'brown', bp);
    lfoTo(s, k, 0.07, 150, bp.frequency);
    grains(s, k, () => 0.4, (x) => x.thump(60, 45, 0.3, 0.03));
  }),
  'loop.amb.flooded': loopOf((s, k) => {
    const lap = s.gain(0.05, k.out);
    const lp = s.filt('lowpass', 800, 0.8, lap);
    noiseSrc(s, k, 'pink', lp);
    lfoTo(s, k, 0.3, 0.04, lap.gain);
    grains(s, k, () => 3, (x) => x.bubble(400 + Math.random() * 900, 0.04, 0.04));
  }),
};

for (const hour of LATER_HOURS) LATER_LOOPS[`loop.hour.${hour}`] = hourDrone(hour);
