/**
 * The replay that bug reports carry (ENG-0256): while an operation runs, a source that encodes its
 * input log on demand; once it ends, the packed replay of that run. Crash reports and the F8 /
 * Options support bundle attach whichever is current, so a report arrives with the exact inputs
 * that led to it (`?replay=` / the replay tests re-simulate them).
 */
import { encodeReplay, packReplay, type ReplayHeader } from '../core/replayCodec';
import type { InputLog } from '../surgery/replay';

/** Larger replays are left out of crash events (Sentry's event size limit). */
export const MAX_REPORT_REPLAY_BYTES = 160 * 1024;

let live: (() => { log: InputLog; header: Omit<ReplayHeader, 'version'> } | null) | null = null;
let last: { opId: string; bytes: Uint8Array } | null = null;

/** The running operation's log source (null when it ends or the scene is disposed). */
export function setLiveReplay(src: typeof live): void {
  live = src;
}

/** Pack and keep a finished operation's replay as "the last replay". */
export async function rememberReplay(log: InputLog, header: Omit<ReplayHeader, 'version'>): Promise<void> {
  last = { opId: log.opId, bytes: await packReplay(log, header) };
}

/** Bytes to attach now: the live operation (plain encoding, synchronous) or the last packed one. */
export function currentReplay(): { opId: string; bytes: Uint8Array } | null {
  const l = live?.();
  if (l) return { opId: l.log.opId, bytes: encodeReplay(l.log, l.header) };
  return last;
}

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Base64 replay for a report, or undefined when there is none or it is too large. */
export function replayForReport(): { opId: string; base64: string } | undefined {
  const r = currentReplay();
  if (!r || r.bytes.length > MAX_REPORT_REPLAY_BYTES) return undefined;
  return { opId: r.opId, base64: toBase64(r.bytes) };
}

/** Test hook. */
export function resetReplays(): void {
  live = null;
  last = null;
}
