/**
 * Support bundles (PLT-0093, PLT-0131): what the F8 bug-report key and the Options "Export support
 * files" button collect — the in-memory log, settings, the active profile, build info and the last
 * input recording — and how they leave the machine: on desktop the main process adds the save
 * folder, the log files and a screenshot, zips everything into the support folder and reveals it;
 * on the web the same files are zipped here and offered as a download.
 *
 * The input recording is a rolling buffer of the last `INPUT_BUFFER_S` seconds of the current
 * operation, kept only while the `supportInputBuffer` setting is on (it holds every pointer sample,
 * so it is opt-in). When an operation ends its buffer becomes "the last recording" until the next
 * one starts, so a report filed from the results screen still carries the stroke that went wrong.
 * Replays are the same JSON `?replay=` and the regression tests consume (src/input/record.ts).
 */
import { activeSave } from '../core/save';
import { settings } from '../core/settings';
import type { InputPrefs } from '../input/bindings';
import { RECORDING_FORMAT, RECORDING_VERSION, type Recording } from '../input/record';
import type { InputFrame } from '../input/types';
import { BUILD } from './build';
import { log } from './log';
import { platform } from './index';
import { zip } from './zip';
import { replayForReport } from './lastReplay';

/** Length of the rolling input buffer. */
export const INPUT_BUFFER_S = 30;

type FrameSink = ((f: InputFrame) => void) | null;

/** The slice of `Input` the buffer hooks (tests pass a fake). */
export interface RecordableInput {
  recorder: FrameSink;
}

/**
 * Rolling input recorder: frames older than `windowS` seconds (by frame time) are dropped as new
 * ones arrive, so memory stays bounded however long an operation runs.
 */
export class RollingRecorder {
  private rec: Recording | null = null;
  /** The last operation's buffer, kept until the next operation starts. */
  last: Recording | null = null;

  constructor(readonly windowS = INPUT_BUFFER_S) {}

  get recording(): boolean {
    return this.rec !== null;
  }

  begin(opId: string, seed: number, timerAssist: number, prefs: InputPrefs): void {
    this.rec = { format: RECORDING_FORMAT, version: RECORDING_VERSION, opId, seed, timerAssist, prefs: JSON.parse(JSON.stringify(prefs)) as InputPrefs, frames: [] };
    this.last = null;
  }

  push(frame: InputFrame): void {
    const r = this.rec;
    if (!r) return;
    r.frames.push(JSON.parse(JSON.stringify(frame)) as InputFrame);
    const cutoff = frame.t - this.windowS * 1000;
    let drop = 0;
    while (drop < r.frames.length - 1 && r.frames[drop].t < cutoff) drop++;
    if (drop) r.frames.splice(0, drop);
  }

  /** Close the current buffer (operation over); it stays available as `last`. */
  finish(result?: Recording['result']): Recording | null {
    const r = this.rec;
    this.rec = null;
    if (r && result) r.result = result;
    if (r) this.last = r;
    return r;
  }

  /** The recording to attach to a report now: the live buffer, else the last finished one. */
  snapshot(): Recording | null {
    const r = this.rec ?? this.last;
    return r ? (JSON.parse(JSON.stringify(r)) as Recording) : null;
  }

  clear(): void {
    this.rec = null;
    this.last = null;
  }
}

/**
 * Keeps `input.recorder` chained through the rolling recorder while the setting is on. Another
 * recorder installed later (`?record=1`) is chained too, and removed again when the setting turns
 * off, so neither replaces the other.
 */
export class InputBufferHook {
  private chained: FrameSink = null;
  private previous: FrameSink = null;

  constructor(
    private input: RecordableInput,
    readonly ring: RollingRecorder,
  ) {}

  /** Call every frame with the setting's current value. */
  sync(on: boolean): void {
    if (on) {
      if (this.input.recorder === this.chained && this.chained) return;
      const prev = this.input.recorder;
      this.previous = prev;
      this.chained = (f) => {
        prev?.(f);
        this.ring.push(f);
      };
      this.input.recorder = this.chained;
    } else if (this.chained) {
      if (this.input.recorder === this.chained) this.input.recorder = this.previous;
      this.chained = null;
      this.previous = null;
      this.ring.clear();
    }
  }
}

/** The rolling recorder behind F8 and the Options button (installed by session.ts). */
export const inputBuffer = new RollingRecorder();

/** Files the renderer contributes to a support bundle (names are safe: letters, dots, dashes). */
export function collectSupportFiles(): Record<string, string> {
  const files: Record<string, string> = {
    'log.txt': log.lines().join('\n'),
    'settings.json': JSON.stringify(settings, null, 2),
    'profile.json': JSON.stringify(activeSave(), null, 2),
    'build.txt': [BUILD.id, `${platform.kind}/${platform.os}`, typeof navigator !== 'undefined' ? navigator.userAgent : 'node'].join('\n'),
  };
  const rec = inputBuffer.snapshot();
  if (rec) files['input-recording.json'] = JSON.stringify(rec);
  // The running or last operation's full replay (ENG-0256), base64 of the binary .ssrp file.
  const rp = replayForReport();
  if (rp) files[`replay-${rp.opId.replace(/[^a-z0-9-]/gi, '_')}.ssrp.b64`] = rp.base64;
  return files;
}

/** Offer bytes as a browser download. */
function download(name: string, data: Uint8Array): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/**
 * Export a support bundle. Resolves to the bundle's name (desktop: a file in the support folder,
 * which is revealed; web: the download's file name) or null when nothing could be written.
 */
export async function exportSupportBundle(): Promise<string | null> {
  const files = collectSupportFiles();
  if (platform.kind === 'desktop') return platform.exportSupport(files);
  const name = `support-${stamp()}.zip`;
  try {
    return download(name, zip(Object.fromEntries(Object.entries(files).map(([n, t]) => [`report/${n}`, t])), new Date())) ? name : null;
  } catch (e) {
    log.warn('support', 'bundle download failed', e);
    return null;
  }
}
