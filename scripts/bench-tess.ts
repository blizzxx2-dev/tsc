// Micro-benchmark for ENG-0023: ellipse tessellation with per-vertex cos/sin vs precomputed unit-circle tables.
// Usage: node scripts/bench-tess.ts
const TAU = Math.PI * 2;
const tables = new Map<number, Float32Array>();
function trig(n: number): Float32Array {
  let t = tables.get(n);
  if (!t) {
    t = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      t[i * 2] = Math.cos((i / n) * TAU);
      t[i * 2 + 1] = Math.sin((i / n) * TAU);
    }
    tables.set(n, t);
  }
  return t;
}
const out = new Float32Array(64 * 6);
function live(n: number, rx: number, ry: number, rot: number): number {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * TAU;
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    out[i] = ex * cr - ey * sr;
    s += out[i] + ex * sr + ey * cr;
  }
  return s;
}
function table(n: number, rx: number, ry: number, rot: number): number {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const tb = trig(n);
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const ex = tb[i * 2] * rx, ey = tb[i * 2 + 1] * ry;
    out[i] = ex * cr - ey * sr;
    s += out[i] + ex * sr + ey * cr;
  }
  return s;
}
function time(fn: typeof live): number {
  let sink = 0;
  for (let k = 0; k < 2e4; k++) sink += fn(12 + (k % 53), 30, 20, k * 0.001);
  const t0 = performance.now();
  for (let k = 0; k < 4e5; k++) sink += fn(12 + (k % 53), 30, 20, k * 0.001);
  const ms = performance.now() - t0;
  if (sink === 42) console.log('');
  return ms;
}
const a = time(live);
const b = time(table);
console.log(`cos/sin per vertex: ${a.toFixed(1)} ms · tables: ${b.toFixed(1)} ms · speed-up ${(a / b).toFixed(2)}×`);
