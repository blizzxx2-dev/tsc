/**
 * The music state machine: which theme each game state plays and how every
 * state change is carried out (on the bar, on the beat, immediately with a
 * cross-fade, a hard "cut", or continuing the same track). Pure and tested.
 */
import type { HourId } from './themes';

export type MusicState =
  | 'silent'
  | 'title'
  | 'story-calm'
  | 'story-tense'
  | 'story-sorrow'
  | 'briefing'
  | 'op-intro'
  | 'operation'
  | 'boss'
  | 'victory'
  | 'failure'
  | 'results'
  | 'demo-end'
  | 'credits';

export const MUSIC_STATES: readonly MusicState[] = ['silent', 'title', 'story-calm', 'story-tense', 'story-sorrow', 'briefing', 'op-intro', 'operation', 'boss', 'victory', 'failure', 'results', 'demo-end', 'credits'];

/**
 * - `bar`: quantised to the next bar of the playing track (tempo metadata)
 * - `beat`: on the next beat (victory resolves through its stinger)
 * - `urgent`: immediately, 2 s cross-fade
 * - `cut`: bowed-string scrape into silence (failure)
 * - `continue`: same track keeps playing; only layers/sections change
 * - `none`: nothing to do
 */
export type TransitionKind = 'none' | 'bar' | 'beat' | 'urgent' | 'cut' | 'continue';

const STORY: readonly MusicState[] = ['story-calm', 'story-tense', 'story-sorrow'];

export function transition(from: MusicState, to: MusicState): TransitionKind {
  if (from === to) return 'none';
  if (to === 'failure') return from === 'operation' || from === 'boss' || from === 'op-intro' ? 'cut' : 'urgent';
  if (to === 'victory') return from === 'operation' || from === 'boss' ? 'beat' : 'urgent';
  if (from === 'op-intro' && to === 'operation') return 'continue';
  if (from === 'silent') return 'urgent';
  if (to === 'silent') return 'urgent';
  // Scrubbing in and boss reveals are gameplay beats: don't wait for the bar.
  if (to === 'op-intro' || (to === 'boss' && from !== 'op-intro')) return 'urgent';
  if (from === 'op-intro' && to === 'boss') return 'continue';
  if ((from === 'operation' || from === 'boss') && to !== 'operation' && to !== 'boss') return 'urgent';
  if (STORY.includes(from) && STORY.includes(to)) return 'bar';
  return 'bar';
}

export interface MusicContext {
  /** 1-based chapter of the current operation. */
  chapter?: number;
  /** Boss hour when the operation (or the phase) is a Malison. */
  hour?: HourId;
  won?: boolean;
  /** Discipline operations (Trauma Team-style chapters). */
  discipline?: 'triage' | 'diagnosis' | 'forensic' | 'boneset';
  /** Challenge mode plays the faster remixes. */
  challenge?: boolean;
}

/** Theme id for a state, or null for silence. */
export function themeFor(state: MusicState, ctx: MusicContext = {}): string | null {
  switch (state) {
    case 'silent':
    case 'failure':
      return null;
    case 'title':
      return 'title';
    case 'story-calm':
      return 'hospice';
    case 'story-tense':
      return 'tense';
    case 'story-sorrow':
      return 'sorrow';
    case 'briefing':
      return 'briefing';
    case 'op-intro':
    case 'operation': {
      if (ctx.hour) return ctx.hour;
      if (ctx.discipline) return ctx.discipline;
      const ch = ctx.chapter ?? 1;
      const base = ch >= 4 ? 'opD' : ch === 3 ? 'opC' : ch === 2 ? 'opB' : 'opA';
      return ctx.challenge && (base === 'opA' || base === 'opB') ? `${base}Challenge` : base;
    }
    case 'boss':
      return ctx.hour ?? 'matins';
    case 'victory':
      return null;
    case 'results':
      return ctx.won === false ? 'resultsLoss' : 'resultsWin';
    case 'demo-end':
      return 'demoEnd';
    case 'credits':
      return 'credits';
  }
}
