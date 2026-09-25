// Asset build (ENG-0204/0205/0209/0212/0217): assets/ → public/assets/ + src/assets/manifest.gen.ts
//   node scripts/build-assets.ts          build (writes hashed files, manifest, size report)
//   node scripts/build-assets.ts --check  verify outputs are current and valid (CI); exits 1 otherwise
// See docs/assets.md for the source layout and conventions.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { decodePng } from './lib/atlas.ts';
import { packSheetDir } from './lib/sheets.ts';

const ROOT = process.cwd();
const SRC = join(ROOT, 'assets');
const OUT = join(ROOT, 'public', 'assets');
const MANIFEST = join(ROOT, 'src', 'assets', 'manifest.gen.ts');
const CHECK = process.argv.includes('--check');
const MAX_TEX = 4096;
const UNUSED_LIMIT = 50 * 1024;

interface Rules {
  bundles: string[];
  rules: { match: string; bundle: string }[];
  default: string;
  fonts: Record<string, { family: string; style: string; weight: string; unicodeRange?: string }>;
}
interface Entry {
  type: string;
  url: string;
  bytes: number;
  bundle: string;
  hash: string;
  pages?: string[];
  font?: { family: string; style: string; weight: string; unicodeRange?: string };
  w?: number;
  h?: number;
  status?: Status;
  nine?: [number, number, number, number];
  pivot?: [number, number];
  angle0?: number;
  parallax?: number;
  layer?: string;
}
type Status = 'placeholder' | 'wip' | 'final';
interface MetaRule {
  match: string;
  status?: Status;
  nine?: [number, number, number, number];
  pivot?: [number, number];
  angle0?: number;
  parallax?: number;
  layer?: string;
}

const rules: Rules = JSON.parse(readFileSync(join(SRC, 'bundles.json'), 'utf8'));
// Per-asset art metadata (ART-0041/0045/0047/0048): every rule whose regex matches an id merges in
// order, so a broad status rule can be refined by a narrower 9-slice or pivot rule below it.
const META_FILE = join(SRC, '_meta.json');
const meta: { rules: MetaRule[] } = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : { rules: [] };
/** Bundles that ship in the demo: a placeholder in any of them fails the build (ART-0041). */
const DEMO_BUNDLES = new Set(['boot', 'title', 'story-common', 'ops-common', 'chapter1', 'chapter2']);
const errors: string[] = [];
const files = new Map<string, Buffer>(); // output file name → bytes
const entries: Record<string, Entry> = {};

const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex').slice(0, 10);
const posix = (p: string) => p.split(sep).join('/');
const bundleFor = (id: string) => rules.rules.find((r) => new RegExp(r.match).test(id))?.bundle ?? rules.default;
const TYPE_BY_DIR: Record<string, string> = {
  fonts: 'font',
  luts: 'lut',
  shaders: 'shader',
  audio: 'audio',
  particles: 'json',
  backdrops: 'image',
  portraits: 'image',
  models: 'model',
};
const TYPE_BY_EXT: Record<string, string> = {
  '.png': 'image',
  '.jpg': 'image',
  '.webp': 'image',
  '.woff2': 'font',
  '.json': 'json',
  '.glsl': 'shader',
  '.ogg': 'audio',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.txt': 'text',
  '.glb': 'model',
};

function emit(id: string, ext: string, data: Buffer): { url: string; h: string } {
  const h = hash(data);
  const name = `${id.replace(/\//g, '_')}.${h}${ext}`;
  files.set(name, data);
  return { url: `assets/${name}`, h };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// ---- sprite sheets: every assets/sprites/<sheet>/ folder is packed into an atlas.
const spriteRoot = join(SRC, 'sprites');
const frameIds = new Set<string>();
if (existsSync(spriteRoot))
  for (const sheet of readdirSync(spriteRoot).sort()) {
    const dir = join(spriteRoot, sheet);
    if (!statSync(dir).isDirectory()) continue;
    const id = `sprites/${sheet}`;
    const { pages, json } = packSheetDir(dir, sheet);
    const pageUrls: string[] = [];
    json.pages.forEach((pg, i) => {
      if (pg.w > MAX_TEX || pg.h > MAX_TEX) errors.push(`${id}: page ${i} is ${pg.w}×${pg.h} (> ${MAX_TEX})`);
      if ((pg.w & (pg.w - 1)) !== 0 || (pg.h & (pg.h - 1)) !== 0) errors.push(`${id}: page ${i} is not power-of-two (${pg.w}×${pg.h})`);
      const { url } = emit(`${id}-${i}`, '.png', pages[i].png);
      pageUrls.push(url);
      pg.file = url.replace(/^assets\//, '');
    });
    for (const f of Object.keys(json.frames)) frameIds.add(f);
    const body = Buffer.from(JSON.stringify(json));
    const { url, h } = emit(id, '.json', body);
    entries[id] = { type: 'sheet', url, bytes: body.length + pages.reduce((n, p) => n + p.png.length, 0), bundle: bundleFor(id), hash: h, pages: pageUrls };
  }

// ---- naming (ART-0031, docs/art/pipeline.md): lowercase kebab-case subject-variant-state, an optional
// @2x scale suffix; metadata files start with '_' and licence texts are exempt.
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*(@[1-4]x)?\.[a-z0-9]+$/;
for (const p of walk(SRC)) {
  const base = p.split(sep).pop()!;
  if (base.startsWith('.') || base.startsWith('_') || /^(README|OFL|LICENSE)/i.test(base) || base === 'bundles.json') continue;
  if (!NAME.test(base)) errors.push(`${posix(relative(SRC, p))}: name must be lowercase kebab-case (subject-variant-state[@2x].ext)`);
}

// ---- everything else: copied with a content hash.
for (const p of walk(SRC)) {
  const rel = posix(relative(SRC, p));
  const base = rel.split('/').pop()!;
  if (rel === 'bundles.json' || rel.startsWith('sprites/') || base.startsWith('.') || base.startsWith('_') || /^(README|OFL|LICENSE)/i.test(base)) continue;
  const ext = extname(rel).toLowerCase();
  const id = rel.slice(0, rel.length - ext.length);
  const dir = rel.split('/')[0];
  const type = TYPE_BY_DIR[dir] ?? TYPE_BY_EXT[ext] ?? 'text';
  const data = readFileSync(p);
  const e: Entry = { type, url: '', bytes: data.length, bundle: bundleFor(id), hash: '' };
  if (ext === '.png') {
    const img = decodePng(data);
    e.w = img.w;
    e.h = img.h;
    if (img.w > MAX_TEX || img.h > MAX_TEX) errors.push(`${id}: ${img.w}×${img.h} exceeds ${MAX_TEX} px`);
    if (type === 'lut' && !(img.w === 1024 && img.h === 32)) errors.push(`${id}: LUT must be a 1024×32 strip of 32³ (got ${img.w}×${img.h})`);
  }
  if (type === 'font') {
    const name = base.replace(/\.[^.]+$/, '');
    const f = rules.fonts[name];
    if (!f) errors.push(`${id}: font has no face entry in assets/bundles.json "fonts"`);
    else e.font = f;
  }
  const { url, h } = emit(id, ext, data);
  e.url = url;
  e.hash = h;
  entries[id] = e;
}

// ---- art metadata: status, 9-slice margins, pivots, embed angle, parallax layers.
for (const [id, e] of Object.entries(entries)) {
  for (const r of meta.rules) {
    if (!new RegExp(r.match).test(id)) continue;
    const { match: _m, ...fields } = r;
    Object.assign(e, fields);
  }
  const layer = /^backdrops\/(.+)-(far|mid|near|fx)$/.exec(id);
  if (layer && !e.layer) e.layer = layer[1];
  if (!e.status) errors.push(`${id}: no status (placeholder|wip|final) — add a rule to assets/_meta.json`);
  if (e.status === 'placeholder' && DEMO_BUNDLES.has(e.bundle)) errors.push(`${id}: placeholder art in demo bundle '${e.bundle}'`);
  if (e.nine) {
    const [l, t, r, b] = e.nine;
    if (e.w !== undefined && e.h !== undefined && (l + r >= e.w || t + b >= e.h))
      errors.push(`${id}: 9-slice margins ${e.nine.join(',')} leave no centre in ${e.w}×${e.h}`);
  }
  if (e.parallax !== undefined && (e.parallax < 0 || e.parallax > 2)) errors.push(`${id}: parallax ${e.parallax} outside 0..2`);
}

// ---- validation (ENG-0209): referenced ids exist, big assets are used, bundles are known.
const srcText = walk(join(ROOT, 'src'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.gen.ts'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
for (const m of srcText.matchAll(/\.sprite\(\s*'([^']+)'/g)) if (!frameIds.has(m[1])) errors.push(`src references missing sprite frame '${m[1]}'`);
for (const m of srcText.matchAll(/(?:assetUrl|assets\.load|assets\.get)\(\s*'([^']+)'/g))
  if (!entries[m[1]]) errors.push(`src references missing asset '${m[1]}'`);
for (const [id, e] of Object.entries(entries)) {
  if (!rules.bundles.includes(e.bundle)) errors.push(`${id}: unknown bundle '${e.bundle}'`);
  const autoUsed = e.type === 'font' || e.type === 'lut' || e.type === 'sheet' || e.type === 'model';
  if (!autoUsed && e.bytes > UNUSED_LIMIT && !srcText.includes(`'${id}'`))
    errors.push(`${id}: ${Math.round(e.bytes / 1024)} KB and never referenced from src/`);
}

// ---- size report (ENG-0207/0217). No size budget: asset quality is never traded for install size.
const perBundle = new Map<string, number>();
for (const e of Object.values(entries)) perBundle.set(e.bundle, (perBundle.get(e.bundle) ?? 0) + e.bytes);
const total = [...perBundle.values()].reduce((a, b) => a + b, 0);

// ---- generated 3D models (git-ignored, built locally by npm run art:models) get their own runtime
// manifest, public/assets/models.json, so the committed manifest is identical on every clone.
const modelIds = Object.keys(entries)
  .filter((i) => entries[i].type === 'model')
  .sort();
const modelManifest = JSON.stringify({ entries: Object.fromEntries(modelIds.map((i) => [i, entries[i]])) }, null, 2) + '\n';
for (const i of modelIds) delete entries[i];

// ---- manifest source.
const ids = Object.keys(entries).sort();
const manifest =
  `// GENERATED by scripts/build-assets.ts from assets/ — do not edit. Run \`npm run assets\`.\n` +
  `import type { AssetEntry } from './types';\n\n` +
  `export type AssetId =${ids.length ? ids.map((i) => `\n  | '${i}'`).join('') : ' never'};\n\n` +
  `export type BundleId = ${rules.bundles.map((b) => `'${b}'`).join(' | ')};\n\n` +
  `export const MANIFEST: Record<AssetId, AssetEntry> = ${JSON.stringify(Object.fromEntries(ids.map((i) => [i, entries[i]])), null, 2)};\n\n` +
  `export const BUNDLES: Record<BundleId, readonly AssetId[]> = ${JSON.stringify(Object.fromEntries(rules.bundles.map((b) => [b, ids.filter((i) => entries[i].bundle === b)])), null, 2)};\n\n` +
  `/** Sprite frame ids across every sheet. */\nexport const FRAME_IDS: readonly string[] = ${JSON.stringify([...frameIds].sort())};\n`;

if (CHECK) {
  const stale: string[] = [];
  if (!existsSync(MANIFEST) || readFileSync(MANIFEST, 'utf8') !== manifest) stale.push('src/assets/manifest.gen.ts');
  for (const [name, data] of files)
    if (!name.startsWith('models_') && (!existsSync(join(OUT, name)) || !readFileSync(join(OUT, name)).equals(data))) stale.push(`public/assets/${name}`);
  if (stale.length) errors.push(`generated assets are stale (run npm run assets): ${stale.join(', ')}`);
} else {
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (!files.has(f) && f !== 'models.json') rmSync(join(OUT, f));
  for (const [name, data] of files) writeFileSync(join(OUT, name), data);
  writeFileSync(join(OUT, 'models.json'), modelManifest);
  mkdirSync(join(ROOT, 'src', 'assets'), { recursive: true });
  writeFileSync(MANIFEST, manifest);
}

console.log(`assets: ${ids.length} ids, ${files.size} files, ${(total / 1024).toFixed(0)} KB`);
const byStatus = (st: Status) => ids.filter((i) => entries[i].status === st).length;
console.log(`  status: ${byStatus('final')} final, ${byStatus('wip')} wip, ${byStatus('placeholder')} placeholder`);
for (const b of rules.bundles)
  console.log(`  ${b.padEnd(13)} ${((perBundle.get(b) ?? 0) / 1024).toFixed(1).padStart(8)} KB  (${ids.filter((i) => entries[i].bundle === b).length} assets)`);
if (errors.length) {
  console.error('asset validation failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}
