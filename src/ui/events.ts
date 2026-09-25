/**
 * UI event hooks (UIX-0010). Widgets emit semantic events; the audio layer
 * (AUD) maps them to sounds, and analytics or haptics may subscribe too.
 * Menus never call `audio.play` for their own feedback.
 */
import { EventBus } from '../core/events';

export interface UiEvents {
  'ui.hover': { id: string };
  'ui.focus': { id: string };
  'ui.confirm': { id: string };
  'ui.back': { id: string };
  'ui.slider': { id: string; value: number };
  'ui.tab': { id: string; index: number };
  'ui.error': { id: string };
}
export type UiEventName = keyof UiEvents;

export const uiEvents = new EventBus<UiEvents>();

/** Interim cue mapping until AUD ships dedicated UI sounds: confirm/tab/slider click, errors thud. */
export function bindUiSounds(play: (cue: 'select' | 'miss') => void): () => void {
  const offs = [uiEvents.on('ui.confirm', () => play('select')), uiEvents.on('ui.tab', () => play('select')), uiEvents.on('ui.slider', () => play('select')), uiEvents.on('ui.error', () => play('miss'))];
  return () => offs.forEach((f) => f());
}
