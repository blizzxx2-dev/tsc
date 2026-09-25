/**
 * KTX2 (Basis UASTC) textures: transcoded at load to the best GPU format the device supports —
 * BC7 on desktop, ASTC 4×4 or ETC2 on mobile/Steam Deck-class GPUs — and uploaded with their full
 * mip chain. Only when none is available does it fall back to uncompressed RGBA8. Uses the Basis
 * Universal transcoder (public/vendor/basis, from three.js), loaded once on first use.
 */
import type { GlRegistry } from './registry';

/* eslint-disable @typescript-eslint/no-explicit-any */
let basis: Promise<any> | null = null;

/** Load and initialise the transcoder (a classic script defining the global `BASIS` factory). */
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

// basist::transcoder_texture_format
const TF = { ETC2_RGBA: 1, BC3_RGBA: 3, BC7_RGBA: 6, ASTC_4x4_RGBA: 10, RGBA32: 13 } as const;

interface Target {
  tf: number;
  gl: number | null; // null = uncompressed RGBA8
  block: number;
}

function pickTarget(gl: WebGL2RenderingContext): Target {
  const bptc = gl.getExtension('EXT_texture_compression_bptc');
  if (bptc) return { tf: TF.BC7_RGBA, gl: bptc.COMPRESSED_RGBA_BPTC_UNORM_EXT, block: 4 };
  const astc = gl.getExtension('WEBGL_compressed_texture_astc');
  if (astc) return { tf: TF.ASTC_4x4_RGBA, gl: astc.COMPRESSED_RGBA_ASTC_4x4_KHR, block: 4 };
  const etc = gl.getExtension('WEBGL_compressed_texture_etc');
  if (etc) return { tf: TF.ETC2_RGBA, gl: etc.COMPRESSED_RGBA8_ETC2_EAC, block: 4 };
  return { tf: TF.RGBA32, gl: null, block: 1 };
}

export interface Ktx2Upload {
  tex: WebGLTexture;
  bytes: number;
  width: number;
  height: number;
}

/** Transcode a KTX2 image and upload every mip level into a new texture. */
export async function uploadKtx2(gl: WebGL2RenderingContext, reg: GlRegistry, data: Uint8Array, repeat: boolean, anisotropy = 1): Promise<Ktx2Upload | null> {
  const mod = await loadBasis();
  const file = new mod.KTX2File(data);
  try {
    if (!file.isValid() || !file.startTranscoding()) return null;
    const w = file.getWidth();
    const h = file.getHeight();
    const levels = Math.max(1, file.getLevels());
    let target = pickTarget(gl);
    // Block formats need multiple-of-4 base sizes in WebGL; odd sizes fall back to RGBA8.
    if (target.gl !== null && (w % 4 || h % 4)) target = { tf: TF.RGBA32, gl: null, block: 1 };
    const tex = reg.createTexture('ktx2');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    let bytes = 0;
    let uploaded = 0;
    for (let level = 0; level < levels; level++) {
      const lw = Math.max(1, w >> level);
      const lh = Math.max(1, h >> level);
      // Compressed mips smaller than a block are skipped; the chain stops at the last full block.
      if (target.gl !== null && (lw < 4 || lh < 4)) break;
      const size = file.getImageTranscodedSizeInBytes(level, 0, 0, target.tf);
      const dst = new Uint8Array(size);
      if (!file.transcodeImage(dst, level, 0, 0, target.tf, 0, -1, -1)) break;
      if (target.gl !== null) gl.compressedTexImage2D(gl.TEXTURE_2D, level, target.gl, lw, lh, 0, dst);
      else gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA8, lw, lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, dst);
      bytes += size;
      uploaded++;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, Math.max(0, uploaded - 1));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, uploaded > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext && anisotropy > 1) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
    reg.setBytes(tex, bytes);
    return { tex, bytes, width: w, height: h };
  } finally {
    file.close();
    file.delete();
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
