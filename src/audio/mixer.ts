/**
 * Mixing logic, kept pure so it can be unit-tested: the snapshot stack (named
 * mix states that override bus parameters, cross-faded, with priorities) and
 * the ducking table (sidechain-style gain dips triggered by barks and stings).
 */
import type { BusId, DuckKind } from './events';

export interface BusMix {
  /** Gain offset in dB. */
  db: number;
  /** Lowpass cutoff (Hz). 20000 = open. */
  lpf: number;
}

export interface MixState {
  bus: Record<BusId, BusMix>;
  /** World-SFX pitch/time rate (Litany slows the world). */
  worldRate: number;
  /** Reverb send offset in dB. */
  reverbDb: number;
  /** High-shelf cut (dB, ≤ 0) above 4 kHz on world + hud (low vitals). */
  shelfDb: number;
  /** Tinnitus layer level 0..1. */
  tinnitus: number;
  /** Heartbeat rate multiplier (Litany). */
  heartRate: number;
}

export type SnapshotId = 'default' | 'pause' | 'litany' | 'lowVitals' | 'vn' | 'results' | 'menu';

type Override = {
  bus?: Partial<Record<BusId, Partial<BusMix>>>;
} & Partial<Omit<MixState, 'bus'>>;

export interface Snapshot {
  id: SnapshotId;
  prio: number;
  /** Cross-fade in/out seconds. */
  enter: number;
  exit: number;
  set: Override;
}

const OPEN = 20000;
export const MUTE_DB = -80;

export const BASE_MIX: MixState = {
  bus: {
    music: { db: 0, lpf: OPEN },
    world: { db: 0, lpf: OPEN },
    hud: { db: 0, lpf: OPEN },
    ui: { db: 0, lpf: OPEN },
    vo: { db: 0, lpf: OPEN },
    ambience: { db: 0, lpf: OPEN },
  },
  worldRate: 1,
  reverbDb: 0,
  shelfDb: 0,
  tinnitus: 0,
  heartRate: 1,
};

export const SNAPSHOTS: Record<SnapshotId, Snapshot> = {
  default: { id: 'default', prio: 0, enter: 0.3, exit: 0.3, set: {} },
  menu: { id: 'menu', prio: 10, enter: 0.3, exit: 0.3, set: { bus: { ambience: { db: -4 } }, reverbDb: -3 } },
  vn: { id: 'vn', prio: 10, enter: 0.3, exit: 0.3, set: { bus: { music: { db: -2 }, ambience: { db: -2 } } } },
  results: { id: 'results', prio: 10, enter: 0.3, exit: 0.3, set: { bus: { ambience: { db: -8 }, world: { db: MUTE_DB } } } },
  lowVitals: { id: 'lowVitals', prio: 20, enter: 1.2, exit: 1.5, set: { shelfDb: -6, tinnitus: 1 } },
  litany: {
    id: 'litany',
    prio: 30,
    enter: 0.4,
    exit: 0.6,
    // Music is handled by the player's Stillness cross-fade (its Stillness stem must stay open).
    set: { bus: { world: { lpf: 1200 }, ambience: { db: -9, lpf: 900 } }, worldRate: 0.6, reverbDb: 6, heartRate: 0.15 },
  },
  pause: {
    id: 'pause',
    prio: 50,
    enter: 0.3,
    exit: 0.3,
    set: { bus: { music: { db: -6, lpf: 800 }, world: { db: MUTE_DB }, ambience: { db: -12 } }, tinnitus: 0 },
  },
};

/** Resolve a set of active snapshots into one mix: higher priority overrides lower, per parameter. */
export function resolveMix(active: Iterable<SnapshotId>): MixState {
  const out: MixState = structuredCloneMix(BASE_MIX);
  const list = [...new Set(active)].map((id) => SNAPSHOTS[id]).sort((a, b) => a.prio - b.prio);
  for (const s of list) {
    const { bus, ...rest } = s.set;
    if (bus) for (const [b, m] of Object.entries(bus) as [BusId, Partial<BusMix>][]) Object.assign(out.bus[b], m);
    Object.assign(out, rest);
  }
  return out;
}

function structuredCloneMix(m: MixState): MixState {
  const bus = {} as Record<BusId, BusMix>;
  for (const k of Object.keys(m.bus) as BusId[]) bus[k] = { ...m.bus[k] };
  return { ...m, bus };
}

/** A stack of active snapshots; tracks the fade time of the latest change. */
export class SnapshotStack {
  private active = new Set<SnapshotId>(['default']);
  /** Fade time (s) to apply for the most recent transition. */
  fade = 0.3;
  /** Increments on every change so the engine knows to re-apply. */
  version = 0;

  has(id: SnapshotId): boolean {
    return this.active.has(id);
  }

  push(id: SnapshotId): void {
    if (this.active.has(id)) return;
    this.active.add(id);
    this.fade = SNAPSHOTS[id].enter;
    this.version++;
  }

  pop(id: SnapshotId): void {
    if (id === 'default' || !this.active.has(id)) return;
    this.active.delete(id);
    this.fade = SNAPSHOTS[id].exit;
    this.version++;
  }

  /** Push or pop depending on `on`. */
  set(id: SnapshotId, on: boolean): void {
    if (on) this.push(id);
    else this.pop(id);
  }

  list(): SnapshotId[] {
    return [...this.active].sort((a, b) => SNAPSHOTS[b].prio - SNAPSHOTS[a].prio);
  }

  resolve(): MixState {
    return resolveMix(this.active);
  }
}

// ---------------------------------------------------------------- ducking

export interface DuckRule {
  /** dB dip per bus. */
  targets: Partial<Record<BusId, number>>;
  attack: number;
  /** Default hold (s) when the trigger gives none. */
  hold: number;
  release: number;
}

/** Ducking amounts, as data. */
export const DUCKING: Record<DuckKind, DuckRule> = {
  bark: { targets: { music: -8, ambience: -6 }, attack: 0.08, hold: 1.5, release: 0.4 },
  sting: { targets: { music: -3 }, attack: 0.02, hold: 0.25, release: 0.25 },
  boss: { targets: { music: -4, ambience: -4 }, attack: 0.05, hold: 0.6, release: 0.6 },
  knell: { targets: { music: -14, ambience: -8, world: -10 }, attack: 0.1, hold: 3, release: 1.5 },
};

interface ActiveDuck {
  kind: DuckKind;
  start: number;
  until: number;
}

export class Ducker {
  private active: ActiveDuck[] = [];

  trigger(kind: DuckKind, now: number, hold?: number): void {
    const rule = DUCKING[kind];
    const until = now + (hold ?? rule.hold);
    const cur = this.active.find((d) => d.kind === kind && d.until + rule.release > now);
    if (cur) cur.until = Math.max(cur.until, until);
    else this.active.push({ kind, start: now, until });
  }

  /** Current dip (dB, ≤ 0) for a bus: the deepest active duck, shaped by attack and release. */
  level(bus: BusId, now: number): number {
    let db = 0;
    this.active = this.active.filter((d) => now < d.until + DUCKING[d.kind].release);
    for (const d of this.active) {
      const r = DUCKING[d.kind];
      const depth = r.targets[bus];
      if (!depth) continue;
      let k: number;
      if (now < d.start + r.attack) k = (now - d.start) / r.attack;
      else if (now <= d.until) k = 1;
      else k = 1 - (now - d.until) / r.release;
      db = Math.min(db, depth * Math.max(0, Math.min(1, k)));
    }
    return db;
  }

  get count(): number {
    return this.active.length;
  }
}

export const dbToGain = (db: number): number => (db <= MUTE_DB ? 0 : 10 ** (db / 20));
export const volToGain = (v100: number): number => (v100 <= 0 ? 0 : (v100 / 100) ** 2);
