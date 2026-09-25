/**
 * Voice-over runtime. Lines are keyed by a stable id derived from their text
 * (see `lineId`, shared with `scripts/vo-export.mjs`); a line with a recorded
 * asset (`vo/<id>` in the manifest) plays on the VO bus with bark ducking and a
 * subtitle, and a new urgent bark interrupts a playing tip with a 60 ms fade.
 * Without a recording the line stays text-only (the callout panel), but still
 * ducks music and ambience so the text lands.
 */
import type { AudioEngine } from './engine';
import { audioLanguage, subtitleFor } from './i18n';
import { pickVariation } from './voices';

/** Seconds before the same bark may be voiced again (AUD-0099). */
export const BARK_COOLDOWN = 20;
/** Recorded takes per line: vo/<id>, vo/<id>.2, vo/<id>.3. */
export const VARIANTS = 3;

/** FNV-1a hash of the normalised line text → `line.xxxxxxxx`. */
export function lineId(text: string): string {
  const norm = text.normalize('NFKD').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `line.${h.toString(16).padStart(8, '0')}`;
}

interface Playing {
  src: AudioBufferSourceNode;
  gain: GainNode;
  urgent: boolean;
  until: number;
  id: string;
}

export class VoiceOver {
  private current: Playing | null = null;
  /** Lines requested without a recording (dev report). */
  readonly textOnly = new Set<string>();
  /**
   * VO language folder: assets are looked up as vo/<lang>/<id> first, then vo/<id>
   * (English), so localised VO can be dropped in without code changes.
   */
  get language(): string {
    return audioLanguage();
  }
  private lastVariant = new Map<string, number>();
  private lastPlayed = new Map<string, number>();
  private clock = 0;

  /** Advance the cooldown clock (real seconds). */
  tick(dt: number): void {
    this.clock += dt;
  }

  /** The recorded takes available for a line id, localised first. */
  takes(id: string): AudioBuffer[] {
    const a = this.engine.assets;
    const names = Array.from({ length: VARIANTS }, (_, i) => (i === 0 ? id : `${id}.${i + 1}`));
    const loc = this.language !== 'en' ? names.map((n) => a.get(`vo/${this.language}/${n}`)).filter((b): b is AudioBuffer => !!b) : [];
    return loc.length ? loc : names.map((n) => a.get(`vo/${n}`)).filter((b): b is AudioBuffer => !!b);
  }

  constructor(private engine: AudioEngine) {}

  /** Seconds left on the playing line (0 when silent). */
  remaining(): number {
    if (!this.current) return 0;
    return Math.max(0, this.current.until - this.engine.now);
  }

  /**
   * Speak a line. Returns the duration it will occupy: the recording's length
   * when there is one, else the text hold. `speaker`/`color` feed the subtitle.
   */
  line(text: string, hold: number, urgent = false, speaker = 'Sister Ilse', color = '#9fd3a8'): number {
    const eng = this.engine;
    const id = lineId(text);
    const takes = this.takes(id);
    const last = this.lastPlayed.get(id);
    const cooling = last !== undefined && this.clock - last < BARK_COOLDOWN;
    let buf: AudioBuffer | undefined;
    if (takes.length && !cooling) {
      const v = pickVariation(takes.length, this.lastVariant.get(id));
      this.lastVariant.set(id, v);
      buf = takes[v];
    }
    if (!buf || !eng.ctx) {
      this.textOnly.add(id);
      if (hold > 0) eng.ducker.trigger('bark', eng.now, hold);
      return hold;
    }
    const now = eng.now;
    this.lastPlayed.set(id, this.clock);
    if (this.current && this.current.until > now) {
      // An urgent line cuts a tip short; otherwise the new line replaces the old one the same way.
      const g = this.current.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.06);
      this.current.src.stop(now + 0.07);
    }
    const ctx = eng.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(eng.buses.vo.input);
    const start = now + (this.current ? 0.06 : 0);
    src.start(start);
    this.current = { src, gain, urgent, until: start + buf.duration, id };
    eng.ducker.trigger('bark', now, buf.duration + 0.1);
    if (eng.prefs.subtitles) eng.subtitles.show(speaker, color, subtitleFor(id, text), buf.duration);
    return buf.duration;
  }

  /** An operation bark from Sister Ilse. */
  bark(text: string, hold: number, urgent = false): number {
    return this.line(text, hold, urgent);
  }

  private paused: { buf: AudioBuffer; offset: number; urgent: boolean; id: string } | null = null;

  /** Pause mid-line (menu opened): remember the offset. */
  pause(): void {
    const c = this.current;
    if (!c || !c.src.buffer || c.until <= this.engine.now) return;
    const offset = c.src.buffer.duration - (c.until - this.engine.now);
    this.paused = { buf: c.src.buffer, offset: Math.max(0, offset), urgent: c.urgent, id: c.id };
    this.stop();
  }

  /** Resume a paused line from where it stopped. */
  resume(): void {
    const p = this.paused;
    const eng = this.engine;
    this.paused = null;
    if (!p || !eng.ctx) return;
    const src = eng.ctx.createBufferSource();
    src.buffer = p.buf;
    const gain = eng.ctx.createGain();
    src.connect(gain);
    gain.connect(eng.buses.vo.input);
    src.start(eng.now, p.offset);
    this.current = { src, gain, urgent: p.urgent, until: eng.now + p.buf.duration - p.offset, id: p.id };
  }

  stop(): void {
    if (!this.current) return;
    try {
      this.current.src.stop();
    } catch {
      // Already ended.
    }
    this.current = null;
  }
}
