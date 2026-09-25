// Tileability check for flesh textures (ART-0160): every albedo and normal is offset by half a tile
// and its wrap seam diffed against the texture's own neighbour steps; any ratio above the threshold fails.
//   node scripts/art/check-tileable.ts               check (exit 1 on a seam)
//   node scripts/art/check-tileable.ts --out <dir>   also write the half-offset previews as PNG
//   --threshold <n>                                   override the failure ratio (default 1.75)
// Inputs: the baked flesh noise (its fbm is the procedural albedo, its gradient the normal field;
// src/render/noiseBake.ts) and any painted `*albedo*` / `*normal*` PNG under assets/ or art-src/.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bakedNoise } from '../../src/render/noiseBake.ts';
import { decodePng, encodePng } from '../lib/atlas.ts';
import { halfOffset, SEAM_THRESHOLD, seamRatio, type Plane } from '../lib/tileable.ts';

const ROOT = process.cwd();
const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const OUT = arg('--out');
const LIMIT = Number(arg('--threshold') ?? SEAM_THRESHOLD);

interface Tex {
  name: string;
  plane: Plane;
  channels: number[];
}

const texes: Tex[] = [];
// The procedural set: a smaller bake is the same periodic field at a coarser sampling.
const baked = bakedNoise(256);
texes.push({ name: 'baked fbm (albedo)', plane: { w: baked.size, h: baked.size, channels: 4, data: baked.fbm }, channels: [0] });
texes.push({ name: 'baked fbm gradient (normal)', plane: { w: baked.size, h: baked.size, channels: 4, data: baked.fbm }, channels: [1, 2] });
texes.push({ name: 'baked cells (membranes)', plane: { w: baked.size, h: baked.size, channels: 4, data: baked.cells }, channels: [0, 1, 2] });

const walk = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : [];
for (const f of [...walk(join(ROOT, 'assets')), ...walk(join(ROOT, 'art-src'))]) {
  if (!/\.png$/i.test(f) || !/(albedo|normal)/i.test(f)) continue;
  const img = decodePng(readFileSync(f));
  texes.push({ name: relative(ROOT, f), plane: { w: img.w, h: img.h, channels: 4, data: img.data }, channels: /normal/i.test(f) ? [0, 1] : [0, 1, 2] });
}

if (OUT) mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const t of texes) {
  const r = seamRatio(t.plane, t.channels);
  const bad = r.worst > LIMIT;
  if (bad) failed++;
  console.log(`${bad ? 'SEAM' : 'ok  '}  ${t.name.padEnd(44)} x ${r.x.toFixed(2)}  y ${r.y.toFixed(2)}`);
  if (OUT) {
    const off = halfOffset(t.plane);
    const px = new Uint8Array(off.w * off.h * 4);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < off.w * off.h; i++)
      for (const c of t.channels) {
        const v = off.data[i * off.channels + c];
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    for (let i = 0; i < off.w * off.h; i++) {
      t.channels.slice(0, 3).forEach((c, k) => (px[i * 4 + k] = Math.round(((off.data[i * off.channels + c] - lo) / Math.max(1e-6, hi - lo)) * 255)));
      if (t.channels.length === 1) px[i * 4 + 1] = px[i * 4 + 2] = px[i * 4];
      px[i * 4 + 3] = 255;
    }
    writeFileSync(
      join(
        OUT,
        `${t.name
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase()}-offset.png`,
      ),
      encodePng({ w: off.w, h: off.h, data: px }),
    );
  }
}
console.log(failed ? `\n${failed} texture(s) show a seam above ${LIMIT}×.` : `\nAll ${texes.length} textures tile (threshold ${LIMIT}×).`);
process.exit(failed ? 1 : 0);
