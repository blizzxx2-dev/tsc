/**
 * The one hook main.ts calls. In dev (`vite`) and QA builds (`vite build --mode qa`) it loads the
 * debug API, console and cheat menu; in production builds `import.meta.env` folds the condition to
 * false and the dynamic import — with all of src/debug — is dropped from the bundle.
 */
import type { DebugGame } from './api';

export interface QaHookOptions {
  /** Telemetry controls to expose in the console, when telemetry is installed. */
  telemetry?: { setEnabled(on: boolean): void; enabled(): boolean; dump(): unknown[] };
}

export function installQaHooks(game: unknown, opts: QaHookOptions = {}): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'qa') {
    void import('./index').then((m) => m.installDebug(game as DebugGame, opts));
  }
}
