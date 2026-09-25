import type { Operation, OperationDef } from '../surgery/operation';
import type { BossAssists, BossEvent, BossSound } from '../surgery/bosses/signals';
import { settings } from '../core/settings';
import { bossStoryFlags } from '../content/flags';
import { allOperations } from '../content/campaign';
import { loadProgress } from '../surgery/progress';
import { patientName } from '../surgery/bosses/prime';

/**
 * Presentation side of the boss signals: synthesises boss sounds (tolls,
 * choir stings, inhales, antiphon halves, hisses…) panned to where the boss
 * is, keeps a whisper ambience that follows its source across the stereo
 * field, and tracks the adaptive-music intensity the bosses announce (the
 * music system reads `intensity` / `layers`). Uses its own AudioContext, made
 * lazily once a boss first sounds (a user gesture has long since happened).
 */

/** Copy the boss accessibility assists from the settings into an operation definition. */
export function withBossAssists<T extends OperationDef>(def: T): T {
  const assists: BossAssists = {
    reducedLag: settings.bossReducedLag,
    minBrightness: settings.bossMinBrightness,
    hazeOutline: settings.bossHazeOutline,
    lagReadout: settings.bossLagReadout,
  };
  if (!Object.values(assists).some(Boolean)) return def;
  return { ...def, assists } as T;
}

/** Patients lost on this save (operations with a recorded failure), by their content name (BOS-0055). */
export function lostPatientsOf(fails: Readonly<Record<string, number>>, ops: readonly OperationDef[] = allOperations()): string[] {
  const out: string[] = [];
  for (const d of ops) {
    const n = (fails[d.id] ?? 0) > 0 ? patientName(d.patient ?? '') : null;
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Everything a boss fight reads from outside the sim: assists, story flags (BOS-0139) and the lost-patient roll (BOS-0055). */
export function withBossContext<T extends OperationDef>(def: T): T {
  const d = withBossAssists(def);
  const storyFlags = bossStoryFlags();
  let lostPatients: string[];
  try {
    lostPatients = lostPatientsOf(loadProgress().fails);
  } catch {
    lostPatients = [];
  }
  if (!storyFlags.length && !lostPatients.length) return d;
  return { ...d, ...(storyFlags.length ? { storyFlags } : {}), ...(lostPatients.length ? { lostPatients } : {}) } as T;
}

/** One partial of a boss sound recipe. */
export interface Partial {
  freq: number;
  dur: number;
  type: OscillatorType | 'noise';
  gain: number;
  slideTo?: number;
  delay?: number;
}

/** Recipes for every boss sound (data, so loudness can be checked in tests). */
export const BOSS_SOUND_RECIPES: Record<BossSound, Partial[]> = {
  toll: [
    { freq: 98, dur: 2.8, type: 'sine', gain: 0.35 },
    { freq: 196, dur: 1.8, type: 'sine', gain: 0.12 },
    { freq: 293, dur: 1.2, type: 'triangle', gain: 0.05 },
  ],
  sting: [
    { freq: 220, dur: 1.1, type: 'sawtooth', gain: 0.08 },
    { freq: 277, dur: 1.1, type: 'sawtooth', gain: 0.07, delay: 0.02 },
    { freq: 330, dur: 1.1, type: 'sawtooth', gain: 0.07, delay: 0.04 },
    { freq: 1800, dur: 0.6, type: 'noise', gain: 0.08 },
  ],
  inhale: [{ freq: 900, dur: 0.8, type: 'noise', gain: 0.12, slideTo: 2600 }],
  call: [{ freq: 392, dur: 0.5, type: 'sine', gain: 0.18 }],
  response: [{ freq: 523, dur: 0.5, type: 'sine', gain: 0.18 }],
  flare: [
    { freq: 1320, dur: 1.4, type: 'sine', gain: 0.12 },
    { freq: 1760, dur: 1.2, type: 'sine', gain: 0.08, delay: 0.05 },
  ],
  crackle: [{ freq: 3000, dur: 0.9, type: 'noise', gain: 0.16 }],
  syllable: [{ freq: 700, dur: 0.25, type: 'noise', gain: 0.1 }],
  drone: [
    { freq: 110, dur: 2, type: 'sawtooth', gain: 0.05 },
    { freq: 4200, dur: 2, type: 'noise', gain: 0.03 },
  ],
  ripple: [
    { freq: 58, dur: 0.12, type: 'sine', gain: 0.4, slideTo: 40 },
    { freq: 52, dur: 0.1, type: 'sine', gain: 0.3, slideTo: 38, delay: 0.14 },
  ],
  bulge: [{ freq: 80, dur: 0.8, type: 'sine', gain: 0.3, slideTo: 160 }],
  three: [
    { freq: 131, dur: 3, type: 'sine', gain: 0.3 },
    { freq: 131, dur: 3, type: 'sine', gain: 0.3, delay: 1.2 },
    { freq: 131, dur: 3, type: 'sine', gain: 0.3, delay: 2.4 },
  ],
  hiss: [{ freq: 5000, dur: 0.9, type: 'noise', gain: 0.14 }],
  gasp: [{ freq: 1200, dur: 0.35, type: 'noise', gain: 0.18, slideTo: 400 }],
  hush: [{ freq: 600, dur: 1.0, type: 'noise', gain: 0.06, slideTo: 200 }],
  dial: [
    { freq: 2400, dur: 0.05, type: 'square', gain: 0.06 },
    { freq: 2400, dur: 0.05, type: 'square', gain: 0.06, delay: 0.5 },
    { freq: 2400, dur: 0.05, type: 'square', gain: 0.06, delay: 1.0 },
  ],
  hum: [{ freq: 147, dur: 1.2, type: 'triangle', gain: 0.14 }],
  reading: [
    { freq: 165, dur: 0.4, type: 'triangle', gain: 0.1 },
    { freq: 147, dur: 0.5, type: 'triangle', gain: 0.1, delay: 0.4 },
  ],
  withering: [{ freq: 330, dur: 2.5, type: 'sine', gain: 0.14, slideTo: 60 }],
};

/** Sustained chords: one note per living layer (Lauds's Voices, Vespers's lit lamps). */
export const CHORDS: Record<string, readonly number[]> = {
  'lauds-chord': [196, 247, 294, 392],
  'vespers-hymn': [110, 165, 220, 275],
};

/** Peak gain of a recipe (sum of simultaneous partials, upper bound). */
export function recipePeak(s: BossSound): number {
  return BOSS_SOUND_RECIPES[s].reduce((a, p) => a + p.gain, 0);
}

export class BossAudio {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private whisper: { src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode } | null = null;
  /** Adaptive-music state the music system reads. */
  intensity: 0 | 1 | 2 | 3 = 0;
  layers = 0;
  /** Last events (debug overlay / tests). */
  readonly log: BossEvent[] = [];

  listen(op: Operation): void {
    op.events.on('boss', (e) => this.on(e));
  }

  on(e: BossEvent): void {
    this.log.push(e);
    if (this.log.length > 64) this.log.shift();
    if (e.kind === 'music') {
      this.intensity = e.intensity;
      if (e.layers !== undefined) this.layers = e.layers;
      if (e.intensity === 0) this.stopWhisper();
    } else if (e.kind === 'sound') this.play(e.sound, e.pan, e.gain, e.pitch ?? 1);
    else if (e.kind === 'ambience') {
      if (e.layers !== undefined && CHORDS[e.id]) this.chord(e.id, e.layers, e.gain);
      else this.ambience(e.pan, e.gain);
    }
    else if (e.kind === 'hud' && e.flag === 'silence') {
      // Compline's silence: the boss ambience ducks ahead of the full mute.
      this.ducked = e.on;
      if (this.ctx && this.out) this.out.gain.setTargetAtTime(this.level() * (e.on ? 0.15 : 1), this.ctx.currentTime, 0.25);
    } else if (e.kind === 'death') {
      this.stopWhisper();
      this.stopChords();
    }
  }
  private chords = new Map<string, { o: OscillatorNode; g: GainNode }[]>();
  /** Ducked for a silence window. */
  ducked = false;

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof AudioContext === 'undefined') return null;
    try {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private level(): number {
    if (settings.muted) return 0;
    return settings.volume * settings.sfx;
  }

  play(sound: BossSound, pan: number, gain: number, pitch = 1): void {
    const ctx = this.context();
    if (!ctx || !this.out) return;
    this.out.gain.value = this.level() * (this.ducked ? 0.15 : 1);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.out);
    for (const part of BOSS_SOUND_RECIPES[sound]) {
      const t = ctx.currentTime + (part.delay ?? 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(part.gain * gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + part.dur);
      g.connect(p);
      if (part.type === 'noise') {
        const len = Math.max(1, Math.floor(ctx.sampleRate * part.dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(part.freq * pitch, t);
        if (part.slideTo) f.frequency.exponentialRampToValueAtTime(part.slideTo * pitch, t + part.dur);
        src.connect(f).connect(g);
        src.start(t);
      } else {
        const o = ctx.createOscillator();
        o.type = part.type;
        o.frequency.setValueAtTime(part.freq * pitch, t);
        if (part.slideTo) o.frequency.exponentialRampToValueAtTime(part.slideTo * pitch, t + part.dur);
        o.connect(g);
        o.start(t);
        o.stop(t + part.dur + 0.05);
      }
    }
  }

  /** The choir whisper loop, panned to its source (BOS-0020). */
  private ambience(pan: number, gain: number): void {
    const ctx = this.context();
    if (!ctx || !this.out) return;
    if (!this.whisper) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin((i / len) * Math.PI * 6));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 3;
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      src.connect(f).connect(g).connect(p).connect(this.out);
      src.start();
      this.whisper = { src, gain: g, pan: p };
    }
    const t = ctx.currentTime;
    this.whisper.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
    this.whisper.gain.gain.setTargetAtTime(0.04 * gain, t, 0.2);
  }

  /** A sustained chord whose notes sound only while their layer lives (a Voice, a lit lamp). */
  private chord(id: string, layers: number, gain: number): void {
    const ctx = this.context();
    if (!ctx || !this.out) return;
    let c = this.chords.get(id);
    if (!c) {
      c = CHORDS[id].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(g).connect(this.out!);
        o.start();
        return { o, g };
      });
      this.chords.set(id, c);
    }
    const t = ctx.currentTime;
    c.forEach((n, i) => n.g.gain.setTargetAtTime(i < layers ? 0.025 * gain : 0, t, 0.4));
  }

  private stopChords(): void {
    if (!this.ctx) return;
    for (const c of this.chords.values()) for (const n of c) {
      n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      n.o.stop(this.ctx.currentTime + 1.5);
    }
    this.chords.clear();
  }

  private stopWhisper(): void {
    if (!this.whisper || !this.ctx) return;
    const w = this.whisper;
    this.whisper = null;
    w.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    w.src.stop(this.ctx.currentTime + 1.5);
  }

  dispose(): void {
    this.stopWhisper();
    this.stopChords();
  }
}
