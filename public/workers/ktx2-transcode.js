/* KTX2 → GPU-format transcode worker (src/render/ktx2.ts). A classic worker so the Basis
 * transcoder loads with importScripts from its own same-origin file: no eval, so it runs under the
 * desktop build's strict CSP ('wasm-unsafe-eval' only). One job = one image; every mip level comes
 * back as its own transferred buffer, ready for compressedTexImage2D.
 *
 *   → { id, data: ArrayBuffer, tf, fallbackTf, block }
 *   ← { id, ok: true, width, height, tf, levels: ArrayBuffer[] } | { id, ok: false, error }
 */
/* global BASIS, self */
'use strict';

const ready = (async () => {
  self.importScripts('../vendor/basis/basis_transcoder.js');
  const wasm = await fetch('../vendor/basis/basis_transcoder.wasm').then((r) => {
    if (!r.ok) throw new Error(`basis_transcoder.wasm: HTTP ${r.status}`);
    return r.arrayBuffer();
  });
  const mod = await BASIS({ wasmBinary: wasm });
  mod.initializeBasis();
  return mod;
})();

function transcode(mod, msg) {
  const file = new mod.KTX2File(new Uint8Array(msg.data));
  try {
    if (!file.isValid() || !file.startTranscoding()) throw new Error('invalid KTX2');
    const width = file.getWidth();
    const height = file.getHeight();
    // Block formats need multiple-of-block base sizes in WebGL; odd sizes use the fallback.
    const blocked = msg.block > 1 && (width % msg.block || height % msg.block);
    const tf = blocked ? msg.fallbackTf : msg.tf;
    const block = blocked ? 1 : msg.block;
    const levels = [];
    const count = Math.max(1, file.getLevels());
    for (let level = 0; level < count; level++) {
      // Compressed mips smaller than a block are skipped; the chain stops at the last full block.
      if (block > 1 && (Math.max(1, width >> level) < block || Math.max(1, height >> level) < block)) break;
      const dst = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, tf));
      if (!file.transcodeImage(dst, level, 0, 0, tf, 0, -1, -1)) break;
      levels.push(dst.buffer);
    }
    if (!levels.length) throw new Error('transcode failed');
    return { width, height, tf, levels };
  } finally {
    file.close();
    file.delete();
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    const out = transcode(await ready, msg);
    self.postMessage({ id: msg.id, ok: true, ...out }, out.levels);
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
  }
};
