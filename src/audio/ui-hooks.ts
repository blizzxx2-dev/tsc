/**
 * Interface sounds for immediate-mode widgets. `button()` reports hover and
 * clicks here; a hover sound plays once when the pointer moves onto a new
 * button, and clicks play a wax-seal confirm or a page-turn "back".
 */
import type { AudioSystem } from './system';

let sys: AudioSystem | null = null;
let hoveredNow: string | null = null;
let hoveredLast: string | null = null;

export function bindUiAudio(s: AudioSystem): void {
  sys = s;
}

const BACK = /^(back|leave|no|resume|abandon.*|quit|cancel|close)$/i;

/** Called by `button()` every frame it is drawn. */
export function uiButton(label: string, hover: boolean, clicked: boolean): void {
  if (!sys) return;
  if (hover) {
    if (label !== hoveredLast && hoveredNow === null) sys.play('ui.hover');
    hoveredNow = label;
  }
  if (clicked) sys.play(BACK.test(label.trim()) ? 'ui.back' : 'ui.confirm');
}

/** Frame boundary (called by the scene director). */
export function uiFrame(): void {
  hoveredLast = hoveredNow;
  hoveredNow = null;
}

/** For option rows and other custom widgets. */
export function uiSound(kind: 'hover' | 'confirm' | 'back' | 'tab' | 'slider' | 'toggle' | 'error' | 'save'): void {
  sys?.play(`ui.${kind}`);
}
