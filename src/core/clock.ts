/**
 * The single source of time for the game (ENG-0056).
 *
 * - `real`  — wall-clock seconds since boot; always advances (UI animation, audio ducking, shader time).
 * - `sim`   — simulation seconds; stops while paused and during hitstop.
 * - `world` — sim time scaled by `worldScale` (the Litany of Stillness slows it to 0.15×).
 *
 * Scenes read these instead of keeping their own `t += dt` counters, and the
 * renderer's `gfx.time` is driven from `real`.
 */
export const HITSTOP_CAP_MS = 120;

export class Clock {
  real = 0;
  sim = 0;
  world = 0;
  /** Fixed ticks run since boot. */
  ticks = 0;
  /** Rendered frames since boot. */
  frames = 0;
  /** Pause stops sim + world time (ENG-0057); real time and UI keep running. */
  paused = false;
  /** World-time multiplier (Litany: 0.15). */
  worldScale = 1;
  /** Disables hitstop (reduce-motion accessibility setting). */
  reduceMotion = false;
  private hitstopLeft = 0;

  /** Advance real time by one rendered frame. */
  frame(dt: number): void {
    this.real += dt;
    this.frames++;
  }

  /**
   * Advance one fixed simulation tick. Returns the world-time delta the tick
   * should apply (0 while paused or in hitstop).
   */
  tick(dt: number): number {
    this.ticks++;
    if (this.paused) return 0;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft = Math.max(0, this.hitstopLeft - dt);
      return 0;
    }
    this.sim += dt;
    const w = dt * this.worldScale;
    this.world += w;
    return w;
  }

  /** Freeze world time briefly on an impact (ENG-0058), capped at 120 ms; no-op under reduce-motion. */
  hitstop(ms: number): void {
    if (this.reduceMotion || ms <= 0) return;
    this.hitstopLeft = Math.max(this.hitstopLeft, Math.min(ms, HITSTOP_CAP_MS) / 1000);
  }

  get inHitstop(): boolean {
    return this.hitstopLeft > 0;
  }
}

/** Hitstop lengths per impact (ENG-0058), in ms: 40–60 on heavy blows, capped by `HITSTOP_CAP_MS`. */
export const HITSTOP_MS = { malison: 60, harm: 50, extract: 40 } as const;
/** A Malison lashes every tick; one hitstop per this many real seconds. */
export const MALISON_HITSTOP_COOLDOWN = 0.6;

/** The subset of the sim's event bus the hitstop needs (src/surgery/events.ts). */
export interface HitstopEvents {
  impact: { kind: 'harm'; amount: number };
  malisonHit: { damage: number };
  extract: unknown;
}
interface HitstopBus<E extends HitstopEvents> {
  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void;
}

/**
 * Wire an operation's events to the clock's hitstop: heavy mistakes (`impact`, ≥5 vitals),
 * Malison lashes (rate-limited, since it emits every tick) and instrument extractions freeze
 * world time for 40–60 ms. Reduced Motion is honoured inside `clock.hitstop`. Returns the
 * unsubscribe for the scene's dispose.
 */
export function bindHitstop<E extends HitstopEvents>(clock: Clock, events: HitstopBus<E>): () => void {
  let lastMalison = -Infinity;
  const offs = [
    events.on('impact', () => clock.hitstop(HITSTOP_MS.harm)),
    events.on('extract', () => clock.hitstop(HITSTOP_MS.extract)),
    events.on('malisonHit', () => {
      if (clock.real - lastMalison < MALISON_HITSTOP_COOLDOWN) return;
      lastMalison = clock.real;
      clock.hitstop(HITSTOP_MS.malison);
    }),
  ];
  return () => offs.forEach((off) => off());
}
