/** One caught failure, kept for bug reports and the crash log. */
export interface CrashRecord {
  phase: 'update' | 'render';
  scene: string;
  frame: number;
  tick: number;
  message: string;
  stack?: string;
  time: string;
}

/**
 * Error boundary around scene update/render (ENG-0069). A throw is caught,
 * logged with scene + frame context and handed to `onCrash` (which routes to
 * the "ink has run" screen) instead of escaping and killing the rAF loop.
 * If the crash handler's own scene keeps failing, `fatal` fires once so the
 * shell can show a DOM message and stop.
 */
export class ErrorBoundary {
  readonly crashes: CrashRecord[] = [];
  private streak = 0;
  private fatalFired = false;

  constructor(
    private onCrash: (rec: CrashRecord) => void,
    private onFatal: (rec: CrashRecord) => void = () => undefined,
    private log: (msg: string, err: unknown) => void = (m, e) => console.error(m, e),
  ) {}

  /** Run `fn`; returns false if it threw (and the crash was handled). */
  run(phase: CrashRecord['phase'], scene: string, frame: number, tick: number, fn: () => void): boolean {
    try {
      fn();
      if (phase === 'render') this.streak = 0;
      return true;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const rec: CrashRecord = { phase, scene, frame, tick, message: e.message, stack: e.stack, time: new Date().toISOString() };
      this.crashes.push(rec);
      if (this.crashes.length > 20) this.crashes.shift();
      this.log(`[boundary] ${phase} failed in ${scene} at frame ${frame} (tick ${tick}): ${e.message}`, e);
      // Three failures without one clean render in between: the error screen itself is failing.
      if (++this.streak >= 3) {
        if (!this.fatalFired) {
          this.fatalFired = true;
          this.onFatal(rec);
        }
        return false;
      }
      try {
        this.onCrash(rec);
      } catch (e2) {
        this.log('[boundary] crash handler failed', e2);
      }
      return false;
    }
  }

  get halted(): boolean {
    return this.fatalFired;
  }
}
