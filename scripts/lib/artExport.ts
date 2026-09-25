/**
 * Art export (ART-0035): masters in `art-src/export/<category>/…` become shipped files in
 * `assets/<category>/…` — resized to the ship resolution from the authoring standard (ART-0034),
 * trimmed of transparent borders where the class allows it, compressed per the export spec
 * (ART-0033) — and every export is recorded in `assets/manifest.json` with its size, content hash,
 * trim box and, for sprites, the atlas page it packs onto.
 *
 * It never upscales, and never replaces an existing export with a smaller one: a smaller result
 * means the master is below spec, which is an error, not a silent downgrade.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import sharp from 'sharp';
import { packSheetDir } from './sheets.ts';

// Masters change under the same path between runs: never serve a cached decode.
sharp.cache(false);

export interface ExportRule {
  /** Ship size relative to the master (0.5 = masters are authored at 2×). */
  scale: number;
  format: 'png' | 'webp' | 'webp-lossless';
  trim: boolean;
}

/** Per-category rules, from docs/art/pipeline.md (ART-0033 export spec, ART-0034 authoring resolution). */
export const EXPORT_RULES: Record<string, ExportRule> = {
  backdrops: { scale: 0.5, format: 'webp', trim: false },
  portraits: { scale: 0.5, format: 'webp-lossless', trim: true },
  sprites: { scale: 0.5, format: 'png', trim: true },
  ui: { scale: 1, format: 'png', trim: true },
  luts: { scale: 1, format: 'png', trim: false },
};

export interface ManifestEntry {
  source: string;
  w: number;
  h: number;
  bytes: number;
  /** sha256 of the exported bytes, first 16 hex digits. */
  hash: string;
  /** Transparent border removed: the kept box inside the resized image, and that image's full size. */
  trim?: { x: number; y: number; w: number; h: number; fullW: number; fullH: number };
  /** Sprites: the sheet and the atlas page the frame packs onto. */
  atlas?: { sheet: string; frame: string; page: number };
}

export interface Manifest {
  version: 1;
  entries: Record<string, ManifestEntry>;
}

const SOURCE_EXT = new Set(['.png', '.tif', '.tiff', '.webp', '.jpg', '.jpeg']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*(@[1-4]x)?$/;

const walk = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : [];
const posix = (p: string) => p.split(sep).join('/');

async function exportOne(file: string, rule: ExportRule): Promise<{ buf: Buffer; w: number; h: number; trim?: ManifestEntry['trim'] }> {
  const meta = await sharp(file).metadata();
  const w = Math.max(1, Math.round((meta.width ?? 1) * rule.scale));
  const h = Math.max(1, Math.round((meta.height ?? 1) * rule.scale));
  let img = sharp(file).ensureAlpha();
  if (rule.scale !== 1) img = img.resize(w, h, { kernel: 'lanczos3' });
  let trim: ManifestEntry['trim'];
  if (rule.trim) {
    // Trim on the resized pixels so the box is in ship space.
    const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width;
    let y0 = info.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < info.width - 1 || y1 < info.height - 1)) {
      trim = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, fullW: info.width, fullH: info.height };
      img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: y0, width: trim.w, height: trim.h });
    }
  }
  const out =
    rule.format === 'png'
      ? img.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      : rule.format === 'webp'
        ? img.webp({ quality: 90, effort: 6 })
        : img.webp({ lossless: true, effort: 6 });
  const { data, info } = await out.toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height, trim };
}

/**
 * Export every master under `<root>/art-src/export` into `<root>/assets` and write the manifest.
 * `check` exports in memory only and reports what is missing or stale. Returns problems found.
 */
export async function runExport(root: string, o: { check?: boolean; log?: (s: string) => void } = {}): Promise<{ manifest: Manifest; problems: string[] }> {
  const log = o.log ?? (() => {});
  const src = join(root, 'art-src', 'export');
  const dst = join(root, 'assets');
  const manifestPath = join(dst, 'manifest.json');
  const prev: Manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 1, entries: {} };
  const manifest: Manifest = { version: 1, entries: {} };
  const problems: string[] = [];
  const sheets = new Set<string>();
  for (const file of walk(src).sort()) {
    const ext = extname(file).toLowerCase();
    if (!SOURCE_EXT.has(ext)) continue;
    const rel = posix(relative(src, file));
    const category = rel.split('/')[0];
    const rule = EXPORT_RULES[category];
    if (!rule) {
      problems.push(`${rel}: unknown category "${category}" (expected ${Object.keys(EXPORT_RULES).join(', ')})`);
      continue;
    }
    const base = rel.slice(0, -ext.length);
    const name = base.split('/').pop()!;
    if (!NAME_RE.test(name)) {
      problems.push(`${rel}: "${name}" breaks the naming convention (lowercase kebab-case, optional @2x)`);
      continue;
    }
    const outExt = rule.format === 'png' ? '.png' : '.webp';
    const outRel = `${base}${outExt}`;
    const outPath = join(dst, outRel);
    const { buf, w, h, trim } = await exportOne(file, rule);
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const entry: ManifestEntry = { source: posix(relative(root, file)), w, h, bytes: buf.length, hash, ...(trim ? { trim } : {}) };
    manifest.entries[outRel] = entry;
    if (category === 'sprites') sheets.add(outRel.split('/')[1]);
    const old = prev.entries[outRel];
    if (o.check) {
      if (!old || old.hash !== hash || !existsSync(outPath)) problems.push(`${outRel}: ${old ? 'stale' : 'not exported'} — run npm run art:export`);
      continue;
    }
    if (old && existsSync(outPath) && (old.trim?.fullW ?? old.w) > (trim?.fullW ?? w)) {
      problems.push(`${outRel}: the export would shrink from ${old.trim?.fullW ?? old.w} px to ${trim?.fullW ?? w} px wide — the master is below spec`);
      continue;
    }
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buf);
    log(`${outRel}  ${w}×${h}  ${(buf.length / 1024).toFixed(1)} KB${trim ? `  (trimmed from ${trim.fullW}×${trim.fullH})` : ''}`);
  }
  // Atlas pages: pack each sheet the way the asset build will, and record where each frame lands.
  if (!o.check)
    for (const sheet of sheets) {
      const dir = join(dst, 'sprites', sheet);
      const { json } = packSheetDir(dir, sheet);
      for (const [outRel, e] of Object.entries(manifest.entries)) {
        if (!outRel.startsWith(`sprites/${sheet}/`)) continue;
        const frame = `${sheet}/${outRel
          .split('/')
          .pop()!
          .replace(/\.png$/, '')}`;
        const f = json.frames[frame];
        if (f) e.atlas = { sheet, frame, page: f.page };
      }
    }
  else for (const [outRel, e] of Object.entries(prev.entries)) if (manifest.entries[outRel] && e.atlas) manifest.entries[outRel].atlas = e.atlas;
  if (!o.check && !problems.length) writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  return { manifest, problems };
}
