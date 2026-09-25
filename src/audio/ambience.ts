/**
 * Location ambiences: a seamless synthesised bed per backdrop (cross-faded over
 * 1 s on scene change), random one-shot emitters with min/max intervals and
 * random pan (never two within 4 s), and the curse-corruption whisper bed.
 */
import type { AudioEngine, LoopHandle } from './engine';
import type { EventId } from './events';

import type { AmbienceId } from './beds';

export type { AmbienceId };

export interface Emitter {
  id: EventId;
  min: number;
  max: number;
  /** Volume 0..1. */
  vol?: number;
}

export const EMITTERS: Record<AmbienceId, Emitter[]> = {
  hospice: [
    { id: 'amb.cough', min: 9, max: 22, vol: 0.7 },
    { id: 'amb.bell', min: 30, max: 70, vol: 0.6 },
    { id: 'amb.drip', min: 5, max: 12, vol: 0.5 },
  ],
  street: [
    { id: 'amb.crow', min: 8, max: 20 },
    { id: 'amb.dog', min: 12, max: 30, vol: 0.8 },
    { id: 'amb.cart', min: 20, max: 45 },
    { id: 'amb.bell', min: 30, max: 70 },
    { id: 'amb.watchman', min: 45, max: 90, vol: 0.7 },
  ],
  theatre: [
    { id: 'amb.cough', min: 20, max: 45, vol: 0.4 },
    { id: 'amb.bell', min: 40, max: 90, vol: 0.4 },
  ],
  chapel: [
    { id: 'amb.choirHum', min: 20, max: 40 },
    { id: 'amb.bell', min: 30, max: 60, vol: 0.8 },
    { id: 'amb.cough', min: 25, max: 50, vol: 0.4 },
  ],
  night: [
    { id: 'amb.owl', min: 15, max: 35 },
    { id: 'amb.dog', min: 20, max: 45, vol: 0.6 },
    { id: 'amb.watchman', min: 30, max: 60, vol: 0.8 },
    { id: 'amb.drunk', min: 40, max: 90, vol: 0.7 },
    { id: 'amb.bell', min: 45, max: 90, vol: 0.6 },
  ],
  pyre: [
    { id: 'amb.crowd', min: 6, max: 14 },
    { id: 'amb.bell', min: 25, max: 50, vol: 0.8 },
    { id: 'amb.crow', min: 15, max: 30, vol: 0.6 },
  ],
  cathedral: [
    { id: 'amb.choirHum', min: 18, max: 35 },
    { id: 'amb.bell', min: 30, max: 60 },
    { id: 'amb.cough', min: 30, max: 60, vol: 0.3 },
  ],
  catacombs: [
    { id: 'amb.rats', min: 8, max: 20 },
    { id: 'amb.drip', min: 3, max: 9 },
  ],
  armycamp: [
    { id: 'amb.sentry', min: 25, max: 50 },
    { id: 'amb.armour', min: 10, max: 22 },
    { id: 'amb.horse', min: 20, max: 40 },
    { id: 'amb.battle', min: 30, max: 70, vol: 0.7 },
  ],
  flooded: [
    { id: 'amb.slosh', min: 5, max: 12 },
    { id: 'amb.drip', min: 3, max: 8 },
    { id: 'amb.rats', min: 20, max: 45, vol: 0.6 },
  ],
  camp: [
    { id: 'amb.armour', min: 8, max: 18 },
    { id: 'amb.horse', min: 15, max: 35 },
    { id: 'amb.drunk', min: 30, max: 60, vol: 0.8 },
    { id: 'amb.dog', min: 25, max: 50, vol: 0.5 },
  ],
};

/** Minimum spacing between any two emitter one-shots. */
export const EMITTER_GAP = 4;

/** Emitter scheduling, pure so the spacing rule is testable. */
export class EmitterScheduler {
  private due = new Map<number, number>();
  private lastFire = -Infinity;
  t = 0;

  constructor(
    public list: Emitter[],
    private rand = Math.random,
  ) {
    list.forEach((e, i) => this.due.set(i, this.t + e.min * 0.5 + this.rand() * (e.max - e.min) * 0.5));
  }

  /** Advance time; returns emitters that fire now. */
  update(dt: number): Emitter[] {
    this.t += dt;
    const out: Emitter[] = [];
    this.list.forEach((e, i) => {
      const due = this.due.get(i)!;
      if (this.t < due) return;
      if (this.t - this.lastFire < EMITTER_GAP) {
        // Too soon after another emitter: slip this one back.
        this.due.set(i, this.lastFire + EMITTER_GAP + this.rand() * 2);
        return;
      }
      out.push(e);
      this.lastFire = this.t;
      this.due.set(i, this.t + e.min + this.rand() * (e.max - e.min));
    });
    return out;
  }
}


/** Scene backdrop names (including screens without a story backdrop) → ambience. */
export function ambienceFor(backdrop: string): AmbienceId {
  switch (backdrop) {
    case 'hospice':
    case 'street':
    case 'theatre':
    case 'chapel':
    case 'night':
    case 'camp':
    case 'pyre':
    case 'cathedral':
    case 'catacombs':
    case 'armycamp':
    case 'flooded':
      return backdrop;
    case 'results':
      return 'hospice';
    default:
      return 'night';
  }
}

export class AmbienceManager {
  current: AmbienceId | null = null;
  private bed: LoopHandle | null = null;
  private curse: LoopHandle | null = null;
  private curseLevel = 0;
  private emitters: EmitterScheduler | null = null;
  bedGain = 1;

  constructor(private engine: AudioEngine) {}

  set(id: AmbienceId | null): void {
    if (id === this.current && (this.bed || !this.engine.ready)) return;
    this.current = id;
    this.engine.stopLoop(this.bed, 1000);
    this.bed = null;
    this.emitters = id ? new EmitterScheduler(EMITTERS[id]) : null;
    if (id) this.bed = this.engine.startLoop(`loop.amb.${id}` as EventId, {}, { fadeIn: 1, vol: this.bedGain });
    this.engine.setSpace(id === 'chapel' || id === 'cathedral' ? 'chapel' : id === 'theatre' || id === 'hospice' || id === 'catacombs' ? 'theatre' : 'none');
  }

  /** Bed level (the theatre bed ducks as tension rises). */
  setBedGain(g: number): void {
    if (Math.abs(g - this.bedGain) < 0.01) return;
    this.bedGain = g;
    this.engine.setLoopGain(this.bed, g, 0.5);
  }

  /** Curse corruption: whisper bed level 0..1 (sigils 0.25, Malison 0.7), smoothed over 1.5 s. */
  setCurse(level: number, dt: number): void {
    this.curseLevel += (level - this.curseLevel) * Math.min(1, dt / 1.5);
    if (this.curseLevel > 0.01 && !this.curse) this.curse = this.engine.startLoop('loop.curse.bed', { level: 0 }, { fadeIn: 0.5 });
    if (this.curse) {
      this.engine.setParam(this.curse, 'level', this.curseLevel);
      if (this.curseLevel < 0.005 && level === 0) {
        this.engine.stopLoop(this.curse, 500);
        this.curse = null;
      }
    }
  }

  update(dt: number): void {
    if (!this.emitters) return;
    for (const e of this.emitters.update(dt)) this.engine.play(e.id, { pan: Math.random() * 1.6 - 0.8, vol: e.vol ?? 1 });
    if (this.engine.ready && this.current && !this.bed) this.bed = this.engine.startLoop(`loop.amb.${this.current}` as EventId, {}, { fadeIn: 1, vol: this.bedGain });
  }

  stop(): void {
    this.set(null);
    this.engine.stopLoop(this.curse, 500);
    this.curse = null;
  }
}
