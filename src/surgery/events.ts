import type { Vec } from '../core/math';
import type { Cue } from '../core/audio';
import type { Rating, ToolId } from './types';

/**
 * Everything the simulation tells the presentation layer, in order. Scenes,
 * audio, telemetry and achievements read `op.events` instead of poking at
 * entity internals. (`op.cues` remains as the audio shorthand: every cue is
 * also published here as a `cue` event.)
 */
export type SimEvent =
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

export type SimEventKind = SimEvent['kind'];
