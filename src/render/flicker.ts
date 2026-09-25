/**
 * Candle flicker on the light rig (ENG-0156). The side candles of the operating theatre breathe by at
 * most 3 % of their intensity, and the grade pass adds a global flicker of 1.6 %, so the field's
 * luminance never moves by more than 3 % (the side candles carry under two fifths of the light).
 * `pref` is the player's flicker multiplier (`displayPrefs.flicker`), 0 under Reduced Flashing or
 * Reduced Motion, which stills both.
 */
export const RIG_FLICKER = 0.03;
/** Global luminance flicker applied in the post pass (POST_FS `u_flicker` scale). */
export const POST_FLICKER = 0.016;

/** Intensity multiplier for a candle light at time `t`; `phase` decorrelates candles. */
export function candleFlicker(t: number, phase: number, pref: number): number {
  const k = Math.max(0, Math.min(1, pref));
  return 1 + RIG_FLICKER * k * Math.sin(t * 9.3 + phase) * Math.sin(t * 4.1 + phase * 0.7);
}
