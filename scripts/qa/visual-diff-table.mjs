// Before/after table for baseline PRs (QAT-0067): which screenshots changed and by how much.
// GitHub's "Files changed" view shows each PNG pair with swipe/onion-skin for the visual review.
// Usage: node scripts/qa/visual-diff-table.mjs <beforeDir> <afterDir>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const [before, after] = process.argv.slice(2);
const list = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.png')) : []);
const names = [...new Set([...list(before), ...list(after)])].sort();
const rows = names.map((n) => {
  const a = join(before, n);
  const b = join(after, n);
  if (!existsSync(a)) return `| ${n} | new | — |`;
  if (!existsSync(b)) return `| ${n} | removed | — |`;
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return `| ${n} | size ${A.width}×${A.height} → ${B.width}×${B.height} | 100 % |`;
  const px = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.1 });
  return `| ${n} | ${px ? 'changed' : 'unchanged'} | ${((px / (A.width * A.height)) * 100).toFixed(2)} % |`;
});
console.log(
  [
    '### Screenshot baselines: before → after',
    '',
    '| Screen | Change | Pixels differing |',
    '|---|---|---:|',
    ...rows,
    '',
    'Review each changed PNG in **Files changed** (swipe / onion skin).',
  ].join('\n'),
);
