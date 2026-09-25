// Warn (never fail) when the generated 3D models are missing or older than the scripts that make
// them. Models are built locally (npm run art:models) and not committed; see docs/art/pipeline.md.
//   node scripts/art/check-models.mjs            warn
//   node scripts/art/check-models.mjs --stamp    record the current source hash (after a build)
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES = ['art-src/blender', 'art-src/textures.json', 'scripts/art/compress-models.mjs', 'scripts/art/ktx2-worker.mjs'];
const STAMP = 'assets/models/.stamp.json';

function files(p) {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return [p];
  return readdirSync(p)
    .sort()
    .flatMap((f) => (f.startsWith('.') || f === '__pycache__' ? [] : files(join(p, f))));
}
const hash = createHash('sha256');
for (const f of SOURCES.flatMap(files)) hash.update(f).update(readFileSync(f));
const digest = hash.digest('hex').slice(0, 16);

if (process.argv.includes('--stamp')) {
  writeFileSync(STAMP, JSON.stringify({ sources: digest, built: new Date().toISOString() }, null, 2) + '\n');
  process.exit(0);
}
const warn = (m) => console.warn(`\x1b[33m⚠ 3D models: ${m}\x1b[0m`);
if (!existsSync(STAMP) || !readdirSync('assets/models').some((f) => f.endsWith('.glb')))
  warn('not built — the game shows procedural backdrops. Run `npm run art:models` (needs bpy; see docs/art/pipeline.md).');
else if (JSON.parse(readFileSync(STAMP, 'utf8')).sources !== digest) warn('out of date with art-src/blender — run `npm run art:models`.');
