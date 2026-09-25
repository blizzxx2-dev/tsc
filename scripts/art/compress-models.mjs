// GPU texture compression for the Blender pipeline's models (KHR_texture_basisu).
//   node scripts/art/compress-models.mjs [name…]
// Reads the raw exports in art-src/.cache/models/*.glb and writes assets/models/*.glb with every
// texture re-encoded as KTX2 UASTC at full source resolution (quality level 3, full mip chain,
// lossless zstd supercompression, no RDO): visually near-lossless, and 4× less VRAM than RGBA8
// once transcoded to BC7/ASTC. Colour maps are encoded perceptually (sRGB), normal maps with the
// normal-map preset. Encodes run on a worker per core and are cached by content hash in
// art-src/.cache/ktx2, so shared maps (the instruments' wood) encode once.
// ktx2-encoder is pinned to 0.4.x: later releases cap sources at 12 Mpix, below one 4K map.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, join } from 'node:path';
import { Worker } from 'node:worker_threads';

const SRC = 'art-src/.cache/models';
const CACHE = 'art-src/.cache/ktx2';
const OUT = 'assets/models';
const only = process.argv.slice(2);
const SETTINGS = 'uastc3-mips-zstd-nordo-v1';

function slotsOf(doc) {
  const slots = new Map();
  const add = (tex, slot) => tex && slots.set(tex, new Set([...(slots.get(tex) ?? []), slot]));
  for (const m of doc.getRoot().listMaterials()) {
    add(m.getBaseColorTexture(), 'color');
    add(m.getEmissiveTexture(), 'color');
    add(m.getNormalTexture(), 'normal');
    add(m.getMetallicRoughnessTexture(), 'data');
    add(m.getOcclusionTexture(), 'data');
  }
  return slots;
}

// ---- worker pool
const size = Math.max(1, Math.min(availableParallelism(), 4));
const workers = Array.from({ length: size }, () => new Worker(new URL('./ktx2-worker.mjs', import.meta.url)));
const idle = [...workers];
const queue = [];
const pending = new Map();
let seq = 0;
for (const w of workers)
  w.on('message', (msg) => {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    idle.push(w);
    pump();
    if (msg.error) p.reject(new Error(msg.error));
    else p.resolve(new Uint8Array(msg.ktx));
  });
function pump() {
  while (idle.length && queue.length) {
    const job = queue.shift();
    const w = idle.pop();
    pending.set(job.id, job);
    w.postMessage({ id: job.id, image: job.image, color: job.color, normal: job.normal });
  }
}
const encode = (image, color, normal) =>
  new Promise((resolve, reject) => {
    queue.push({ id: seq++, image, color, normal, resolve, reject });
    pump();
  });

// ---- per texture, cached by content + settings
mkdirSync(CACHE, { recursive: true });
const inflight = new Map();
function compressed(image, color, normal) {
  const key = createHash('sha256').update(image).update(`${SETTINGS}|${color}|${normal}`).digest('hex').slice(0, 24);
  const path = join(CACHE, `${key}.ktx2`);
  if (existsSync(path)) return Promise.resolve(new Uint8Array(readFileSync(path)));
  if (!inflight.has(key))
    inflight.set(
      key,
      encode(image, color, normal).then((ktx) => {
        writeFileSync(path, ktx);
        process.stdout.write('.');
        return ktx;
      }),
    );
  return inflight.get(key);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith('.glb') && (!only.length || only.includes(basename(f, '.glb'))));
const t0 = Date.now();
await Promise.all(
  files.map(async (f) => {
    const src = join(SRC, f);
    const dst = join(OUT, f);
    if (existsSync(dst) && statSync(dst).mtimeMs > statSync(src).mtimeMs) return console.log(`= ${f} (up to date)`);
    const doc = await io.read(src);
    const slots = slotsOf(doc);
    const texs = doc
      .getRoot()
      .listTextures()
      .filter((t) => t.getMimeType() !== 'image/ktx2');
    await Promise.all(
      texs.map(async (tex) => {
        const kind = slots.get(tex) ?? new Set(['data']);
        tex.setImage(await compressed(tex.getImage(), kind.has('color'), kind.has('normal'))).setMimeType('image/ktx2');
      }),
    );
    if (texs.length) doc.createExtension(KHRTextureBasisu).setRequired(true);
    await io.write(dst, doc);
    console.log(`\n✔ ${f}: ${texs.length} textures → KTX2 (${(statSync(dst).size / 2 ** 20).toFixed(1)} MB)`);
  }),
);
console.log(`compress-models: ${files.length} model(s) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
for (const w of workers) await w.terminate();
