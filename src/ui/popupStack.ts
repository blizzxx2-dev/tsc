/**
 * Popup de-overlap (UIX-0047): a popup spawned within `NEAR_PX` and `RECENT_S` of another live
 * popup stacks one line above it, so a burst of simultaneous ratings (five shards cast out at once)
 * stays legible instead of printing on top of itself.
 */
export const NEAR_PX = 40;
export const RECENT_S = 0.3;
/** One stacked line: a rating stamp with its label above. */
export const LINE_PX = 44;

export interface Stackable {
  pos: { x: number; y: number };
  /** Seconds since spawned. */
  t: number;
  /** Extra upward offset from stacking (px). */
  lift?: number;
}

/** Lift `p` above every recent, nearby popup it would overlap; returns the lift applied. */
export function stackPopup(live: readonly Stackable[], p: Stackable): number {
  let lift = 0;
  // Keep climbing while the slot is taken: the stack can be several deep.
  for (let guard = 0; guard < 16; guard++) {
    const clash = live.some((o) => o !== p && o.t < RECENT_S && Math.abs(o.pos.x - p.pos.x) < NEAR_PX && Math.abs(o.pos.y - (o.lift ?? 0) - (p.pos.y - lift)) < NEAR_PX);
    if (!clash) break;
    lift += LINE_PX;
  }
  p.lift = lift;
  return lift;
}
