/**
 * Idle throttling (ENG-0229): in menus and paused states, once nothing has happened for a moment,
 * the loop drops to 30 fps to save laptop and Steam Deck battery. Any input restores the full rate
 * on the very next frame. An operation in play, a transition, or a scene that says it is animating
 * (`animating: true`) never throttles.
 */
export const IDLE_FPS = 30;
/** Seconds without input before throttling starts. */
export const IDLE_AFTER_S = 1.5;

export interface IdleState {
  /** Real time now (seconds) and of the last input event. */
  now: number;
  lastInput: number;
  /** The top scene is an operation in play (not paused, not finished). */
  playing: boolean;
  transition: boolean;
  /** The top scene asked for full rate (a scripted animation, a video…). */
  animating: boolean;
}

/** Frame cap to apply this frame: 0 = uncapped/user setting, IDLE_FPS when idle. */
export function idleCap(s: IdleState): number {
  if (s.playing || s.transition || s.animating) return 0;
  return s.now - s.lastInput >= IDLE_AFTER_S ? IDLE_FPS : 0;
}

/** Combine the player's frame cap with the idle cap (the lower non-zero wins). */
export function effectiveCap(userCap: number, idle: number): number {
  if (!idle) return userCap;
  return userCap > 0 ? Math.min(userCap, idle) : idle;
}
