/**
 * KTX2 (Basis UASTC) textures: transcoded to the best GPU format the device supports — BC7 on
 * desktop, ASTC 4×4 or ETC2 on mobile/Steam Deck-class GPUs — and uploaded with their full mip
 * chain. Only when none is available does it fall back to uncompressed RGBA8.
 *
 * Transcoding is the slow part (a 4K UASTC map is tens of milliseconds), so it runs on a small pool
 * of workers (public/workers/ktx2-transcode.js) and only the upload happens on the main thread;
 * loading a set no longer stalls the frame. The worker loads the Basis Universal transcoder
 * (public/vendor/basis, from three.js) with importScripts, which needs no eval and so runs under the
 * desktop build's CSP. If workers cannot start, the transcoder runs in-thread instead.
 */
import type { GlRegistry } from './registry';

// basist::transcoder_texture_format
const TF = { ETC2_RGBA: 1, BC3_RGBA: 3, BC7_RGBA: 6, ASTC_4x4_RGBA: 10, RGBA32: 13 } as const;

interface Target {
  tf: number;
  gl: number | null; // null = uncompressed RGBA8
  block: number;
}

const RGBA: Target = { tf: TF.RGBA32, gl: null, block: 1 };

function pickTarget(gl: WebGL2RenderingContext): Target {
  const bptc = gl.getExtension('EXT_texture_compression_bptc');
  if (bptc) return { tf: TF.BC7_RGBA, gl: bptc.COMPRESSED_RGBA_BPTC_UNORM_EXT, block: 4 };
  const astc = gl.getExtension('WEBGL_compressed_texture_astc');
  if (astc) return { tf: TF.ASTC_4x4_RGBA, gl: astc.COMPRESSED_RGBA_ASTC_4x4_KHR, block: 4 };
  const etc = gl.getExtension('WEBGL_compressed_texture_etc');
  if (etc) return { tf: TF.ETC2_RGBA, gl: etc.COMPRESSED_RGBA8_ETC2_EAC, block: 4 };
  return RGBA;
}

/** A transcoded image: one buffer per mip level in `tf`. */
export interface Transcoded {
  width: number;
  height: number;
  tf: number;
  levels: ArrayBuffer[];
}

// ---- worker pool

interface Job {
  id: number;
  msg: { id: number; data: ArrayBuffer; tf: number; fallbackTf: number; block: number };
  resolve: (t: Transcoded) => void;
  reject: (e: Error) => void;
}

class TranscodePool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private running = new Map<number, Job>();
  private seq = 0;
  /** Set once a worker fails to start: every later job goes in-thread. */
  broken = false;

  constructor(url: string, size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(url);
      w.onmessage = (e: MessageEvent) => this.done(w, e.data);
      w.onerror = (e) => {
        e.preventDefault();
        this.fail(w, new Error(e.message || 'ktx2 worker failed to start'));
      };
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run(data: Uint8Array, target: Target): Promise<Transcoded> {
    // The worker takes ownership of a private copy: the model's GLB buffer stays intact.
    const buf = data.slice().buffer;
    return new Promise((resolve, reject) => {
      const id = this.seq++;
      this.queue.push({ id, msg: { id, data: buf, tf: target.tf, fallbackTf: RGBA.tf, block: target.block }, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const job = this.queue.shift()!;
      const w = this.idle.pop()!;
      this.running.set(job.id, job);
      (w as Worker & { job?: number }).job = job.id;
      w.postMessage(job.msg, [job.msg.data]);
    }
  }

  private done(w: Worker, m: { id: number; ok: boolean; error?: string } & Transcoded): void {
    const job = this.running.get(m.id);
    this.running.delete(m.id);
    this.idle.push(w);
    this.pump();
    if (!job) return;
    if (m.ok) job.resolve({ width: m.width, height: m.height, tf: m.tf, levels: m.levels });
    else job.reject(new Error(m.error));
  }

  /** A worker died (script or wasm failed to load): drop the pool and fail everything outstanding. */
  private fail(w: Worker, err: Error): void {
    if (this.broken) return;
    this.broken = true;
    console.warn('[ktx2] transcode workers unavailable, transcoding in-thread:', err.message, w);
    for (const x of this.workers) x.terminate();
    const pending = [...this.running.values(), ...this.queue];
    this.running.clear();
    this.queue = [];
    for (const j of pending) j.reject(err);
  }
}

let pool: TranscodePool | null = null;

function getPool(): TranscodePool | null {
  if (pool) return pool.broken ? null : pool;
  if (typeof Worker === 'undefined') return null;
  try {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    pool = new TranscodePool(`${import.meta.env.BASE_URL}workers/ktx2-transcode.js`, Math.max(1, Math.min(cores - 1, 3)));
  } catch (e) {
    console.warn('[ktx2] cannot start transcode workers:', e);
    return null;
  }
  return pool;
}

// ---- in-thread fallback

/* eslint-disable @typescript-eslint/no-explicit-any */
let basis: Promise<any> | null = null;

/** Load and initialise the transcoder in this thread (a classic script defining the global `BASIS`). */
function loadBasis(): Promise<any> {
  basis ??= (async () => {
    const base = `${import.meta.env.BASE_URL}vendor/basis/`;
    const [js, wasm] = await Promise.all([fetch(`${base}basis_transcoder.js`).then((r) => r.text()), fetch(`${base}basis_transcoder.wasm`).then((r) => r.arrayBuffer())]);
    const factory = new Function(`${js}\nreturn BASIS;`)();
    const mod = await factory({ wasmBinary: wasm });
    mod.initializeBasis();
    return mod;
  })();
  return basis;
}

async function transcodeHere(data: Uint8Array, target: Target): Promise<Transcoded> {
  const mod = await loadBasis();
  const file = new mod.KTX2File(data);
  try {
    if (!file.isValid() || !file.startTranscoding()) throw new Error('invalid KTX2');
    const width = file.getWidth();
    const height = file.getHeight();
    const t = target.block > 1 && (width % target.block || height % target.block) ? RGBA : target;
    const levels: ArrayBuffer[] = [];
    for (let level = 0; level < Math.max(1, file.getLevels()); level++) {
      if (t.block > 1 && (Math.max(1, width >> level) < t.block || Math.max(1, height >> level) < t.block)) break;
      const dst = new Uint8Array(file.getImageTranscodedSizeInBytes(level, 0, 0, t.tf));
      if (!file.transcodeImage(dst, level, 0, 0, t.tf, 0, -1, -1)) break;
      levels.push(dst.buffer);
    }
    if (!levels.length) throw new Error('transcode failed');
    return { width, height, tf: t.tf, levels };
  } finally {
    file.close();
    file.delete();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Transcode off the main thread when possible. */
export async function transcodeKtx2(data: Uint8Array, target: Target): Promise<Transcoded> {
  const p = getPool();
  if (p) {
    try {
      return await p.run(data, target);
    } catch (e) {
      if (!p.broken) throw e; // a bad image, not a bad worker
    }
  }
  return transcodeHere(data, target);
}

// ---- upload

/**
 * Uploads take turns, one texture per animation frame, so a set whose maps all finish transcoding
 * together cannot land a burst of full mip chains in a single frame.
 */
let uploadTurn: Promise<void> = Promise.resolve();
const nextFrame = (): Promise<void> => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
function takeUploadTurn(): Promise<() => void> {
  const prev = uploadTurn;
  let release!: () => void;
  uploadTurn = new Promise((r) => (release = r));
  return prev.then(nextFrame).then(() => release);
}

export interface Ktx2Upload {
  tex: WebGLTexture;
  bytes: number;
  width: number;
  height: number;
}

/** Transcode a KTX2 image and upload every mip level into a new texture. */
export async function uploadKtx2(gl: WebGL2RenderingContext, reg: GlRegistry, data: Uint8Array, repeat: boolean, anisotropy = 1): Promise<Ktx2Upload | null> {
  const target = pickTarget(gl);
  let img: Transcoded;
  try {
    img = await transcodeKtx2(data, target);
  } catch (e) {
    console.warn('[ktx2]', e);
    return null;
  }
  const release = await takeUploadTurn();
  try {
    return upload(gl, reg, img, target, repeat, anisotropy);
  } finally {
    release();
  }
}

function upload(gl: WebGL2RenderingContext, reg: GlRegistry, img: Transcoded, target: Target, repeat: boolean, anisotropy: number): Ktx2Upload | null {
  if (gl.isContextLost()) return null;
  const compressed = img.tf === target.tf ? target.gl : null;
  const tex = reg.createTexture('ktx2');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  let bytes = 0;
  img.levels.forEach((buf, level) => {
    const lw = Math.max(1, img.width >> level);
    const lh = Math.max(1, img.height >> level);
    const px = new Uint8Array(buf);
    if (compressed !== null) gl.compressedTexImage2D(gl.TEXTURE_2D, level, compressed, lw, lh, 0, px);
    else gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA8, lw, lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    bytes += buf.byteLength;
  });
  const uploaded = img.levels.length;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, Math.max(0, uploaded - 1));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, uploaded > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext && anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
  reg.setBytes(tex, bytes);
  return { tex, bytes, width: img.width, height: img.height };
}
