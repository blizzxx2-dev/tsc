/**
 * Baked tiling noise for the flesh field (ENG-0081). The live `FLESH_FS` evaluated a 4-octave
 * value-noise fbm up to ~17 times per pixel plus two 3×3 voronoi searches; this bakes the same
 * two fields once at load into 512² textures the shader samples instead:
 *
 * - `fbm`   RGBA: x fbm value, yz its analytic gradient (for the wet specular normal), w unused.
 * - `cells` RGBA: xyz the three nearest domain-warped voronoi feature distances (d1 ≤ d2 ≤ d3),
 *           from which the shader rebuilds the per-organ soft-min membrane edge (`u_cellSoft`).
 *
 * Both tile with period `PERIOD` noise units, so `fbm(p)` becomes `texture(u_noise, p / PERIOD)`.
 * Tiling needs periodic lattices, which the live shader's 36.87° octave rotation (a non-integer
 * matrix) cannot give, so the bake rotates by 26.57° per octave with the integer matrix
 * M = [[2,-1],[1,2]] (scale √5): every octave lattice is a sublattice of Z², and hashing the lattice
 * cell reduced modulo M^i·PERIOD·Z² makes each octave exactly periodic. Four √5 octaves with 1/f
 * amplitudes span the same 1–11 frequency range as the live 1–8 fbm with near-identical variance,
 * and the varying octave angles keep the value-noise lattices from lining up into squares or a
 * diagonal grain.
 *
 * Pure and deterministic (a fixed integer hash), so a bake is identical on every machine and in
 * Node tests. The result is cached: one bake per process, re-uploaded after a context loss.
 */

export const NOISE_SIZE = 512;
/** Tile period in noise units (the shader's `NOISE_PERIOD`). */
export const NOISE_PERIOD = 16;
/** Octaves of the baked fbm (√5 apart: frequencies 1, 2.24, 5, 11.2). */
const OCTAVES = 4;
/** Live fbm mean (Σ 0.5^(k+1) · 0.5 + the 0.03125 · 0.5 tail); the bake centres on the same value. */
const FBM_MEAN = 0.484375;

export interface BakedNoise {
  size: number;
  period: number;
  /** RGBA float texels: fbm, ∂fbm/∂x, ∂fbm/∂y, 0. */
  fbm: Float32Array;
  /** RGBA float texels: d1, d2, d3, 0 (voronoi feature distances, cell units). */
  cells: Float32Array;
}

/** Integer hash → [0,1); stable across platforms (no Math.sin). */
function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Quintic fade and its derivative (continuous second derivative: no creases at cell borders). */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const dfade = (t: number): number => 30 * t * t * (t * (t - 2) + 1);

const mod = (a: number, n: number): number => a - Math.floor(a / n) * n;

/**
 * One octave lattice: q = M^i · p with M = [[2,-1],[1,2]] (row-major: q.x = 2p.x - p.y, q.y = p.x + 2p.y).
 * `m` is M^i; `invd` is M^-i scaled by `den` = 5^i so it is an integer matrix (the adjugate power),
 * and `exd`/`eyd` are its columns: the unit cell steps in scaled M^-i coordinates. Keeping the
 * inverse coordinates as exact integers makes the periodic reduction exact at cell boundaries.
 */
interface Lattice {
  m: [number, number, number, number];
  invd: [number, number, number, number];
  den: number;
  exd: [number, number];
  eyd: [number, number];
}

function lattices(n: number): Lattice[] {
  const out: Lattice[] = [];
  let m: [number, number, number, number] = [1, 0, 0, 1];
  let invd: [number, number, number, number] = [1, 0, 0, 1];
  let den = 1;
  for (let i = 0; i < n; i++) {
    out.push({ m, invd, den, exd: [invd[0], invd[2]], eyd: [invd[1], invd[3]] });
    // M · m, and invd · adj(M) with adj(M) = [[2, 1], [-1, 2]] (M^-1 = adj(M) / 5).
    m = [2 * m[0] - m[2], 2 * m[1] - m[3], m[0] + 2 * m[2], m[1] + 2 * m[3]];
    invd = [2 * invd[0] - invd[1], invd[0] + 2 * invd[1], 2 * invd[2] - invd[3], invd[2] + 2 * invd[3]];
    den *= 5;
  }
  return out;
}

/** Hash of the lattice cell whose scaled M^-i coordinates are `(vx, vy)` (integers), reduced modulo the period lattice. */
function cellHash(L: Lattice, vx: number, vy: number, period: number, seed: number): number {
  const n = period * L.den;
  const wx = mod(vx, n);
  const wy = mod(vy, n);
  // M^i · (w / den) is an integer (the reduced cell); the division is exact.
  const cx = Math.round((L.m[0] * wx + L.m[1] * wy) / L.den);
  const cy = Math.round((L.m[2] * wx + L.m[3] * wy) / L.den);
  return hash(cx, cy, seed);
}

/**
 * Periodic value noise on one octave lattice: value and gradient in `p` space.
 * Returns [n, dn/dx, dn/dy].
 */
function noiseOct(L: Lattice, px: number, py: number, period: number, seed: number, out: [number, number, number]): void {
  const qx = L.m[0] * px + L.m[1] * py;
  const qy = L.m[2] * px + L.m[3] * py;
  const ix = Math.floor(qx);
  const iy = Math.floor(qy);
  const fx = qx - ix;
  const fy = qy - iy;
  // Base cell in scaled M^-i coordinates (exact integers); the corner steps are M^-i·e_x and M^-i·e_y.
  const vx = L.invd[0] * ix + L.invd[1] * iy;
  const vy = L.invd[2] * ix + L.invd[3] * iy;
  const a = cellHash(L, vx, vy, period, seed);
  const b = cellHash(L, vx + L.exd[0], vy + L.exd[1], period, seed);
  const c = cellHash(L, vx + L.eyd[0], vy + L.eyd[1], period, seed);
  const d = cellHash(L, vx + L.exd[0] + L.eyd[0], vy + L.exd[1] + L.eyd[1], period, seed);
  const ux = fade(fx);
  const uy = fade(fy);
  const k1 = b - a;
  const k2 = c - a;
  const k3 = a - b - c + d;
  out[0] = a + k1 * ux + k2 * uy + k3 * ux * uy;
  // Gradient in q space, then through M^i (chain rule: grad_p = M^T grad_q).
  const gqx = dfade(fx) * (k1 + k3 * uy);
  const gqy = dfade(fy) * (k2 + k3 * ux);
  out[1] = L.m[0] * gqx + L.m[2] * gqy;
  out[2] = L.m[1] * gqx + L.m[3] * gqy;
}

/** Periodic fbm at `p` (noise units): [value, d/dx, d/dy], value clamped to 0..1 like the live fbm's range. */
export function periodicFbm(px: number, py: number, period = NOISE_PERIOD, L = lattices(OCTAVES), seed = 0x9e3779b9): [number, number, number] {
  let v = FBM_MEAN;
  let gx = 0;
  let gy = 0;
  const tmp: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < OCTAVES; i++) {
    // 1/f amplitudes: 0.5 at frequency 1, then ÷√5 per octave (the live fbm halves per scale-2 octave).
    const amp = 0.5 * Math.pow(5, -i / 2);
    noiseOct(L[i], px + i * 3.7, py + i * 5.1, period, seed + i * 0x632be5ab, tmp);
    v += amp * (tmp[0] - 0.5);
    gx += amp * tmp[1];
    gy += amp * tmp[2];
  }
  return [Math.min(1, Math.max(0, v)), gx, gy];
}

/** Single-octave periodic value noise with `freq` lattice cells per period (for the voronoi domain warp). */
function warpNoise(px: number, py: number, cellsPerPeriod: number, period: number, seed: number): number {
  const s = cellsPerPeriod / period;
  const qx = px * s;
  const qy = py * s;
  const ix = Math.floor(qx);
  const iy = Math.floor(qy);
  const fx = qx - ix;
  const fy = qy - iy;
  const h = (dx: number, dy: number) => hash(mod(ix + dx, cellsPerPeriod), mod(iy + dy, cellsPerPeriod), seed);
  const ux = fade(fx);
  const uy = fade(fy);
  return h(0, 0) + (h(1, 0) - h(0, 0)) * ux + (h(0, 1) - h(0, 0)) * uy + (h(0, 0) - h(1, 0) - h(0, 1) + h(1, 1)) * ux * uy;
}

/**
 * Periodic domain-warped voronoi at `p` (cell units): the three nearest feature distances,
 * matching the live `cells()` search (warp ±0.6 cells, 3×3 neighbourhood).
 */
export function periodicCells(px: number, py: number, period = NOISE_PERIOD): [number, number, number] {
  // The live warp used noise(p * 0.35); 6 cells per period is the nearest periodic frequency.
  const wx = warpNoise(px, py, 6, period, 0x1b873593) * 1.2 - 0.6;
  const wy = warpNoise(px, py, 6, period, 0x85ebca6b) * 1.2 - 0.6;
  px += wx;
  py += wy;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  let d1 = 8;
  let d2 = 8;
  let d3 = 8;
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) {
      const cx = mod(ix + x, period);
      const cy = mod(iy + y, period);
      const ox = hash(cx, cy, 0xcc9e2d51);
      const oy = hash(cx, cy, 0x1b56c4e9);
      const dx = x + ox - fx;
      const dy = y + oy - fy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) {
        d3 = d2;
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d3 = d2;
        d2 = d;
      } else if (d < d3) d3 = d;
    }
  return [d1, d2, d3];
}

let cached: BakedNoise | null = null;

/** Bake (once per process) the tiling fbm and voronoi textures. */
export function bakedNoise(size = NOISE_SIZE, period = NOISE_PERIOD): BakedNoise {
  if (cached && cached.size === size && cached.period === period) return cached;
  const fbm = new Float32Array(size * size * 4);
  const cells = new Float32Array(size * size * 4);
  const L = lattices(OCTAVES);
  const step = period / size;
  for (let y = 0; y < size; y++) {
    // Texel centres; texture v=0 is the first row, matching `texture(u, p / period)` with p.y down.
    const py = (y + 0.5) * step;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * step;
      const o = (y * size + x) * 4;
      const f = periodicFbm(px, py, period, L);
      fbm[o] = f[0];
      fbm[o + 1] = f[1];
      fbm[o + 2] = f[2];
      const c = periodicCells(px, py, period);
      cells[o] = c[0];
      cells[o + 1] = c[1];
      cells[o + 2] = c[2];
    }
  }
  cached = { size, period, fbm, cells };
  return cached;
}
