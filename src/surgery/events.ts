import type { Cue } from '../core/audio';
import { EventBus } from '../core/events';
import type { Vec } from '../core/math';
import type { FxEvent } from '../render/particles';
import type { Entity } from './entity';
import type { Rating, ToolId } from './types';

/**
 * Typed simulation events (ENG-0243). The sim only *announces* what happened;
 * views, particles, decals, audio and achievements subscribe. Nothing here is
 * presentation state — popups and sounds live with their consumers.
 */
export interface SimEvents {
  /** A sound the moment calls for (consumed by audio). */
  cue: Cue;
  cut: { cue: Cue };
  stitch: { cue: Cue };
  drain: { cue: Cue };
  burn: { cue: Cue };
  extract: { cue: Cue };
  rate: { rating: Rating; pos: Vec; label?: string; combo: number; points: number };
  hurt: { amount: number; pos?: Vec; vitals: number };
  heal: { amount: number; vitals: number };
  popup: { text: string; pos: Vec; color: string; rating?: Rating; label?: string; combo?: number };
  say: { lines: string[] };
  fx: FxEvent;
  phase: { index: number; count: number };
  litany: { duration: number };
  tool: { tool: ToolId; previous: ToolId };
  spawn: { entity: Entity };
  death: { entity: Entity };
  malisonHit: { pos: Vec; damage: number };
  win: { score: number; vitals: number; timeLeft: number };
  lose: { reason: string };
}

/** Semantic events implied by the sound cues entities already request. */
const CUE_EVENTS: Partial<Record<Cue, 'cut' | 'stitch' | 'drain' | 'burn' | 'extract'>> = {
  cut: 'cut',
  stitch: 'stitch',
  squelch: 'drain',
  burn: 'burn',
  pluck: 'extract',
};

export type SimBus = EventBus<SimEvents>;

/**
 * Drop-in replacement for the old `op.cues: Cue[]` queue: `op.cues.push('cut')`
 * now publishes on the bus instead of storing strings for the scene to drain.
 */
export class CueSink {
  constructor(private bus: SimBus) {}

  push(...cues: Cue[]): number {
    for (const c of cues) {
      this.bus.emit('cue', c);
      const ev = CUE_EVENTS[c];
      if (ev) this.bus.emit(ev, { cue: c });
    }
    return 0;
  }
}
