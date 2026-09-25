/**
 * Curve and gradient utilities (ENG-0127): over-life curves (size, alpha, speed) and colour
 * gradients are authored as keyframes, baked once to 64-sample lookup tables and packed into one
 * RGBA8 texture row per curve/gradient, so the particle shader can sample them by row.
 */
import type { GlRegistry } from './registry';

export const CURVE_SAMPLES = 64;

/** Keyframes `[t, value]` with t in 0..1 (sorted or not). A bare number is a constant curve. */
export type CurveDef = number | readonly (readonly [number, number])[];
/** Keyframes `[t, '#rrggbb', alpha?]`. A bare colour string is a constant gradient. */
export type GradientDef = string | readonly (readonly [number, string] | readonly [number, string, number])[];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Piecewise-linear evaluation of keyframes at t (clamped at the ends). */
export function evalCurve(def: CurveDef, t: number): number {
  if (typeof def === 'number') return def;
  if (!def.length) return 0;
  const k = [...def].sort((a, b) => a[0] - b[0]);
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, v0] = k[i - 1];
      const [t1, v1] = k[i];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return k[k.length - 1][1];
}

/** Bake a curve into `n` evenly spaced samples (sample i at t = i / (n − 1)). */
export function bakeCurve(def: CurveDef, n = CURVE_SAMPLES): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = evalCurve(def, i / (n - 1));
  return out;
}

/** Linear-interpolated lookup into a baked table at t in 0..1. */
export function sampleBaked(lut: ArrayLike<number>, t: number): number {
  const n = lut.length;
  const x = clamp01(t) * (n - 1);
  const i = Math.floor(x);
  if (i >= n - 1) return lut[n - 1];
  const f = x - i;
  return lut[i] + (lut[i + 1] - lut[i]) * f;
}

const rgb = (h: string): [number, number, number] => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Bake a gradient into `n` RGBA8 samples (straight alpha). */
export function bakeGradient(def: GradientDef, n = CURVE_SAMPLES): Uint8Array {
  const out = new Uint8Array(n * 4);
  const keys = typeof def === 'string' ? [[0, def, 1] as const] : [...def].sort((a, b) => a[0] - b[0]);
  const ch = (c: 0 | 1 | 2 | 3) => keys.map((k) => [k[0], c === 3 ? (k[2] ?? 1) * 255 : rgb(k[1])[c]] as const);
  const curves = [ch(0), ch(1), ch(2), ch(3)];
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = Math.round(Math.max(0, Math.min(255, evalCurve(curves[c], i / (n - 1)))));
  return out;
}

/** Sample a baked gradient at t → [r, g, b, a] in 0..255. */
export function sampleGradient(lut: Uint8Array, t: number): [number, number, number, number] {
  const n = lut.length / 4;
  const x = clamp01(t) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = n === 1 ? 0 : x - i;
  const o: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) o[c] = n === 1 ? lut[c] : lut[i * 4 + c] + (lut[(i + 1) * 4 + c] - lut[i * 4 + c]) * f;
  return o;
}

/**
 * A texture of baked rows: gradients stored as RGBA, scalar curves normalised into R (with their
 * range kept CPU-side). `row(name)` gives the v coordinate of a row's centre for shader lookups.
 */
export class CurveAtlas {
  private rows = new Map<string, number>();
  private data: Uint8Array[] = [];
  /** Scalar curve ranges: value = min + r × (max − min). */
  readonly ranges = new Map<string, [number, number]>();
  private tex: WebGLTexture | null = null;
  private dirty = true;

  addGradient(name: string, def: GradientDef): number {
    return this.put(name, bakeGradient(def));
  }

  /** Add a scalar curve stored in R, normalised to `range` (default: the curve's own min..max). */
  addCurve(name: string, def: CurveDef, range?: [number, number]): number {
    const lut = bakeCurve(def);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of lut) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    if (range) [lo, hi] = range;
    const span = hi - lo || 1;
    const px = new Uint8Array(CURVE_SAMPLES * 4);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      px[i * 4] = Math.round(Math.max(0, Math.min(1, (lut[i] - lo) / span)) * 255);
      px[i * 4 + 3] = 255;
    }
    this.ranges.set(name, [lo, lo + span]);
    return this.put(name, px);
  }

  private put(name: string, px: Uint8Array): number {
    let r = this.rows.get(name);
    if (r === undefined) {
      r = this.data.length;
      this.rows.set(name, r);
      this.data.push(px);
    } else this.data[r] = px;
    this.dirty = true;
    return r;
  }

  /** Row index of a named curve/gradient (−1 when absent). */
  index(name: string): number {
    return this.rows.get(name) ?? -1;
  }

  get height(): number {
    return Math.max(1, this.data.length);
  }

  /** v coordinate of a row's centre. */
  row(name: string): number {
    return ((this.rows.get(name) ?? 0) + 0.5) / this.height;
  }

  /** All rows as one RGBA8 image, CURVE_SAMPLES wide. */
  pixels(): Uint8Array {
    const out = new Uint8Array(CURVE_SAMPLES * 4 * this.height);
    this.data.forEach((px, i) => out.set(px, i * CURVE_SAMPLES * 4));
    return out;
  }

  /** The uploaded texture (re-uploaded after changes); linear filtering interpolates between samples. */
  texture(gl: WebGL2RenderingContext, reg?: GlRegistry): WebGLTexture {
    if (this.tex && !this.dirty && (!reg || reg.isLive(this.tex))) return this.tex;
    if (!this.tex || (reg && !reg.isLive(this.tex))) {
      this.tex = reg ? reg.createTexture('curve-luts') : gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, CURVE_SAMPLES, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    reg?.setBytes(this.tex, CURVE_SAMPLES * 4 * this.height);
    this.dirty = false;
    return this.tex;
  }
}
