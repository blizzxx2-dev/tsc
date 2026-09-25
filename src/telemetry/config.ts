/**
 * Consent, install id and the remote kill switch (client side).
 *
 * - Telemetry is opt-in: nothing is recorded until consent is `granted`.
 * - The install id is a random UUID, resettable from Options/the console (new id, queue cleared).
 * - A config document `{ enabled, disabledEvents }` is re-read once per session start; it can turn
 *   all telemetry or single events off without a new build. Until the ingest backend exists
 *   (QAT-0096, a human hand-off) the source is local (a storage override); a URL source is used
 *   only when the build sets VITE_TELEMETRY_CONFIG_URL.
 */
import type { EventName } from './schema';
import { EVENT_NAMES } from './schema';
import { uuid } from './events';
import type { KeyValue } from './queue';

export type Consent = 'granted' | 'denied' | 'unasked';

export interface TelemetryPrefs {
  consent: Consent;
  install: string;
}

export const PREFS_KEY = 'suture-and-steel.telemetry';
export const CONFIG_OVERRIDE_KEY = 'suture-and-steel.telemetry.config';

export function loadPrefs(store: KeyValue): TelemetryPrefs {
  try {
    const p = JSON.parse(store.get(PREFS_KEY) ?? 'null') as Partial<TelemetryPrefs> | null;
    if (p && typeof p.install === 'string' && /^[0-9a-f-]{36}$/.test(p.install)) {
      return { consent: p.consent === 'granted' || p.consent === 'denied' ? p.consent : 'unasked', install: p.install };
    }
  } catch {
    // Corrupt prefs: start again, unasked.
  }
  const fresh: TelemetryPrefs = { consent: 'unasked', install: uuid() };
  savePrefs(store, fresh);
  return fresh;
}

export function savePrefs(store: KeyValue, p: TelemetryPrefs): void {
  try {
    store.set(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: preferences last for this session.
  }
}

export interface RemoteConfig {
  enabled: boolean;
  disabledEvents: EventName[];
}

export const DEFAULT_CONFIG: RemoteConfig = { enabled: true, disabledEvents: [] };

/** Validate an untrusted config document; anything malformed falls back to the default. */
export function parseConfig(raw: unknown): RemoteConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
  const o = raw as Record<string, unknown>;
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : true;
  const disabledEvents = Array.isArray(o.disabledEvents)
    ? (o.disabledEvents.filter((e) => (EVENT_NAMES as readonly unknown[]).includes(e)) as EventName[])
    : [];
  return { enabled, disabledEvents };
}

export type ConfigSource = () => Promise<unknown>;

/** Storage override source (QA can flip the kill switch locally). */
export const storageConfigSource =
  (store: KeyValue): ConfigSource =>
  async () =>
    JSON.parse(store.get(CONFIG_OVERRIDE_KEY) ?? 'null');

/** Read the config once (session start). Network/parse failures keep telemetry on its defaults. */
export async function readConfig(source: ConfigSource): Promise<RemoteConfig> {
  try {
    return parseConfig(await source());
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export const allows = (cfg: RemoteConfig, event: EventName): boolean => cfg.enabled && !cfg.disabledEvents.includes(event);
