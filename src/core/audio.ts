/**
 * Procedural sound: every effect is synthesized with WebAudio so the game ships
 * with no audio assets yet. Swap individual cues for recorded samples later.
 */
export type Cue =
  | 'cool'
  | 'good'
  | 'bad'
  | 'miss'
  | 'cut'
  | 'stitch'
  | 'squelch'
  | 'pluck'
  | 'burn'
  | 'inject'
  | 'heartbeat'
  | 'flatline'
  | 'litany'
  | 'bell'
  | 'select'
  | 'alarm';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.5;
  muted = false;

  /** Browsers require a user gesture before audio can start. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.3, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number, q = 1, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  play(cue: Cue): void {
    switch (cue) {
      case 'cool':
        this.tone(880, 0.12, 'triangle', 0.25);
        this.tone(1320, 0.2, 'triangle', 0.2, undefined, 0.07);
        break;
      case 'good':
        this.tone(660, 0.15, 'triangle', 0.2);
        break;
      case 'bad':
        this.tone(220, 0.25, 'sawtooth', 0.15, 160);
        break;
      case 'miss':
        this.tone(140, 0.35, 'square', 0.15, 90);
        break;
      case 'cut':
        this.noise(0.12, 0.25, 3500, 2);
        break;
      case 'stitch':
        this.noise(0.05, 0.2, 2200, 6);
        this.tone(1200, 0.04, 'sine', 0.08);
        break;
      case 'squelch':
        this.noise(0.18, 0.3, 400, 3);
        break;
      case 'pluck':
        this.tone(500, 0.08, 'sine', 0.2, 900);
        break;
      case 'burn':
        this.noise(0.3, 0.2, 6000, 0.7);
        break;
      case 'inject':
        this.tone(300, 0.3, 'sine', 0.15, 600);
        break;
      case 'heartbeat':
        this.tone(60, 0.12, 'sine', 0.5, 40);
        this.tone(55, 0.1, 'sine', 0.35, 38, 0.16);
        break;
      case 'flatline':
        this.tone(980, 1.5, 'sine', 0.2);
        break;
      case 'litany':
        for (const [i, f] of [196, 247, 294, 392].entries()) this.tone(f, 1.6, 'sine', 0.12, undefined, i * 0.05);
        break;
      case 'bell':
        this.tone(392, 2.2, 'sine', 0.25);
        this.tone(784, 1.4, 'sine', 0.1);
        this.tone(1175, 0.9, 'sine', 0.05);
        break;
      case 'select':
        this.tone(520, 0.05, 'square', 0.08);
        break;
      case 'alarm':
        this.tone(740, 0.15, 'square', 0.1);
        this.tone(740, 0.15, 'square', 0.1, undefined, 0.25);
        break;
    }
  }
}
