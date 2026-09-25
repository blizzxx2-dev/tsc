/**
 * Game → platform event hub. Scenes/flow emit gameplay milestones; achievements, rich presence and
 * (later) telemetry and Timeline markers subscribe. Keeps platform services out of the scene code.
 */
import type { GameEvent } from './achievements';

export type { GameEvent } from './achievements';

type Handler = (e: GameEvent) => void;
const handlers = new Set<Handler>();

export function onGameEvent(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}

export function emitGameEvent(e: GameEvent): void {
  for (const h of handlers) {
    try {
      h(e);
    } catch {
      // A platform subscriber must never break gameplay.
    }
  }
}
