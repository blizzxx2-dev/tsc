/**
 * The WebAudio engine: bus graph, master safety chain, reverb sends, voice
 * management, loops, snapshots, ducking, recorded-asset playback with
 * synthesised fallback, captions and debug telemetry.
 *
 *   voices → world ┐
 *            hud ──┴→ sfx ┐
 *            music ───────┤
 *            ui ──────────┼→ master → range comp → limiter → ceiling → mono → balance → focus → out
 *            vo ──────────┤          (reverb returns join master)
 *            ambience ────┘
 */
import { AssetStore } from './assets';
import { CaptionFeed, SubtitleFeed } from './captions';
import { eventDef, isEventId, resolveEvent, type BusId, type EventDef, type EventId } from './events';
import { captionFor } from './i18n';
import { dbToGain, Ducker, MUTE_DB, SnapshotStack, volToGain, type MixState } from './mixer';
import { audioPrefs, type AudioPrefs } from './prefs';
import { LOOPS, RECIPES, type LoopVoice, type Params } from './sfx';
import { glide, NoiseBank, Synth } from './synth';
import { pickVariation, VoiceManager, type Voice } from './voices';

export type Space = 'none' | 'theatre' | 'chapel';

/** Sample-peak ceiling of the master (dBFS). */
export const CEILING_DB = -1.5;

export interface PlayOpts {
  /** −1..1 stereo position. */
  pan?: number;
  /** Linear gain multiplier. */
  vol?: number;
  /** Pitch multiplier. */
  pitch?: number;
  priority?: number;
  params?: Params;
  /** Absolute context time (defaults to now). */
  at?: number;
  /** Hold for bark-style ducking (s). */
  duckHold?: number;
  /** Suppress the caption (e.g. the director captions it differently). */
  noCaption?: boolean;
}

export interface LoopHandle {
  readonly id: number;
  readonly event: EventId;
  alive: boolean;
}

interface LoopRec extends LoopHandle {
  voice: LoopVoice;
  gain: GainNode;
  panner: StereoPannerNode | null;
  bus: BusId;
  rec: Voice | null;
}

interface BusNode {
  input: GainNode;
  duck: GainNode;
  snap: GainNode;
  lpf: BiquadFilterNode;
  shelf: BiquadFilterNode | null;
  send: GainNode;
  meter: AnalyserNode;
  out: AudioNode;
}

const BUS_SEND: Record<BusId, number> = { music: 0.12, world: 0.2, hud: 0.08, ui: 0.03, vo: 0.1, ambience: 0.22 };
/** Bus base levels (dB) for the mix: SFX peaks ≤ −3 dBFS, music bed below VO (docs/audio/loudness.md). */
export const BUS_TRIM: Record<BusId, number> = { music: -6, world: 0, hud: -1, ui: -4, vo: 0, ambience: -5 };

export interface EventLogEntry {
  t: number;
  id: string;
  bus: BusId;
  fallback: boolean;
}

export type ContextFactory = () => BaseAudioContext;

export class AudioEngine {
  ctx: BaseAudioContext | null = null;
  bank: NoiseBank | null = null;
  synth: Synth | null = null;
  buses = {} as Record<BusId, BusNode>;
  sfxBus: BusNode | null = null;
  masterIn: GainNode | null = null;
  private rangeComp: DynamicsCompressorNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  private ceiling: WaveShaperNode | null = null;
  private monoNode: GainNode | null = null;
  private balance: StereoPannerNode | null = null;
  private focusGain: GainNode | null = null;
  private reverbs: Partial<Record<Exclude<Space, 'none'>, { conv: ConvolverNode; wet: GainNode; fed: boolean; off?: ReturnType<typeof setTimeout> }>> = {};
  private reverbIn: GainNode | null = null;
  space: Space = 'none';
  readonly voices = new VoiceManager();
  private loops = new Set<LoopRec>();
  private nextLoop = 1;
  readonly snapshots = new SnapshotStack();
  private appliedVersion = -1;
  mix: MixState = this.snapshots.resolve();
  readonly ducker = new Ducker();
  readonly captions = new CaptionFeed();
  readonly subtitles = new SubtitleFeed();
  readonly assets = new AssetStore();
  readonly prefs: AudioPrefs = audioPrefs;
  private lastVar = new Map<string, number>();
  private lastPlay = new Map<string, number>();
  readonly log: EventLogEntry[] = [];
  /** Plays that had no designed recipe or asset (legacy synth fallback). */
  fallbackPlays = 0;
  readonly fallbackIds = new Set<string>();
  focused = true;
  private listeners: (() => void)[] = [];

  constructor(private factory: ContextFactory | null = null) {}

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Override the clock (offline renders drive a simulated timeline). */
  clock: (() => number) | null = null;
  /** Offline render: no wall-clock timers (node clean-up happens with the context). */
  offline = false;

  /** Highest safe filter frequency for this context (filters above Nyquist misbehave on some implementations). */
  get nyquistSafe(): number {
    return Math.min(20000, (this.ctx?.sampleRate ?? 48000) * 0.45);
  }

  get now(): number {
    return this.clock ? this.clock() : (this.ctx?.currentTime ?? 0);
  }

  // ------------------------------------------------------------------ lifecycle

  /** Create (or resume) the context. Browsers require a user gesture first. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && 'resume' in this.ctx) void (this.ctx as AudioContext).resume();
      return;
    }
    try {
      const ctx = this.factory ? this.factory() : new AudioContext({ latencyHint: 'interactive' });
      this.build(ctx);
    } catch {
      this.ctx = null;
    }
  }

  /** Build the graph on a context (also used by offline tests). */
  build(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.bank = new NoiseBank(ctx);
    this.synth = new Synth(ctx, this.bank);

    this.focusGain = ctx.createGain();
    this.focusGain.connect(ctx.destination);
    this.balance = ctx.createStereoPanner();
    this.balance.connect(this.focusGain);
    this.monoNode = ctx.createGain();
    this.monoNode.channelCountMode = 'explicit';
    this.monoNode.channelInterpretation = 'speakers';
    this.monoNode.connect(this.balance);
    // Safety chain: fast limiter, then a soft sample ceiling (−1.5 dBFS keeps true peak ≤ −1 dBTP).
    this.ceiling = ctx.createWaveShaper();
    this.ceiling.curve = ceilingCurve(dbToGain(CEILING_DB));
    this.ceiling.connect(this.monoNode);
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.ratio.value = 20;
    this.limiter.knee.value = 0;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;
    this.limiter.connect(this.ceiling);
    this.rangeComp = ctx.createDynamicsCompressor();
    this.rangeComp.connect(this.limiter);
    this.masterIn = ctx.createGain();
    this.masterIn.connect(this.rangeComp);

    // Reverb: a shared send, two impulse responses cross-faded by space.
    this.reverbIn = ctx.createGain();
    for (const sp of ['theatre', 'chapel'] as const) {
      const conv = ctx.createConvolver();
      conv.buffer = impulseResponse(ctx, sp);
      const wet = ctx.createGain();
      wet.gain.value = 0;
      // Connected on demand by setSpace: an idle convolver still costs CPU.
      conv.connect(wet);
      wet.connect(this.masterIn);
      this.reverbs[sp] = { conv, wet, fed: false };
    }

    const sfx = this.makeBus(this.masterIn, false);
    this.sfxBus = sfx;
    this.buses = {
      music: this.makeBus(this.masterIn, false),
      world: this.makeBus(sfx.input, true),
      hud: this.makeBus(sfx.input, true),
      ui: this.makeBus(this.masterIn, false),
      vo: this.makeBus(this.masterIn, false),
      ambience: this.makeBus(this.masterIn, false),
    };
    for (const b of Object.keys(this.buses) as BusId[]) this.buses[b].send.gain.value = BUS_SEND[b];
    this.applyPrefs();
    this.setSpace(this.space);
    this.appliedVersion = -1;
    this.bindEnvironment();
  }

  private makeBus(parent: AudioNode, shelf: boolean): BusNode {
    const ctx = this.ctx!;
    const input = ctx.createGain();
    const duck = ctx.createGain();
    const snap = ctx.createGain();
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = this.nyquistSafe;
    lpf.Q.value = 0.5;
    input.connect(duck);
    duck.connect(snap);
    snap.connect(lpf);
    let out: AudioNode = lpf;
    let sh: BiquadFilterNode | null = null;
    if (shelf) {
      sh = ctx.createBiquadFilter();
      sh.type = 'highshelf';
      sh.frequency.value = 4000;
      sh.gain.value = 0;
      lpf.connect(sh);
      out = sh;
    }
    out.connect(parent);
    const send = ctx.createGain();
    out.connect(send);
    send.connect(this.reverbIn!);
    const meter = ctx.createAnalyser();
    meter.fftSize = 512;
    out.connect(meter);
    return { input, duck, snap, lpf, shelf: sh, send, meter, out };
  }

  /** Window focus, device changes and interrupted contexts. */
  private bindEnvironment(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
    if (typeof window === 'undefined' || !(this.ctx instanceof (globalThis.AudioContext ?? class {}))) return;
    const ctx = this.ctx as AudioContext;
    const on = <K extends string>(target: EventTarget, ev: K, fn: () => void) => {
      target.addEventListener(ev, fn);
      this.listeners.push(() => target.removeEventListener(ev, fn));
    };
    on(window, 'blur', () => this.setFocused(false));
    on(window, 'focus', () => this.setFocused(true));
    on(document, 'visibilitychange', () => this.setFocused(document.visibilityState === 'visible' && document.hasFocus()));
    const md = navigator.mediaDevices;
    if (md && 'addEventListener' in md) on(md, 'devicechange', () => this.recover());
    ctx.onstatechange = () => {
      // Safari/macOS 'interrupted' or an unexpected suspend: resume on the next chance.
      if ((ctx.state as string) === 'interrupted' || (ctx.state === 'suspended' && this.focused)) void ctx.resume().catch(() => undefined);
    };
  }

  /** Recover from device changes (unplugged headphones, new default device, closed context). */
  recover(): void {
    const ctx = this.ctx as AudioContext | null;
    if (!ctx) return;
    if (ctx.state === 'closed') {
      this.ctx = null;
      this.loops.clear();
      this.voices.voices.length = 0;
      this.unlock();
      return;
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    if (this.prefs.sinkId) void this.setSink(this.prefs.sinkId);
  }

  setFocused(f: boolean): void {
    this.focused = f;
    if (!this.focusGain || !this.ctx) return;
    const target = f || !this.prefs.muteUnfocused ? 1 : 0;
    const p = this.focusGain.gain;
    p.cancelScheduledValues(this.now);
    p.setValueAtTime(p.value, this.now);
    p.linearRampToValueAtTime(target, this.now + 0.2);
  }

  /** Output device selection (Electron/Chromium `setSinkId`). */
  async setSink(id: string): Promise<boolean> {
    const ctx = this.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!ctx?.setSinkId) return false;
    try {
      await ctx.setSinkId(id);
      return true;
    } catch {
      return false;
    }
  }

  static sinkSupported(): boolean {
    return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
  }

  // ------------------------------------------------------------------ prefs & mix

  /** Push the persisted volumes, mono/balance and dynamic range into the graph. */
  applyPrefs(): void {
    if (!this.ctx) return;
    const p = this.prefs;
    const set = (param: AudioParam, v: number) => glide(param, v, this.now, 0.05);
    set(this.masterIn!.gain, p.muted ? 0 : volToGain(p.master) * (p.mono ? Math.SQRT2 : 1));
    set(this.buses.music.input.gain, volToGain(p.music) * dbToGain(BUS_TRIM.music));
    set(this.sfxBus!.input.gain, volToGain(p.sfx));
    set(this.buses.world.input.gain, dbToGain(BUS_TRIM.world));
    set(this.buses.hud.input.gain, dbToGain(BUS_TRIM.hud));
    set(this.buses.vo.input.gain, volToGain(p.voice) * dbToGain(BUS_TRIM.vo + (p.dynamicRange === 'night' ? 4 : 0)));
    set(this.buses.ambience.input.gain, volToGain(p.ambience) * dbToGain(BUS_TRIM.ambience));
    set(this.buses.ui.input.gain, volToGain(p.ui) * dbToGain(BUS_TRIM.ui));
    this.monoNode!.channelCount = p.mono ? 1 : 2;
    set(this.balance!.pan, Math.max(-1, Math.min(1, p.balance / 100)));
    const rc = this.rangeComp!;
    const [th, ratio] = p.dynamicRange === 'night' ? [-30, 6] : p.dynamicRange === 'reduced' ? [-24, 3] : [0, 1];
    rc.threshold.value = th;
    rc.ratio.value = ratio;
    rc.knee.value = 10;
    rc.attack.value = 0.01;
    rc.release.value = 0.25;
    this.setFocused(this.focused);
  }

  /** Legacy facade: master volume 0..1. */
  get volume(): number {
    return this.prefs.master / 100;
  }
  set volume(v: number) {
    this.prefs.master = Math.round(Math.max(0, Math.min(1, v)) * 100);
    this.applyPrefs();
  }
  get muted(): boolean {
    return this.prefs.muted;
  }
  set muted(m: boolean) {
    this.prefs.muted = m;
    this.applyPrefs();
  }

  setSpace(space: Space): void {
    this.space = space;
    if (!this.ctx) return;
    for (const sp of ['theatre', 'chapel'] as const) {
      const r = this.reverbs[sp];
      if (!r) continue;
      const active = space === sp;
      const on = active ? dbToGain(this.mix.reverbDb) * (sp === 'chapel' ? 0.9 : 0.7) : 0;
      glide(r.wet.gain, on, this.now, 0.9);
      if (active && !r.fed) {
        if (r.off) clearTimeout(r.off);
        r.off = undefined;
        this.reverbIn!.connect(r.conv);
        r.fed = true;
      } else if (!active && r.fed && !r.off) {
        // Let the tail ring out under the fade, then stop feeding it.
        const stop = () => {
          if (this.space !== sp) {
            try {
              this.reverbIn!.disconnect(r.conv);
            } catch {
              // Already disconnected.
            }
            r.fed = false;
          }
          r.off = undefined;
        };
        if (this.offline || typeof setTimeout === 'undefined') stop();
        else r.off = setTimeout(stop, 4000);
      }
    }
  }

  /** Apply the current snapshot mix and ducking; called every frame. */
  private applyMix(): void {
    if (!this.ctx) return;
    const now = this.now;
    if (this.snapshots.version !== this.appliedVersion) {
      this.appliedVersion = this.snapshots.version;
      this.mix = this.snapshots.resolve();
      const fade = Math.max(0.02, this.snapshots.fade);
      for (const b of Object.keys(this.buses) as BusId[]) {
        const m = this.mix.bus[b];
        const n = this.buses[b];
        glide(n.snap.gain, m.db <= MUTE_DB ? 0 : dbToGain(m.db), now, fade);
        glide(n.lpf.frequency, Math.min(m.lpf, this.nyquistSafe), now, fade);
        if (n.shelf) glide(n.shelf.gain, this.mix.shelfDb, now, fade);
      }
      this.setSpace(this.space);
    }
    // Ducking follows the ducker's attack/release envelope, sampled per frame.
    for (const b of Object.keys(this.buses) as BusId[]) {
      const g = Math.round(dbToGain(this.ducker.level(b, now)) * 200) / 200;
      glide(this.buses[b].duck.gain, g, now, 0.02);
    }
  }

  // ------------------------------------------------------------------ one-shots

  /**
   * Play an event. Returns the voice, or null when nothing sounded (no context,
   * cooldown, or lost a voice-steal). Captions are posted even without audio.
   */
  play(idIn: EventId | string, o: PlayOpts = {}): Voice | null {
    const raw = isEventId(idIn) ? idIn : null;
    const id: EventId | null = raw ? resolveEvent(raw) : null;
    const def: EventDef | null = id ? eventDef(id) : null;
    const key = id ?? idIn;
    const now = o.at ?? this.now;
    // Cooldowns use real time so they also hold without a context.
    const clock = this.captions.now;
    if (def?.cooldown !== undefined) {
      const last = this.lastPlay.get(key);
      if (last !== undefined && clock - last < def.cooldown) return null;
    }
    this.lastPlay.set(key, clock);
    if (def?.caption && this.prefs.captions && !o.noCaption) this.captions.push(captionFor(key, def.caption), o.pan ?? 0);
    const bus: BusId = def?.bus ?? 'hud';
    const recipe = id ? RECIPES[id] : undefined;
    const assetKeys = def?.assets?.filter((k) => this.assets.has(k)) ?? [];
    const fallback = !recipe && assetKeys.length === 0;
    this.log.push({ t: clock, id: key, bus, fallback });
    if (this.log.length > 20) this.log.shift();
    if (fallback) {
      this.fallbackPlays++;
      this.fallbackIds.add(key);
    }
    if (def?.duck) this.ducker.trigger(def.duck, now, o.duckHold);
    if (!this.ctx || !this.synth || this.prefs.muted) return null;
    if (bus === 'world' && this.mix.bus.world.db <= MUTE_DB) return null;

    const prio = o.priority ?? def?.prio ?? 50;
    if (!this.voices.admit(key, prio, def?.limit ?? 4, now)) return null;
    const vars = def?.vars ?? 4;
    const v = pickVariation(assetKeys.length || vars, this.lastVar.get(key));
    this.lastVar.set(key, v);
    const cents = def?.cents ? (Math.random() * 2 - 1) * def.cents : 0;
    const world = bus === 'world';
    const rate = world ? this.mix.worldRate : 1;
    const pitch = (o.pitch ?? 1) * 2 ** (cents / 1200) * rate;
    const stretch = 1 / rate;
    const jitter = def?.jitterDb ? (Math.random() * 2 - 1) * def.jitterDb : 0;

    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = (o.vol ?? 1) * dbToGain((def?.db ?? 0) + jitter);
    let head: AudioNode = g;
    if (o.pan !== undefined && !this.prefs.mono) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      head = p;
    }
    head.connect(this.buses[bus].input);

    let end: number;
    if (assetKeys.length) {
      const src = ctx.createBufferSource();
      src.buffer = this.assets.get(assetKeys[v % assetKeys.length])!;
      src.playbackRate.value = pitch;
      src.connect(g);
      src.start(now);
      end = now + src.buffer.duration / pitch;
    } else if (recipe) {
      end = recipe(this.synth.begin(now, g, pitch, stretch), v, o.params ?? {});
    } else if (DEV_FALLBACK) {
      end = DEV_FALLBACK(this.synth.begin(now, g));
    } else end = now;
    const voice = this.voices.add({
      event: key,
      prio,
      start: now,
      end: end + 0.05,
      bus,
      stop: () => {
        const t = this.now;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.02);
        if (!this.offline) setTimeoutSafe(() => head.disconnect(), 60);
      },
    });
    return voice;
  }

  // ------------------------------------------------------------------ loops

  startLoop(id: EventId, params: Params = {}, o: { pan?: number; vol?: number; fadeIn?: number } = {}): LoopHandle | null {
    const def = eventDef(id);
    const recipe = LOOPS[id];
    if (!this.ctx || !this.synth || !recipe) return null;
    const now = this.now;
    if (!this.voices.admit(id, def.prio ?? 40, def.limit ?? 8, now)) return null;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(o.vol ?? 1, now + (o.fadeIn ?? 0.05));
    let panner: StereoPannerNode | null = null;
    if (!this.prefs.mono) {
      panner = ctx.createStereoPanner();
      panner.pan.value = o.pan ?? 0;
      gain.connect(panner);
      panner.connect(this.buses[def.bus].input);
    } else gain.connect(this.buses[def.bus].input);
    const voice = recipe(this.synth.begin(now, gain, 1, 1), params);
    const rec: LoopRec = { id: this.nextLoop++, event: id, alive: true, voice, gain, panner, bus: def.bus, rec: null };
    rec.rec = this.voices.add({ event: id, prio: def.prio ?? 40, start: now, end: Infinity, bus: def.bus, stop: () => this.stopLoop(rec, 30) });
    this.loops.add(rec);
    if (def.caption && this.prefs.captions) this.captions.push(captionFor(id, def.caption), o.pan ?? 0);
    return rec;
  }

  setParam(h: LoopHandle | null, name: string, v: number): void {
    if (!h || !h.alive) return;
    (h as LoopRec).voice.set(name, v, this.now);
  }

  setLoopPan(h: LoopHandle | null, pan: number): void {
    const r = h as LoopRec | null;
    if (!r?.alive || !r.panner) return;
    glide(r.panner.pan, Math.round(Math.max(-1, Math.min(1, pan)) * 50) / 50, this.now, 0.08);
  }

  setLoopGain(h: LoopHandle | null, g: number, tau = 0.05): void {
    const r = h as LoopRec | null;
    if (!r?.alive) return;
    glide(r.gain.gain, g, this.now, tau * 3);
  }

  stopLoop(h: LoopHandle | null, fadeMs = 40): void {
    const r = h as LoopRec | null;
    if (!r || !r.alive) return;
    r.alive = false;
    this.loops.delete(r);
    if (r.rec) this.voices.remove(r.rec);
    const now = this.now;
    const end = r.voice.stop(now, fadeMs / 1000);
    r.gain.gain.cancelScheduledValues(now);
    r.gain.gain.setValueAtTime(r.gain.gain.value, now);
    r.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    const node = r.panner ?? r.gain;
    if (!this.offline) setTimeoutSafe(() => node.disconnect(), Math.max(0, (end - now) * 1000) + 80);
  }

  get activeLoops(): number {
    return this.loops.size;
  }

  stopAllLoops(bus?: BusId): void {
    for (const l of [...this.loops]) if (!bus || l.bus === bus) this.stopLoop(l, 100);
  }

  // ------------------------------------------------------------------ frame

  /** Per-frame housekeeping: loop grains, snapshot fades, ducking, captions. */
  update(dt: number): void {
    this.captions.update(dt);
    this.subtitles.update(dt);
    if (!this.ctx) return;
    const now = this.now;
    this.voices.prune(now);
    const paused = this.snapshots.has('pause');
    for (const l of this.loops) if (!(paused && l.bus === 'world')) l.voice.tick?.(now);
    this.applyMix();
  }

  /** RMS and peak (linear) of a bus over the analyser window. */
  meter(bus: BusId): { rms: number; peak: number } {
    const m = this.buses[bus]?.meter;
    if (!m) return { rms: 0, peak: 0 };
    const data = new Float32Array(m.fftSize);
    m.getFloatTimeDomainData(data);
    let sum = 0;
    let peak = 0;
    for (const x of data) {
      sum += x * x;
      peak = Math.max(peak, Math.abs(x));
    }
    return { rms: Math.sqrt(sum / data.length), peak };
  }

  latency(): { base: number; output: number } {
    const c = this.ctx as AudioContext | null;
    return { base: c?.baseLatency ?? 0, output: c?.outputLatency ?? 0 };
  }
}

/**
 * Dev fallback for ids with no recipe or asset: a neutral wooden tick, so dev builds
 * never go silent. `import.meta.env.DEV` is a build-time constant, so release builds
 * fold this to null and drop the function.
 */
const DEV_FALLBACK: ((s: Synth) => number) | null = import.meta.env.DEV
  ? (s) => {
      s.burst({ dur: 0.03, f: 1500, q: 2, gain: 0.15 });
      return s.tone(600, 0.08, { gain: 0.08, type: 'triangle' });
    }
  : null;

function setTimeoutSafe(fn: () => void, ms: number): void {
  if (typeof setTimeout !== 'undefined') setTimeout(fn, ms);
}

/** Soft ceiling over the shaper input range [-1, 1] (louder input clamps to the ceiling): transparent below 0.8× the ceiling, then tanh into it. */
function ceilingCurve(ceil: number): Float32Array<ArrayBuffer> {
  const n = 4096;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  const knee = ceil * 0.8;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(x) * Math.min(y, ceil);
  }
  return c;
}

/** Synthesised stereo impulse response: early reflections plus a filtered exponential tail. */
export function impulseResponse(ctx: BaseAudioContext, space: 'theatre' | 'chapel'): AudioBuffer {
  const sr = ctx.sampleRate;
  const [rt, damp, pre, refl] = space === 'chapel' ? [3.6, 0.35, 0.03, 9] : [1.3, 0.6, 0.012, 6];
  const len = Math.floor(sr * rt);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const k = 1 - damp * 0.9;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      // Darken over time: a one-pole lowpass whose coefficient falls as the tail decays.
      const coef = Math.max(0.05, k * Math.exp(-t * (space === 'chapel' ? 0.8 : 1.6)));
      lp += coef * (white - lp);
      d[i] = t < pre ? 0 : lp * Math.exp((-6.9 * t) / rt) * 0.5;
    }
    // Early reflections: stone walls.
    for (let r = 0; r < refl; r++) {
      const at = Math.floor(sr * (pre + 0.004 + Math.random() * (space === 'chapel' ? 0.09 : 0.05)));
      if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - r * 0.03);
    }
  }
  return buf;
}
