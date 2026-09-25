/**
 * Comfort presentation switches that entity drawing reads (UIX-0155/0156). The simulation never
 * consults player settings; the operation scene copies them here once per frame, and only draw
 * code looks at them, so outcomes cannot depend on how the table is shown.
 */
import { hex } from './color';
import type { Gfx } from './gfx';

export const presentation = {
  /** Replace crawling creatures (grubs, egg-sacs, spiderlings) with abstract blotches. */
  creatureFilter: false,
  /** 0 full, 1 reduced (browned blood, no spurts), 2 minimal (flat stains, no spray). */
  gore: 0 as 0 | 1 | 2,
  /** Flash intensity 0..1 (GAM-0239): boss flares, opening flashes and hit flashes scale by it. */
  flash: 1,
  /** Heartbeat 0..1 (1 at the beat), for reactions that twitch with it (ART-0299). */
  pulse: 0,
  /** Grubs that just felt a Lancet near-miss → the op time it happened (ART-0299). */
  flinch: new WeakMap<object, number>(),
};

/** The flash multiplier from the player's settings: the slider, capped at 35 % by Reduce flashing. */
export const flashScale = (s: { flashIntensity: number; reduceFlashing: boolean }): number => (s.reduceFlashing ? Math.min(0.35, s.flashIntensity) : s.flashIntensity);

/** Embedded shafts twitch with the heartbeat in 3 frames (rest, lift, kick): the angle offset in radians. */
export const shaftTwitch = (pulse: number): number => [0, 0.018, 0.04][pulse > 0.66 ? 2 : pulse > 0.33 ? 1 : 0];

/** A flinch curl 0..1 over 0.35 s (fast in, eased out). */
export const flinchCurl = (age: number): number => (age < 0 || age > 0.35 ? 0 : age < 0.06 ? age / 0.06 : 1 - (age - 0.06) / 0.29);

export const GORE_LEVEL = { full: 0, reduced: 1, minimal: 2 } as const;

/** The abstract stand-in for a filtered creature: a soft, still blot with a ring that marks it as a target. */
export function drawBlotch(g: Gfx, x: number, y: number, r: number, tint = '#6a5a48'): void {
  g.circleGrad(x, y, r, hex(tint, 0.9), hex(tint, 0.15));
  g.arc(x, y, r + 3, 2, hex('#e8dcc0', 0.55), 1);
}

/** Blood particle budget for the gore level (0 = none). */
export const bloodScale = (gore: 0 | 1 | 2): number => (gore === 0 ? 1 : gore === 1 ? 0.35 : 0);
