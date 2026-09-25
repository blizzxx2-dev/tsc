import type { TuningOverride } from './tuning';

/** Difficulty is chosen per save; Master unlocks after clearing Chapter II. */
export type Difficulty = 'novice' | 'surgeon' | 'master';

export interface DifficultySpec {
  id: Difficulty;
  name: string;
  /** Multiplier on every source of vitals drain. */
  drain: number;
  /** Multiplier on the time limit. */
  time: number;
  /** Dotted guide lines, numbered sigil nodes and pull-axis hints. */
  guides: boolean;
  blurb: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  novice: { id: 'novice', name: 'Novice', drain: 0.6, time: 1.4, guides: true, blurb: 'Wounds drain slowly and the clock is generous. Guides always shown.' },
  surgeon: { id: 'surgeon', name: 'Surgeon', drain: 1, time: 1, guides: true, blurb: 'The hospice as Master Haller runs it.' },
  master: { id: 'master', name: 'Master', drain: 1.35, time: 0.85, guides: false, blurb: 'Faster bleeding, less time, no guides. For those who finished Chapter II.' },
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['novice', 'surgeon', 'master'];

/**
 * Assists are independent of difficulty; each one used is flagged on results
 * (and disqualifies XS and leaderboards).
 */
export interface Assists {
  /** +6 px on every grab / hit radius. */
  bigHitboxes: boolean;
  /** Force guide lines on even on Master. */
  guides: boolean;
  /** Hidden things surface on their own after a few seconds. */
  autoLens: boolean;
  /** Boss tells play out 1.25× slower. */
  slowTells: boolean;
  /** Vitals never fall below 1. */
  noFail: boolean;
  /** Tool-hover suggestions: the needed instrument pulses. */
  suggest: boolean;
  /** Held tools become click-to-start / click-to-stop. */
  holdToggle: boolean;
  /** Stitches by click, encircle by 1 s hold, star by hold key. */
  simpleGestures: boolean;
  /** Game speed 0.7–1 (1 = off). */
  gameSpeed: number;
}

export const NO_ASSISTS: Assists = {
  bigHitboxes: false,
  guides: false,
  autoLens: false,
  slowTells: false,
  noFail: false,
  suggest: false,
  holdToggle: false,
  simpleGestures: false,
  gameSpeed: 1,
};

export const AUTO_LENS_AFTER = 4;
export const SLOW_TELLS = 1.25;

/** Which assists that change the challenge are on (for the results flag). Comfort options are excluded. */
export function assistFlags(a: Assists): string[] {
  const out: string[] = [];
  if (a.bigHitboxes) out.push('larger targets');
  if (a.guides) out.push('guides');
  if (a.autoLens) out.push('auto-lens');
  if (a.slowTells) out.push('slow tells');
  if (a.noFail) out.push('no-fail');
  if (a.gameSpeed < 1) out.push(`speed ${Math.round(a.gameSpeed * 100)}%`);
  if (a.simpleGestures) out.push('simple gestures');
  return out;
}

/** Modifiers applied on top of difficulty — used by challenge (X-op) rules and mutators. */
export interface Modifiers {
  drain: number;
  time: number;
  /** Boss HP multiplier. */
  hp: number;
  /** Boss tells / timers speed multiplier (> 1 = faster). */
  tellSpeed: number;
  /** Add-spawn cadence multiplier (> 1 = more often). */
  addCadence: number;
  /** Extra tuning overrides (e.g. mutators changing lens radius). */
  tuning?: TuningOverride;
}

export const NO_MODS: Modifiers = { drain: 1, time: 1, hp: 1, tellSpeed: 1, addCadence: 1 };

export function combineMods(a: Modifiers, b: Partial<Modifiers>): Modifiers {
  return {
    drain: a.drain * (b.drain ?? 1),
    time: a.time * (b.time ?? 1),
    hp: a.hp * (b.hp ?? 1),
    tellSpeed: a.tellSpeed * (b.tellSpeed ?? 1),
    addCadence: a.addCadence * (b.addCadence ?? 1),
    tuning: { ...(a.tuning ?? {}), ...(b.tuning ?? {}) },
  };
}
