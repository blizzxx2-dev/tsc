/**
 * Display-change confirmation (PLT-0104): a mode/monitor change is applied at once, and reverted
 * after 15 s unless the player confirms it — a mode the monitor cannot show never strands them.
 */
export const DISPLAY_CONFIRM_MS = 15_000;

export interface DisplayConfig {
  mode: 'windowed' | 'borderless' | 'fullscreen';
  monitor: number;
}

export class DisplayChangeGuard {
  private busy = false;
  constructor(
    private apply: (c: DisplayConfig) => Promise<void>,
    /** Resolves true to keep the change, false to revert; must resolve false by itself after the timeout. */
    private ask: (timeoutMs: number) => Promise<boolean>,
  ) {}

  get pending(): boolean {
    return this.busy;
  }

  /** Apply `next`; returns the configuration in force afterwards. */
  async change(prev: DisplayConfig, next: DisplayConfig): Promise<DisplayConfig> {
    if (this.busy || (prev.mode === next.mode && prev.monitor === next.monitor)) return prev;
    this.busy = true;
    try {
      await this.apply(next);
      if (await this.ask(DISPLAY_CONFIRM_MS)) return next;
      await this.apply(prev);
      return prev;
    } finally {
      this.busy = false;
    }
  }
}
