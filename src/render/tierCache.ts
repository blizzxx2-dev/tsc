/**
 * First-launch GPU benchmark result (ENG-0191), cached per renderer outside the settings file:
 * it is measured data, not a player preference.
 */
export interface DetectedTier {
  tier: 'low' | 'medium' | 'high';
  renderer: string;
  benchMs?: number;
}

const KEY = 'suture-and-steel.gpu-tier';

export function loadDetectedTier(): DetectedTier | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DetectedTier) : undefined;
  } catch {
    return undefined;
  }
}

export function storeDetectedTier(t: DetectedTier): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Storage unavailable: re-benchmark next launch.
  }
}
