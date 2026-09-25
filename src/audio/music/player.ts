/**
 * Adaptive music player: a look-ahead sequencer that renders the procedural
 * themes bar by bar into per-layer gain stems, so layers fade with game state,
 * sections change on the bar, transitions follow the state machine, stingers
 * land on the beat in key, and the Litany cross-fades to a "Stillness" stem
 * while the musical clock keeps running (so the stems resume in sync).
 */
import type { AudioEngine } from '../engine';
import { INSTRUMENTS, mtof, type InstId } from './instruments';
import { themeFor, transition, type MusicContext, type MusicState, type TransitionKind } from './state';
import { glide } from '../synth';
import { degreeMidi, LAYERS, THEMES, type BarCtx, type LayerId, type Section, type Theme } from './themes';

const LOOKAHEAD = 0.35;
const LAYER_RAMP = 1.5;

export type StingerKind = 'scrubIn' | 'phaseClear' | 'bossReveal' | 'victory' | 'failure' | 'rank' | 'chapter1' | 'chapter2';

interface Track {
  theme: Theme;
  out: GainNode;
  main: GainNode;
  lpf: BiquadFilterNode;
  layers: Record<LayerId, GainNode>;
  start: number;
  spb: number;
  nextBarTime: number;
  abs: number;
  intro: boolean;
  /** Index into theme.order (through-composed) or the named section. */
  orderIdx: number;
  section: string;
  sectionBar: number;
  pendingSection: string | null;
  stopAt: number;
}

export class MusicPlayer {
  state: MusicState = 'silent';
  ctxInfo: MusicContext = {};
  track: Track | null = null;
  private fading: Track[] = [];
  private targets: Record<LayerId, number> = { bed: 1, pulse: 1, melody: 1, tension: 0, danger: 0, clock: 0, flow: 0, stillness: 0 };
  litany = false;
  private stingerBus: GainNode | null = null;
  /** First boot plays the title intro once. */
  private titleIntroPlayed = false;
  /** Last transition, for tests and the debug overlay. */
  lastTransition: TransitionKind = 'none';

  constructor(private engine: AudioEngine) {}

  private get ctx(): BaseAudioContext | null {
    return this.engine.ctx;
  }

  private bus(): AudioNode | null {
    return this.engine.buses.music?.input ?? null;
  }

  // ------------------------------------------------------------------ state

  setState(to: MusicState, info: MusicContext = {}): TransitionKind {
    const from = this.state;
    const sameTheme = themeFor(from, this.ctxInfo) === themeFor(to, info);
    this.ctxInfo = { ...this.ctxInfo, ...info };
    let kind = transition(from, to);
    if (kind !== 'none' && kind !== 'cut' && kind !== 'beat' && sameTheme && this.track) kind = 'continue';
    this.state = to;
    this.lastTransition = kind;
    if (!this.ctx) return kind;
    const theme = themeFor(to, this.ctxInfo);
    switch (kind) {
      case 'none':
      case 'continue':
        break;
      case 'cut':
        this.stinger('failure');
        this.fadeOut(0.3, 0.25);
        break;
      case 'beat':
        this.fadeOut(Math.max(0, this.nextBeat() - this.now()), 0.6);
        if (to === 'victory') this.stinger('victory');
        break;
      case 'urgent':
        this.fadeOut(0, 2);
        if (theme) this.startTrack(theme, this.now(), 2);
        break;
      case 'bar': {
        const at = this.track ? this.track.nextBarTime : this.now();
        this.fadeOut(Math.max(0, at - this.now()), Math.min(2, this.track ? this.track.spb * this.track.theme.beats : 1));
        if (theme) this.startTrack(theme, at, 1);
        break;
      }
    }
    this.applyStateLayers(to);
    return kind;
  }

  /** Default layer mix for a state; the operation director refines it every frame. */
  private applyStateLayers(state: MusicState): void {
    const t = this.track?.theme;
    const d = t?.defaults ?? {};
    for (const l of LAYERS) this.targets[l] = d[l] ?? 0;
    if (state === 'op-intro') {
      this.targets.pulse = 0;
      this.targets.melody = 0;
    }
    this.pushLayers(state === 'op-intro' ? 0.3 : LAYER_RAMP);
  }

  /** Set a layer's target gain (0..1), ramped over 1.5 s. */
  setLayer(l: LayerId, v: number): void {
    const c = Math.max(0, Math.min(1, v));
    if (Math.abs(this.targets[l] - c) < 0.02) return;
    this.targets[l] = c;
    this.pushLayers(LAYER_RAMP);
  }

  layerTarget(l: LayerId): number {
    return this.targets[l];
  }

  /** Change section at the next bar (boss phases). */
  setSection(name: string): void {
    const tr = this.track;
    if (!tr || !tr.theme.sections[name] || tr.section === name || tr.pendingSection === name) return;
    tr.pendingSection = name;
  }

  get section(): string | null {
    return this.track?.section ?? null;
  }

  /** Litany: cross-fade to the Stillness stem (400 ms in, 600 ms out); the clock keeps running. */
  setLitany(on: boolean): void {
    if (this.litany === on) return;
    this.litany = on;
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const now = this.now();
    const tau = on ? 0.4 / 3 : 0.6 / 3;
    glide(tr.main.gain, on ? 0.25 : 1, now, tau * 3);
    glide(tr.lpf.frequency, on ? 1500 : this.engine.nyquistSafe, now, tau * 3);
    glide(tr.layers.stillness.gain, on ? 1 : this.targets.stillness, now, tau * 3);
  }

  /** 1.5 s before Stillness ends: a reverse swell on the Stillness stem. */
  litanyEnding(): void {
    const tr = this.track;
    if (!tr || !this.ctx || !this.engine.synth) return;
    const t = this.now();
    const root = tr.theme.root;
    const s = this.engine.synth.begin(t, tr.layers.stillness);
    for (const semi of [0, 7, 12]) s.tone(mtof(root + 12 + semi), 1.5, { a: 1.45, gain: 0.02, type: 'triangle' });
  }

  // ------------------------------------------------------------------ transport

  private now(): number {
    return this.engine.now;
  }

  private nextBeat(): number {
    const tr = this.track;
    if (!tr) return this.now();
    const n = Math.ceil((this.now() - tr.start) / tr.spb + 1e-6);
    return tr.start + n * tr.spb;
  }

  private startTrack(id: string, at: number, fadeIn: number): void {
    const ctx = this.ctx;
    const bus = this.bus();
    const theme = THEMES[id];
    if (!ctx || !bus || !theme) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.linearRampToValueAtTime(1, at + fadeIn);
    out.connect(bus);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = this.litany ? 1500 : this.engine.nyquistSafe;
    lpf.connect(out);
    const main = ctx.createGain();
    main.gain.value = this.litany ? 0.25 : 1;
    main.connect(lpf);
    const layers = {} as Record<LayerId, GainNode>;
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = (theme.defaults[l] ?? 0) * (l === 'stillness' && this.litany ? 0 : 1);
      if (l === 'stillness') {
        g.gain.value = this.litany ? 1 : (theme.defaults.stillness ?? 0);
        g.connect(out);
      } else g.connect(main);
      layers[l] = g;
    }
    const intro = id === 'title' && !this.titleIntroPlayed && !!theme.intro;
    if (intro) this.titleIntroPlayed = true;
    const first = theme.order ? theme.order[0] : Object.keys(theme.sections)[0];
    this.track = {
      theme,
      out,
      main,
      lpf,
      layers,
      start: at,
      spb: 60 / theme.bpm,
      nextBarTime: at,
      abs: 0,
      intro,
      orderIdx: 0,
      section: first,
      sectionBar: 0,
      pendingSection: null,
      stopAt: Infinity,
    };
  }

  private fadeOut(delay: number, dur: number): void {
    const tr = this.track;
    if (!tr) return;
    const t = this.now() + delay;
    tr.out.gain.cancelScheduledValues(t);
    tr.out.gain.setValueAtTime(Math.max(0.0001, tr.out.gain.value), t);
    tr.out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, dur));
    tr.stopAt = t + dur;
    this.fading.push(tr);
    this.track = null;
  }

  /** Start the current state's theme if the context arrived after the state was set. */
  resume(): void {
    if (this.track || !this.ctx) return;
    const theme = themeFor(this.state, this.ctxInfo);
    if (theme) this.startTrack(theme, this.now(), 1.5);
    this.applyStateLayers(this.state);
  }

  stop(fade = 1): void {
    this.fadeOut(0, fade);
    this.state = 'silent';
  }

  private pushLayers(ramp: number): void {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const now = this.now();
    for (const l of LAYERS) {
      if (l === 'stillness' && this.litany) continue;
      glide(tr.layers[l].gain, this.targets[l], now, ramp);
    }
  }

  // ------------------------------------------------------------------ sequencing

  private currentSection(tr: Track): Section {
    if (tr.intro && tr.theme.intro) return tr.theme.intro;
    return tr.theme.sections[tr.section];
  }

  private advanceBar(tr: Track): void {
    tr.abs++;
    tr.sectionBar++;
    const sec = this.currentSection(tr);
    if (tr.sectionBar >= sec.chords.length) {
      tr.sectionBar = 0;
      if (tr.intro) tr.intro = false;
      else if (tr.theme.order) {
        tr.orderIdx = (tr.orderIdx + 1) % tr.theme.order.length;
        tr.section = tr.theme.order[tr.orderIdx];
      }
    }
    if (tr.pendingSection) {
      tr.section = tr.pendingSection;
      tr.pendingSection = null;
      tr.sectionBar = 0;
    }
  }

  private scheduleBar(tr: Track, t: number): void {
    const synth = this.engine.synth;
    if (!synth) return;
    const sec = this.currentSection(tr);
    const chord = sec.chords[tr.sectionBar % sec.chords.length];
    const theme = tr.theme;
    const c: BarCtx = { bar: tr.sectionBar, abs: tr.abs, chord, section: tr.section, beats: theme.beats, root: theme.root, deg: (d, oct = 0) => degreeMidi(theme, d, oct) };
    const now = this.now();
    for (const l of LAYERS) {
      const g = tr.layers[l];
      const target = l === 'stillness' && this.litany ? 1 : this.targets[l];
      if (target < 0.001 && g.gain.value < 0.001) continue;
      const pat = sec.layers?.[l] ?? theme.layers[l];
      if (!pat) continue;
      for (const ev of pat(c)) {
        let at = t + ev.beat * tr.spb;
        let dur = ev.dur * tr.spb;
        if (at < now + 0.01) {
          // Scheduled late (first bar after a slow frame): join held notes in progress, drop short ones.
          const late = now + 0.01 - at;
          if (dur - late < 0.25) continue;
          at += late;
          dur -= late;
        }
        INSTRUMENTS[ev.inst](synth.begin(at, g, 1, 1), mtof(ev.midi), dur, ev.vel, g);
      }
    }
  }

  /** Per frame: schedule every bar that starts within the look-ahead window (offline renders pass a longer horizon). */
  update(horizon = LOOKAHEAD): void {
    if (!this.ctx) return;
    const now = this.now();
    this.fading = this.fading.filter((tr) => {
      if (now > tr.stopAt + 0.1) {
        tr.out.disconnect();
        return false;
      }
      return true;
    });
    const tr = this.track;
    if (!tr) return;
    let guard = 0;
    while (tr.nextBarTime < now + horizon && guard++ < 256) {
      if (tr.nextBarTime < now - tr.spb * tr.theme.beats) {
        // Fell behind (tab hidden): skip ahead rather than burst-playing missed bars.
        const bars = Math.floor((now - tr.nextBarTime) / (tr.spb * tr.theme.beats));
        for (let i = 0; i < bars; i++) this.advanceBar(tr);
        tr.nextBarTime += bars * tr.spb * tr.theme.beats;
        continue;
      }
      this.scheduleBar(tr, tr.nextBarTime);
      tr.nextBarTime += tr.spb * tr.theme.beats;
      this.advanceBar(tr);
    }
  }

  // ------------------------------------------------------------------ stingers

  /** A short cue in the key of the playing track, on its next beat. */
  stinger(kind: StingerKind, rank = 2): void {
    const ctx = this.ctx;
    const synth = this.engine.synth;
    const bus = this.bus();
    if (!ctx || !synth || !bus) return;
    if (!this.stingerBus) {
      this.stingerBus = ctx.createGain();
      this.stingerBus.gain.value = 1.2;
      this.stingerBus.connect(bus);
    }
    const tr = this.track;
    const theme = tr?.theme ?? THEMES.opA;
    const at = kind === 'failure' ? this.now() : tr ? this.nextBeat() : this.now();
    const spb = tr?.spb ?? 0.5;
    const d = (deg: number, oct = 0) => degreeMidi(theme, deg, oct);
    const play = (inst: InstId, midi: number, beat: number, dur: number, vel: number) => INSTRUMENTS[inst](synth.begin(at + beat * spb, this.stingerBus!, 1, 1), mtof(midi), dur * spb, vel, this.stingerBus!);
    switch (kind) {
      case 'scrubIn':
        [0, 2, 4, 7].forEach((k, i) => play('lute', d(k, 0), i * 0.08, 2, 0.6));
        [0, 0.25, 0.5, 0.75].forEach((b) => play('tabor', 50, b, 0.25, 0.6));
        play('bell', d(0, 0), 1, 2, 0.5);
        break;
      case 'phaseClear':
        [0, 2, 4].forEach((k, i) => play('lute', d(k, 1), i * 0.5, 1.5, 0.6));
        play('chime', d(7, 1), 1.5, 2, 0.6);
        break;
      case 'bossReveal':
        play('bell', d(0, -1), 0, 4, 1);
        play('sackbut', d(0, -1), 0, 2, 0.9);
        play('sackbut', d(0, -1) + 1, 0, 2, 0.7);
        [0, 1, 7].forEach((semi, i) => play('choir', theme.root + 12 + semi, i * 0.75, 0.75, 0.7));
        break;
      case 'victory': {
        // Resolve to the tonic with a Picardy third.
        const root = theme.root;
        for (const semi of [0, 4, 7, 12]) play('organ', root + semi, 0, 4, 0.8);
        for (const semi of [12, 16, 19]) play('choir', root + semi, 0, 4, 0.7);
        play('bell', root + 12, 0, 4, 0.8);
        break;
      }
      case 'failure':
        play('scrape', d(0, -1), 0, 1.2, 1);
        play('organ', d(0, -2), 0.8, 6, 0.5);
        play('organ', d(2, -1), 0.8, 6, 0.4);
        break;
      case 'rank': {
        if (rank <= 1) for (const semi of [0, 4, 7, 12]) play('choir', theme.root + 12 + semi, 0, 3, 0.8);
        else if (rank === 2) for (const semi of [0, 4, 7]) play('organ', theme.root + semi, 0, 3, 0.6);
        else play('lute', theme.root, 0, 2, 0.6);
        break;
      }
      case 'chapter1':
      case 'chapter2': {
        const root = kind === 'chapter1' ? 50 : 52;
        const f = kind === 'chapter1' ? [0, 7, 12, 7, 12, 15, 14, 12] : [0, 1, 7, 5, 1, 0, 7, 12];
        f.forEach((semi, i) => play('sackbut', root + semi, i * 0.5, i === f.length - 1 ? 3 : 0.5, 0.8));
        [0, 0.5, 1, 1.5, 2, 3].forEach((b) => play('drum', 43, b, 0.5, 0.8));
        play('bell', root + 12, 3.5, 4, 0.8);
        break;
      }
    }
  }
}
