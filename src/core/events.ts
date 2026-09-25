/**
 * A small typed event bus. `EventMap` maps event names to payload types; a
 * listener only ever receives the payload type of the event it subscribed to.
 */
export type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends object> {
  private listeners = new Map<keyof EventMap, Listener<never>[]>();
  private anyListeners: ((type: keyof EventMap, payload: EventMap[keyof EventMap]) => void)[] = [];

  on<K extends keyof EventMap>(type: K, fn: Listener<EventMap[K]>): () => void {
    let list = this.listeners.get(type);
    if (!list) this.listeners.set(type, (list = []));
    list.push(fn as Listener<never>);
    return () => this.off(type, fn);
  }

  off<K extends keyof EventMap>(type: K, fn: Listener<EventMap[K]>): void {
    const list = this.listeners.get(type);
    if (!list) return;
    const i = list.indexOf(fn as Listener<never>);
    if (i >= 0) list.splice(i, 1);
  }

  /** Observe every event (recorders, debug logs). */
  onAny(fn: (type: keyof EventMap, payload: EventMap[keyof EventMap]) => void): () => void {
    this.anyListeners.push(fn);
    return () => {
      const i = this.anyListeners.indexOf(fn);
      if (i >= 0) this.anyListeners.splice(i, 1);
    };
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const list = this.listeners.get(type);
    if (list) for (let i = 0; i < list.length; i++) (list[i] as unknown as Listener<EventMap[K]>)(payload);
    for (let i = 0; i < this.anyListeners.length; i++) this.anyListeners[i](type, payload);
  }

  /** Number of registered listeners (leak tests). */
  get size(): number {
    let n = this.anyListeners.length;
    for (const l of this.listeners.values()) n += l.length;
    return n;
  }

  clear(): void {
    this.listeners.clear();
    this.anyListeners.length = 0;
  }
}
