/**
 * Voice manager: per-event voice limits and a global cap, stealing the
 * lowest-priority, then oldest, voice when full. Pure bookkeeping — the engine
 * owns the nodes and passes a `stop` callback — so stealing is unit-tested.
 */

export interface Voice {
  id: number;
  event: string;
  prio: number;
  start: number;
  /** Context time the voice ends on its own (Infinity for loops). */
  end: number;
  bus: string;
  stop(): void;
}

export const GLOBAL_VOICE_CAP = 48;

export class VoiceManager {
  voices: Voice[] = [];
  private nextId = 1;

  constructor(readonly cap = GLOBAL_VOICE_CAP) {}

  /** Drop voices that have finished. */
  prune(now: number): void {
    if (this.voices.some((v) => v.end <= now)) this.voices = this.voices.filter((v) => v.end > now);
  }

  count(event?: string): number {
    return event ? this.voices.filter((v) => v.event === event).length : this.voices.length;
  }

  /**
   * Make room for a new voice. Returns false if the new voice loses (its
   * priority is below every playing voice when the global cap is full).
   * Stolen voices are stopped and removed.
   */
  admit(event: string, prio: number, limit: number, now: number): boolean {
    this.prune(now);
    // Per-event limit: steal the oldest voice of the same event.
    const same = this.voices.filter((v) => v.event === event);
    if (same.length >= limit) {
      const victim = same.reduce((a, b) => (b.start < a.start ? b : a));
      this.steal(victim);
    }
    if (this.voices.length >= this.cap) {
      const victim = this.voices.reduce((a, b) => (b.prio < a.prio || (b.prio === a.prio && b.start < a.start) ? b : a));
      if (victim.prio > prio) return false;
      this.steal(victim);
    }
    return true;
  }

  add(v: Omit<Voice, 'id'>): Voice {
    const voice = { ...v, id: this.nextId++ };
    this.voices.push(voice);
    return voice;
  }

  remove(v: Voice): void {
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
  }

  private steal(v: Voice): void {
    this.remove(v);
    v.stop();
  }

  /** Active voice counts per bus, for the debug overlay. */
  byBus(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of this.voices) out[v.bus] = (out[v.bus] ?? 0) + 1;
    return out;
  }
}

/** Pick a variation index with no immediate repeat. */
export function pickVariation(count: number, last: number | undefined, rand = Math.random): number {
  if (count <= 1) return 0;
  if (last === undefined || last < 0 || last >= count) return Math.min(count - 1, Math.floor(rand() * count));
  let v = Math.floor(rand() * (count - 1));
  if (v >= last) v++;
  return Math.min(count - 1, v);
}
