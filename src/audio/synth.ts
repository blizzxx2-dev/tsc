/**
 * Low-level synthesis toolkit. Every designed sound in the game is built from
 * these primitives: filtered noise from pre-built buffers, modal (struck-object)
 * resonators for steel, glass, wood and church bronze, liquid "bubble" chirps for
 * wet sounds, Karplus-Strong plucked strings, formant voices for choirs and
 * patients, and sparse-impulse crackle for fire.
 *
 * A Synth is re-aimed per voice with `begin()`: recipes then work in natural
 * units (Hz, seconds from the start of the sound) and the helpers apply the
 * voice's pitch (`k`) and time stretch (`st`, used by the Litany slow-down).
 */

export type NoiseColor = 'white' | 'pink' | 'brown' | 'crackle';

/** Modal partial: [frequency ratio, decay seconds, relative gain]. */
export type Partial = readonly [number, number, number];

/** Free-free steel bar (instruments, clicks). */
export const STEEL: readonly Partial[] = [
  [1, 0.12, 1],
  [2.756, 0.08, 0.5],
  [5.404, 0.05, 0.3],
  [8.933, 0.03, 0.15],
];
/** Thin glass (vials, chimes). */
export const GLASS: readonly Partial[] = [
  [1, 0.6, 1],
  [2.32, 0.4, 0.45],
  [4.25, 0.25, 0.25],
  [6.63, 0.15, 0.12],
];
/** Dry hardwood (ticks, thuds, arrow shafts). */
export const WOOD: readonly Partial[] = [
  [1, 0.07, 1],
  [2.57, 0.04, 0.4],
  [4.2, 0.025, 0.2],
];
/** Fired clay (salve jar). */
export const CLAY: readonly Partial[] = [
  [1, 0.1, 1],
  [1.71, 0.07, 0.5],
  [2.93, 0.05, 0.3],
];
/** Hammered brass/iron plate (instrument dish). */
export const PLATE: readonly Partial[] = [
  [1, 0.9, 1],
  [1.59, 0.7, 0.6],
  [2.14, 0.5, 0.45],
  [2.3, 0.5, 0.35],
  [2.65, 0.35, 0.3],
  [2.92, 0.3, 0.2],
  [3.16, 0.25, 0.15],
];
/** Church bell (hum, prime, tierce, quint, nominal and upper partials). */
export const BELL: readonly Partial[] = [
  [0.5, 4.2, 0.55],
  [1, 3.2, 0.8],
  [1.183, 2.4, 0.5],
  [1.506, 1.9, 0.35],
  [2, 1.7, 0.6],
  [2.514, 1.1, 0.25],
  [2.662, 1.0, 0.22],
  [3.011, 0.8, 0.18],
  [4.166, 0.5, 0.1],
  [5.433, 0.35, 0.06],
];
/** Small hand-bell: brighter and shorter than a tower bell. */
export const HANDBELL: readonly Partial[] = [
  [1, 1.1, 1],
  [2.01, 0.7, 0.5],
  [2.93, 0.45, 0.35],
  [4.18, 0.3, 0.2],
  [5.4, 0.2, 0.1],
];

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';
/** Formant centre frequencies (Hz) and bandwidths for sung vowels. */
const FORMANTS: Record<Vowel, readonly (readonly [number, number, number])[]> = {
  a: [
    [800, 80, 1],
    [1150, 90, 0.5],
    [2900, 120, 0.25],
  ],
  e: [
    [400, 70, 1],
    [1700, 100, 0.4],
    [2600, 120, 0.25],
  ],
  i: [
    [290, 60, 1],
    [2100, 100, 0.3],
    [2950, 120, 0.2],
  ],
  o: [
    [450, 70, 1],
    [800, 80, 0.55],
    [2830, 100, 0.15],
  ],
  u: [
    [325, 60, 1],
    [700, 70, 0.35],
    [2530, 100, 0.1],
  ],
};

const rnd = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

const lastTarget = new WeakMap<AudioParam, number>();

/**
 * Glide a parameter to `v` over `time` seconds from `now` with a linear ramp
 * anchored at the last target — used instead of
 * setTargetAtTime for mixer moves so repeated retargeting stays well-behaved on
 * every implementation. Repeated calls with the same target are ignored.
 */
export function glide(p: AudioParam, v: number, now: number, time: number): void {
  const prev = lastTarget.get(p);
  if (prev !== undefined && Math.abs(prev - v) < 1e-4) return;
  // Anchor the ramp at `now` (a bare linear ramp would start from the previous event's time).
  p.cancelScheduledValues(now);
  p.setValueAtTime(prev ?? p.value, now);
  p.linearRampToValueAtTime(v, now + Math.max(0.005, time));
  lastTarget.set(p, v);
}

/** Pre-built noise buffers, created once when the context unlocks (no per-cue allocation). */
export class NoiseBank {
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  readonly brown: AudioBuffer;
  readonly crackle: AudioBuffer;
  private ks = new Map<string, AudioBuffer>();
  private shapes = new Map<number, Float32Array<ArrayBuffer>>();

  constructor(readonly ctx: BaseAudioContext) {
    const len = Math.floor(ctx.sampleRate * 2);
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.pink = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    this.crackle = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    const p = this.pink.getChannelData(0);
    const b = this.brown.getChannelData(0);
    const c = this.crackle.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      br = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      // Paul Kellet's pink filter.
      b0 = 0.99886 * b0 + x * 0.0555179;
      b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522;
      b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + x * 0.5362) * 0.11;
      br = (br + 0.02 * x) / 1.02;
      b[i] = br * 3.5;
    }
    // Crackle: sparse decaying impulses of random size (embers, sizzle, eschar).
    let i = 0;
    while (i < len) {
      i += Math.floor(rnd(40, 900) * (Math.random() < 0.1 ? 6 : 1));
      const amp = Math.random() ** 3 * (Math.random() < 0.5 ? -1 : 1);
      const dec = rnd(8, 60);
      for (let j = 0; j < 200 && i + j < len; j++) c[i + j] += amp * Math.exp(-j / dec) * (Math.random() * 2 - 1);
    }
  }

  get(color: NoiseColor): AudioBuffer {
    return this[color];
  }

  /** Karplus-Strong plucked string, rendered once per pitch/brightness and cached. */
  pluck(freq: number, dur: number, bright: number): AudioBuffer {
    const f = Math.round(freq * 4) / 4;
    const key = `${f}:${bright.toFixed(2)}:${dur.toFixed(1)}`;
    const hit = this.ks.get(key);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const n = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
    // Soften the excitation for darker plucks.
    for (let pass = 0; pass < Math.round((1 - bright) * 4); pass++) for (let i = 1; i < n; i++) line[i] = 0.5 * (line[i] + line[i - 1]);
    const decay = 0.996 + bright * 0.0035;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % n;
      const v = line[idx];
      line[idx] = decay * 0.5 * (v + line[next]);
      out[i] = v;
      idx = next;
    }
    if (this.ks.size > 256) this.ks.clear();
    this.ks.set(key, buf);
    return buf;
  }

  /** Soft-clip curve for distortion. */
  shape(amount: number): Float32Array<ArrayBuffer> {
    const k = Math.round(amount);
    const hit = this.shapes.get(k);
    if (hit) return hit;
    const n = 1024;
    const c = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    this.shapes.set(k, c);
    return c;
  }
}

export interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  /** Attack seconds. */
  a?: number;
  /** Glide target frequency. */
  f1?: number;
  /** Start offset (seconds from voice start). */
  at?: number;
  dest?: AudioNode;
  detune?: number;
  /** Vibrato: [rate Hz, depth cents]. */
  vib?: readonly [number, number];
  /** Lowpass the tone at this cutoff. */
  lp?: number;
  /** Glide curve: exponential (default) or linear. */
  lin?: boolean;
}

export interface BurstOpts {
  color?: NoiseColor;
  at?: number;
  dur: number;
  a?: number;
  gain?: number;
  type?: BiquadFilterType;
  f: number;
  f1?: number;
  q?: number;
  dest?: AudioNode;
  /** Playback rate of the noise buffer (crackle density, darker/brighter). */
  rate?: number;
}

export class Synth {
  /** Start time of the current voice (context seconds). */
  t0 = 0;
  /** Pitch multiplier of the current voice. */
  k = 1;
  /** Time stretch of the current voice. */
  st = 1;
  out!: AudioNode;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly bank: NoiseBank,
  ) {}

  begin(t0: number, out: AudioNode, pitch = 1, stretch = 1): this {
    this.t0 = t0;
    this.out = out;
    this.k = pitch;
    this.st = stretch;
    return this;
  }

  at(offset = 0): number {
    return this.t0 + offset * this.st;
  }

  gain(v: number, dest: AudioNode = this.out): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  filt(type: BiquadFilterType, f: number, q = 0.707, dest: AudioNode = this.out, gainDb = 0): BiquadFilterNode {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = Math.min(f, this.ctx.sampleRate * 0.45);
    n.Q.value = q;
    n.gain.value = gainDb;
    n.connect(dest);
    return n;
  }

  pan(v: number, dest: AudioNode = this.out): AudioNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v));
    p.connect(dest);
    return p;
  }

  /** Attack-then-exponential-decay envelope on a gain param. */
  env(p: AudioParam, at: number, a: number, d: number, peak: number): number {
    const t = this.at(at);
    const ta = a * this.st;
    const td = d * this.st;
    p.setValueAtTime(0.0001, t);
    if (ta > 0) p.linearRampToValueAtTime(peak, t + ta);
    else p.setValueAtTime(peak, t);
    p.exponentialRampToValueAtTime(0.0001, t + ta + td);
    return t + ta + td;
  }

  /** Sustained envelope: attack, hold, release. */
  ahr(p: AudioParam, at: number, a: number, h: number, r: number, peak: number): number {
    const t = this.at(at);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a * this.st);
    p.setValueAtTime(peak, t + (a + h) * this.st);
    p.exponentialRampToValueAtTime(0.0001, t + (a + h + r) * this.st);
    return t + (a + h + r) * this.st;
  }

  osc(type: OscillatorType, f: number, at: number, dur: number, dest: AudioNode, o: ToneOpts = {}): OscillatorNode {
    const n = this.ctx.createOscillator();
    n.type = type;
    const t = this.at(at);
    const end = t + dur * this.st;
    n.frequency.setValueAtTime(f * this.k, t);
    if (o.f1 !== undefined) {
      if (o.lin) n.frequency.linearRampToValueAtTime(o.f1 * this.k, end);
      else n.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1 * this.k), end);
    }
    if (o.detune) n.detune.value = o.detune;
    if (o.vib) {
      const l = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      l.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      l.connect(lg);
      lg.connect(n.detune);
      l.start(t);
      l.stop(end + 0.05);
    }
    n.connect(dest);
    n.start(t);
    n.stop(end + 0.05);
    return n;
  }

  /** An enveloped oscillator tone. Returns its end time. */
  tone(f: number, dur: number, o: ToneOpts = {}): number {
    const at = o.at ?? 0;
    const g = this.gain(0, o.dest);
    const src = o.lp ? this.filt('lowpass', o.lp, 0.7, g) : g;
    this.osc(o.type ?? 'sine', f, at, dur, src, o);
    return this.env(g.gain, at, o.a ?? 0.004, dur, o.gain ?? 0.3);
  }

  noise(color: NoiseColor, at: number, dur: number, dest: AudioNode, rate = 1): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    const buf = this.bank.get(color);
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    src.connect(dest);
    const t = this.at(at);
    src.start(t, Math.random() * buf.duration * 0.9);
    src.stop(t + dur * this.st + 0.05);
    return src;
  }

  /** Filtered noise burst with an optional filter sweep. Returns end time. */
  burst(o: BurstOpts): number {
    const at = o.at ?? 0;
    const g = this.gain(0, o.dest);
    const f = this.filt(o.type ?? 'bandpass', o.f * this.k, o.q ?? 1, g);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, Math.min(o.f1 * this.k, this.ctx.sampleRate * 0.45)), this.at(at + o.dur));
    this.noise(o.color ?? 'white', at, (o.a ?? 0.002) + o.dur, f, o.rate ?? 1);
    return this.env(g.gain, at, o.a ?? 0.002, o.dur, o.gain ?? 0.3);
  }

  /** Struck object: a bank of exponentially decaying sine partials plus a strike transient. */
  modal(f: number, partials: readonly Partial[], o: { at?: number; gain?: number; dest?: AudioNode; decay?: number; strike?: number; detune?: number } = {}): number {
    const at = o.at ?? 0;
    const dest = o.dest ?? this.out;
    let end = 0;
    for (const [ratio, dec, g] of partials) {
      const fr = f * ratio;
      if (fr * this.k > this.ctx.sampleRate * 0.45) continue;
      const d = dec * (o.decay ?? 1);
      end = Math.max(end, this.tone(fr * (1 + (o.detune ?? 0) * (Math.random() - 0.5)), d, { at, gain: (o.gain ?? 0.3) * g, a: 0.0015, dest }));
    }
    if (o.strike) this.burst({ at, dur: 0.012, f: Math.min(f * 2.5, 9000), q: 0.8, gain: o.strike, dest });
    return end;
  }

  /** A liquid bubble: a sine chirping upward as it decays. */
  bubble(f: number, dur: number, gain: number, at = 0, dest: AudioNode = this.out): number {
    return this.tone(f, dur, { f1: f * rnd(1.4, 2.2), gain, a: 0.002, at, dest });
  }

  /** A cluster of random bubbles over a window. */
  bubbles(n: number, fLo: number, fHi: number, window: number, gain: number, at = 0, dest: AudioNode = this.out): number {
    let end = 0;
    for (let i = 0; i < n; i++) end = Math.max(end, this.bubble(rnd(fLo, fHi), rnd(0.02, 0.07), gain * rnd(0.5, 1), at + Math.random() * window, dest));
    return end;
  }

  /** Low thump with a pitch drop (impacts, hearts, stamps). */
  thump(f0: number, f1: number, dur: number, gain: number, at = 0, dest: AudioNode = this.out): number {
    this.burst({ at, dur: Math.min(0.05, dur * 0.4), type: 'lowpass', f: f0 * 4, q: 0.5, gain: gain * 0.35, dest, color: 'brown' });
    return this.tone(f0, dur, { f1, gain, a: 0.003, at, dest });
  }

  /** Plucked string (lute, snapped string). */
  pluck(f: number, o: { at?: number; gain?: number; dur?: number; bright?: number; dest?: AudioNode } = {}): number {
    const dur = o.dur ?? 1.2;
    const src = this.ctx.createBufferSource();
    src.buffer = this.bank.pluck(f * this.k, dur, o.bright ?? 0.6);
    src.playbackRate.value = 1 / this.st;
    const g = this.gain(o.gain ?? 0.4, o.dest);
    src.connect(g);
    const t = this.at(o.at ?? 0);
    src.start(t);
    return t + dur * this.st;
  }

  /** Formant-filtered source for a set of formants. */
  private formantBank(v: Vowel, dest: AudioNode, shift = 1): AudioNode {
    const sum = this.gain(1, dest);
    const input = this.ctx.createGain();
    for (const [f, bw, g] of FORMANTS[v]) {
      const band = this.filt('bandpass', f * shift, (f * shift) / bw, this.gain(g * 2.2, sum));
      input.connect(band);
    }
    return input;
  }

  /**
   * A sung or voiced vowel: two detuned sawtooths through a formant bank.
   * `glide` gives [time, f0] pitch points for moans, cries and shrieks.
   */
  vox(f0: number, v: Vowel, o: { at?: number; dur: number; a?: number; r?: number; gain?: number; vib?: readonly [number, number]; breath?: number; shift?: number; glide?: readonly (readonly [number, number])[]; dest?: AudioNode; rough?: number }): number {
    const at = o.at ?? 0;
    const env = this.gain(0, o.dest);
    const bank = this.formantBank(v, env, o.shift ?? 1);
    for (const det of [-7, 6]) {
      const n = this.osc('sawtooth', f0, at, o.dur + (o.r ?? 0.2), bank, { detune: det, vib: o.vib ?? [5, 14] });
      if (o.glide) for (const [tt, f] of o.glide) n.frequency.exponentialRampToValueAtTime(f * this.k, this.at(at + tt));
    }
    if (o.rough) {
      // Growl: amplitude modulation at a sub-audio rate.
      const am = this.ctx.createOscillator();
      const amg = this.ctx.createGain();
      amg.gain.value = o.rough * (o.gain ?? 0.15);
      am.frequency.value = rnd(28, 45);
      am.connect(amg);
      amg.connect(env.gain);
      am.start(this.at(at));
      am.stop(this.at(at + o.dur + (o.r ?? 0.2)) + 0.05);
    }
    if (o.breath) this.noise('pink', at, o.dur + (o.r ?? 0.2), this.gain(o.breath, bank));
    return this.ahr(env.gain, at, o.a ?? 0.08, o.dur, o.r ?? 0.2, o.gain ?? 0.15);
  }

  /** Whispered vowels: noise through a sequence of formant banks. */
  whisper(vs: readonly Vowel[], o: { at?: number; dur: number; gain?: number; dest?: AudioNode; shift?: number }): number {
    const at = o.at ?? 0;
    const seg = o.dur / vs.length;
    let end = 0;
    vs.forEach((v, i) => {
      const env = this.gain(0, o.dest);
      const bank = this.formantBank(v, env, o.shift ?? 1);
      this.noise('white', at + i * seg, seg * 1.6, bank);
      end = this.ahr(env.gain, at + i * seg, seg * 0.35, seg * 0.5, seg * 0.6, o.gain ?? 0.08);
    });
    return end;
  }

  /** Sparse crackle (embers, sizzle, eschar). */
  crackle(o: { at?: number; dur: number; gain?: number; hp?: number; rate?: number; dest?: AudioNode; a?: number }): number {
    return this.burst({ color: 'crackle', at: o.at, dur: o.dur, a: o.a ?? 0.01, gain: o.gain ?? 0.4, type: 'highpass', f: o.hp ?? 800, q: 0.5, rate: o.rate ?? 1, dest: o.dest });
  }

  /** Soft-clipping distortion stage. */
  drive(amount: number, dest: AudioNode = this.out): WaveShaperNode {
    const w = this.ctx.createWaveShaper();
    w.curve = this.bank.shape(amount);
    w.oversample = '2x';
    w.connect(dest);
    return w;
  }
}

export { rnd };
