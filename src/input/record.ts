import type { FrameSource } from '../core/input';
import type { InputFrame } from './types';
import type { InputPrefs } from './bindings';

/**
 * Input recording: the exact `InputFrame` stream an operation consumed, plus what
 * is needed to re-drive it deterministically (operation id, seed, assists and input
 * options). `?record=1` saves one per operation; `?replay=<url>` plays one back; the
 * same files drive regression tests headlessly and can be attached to bug reports.
 */
export const RECORDING_FORMAT = 'suture-and-steel/input-recording';
export const RECORDING_VERSION = 1;

export interface Recording {
  format: typeof RECORDING_FORMAT;
  version: typeof RECORDING_VERSION;
  opId: string;
  seed: number;
  /** Settings that change the simulation (time assist) and every input option. */
  timerAssist: number;
  prefs: InputPrefs;
  bindings?: unknown;
  frames: InputFrame[];
  /** Outcome observed while recording, so a replay can be checked against it. */
  result?: { status: string; score: number; vitals: number; timeLeft: number };
}

export class Recorder {
  rec: Recording | null = null;

  begin(opId: string, seed: number, timerAssist: number, prefs: InputPrefs): void {
    this.rec = { format: RECORDING_FORMAT, version: RECORDING_VERSION, opId, seed, timerAssist, prefs: JSON.parse(JSON.stringify(prefs)) as InputPrefs, frames: [] };
  }

  push(frame: InputFrame): void {
    // Deep copy: the frame's arrays are reused by nobody, but events are mutable objects.
    this.rec?.frames.push(JSON.parse(JSON.stringify(frame)) as InputFrame);
  }

  finish(result?: Recording['result']): Recording | null {
    const r = this.rec;
    this.rec = null;
    if (r && result) r.result = result;
    return r;
  }
}

export function parseRecording(json: string): Recording {
  const r = JSON.parse(json) as Recording;
  if (r.format !== RECORDING_FORMAT) throw new Error('Not an input recording');
  if (r.version !== RECORDING_VERSION) throw new Error(`Unsupported recording version ${r.version}`);
  return r;
}

/** Feeds recorded frames back to `Input` one per tick. */
export class Replayer implements FrameSource {
  private i = 0;
  constructor(private rec: Recording) {}
  next(): InputFrame | null {
    const f = this.rec.frames[this.i++];
    return f ? (JSON.parse(JSON.stringify(f)) as InputFrame) : null;
  }
  get done(): boolean {
    return this.i >= this.rec.frames.length;
  }
}

/** Offer a recording as a download (browser only). */
export function downloadRecording(rec: Recording): void {
  const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `input-${rec.opId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
