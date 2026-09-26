import type { Cue } from '../core/audio';
import { EventBus } from '../core/events';
import type { Vec } from '../core/math';
import type { FxEvent } from './fx';
import type { Entity } from './entity';
import type { BossEvent } from './bosses/signals';
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
  /** Boss phases, tells, attacks, music intensity and boss sounds (src/surgery/bosses/signals.ts). */
  boss: BossEvent;
  /** A heavy blow worth a hitstop (ENG-0058): a mistake costing ≥5 vitals (barb tears, stray cuts, bursts). */
  impact: { kind: 'harm'; amount: number; pos: Vec };
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
  /** Frames of silence remaining: while > 0, cues are swallowed (Compline, vocal-fold verses). */
  muteFrames = 0;
  /** Cues published since the counter was last reset (`length = 0`), for tests and tools. */
  private published = 0;

  constructor(private bus: SimBus) {}

  push(...cues: Cue[]): number {
    if (this.muteFrames > 0) return this.published;
    for (const c of cues) {
      this.published++;
      this.bus.emit('cue', c);
      const ev = CUE_EVENTS[c];
      if (ev) this.bus.emit(ev, { cue: c });
    }
    return this.published;
  }

  /** Silence cues for the rest of this frame and the next. */
  muteFrame(): void {
    this.muteFrames = Math.max(this.muteFrames, 2);
    this.published = 0;
  }

  /** Called once at the end of each simulation step. */
  endFrame(): void {
    if (this.muteFrames > 0) this.muteFrames--;
  }

  get length(): number {
    return this.published;
  }
  /** Assigning 0 resets the published counter (compatibility with the old array queue). */
  set length(n: number) {
    this.published = n;
  }
}

/**
 * The gameplay journal (`op.journal`): a bounded, ordered record of what happened
 * for telemetry, achievements, hints and replays. Every cue is also journalled.
 */
export type JournalEvent =
  | { kind: 'rated'; rating: Rating; label?: string; points: number; pos: Vec; combo: number; add: 'content' | 'boss' | 'penalty' | 'self' }
  | { kind: 'spawned'; entity: string; id: number; origin: string }
  | { kind: 'phaseStart'; phase: number }
  | { kind: 'breather'; phase: number }
  | { kind: 'vitalsWarn'; level: 'warn' | 'critical'; vitals: number }
  | { kind: 'litany'; variant: string; use: number }
  | { kind: 'whisper'; total: number }
  | { kind: 'comboMilestone'; combo: number }
  | { kind: 'comboLapsed'; combo: number }
  | { kind: 'toolChanged'; tool: ToolId }
  | { kind: 'toolDisabled'; tool: ToolId; seconds: number }
  | { kind: 'hint'; key: string; text: string }
  | { kind: 'storyFlag'; flag: string }
  | { kind: 'checkpoint'; phase: number }
  | { kind: 'cue'; cue: Cue }
  | { kind: 'won'; score: number }
  | { kind: 'lost'; reason: string; cause: string };

export type JournalEventKind = JournalEvent['kind'];
