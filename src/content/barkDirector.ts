/**
 * The bark director (NAR-0071…0077): listens to an operation's event bus and has the observer,
 * the patient and the Hour speak through `op.say` at `praise` priority, under the cooldown and
 * per-trigger limits in docs/narrative/barks.md. Scripted callouts and the sim's own danger lines
 * always outrank a bark; the director never touches `op.rng`.
 */
import type { Operation } from '../surgery/operation';
import {
  BARK_COOLDOWN,
  BARK_LIMITS,
  BARK_SAMPLE,
  BARK_URGENT,
  MALISON_WHISPERS,
  pickBark,
  pickPatientBark,
  pickWhisper,
  resetBarkHistory,
  speakerFor,
  STROH_PRESENT,
  type BarkSpeaker,
  type BarkTrigger,
  type PatientTrigger,
  WHISPER_BAND_BARKS,
  ENV_BARKS,
} from './barks';
import type { WhisperBand } from './whisper';

export interface BarkDirectorOptions {
  /** Override the observer (default: `speakerFor(op.def.id)`). */
  speaker?: BarkSpeaker;
   
  /** Unit-interval source for cosmetic choices (default Math.random). */
  rng?: () => number;
  /** Seconds between barks (default BARK_COOLDOWN). */
  cooldown?: number;
  /** The Whisper band going in (NAR-0166): Suspected and Accused draw remarks after the star. */
  whisper?: WhisperBand;
}

/** Seconds without a rated action before `idle` may fire. */
export const IDLE_AFTER = 12;

export class BarkDirector {
  readonly speaker: BarkSpeaker;
  private readonly rng: () => number;
  private readonly cooldown: number;
  private lastAt = -Infinity;
  private lastRated = 0;
  private fired = new Map<string, number>();
  private armed30 = true;
  private armed15 = true;
  private ended = false;
  private readonly hour: keyof typeof MALISON_WHISPERS | null;
  private readonly band: WhisperBand;
  private unsubscribe: (() => void)[] = [];
  /** Every line spoken, for tests. */
  readonly spoken: { trigger: string; line: string }[] = [];

  constructor(
    private readonly op: Operation,
    opts: BarkDirectorOptions = {},
  ) {
    // Challenge mode speaks in the examiner's neutral voice (NAR-0167).
    this.speaker = opts.speaker ?? (op.opts.challenge ? 'examiner' : speakerFor(op.def.id));
    // eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
    this.rng = opts.rng ?? Math.random;
    this.cooldown = opts.cooldown ?? BARK_COOLDOWN;
    this.band = opts.whisper ?? 'unremarked';
    this.hour = op.def.id === 'op1-5' ? 'matins' : op.def.id === 'op2-5' ? 'lauds' : null;
    resetBarkHistory();
    this.listen();
    this.fire('op-start');
    this.environment();
  }

  /** One warning per table condition the operation opens under (NAR-0164): rain, a moving cart, one candle. */
  private environment(): void {
    const on = new Set<string>(this.op.opts.mutators ?? []);
    if (this.op.def.venue === 'field' && this.op.def.id === 'op4-1') on.add('rain');
    for (const m of ['rain', 'cart', 'candle'] as const) {
      if (!on.has(m)) continue;
      const lines = ENV_BARKS[m];
      this.say(`env:${m}`, lines[Math.floor(this.rng() * lines.length) % lines.length]);
    }
  }

  private listen(): void {
    const ev = this.op.events;
    this.unsubscribe.push(
      ev.on('rate', ({ rating, combo }) => {
        this.lastRated = this.op.elapsed;
        if (combo === 5 || combo === 10 || combo === 20) this.fire(`combo-${combo}` as BarkTrigger);
        else if (this.rng() < (BARK_SAMPLE[rating] ?? 1)) this.fire(rating);
      }),
      ev.on('hurt', ({ vitals, amount }) => {
        if (vitals < 15 && this.armed15) {
          this.armed15 = false;
          this.fireVitals('vitals-15');
        } else if (vitals < 30 && this.armed30) {
          this.armed30 = false;
          this.fireVitals('vitals-30');
        }
        if (vitals > 25) this.armed15 = true;
        if (vitals > 40) this.armed30 = true;
        if (amount >= 5 && this.rng() < 0.15) this.patient('pain');
        this.clock();
      }),
      ev.on('heal', () => {
        this.fire('tincture');
        if (this.rng() < 0.5) this.patient('relief');
      }),
      ev.on('litany', () => {
        this.fire('litany');
        this.stroh('litany');
        this.whisperBand();
      }),
      ev.on('phase', ({ index }) => {
        if (index <= 0) return;
        const phase = this.op.def.phases[index] as { data?: { close?: boolean } } | undefined;
        if (phase?.data?.close) this.patient('closing');
        if (this.hour && index >= 2) {
          this.whisper();
          if (index === 2) {
            this.fire('enraged');
            this.stroh('enraged');
            return;
          }
        }
        this.fire('phase');
        this.stroh('phase');
      }),
      ev.on('cut', () => this.patient('first-cut')),
      ev.on('extract', () => this.patient('extract')),
      ev.on('malisonHit', () => {
        if (this.hour && this.rng() < 0.2) this.whisper();
      }),
      ev.on('win', () => this.end('success')),
      ev.on('lose', () => this.end('fail')),
    );
  }

  /** Time-based triggers, checked whenever the sim reports anything (bleeding reports often). */
  private clock(): void {
    if (this.ended) return;
    if (this.op.timeLeft < 30) this.fire('time-30');
    if (this.op.elapsed - this.lastRated > IDLE_AFTER && this.op.phase >= 0) {
      this.lastRated = this.op.elapsed;
      this.fire('idle');
    }
  }

  /** The sim's own danger lines are in Ilse's voice; only the other observers double them. */
  private fireVitals(t: 'vitals-30' | 'vitals-15'): void {
    if (this.speaker !== 'ilse') this.fire(t);
  }

  private end(t: 'success' | 'fail'): void {
    if (this.ended) return;
    this.fire(t);
    this.stroh(t);
    this.ended = true;
  }

  private stroh(t: BarkTrigger): void {
    if (this.speaker !== 'stroh' && STROH_PRESENT.includes(this.op.def.id)) this.fire(t, 'stroh');
  }

  private patient(t: PatientTrigger): void {
    if (this.ended || !this.ready(false, `patient:${t}`, 2)) return;
    const line = pickPatientBark(this.op.def.id, t, this.rng);
    if (line) this.say(`patient:${t}`, line);
  }

  private whisper(): void {
    if (!this.hour || this.ended || !this.ready(true, 'whisper', 6)) return;
    this.say('whisper', pickWhisper(this.hour, this.rng));
  }

  /** What the witnesses will make of the star, once the city already suspects (NAR-0166). */
  private whisperBand(): void {
    if (this.band !== 'suspected' && this.band !== 'accused') return;
    if (this.ended || !this.ready(true, 'whisper-band', 2)) return;
    const who = this.speaker === 'stroh' || STROH_PRESENT.includes(this.op.def.id) ? 'stroh' : 'ilse';
    const lines = WHISPER_BAND_BARKS[this.band][who];
    this.say('whisper-band', lines[Math.floor(this.rng() * lines.length) % lines.length]);
  }

  /** Fire a trigger for the observer (or Stroh). Returns the line spoken, if any. */
  fire(t: BarkTrigger, who: BarkSpeaker = this.speaker): string | undefined {
    if (this.ended && t !== 'success' && t !== 'fail') return undefined;
    const key = `${who}:${t}`;
    if (!this.ready(BARK_URGENT.includes(t), key, BARK_LIMITS[t])) return undefined;
    const line = pickBark(who, t, this.rng);
    if (line) this.say(key, line);
    return line;
  }

  private ready(urgent: boolean, key: string, limit: number): boolean {
    if ((this.fired.get(key) ?? 0) >= limit) return false;
    if (!urgent && this.op.elapsed - this.lastAt < this.cooldown) return false;
    return true;
  }

  private say(key: string, line: string): void {
    this.fired.set(key, (this.fired.get(key) ?? 0) + 1);
    this.lastAt = this.op.elapsed;
    this.spoken.push({ trigger: key, line });
    this.op.say(line, 'praise');
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }
}

/** Attach a director to an operation (one line in the operation scene's `listen()`). */
export const attachBarkDirector = (op: Operation, opts?: BarkDirectorOptions): BarkDirector => new BarkDirector(op, opts);
