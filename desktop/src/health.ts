/**
 * Launch health (PLT-0021, PLT-0126): a launch counts as failed if the previous one never reached
 * "healthy" (20 s of running frames) or a clean quit. After 2 consecutive failed launches — or 2
 * renderer/GPU crashes within 10 minutes — the player is offered safe mode. Pure state transitions;
 * the main process persists the state as JSON in the cache folder.
 */
export interface HealthState {
  /** The last launch has not yet been marked healthy or quit cleanly. */
  pending: boolean;
  consecutiveFailures: number;
  /** Epoch ms of recent renderer crashes. */
  crashes: number[];
}

export const FAILED_LAUNCHES_FOR_SAFE_MODE = 2;
export const CRASHES_FOR_SAFE_MODE = 2;
export const CRASH_WINDOW_MS = 10 * 60 * 1000;
export const HEALTHY_AFTER_MS = 20_000;

export const initialHealth = (): HealthState => ({ pending: false, consecutiveFailures: 0, crashes: [] });

export function parseHealth(text: string | null): HealthState {
  try {
    const o = JSON.parse(text ?? '') as Partial<HealthState>;
    return {
      pending: o.pending === true,
      consecutiveFailures: Number.isInteger(o.consecutiveFailures) ? Math.max(0, o.consecutiveFailures as number) : 0,
      crashes: Array.isArray(o.crashes) ? o.crashes.filter((n) => typeof n === 'number').slice(-10) : [],
    };
  } catch {
    return initialHealth();
  }
}

/** On start: count the previous launch as failed if it never became healthy. */
export function onLaunch(s: HealthState): { state: HealthState; offerSafeMode: boolean } {
  const failures = s.pending ? s.consecutiveFailures + 1 : 0;
  return { state: { ...s, pending: true, consecutiveFailures: failures }, offerSafeMode: failures >= FAILED_LAUNCHES_FOR_SAFE_MODE };
}

export const onHealthy = (s: HealthState): HealthState => ({ ...s, pending: false, consecutiveFailures: 0 });
export const onCleanQuit = (s: HealthState): HealthState => ({ ...s, pending: false });

/** Record a renderer crash; returns whether safe mode should be offered. */
export function onCrash(s: HealthState, now: number): { state: HealthState; offerSafeMode: boolean } {
  const crashes = [...s.crashes.filter((t) => now - t < CRASH_WINDOW_MS), now];
  return { state: { ...s, crashes }, offerSafeMode: crashes.length >= CRASHES_FOR_SAFE_MODE };
}
