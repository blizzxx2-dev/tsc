/**
 * ZIP writer for support bundles (PLT-0093, PLT-0131): the shared pure-`Uint8Array` writer in
 * `src/platform/zip.ts` (also used by the browser build's download), returned as a `Buffer` for `fs`.
 */
import { crc32, zip as zipBytes } from '../../src/platform/zip';

export { crc32 };

export function zip(files: Record<string, Uint8Array | string>, date?: Date): Buffer {
  return Buffer.from(zipBytes(files, date));
}
