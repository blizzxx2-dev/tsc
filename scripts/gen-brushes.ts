// Generates the effects-atlas brush sources (ENG-0110) into assets/sprites/fx/.
// Deterministic (seeded); re-run only when changing the brush designs:
//   node scripts/gen-brushes.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { blank, encodePng, type Img } from './lib/atlas.ts';

const OUT = 'assets/sprites/fx';
mkdirSync(OUT, { recursive: true });

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White brush with coverage in alpha, from a 0..1 field function. */
function brush(w: number, h: number, f: (x: number, y: number) => number): Img {
  const img = blank(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = Math.max(0, Math.min(1, f((x + 0.5) / w, (y + 0.5) / h)));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  return img;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const out: Record<string, Img> = {};
out['soft-round'] = brush(64, 64, (x, y) => 1 - smooth(0.15, 0.5, Math.hypot(x - 0.5, y - 0.5)));
out.erase = brush(64, 64, (x, y) => 1 - smooth(0.42, 0.5, Math.hypot(x - 0.5, y - 0.5)));
for (let k = 1; k <= 4; k++) {
  const r = rng(k * 7919);
  const blobs = Array.from({ length: 10 + k * 3 }, (_, i) => {
    const ang = r() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.08 + r() * 0.34;
    return { x: 0.5 + Math.cos(ang) * d, y: 0.5 + Math.sin(ang) * d, s: i === 0 ? 0.2 : 0.02 + r() * 0.07 * (1 - d) };
  });
  out[`splatter-${k}`] = brush(96, 96, (x, y) => Math.max(...blobs.map((b) => 1 - smooth(b.s * 0.7, b.s, Math.hypot(x - b.x, y - b.y)))));
}
out['drag-streak'] = brush(128, 32, (x, y) => (1 - smooth(0.2, 0.5, Math.abs(y - 0.5) * (1.4 - x * 0.8))) * smooth(0, 0.12, x) * (1 - smooth(0.7, 1, x)));
{
  const r = rng(4242);
  const spots = Array.from({ length: 40 }, () => ({ x: r(), y: r(), s: 0.02 + r() * 0.05 }));
  out.scorch = brush(96, 96, (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5);
    let n = 0;
    for (const s of spots) n += Math.max(0, 1 - Math.hypot(x - s.x, y - s.y) / s.s) * 0.35;
    return (1 - smooth(0.25, 0.48, d + n * 0.08)) * (0.75 + 0.25 * Math.min(1, n));
  });
}
out['stitch-mark'] = brush(32, 48, (x, y) => (1 - smooth(0.06, 0.16, Math.abs(x - 0.5))) * smooth(0.05, 0.2, y) * (1 - smooth(0.8, 0.95, y)));

for (const [name, img] of Object.entries(out)) writeFileSync(`${OUT}/${name}.png`, encodePng(img));
writeFileSync(`${OUT}/_sheet.json`, JSON.stringify({ pivots: { 'drag-streak': { x: 0.1, y: 0.5 } } }, null, 1) + '\n');
console.log(`wrote ${Object.keys(out).length} brushes to ${OUT}`);
