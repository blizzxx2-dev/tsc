/**
 * Synthesised ambience beds, one per location, registered as loop recipes:
 * rain on shutters, candle crackle, stone room tone, brazier fire, flies,
 * dripping basin, wind and crickets. Seamless by construction (looped noise
 * buffers and continuous oscillators with slow LFOs, plus Poisson grains).
 */
import { GLASS, WOOD, type Synth } from './synth';
import type { LoopRecipe, LoopVoice } from './sfx';

export type DemoAmbience = 'hospice' | 'street' | 'theatre' | 'chapel' | 'night' | 'camp';
/** Chapters 3–5 locations (beds in sfx-later.ts). */
export type LaterAmbience = 'pyre' | 'cathedral' | 'catacombs' | 'armycamp' | 'flooded';
export type AmbienceId = DemoAmbience | LaterAmbience;

function bedLoop(build: (s: Synth, out: GainNode, srcs: AudioScheduledSourceNode[], grains: ((now: number) => void)[]) => void): LoopRecipe {
  return (s) => {
    const out = s.gain(1);
    const srcs: AudioScheduledSourceNode[] = [];
    const grains: ((now: number) => void)[] = [];
    build(s, out, srcs, grains);
    const v: LoopVoice = {
      set: () => undefined,
      tick: (now) => grains.forEach((g) => g(now)),
      stop: (at, fade) => {
        out.gain.cancelScheduledValues(at);
        out.gain.setValueAtTime(out.gain.value, at);
        out.gain.linearRampToValueAtTime(0, at + fade);
        for (const x of srcs)
          try {
            x.stop(at + fade + 0.05);
          } catch {
            // Already stopped.
          }
        grains.length = 0;
        return at + fade;
      },
    };
    return v;
  };
}

function src(s: Synth, srcs: AudioScheduledSourceNode[], color: 'white' | 'pink' | 'brown' | 'crackle', dest: AudioNode, rate = 1): AudioBufferSourceNode {
  const n = s.ctx.createBufferSource();
  n.buffer = s.bank.get(color);
  n.loop = true;
  n.playbackRate.value = rate;
  n.connect(dest);
  n.start(s.at(0), Math.random() * 1.8);
  srcs.push(n);
  return n;
}

function osc(s: Synth, srcs: AudioScheduledSourceNode[], type: OscillatorType, f: number, dest: AudioNode): OscillatorNode {
  const o = s.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.connect(dest);
  o.start(s.at(0));
  srcs.push(o);
  return o;
}

function lfo(s: Synth, srcs: AudioScheduledSourceNode[], rate: number, depth: number, p: AudioParam): void {
  const g = s.ctx.createGain();
  g.gain.value = depth;
  g.connect(p);
  osc(s, srcs, 'sine', rate, g);
}

/** Poisson grains at `rate` per second, scheduled ahead into `dest`. */
function grainsOf(s: Synth, rate: number, dest: AudioNode, fire: (x: Synth) => void): (now: number) => void {
  let next = 0;
  return (now) => {
    if (next < now) next = now + Math.random() / rate;
    while (next < now + 0.15) {
      const { t0, out, k, st } = s;
      s.begin(next, dest);
      fire(s);
      s.begin(t0, out, k, st);
      next += -Math.log(1 - Math.random() * 0.999) / rate;
    }
  };
}

function wind(s: Synth, out: AudioNode, srcs: AudioScheduledSourceNode[], level: number): void {
  const g = s.gain(level, out);
  const bp = s.filt('bandpass', 380, 0.9, g);
  src(s, srcs, 'brown', bp);
  lfo(s, srcs, 0.07, 160, bp.frequency);
  lfo(s, srcs, 0.11, level * 0.6, g.gain);
}

function fire(s: Synth, out: AudioNode, srcs: AudioScheduledSourceNode[], level: number): void {
  src(s, srcs, 'crackle', s.filt('highpass', 900, 0.5, s.gain(level, out)), 0.6);
  src(s, srcs, 'brown', s.filt('lowpass', 200, 0.7, s.gain(level * 0.4, out)));
}

function roomTone(s: Synth, out: AudioNode, srcs: AudioScheduledSourceNode[], level: number, lp = 220): void {
  src(s, srcs, 'brown', s.filt('lowpass', lp, 0.7, s.gain(level, out)));
}

function rain(s: Synth, out: AudioNode, srcs: AudioScheduledSourceNode[], grains: ((now: number) => void)[], level: number): void {
  src(s, srcs, 'pink', s.filt('highpass', 900, 0.6, s.gain(level, out)));
  grains.push(grainsOf(s, 7, out, (x) => x.bubble(2200 + Math.random() * 2500, 0.012, level * 0.8)));
}

function flies(s: Synth, out: AudioNode, srcs: AudioScheduledSourceNode[], level: number): void {
  for (let i = 0; i < 2; i++) {
    const p = s.ctx.createStereoPanner();
    p.connect(out);
    lfo(s, srcs, 0.05 + Math.random() * 0.1, 0.8, p.pan);
    const g = s.gain(level, p);
    lfo(s, srcs, 0.13 + Math.random() * 0.2, level, g.gain);
    const bp = s.filt('bandpass', 420, 2, g);
    const o = osc(s, srcs, 'sawtooth', 190 + i * 35, bp);
    lfo(s, srcs, 7 + i * 3, 12, o.frequency);
  }
}

function crickets(s: Synth, out: AudioNode, grains: ((now: number) => void)[], level: number): void {
  grains.push(
    grainsOf(s, 1.6, out, (x) => {
      const f = 4300 + Math.random() * 500;
      for (let i = 0; i < 3; i++) x.tone(f, 0.018, { at: i * 0.045, gain: level, a: 0.003 });
    }),
  );
}

export const AMBIENCE_LOOPS: Record<`loop.amb.${DemoAmbience}`, LoopRecipe> = {
  'loop.amb.hospice': bedLoop((s, out, srcs, grains) => {
    roomTone(s, out, srcs, 0.05);
    rain(s, out, srcs, grains, 0.018);
    src(s, srcs, 'crackle', s.filt('highpass', 2200, 0.5, s.gain(0.025, out)), 0.35);
  }),
  'loop.amb.street': bedLoop((s, out, srcs) => {
    wind(s, out, srcs, 0.07);
    src(s, srcs, 'pink', s.filt('bandpass', 500, 0.8, s.gain(0.012, out)));
  }),
  'loop.amb.theatre': bedLoop((s, out, srcs, grains) => {
    roomTone(s, out, srcs, 0.05, 180);
    fire(s, out, srcs, 0.05);
    flies(s, out, srcs, 0.004);
    // Dripping basin, in the stone room.
    grains.push(grainsOf(s, 0.6, out, (x) => x.bubble(900 + Math.random() * 700, 0.05, 0.05)));
  }),
  'loop.amb.chapel': bedLoop((s, out, srcs, grains) => {
    roomTone(s, out, srcs, 0.04, 300);
    src(s, srcs, 'crackle', s.filt('highpass', 2500, 0.5, s.gain(0.012, out)), 0.25);
    grains.push(grainsOf(s, 0.05, out, (x) => x.modal(1400 + Math.random() * 400, GLASS, { gain: 0.01, decay: 2 })));
  }),
  'loop.amb.night': bedLoop((s, out, srcs, grains) => {
    wind(s, out, srcs, 0.06);
    crickets(s, out, grains, 0.006);
  }),
  'loop.amb.camp': bedLoop((s, out, srcs, grains) => {
    fire(s, out, srcs, 0.09);
    wind(s, out, srcs, 0.04);
    grains.push(grainsOf(s, 0.25, out, (x) => x.modal(300 + Math.random() * 200, WOOD, { gain: 0.03 })));
  }),
};

