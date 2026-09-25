/**
 * Cosmetic randomness for the simulation (ENG-0252): sparks, motes and smoke puffs the sim emits
 * vary, but must vary the same way on every replay of a log. This stream is separate from `op.rng`
 * so cosmetic draws never shift gameplay draws, and every Operation reseeds it from its own seed.
 */
let s = 0x9e3779b9;

/** Reseed the cosmetic stream (called by each new Operation). */
export function seedFx(seed: number): void {
  s = (seed ^ 0x9e3779b9) >>> 0 || 1;
}

/** A unit-interval cosmetic draw (mulberry32). */
export function fxRandom(): number {
  let t = (s = (s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
