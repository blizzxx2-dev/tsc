/**
 * Client batching (QAT-0097): events queue in memory (persisted as an offline queue), flush every
 * 60 s and on quit, the queue is capped at 1 MB (oldest dropped first) and failed sends back off
 * exponentially. DOM-free: time, storage and the transport are injected.
 */
import type { TelemetryEvent } from './events';

export interface Transport {
  /** Deliver a batch; reject to trigger backoff. */
  send(batch: TelemetryEvent[]): Promise<void>;
}

export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface QueueOptions {
  flushIntervalMs?: number;
  maxBytes?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxBatch?: number;
  now?: () => number;
  storage?: KeyValue;
  storageKey?: string;
}

const byteLength = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdbff ? (i++, 4) : 3;
  }
  return n;
};

export class TelemetryQueue {
  private items: { ev: TelemetryEvent; bytes: number }[] = [];
  private bytes = 0;
  private nextFlushAt: number;
  private backoffUntil = 0;
  private failures = 0;
  private inFlight = false;
  dropped = 0;
  readonly opts: Required<Omit<QueueOptions, 'storage'>> & { storage?: KeyValue };

  constructor(
    private transport: Transport,
    opts: QueueOptions = {},
  ) {
    this.opts = {
      flushIntervalMs: 60_000,
      maxBytes: 1_000_000,
      baseBackoffMs: 2_000,
      maxBackoffMs: 5 * 60_000,
      maxBatch: 500,
      now: () => Date.now(),
      storageKey: 'suture-and-steel.telemetry.queue',
      ...opts,
    };
    this.nextFlushAt = this.opts.now() + this.opts.flushIntervalMs;
    this.restore();
  }

  get size(): number {
    return this.items.length;
  }

  get sizeBytes(): number {
    return this.bytes;
  }

  get failureCount(): number {
    return this.failures;
  }

  push(ev: TelemetryEvent): void {
    const bytes = byteLength(JSON.stringify(ev));
    this.items.push({ ev, bytes });
    this.bytes += bytes;
    while (this.bytes > this.opts.maxBytes && this.items.length) {
      const old = this.items.shift()!;
      this.bytes -= old.bytes;
      this.dropped++;
    }
  }

  /** Call every frame (cheap): flushes when the interval has elapsed and no backoff is pending. */
  tick(): void {
    const now = this.opts.now();
    if (now < this.nextFlushAt || now < this.backoffUntil || this.inFlight) return;
    void this.flush();
  }

  /** Send everything queued (in batches). Resolves true when the queue is empty afterwards. */
  async flush(): Promise<boolean> {
    const now = this.opts.now();
    this.nextFlushAt = now + this.opts.flushIntervalMs;
    if (this.inFlight || !this.items.length || now < this.backoffUntil) return !this.items.length;
    this.inFlight = true;
    try {
      while (this.items.length) {
        const batch = this.items.slice(0, this.opts.maxBatch);
        await this.transport.send(batch.map((b) => b.ev));
        this.items.splice(0, batch.length);
        this.bytes -= batch.reduce((n, b) => n + b.bytes, 0);
      }
      this.failures = 0;
      this.backoffUntil = 0;
      return true;
    } catch {
      this.failures++;
      this.backoffUntil = this.opts.now() + this.backoffDelay();
      return false;
    } finally {
      this.inFlight = false;
      this.persist();
    }
  }

  /** Delay before the next attempt after `failures` consecutive failures: base × 2^(n-1), capped. */
  backoffDelay(failures = this.failures): number {
    return Math.min(this.opts.maxBackoffMs, this.opts.baseBackoffMs * 2 ** Math.max(0, failures - 1));
  }

  /** On quit: try one last flush and keep whatever is left in the offline queue. */
  async flushOnQuit(): Promise<void> {
    this.backoffUntil = 0;
    await this.flush();
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.bytes = 0;
    this.persist();
  }

  snapshot(): TelemetryEvent[] {
    return this.items.map((i) => i.ev);
  }

  private persist(): void {
    const s = this.opts.storage;
    if (!s) return;
    try {
      if (this.items.length) s.set(this.opts.storageKey, JSON.stringify(this.items.map((i) => i.ev)));
      else s.remove(this.opts.storageKey);
    } catch {
      // Storage full or unavailable: the in-memory queue still works for this session.
    }
  }

  private restore(): void {
    const s = this.opts.storage;
    if (!s) return;
    try {
      const raw = s.get(this.opts.storageKey);
      if (!raw) return;
      for (const ev of JSON.parse(raw) as TelemetryEvent[]) this.push(ev);
    } catch {
      s.remove(this.opts.storageKey);
    }
  }
}

/** Local-only transport: appends delivered events to a capped log in storage (no network). */
export class LocalTransport implements Transport {
  constructor(
    private storage: KeyValue,
    private key = 'suture-and-steel.telemetry.log',
    private cap = 5000,
  ) {}

  async send(batch: TelemetryEvent[]): Promise<void> {
    let log = this.read();
    log.push(...batch);
    if (log.length > this.cap) log = log.slice(log.length - this.cap);
    this.storage.set(this.key, JSON.stringify(log));
  }

  read(): TelemetryEvent[] {
    try {
      return JSON.parse(this.storage.get(this.key) ?? '[]') as TelemetryEvent[];
    } catch {
      return [];
    }
  }

  clear(): void {
    this.storage.remove(this.key);
  }
}

/** In-memory KeyValue (tests, or when localStorage is unavailable). */
export class MemoryStore implements KeyValue {
  private m = new Map<string, string>();
  get(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  set(k: string, v: string): void {
    this.m.set(k, v);
  }
  remove(k: string): void {
    this.m.delete(k);
  }
}
