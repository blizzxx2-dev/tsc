import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildAtlas, decodePng, encodePng, type SheetJson, type SheetMeta } from './atlas.ts';

/** Pack one `assets/sprites/<sheet>/` folder (PNG frames + optional `_sheet.json` meta). */
export function packSheetDir(dir: string, name: string, pageSize = 2048): { pages: { file: string; png: Buffer }[]; json: SheetJson } {
  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  const frames = files.map((f) => ({ id: f.replace(/\.png$/i, ''), img: decodePng(readFileSync(join(dir, f))) }));
  const metaPath = join(dir, '_sheet.json');
  const meta: SheetMeta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const { pages, json } = buildAtlas(name, frames, meta, pageSize);
  return { pages: pages.map((p, i) => ({ file: json.pages[i].file, png: encodePng(p) })), json };
}
