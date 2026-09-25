// Build-time sprite atlas packer (ENG-0033).
// Usage: node scripts/pack-atlas.ts [srcRoot=assets/sprites] [outDir=build/atlas]
// Packs every assets/sprites/<sheet>/*.png into ≤2048² power-of-two pages with
// 2 px extruded borders plus a JSON frame table. Output is byte-identical for
// identical input. `npm run assets` runs this as part of the asset build.
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packSheetDir } from './lib/sheets.ts';

const [src = 'assets/sprites', out = 'build/atlas'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const sheet of readdirSync(src).sort()) {
  const dir = join(src, sheet);
  if (!statSync(dir).isDirectory()) continue;
  const { pages, json } = packSheetDir(dir, sheet);
  for (const p of pages) writeFileSync(join(out, p.file), p.png);
  writeFileSync(join(out, `${sheet}.json`), JSON.stringify(json, null, 1) + '\n');
  console.log(`${sheet}: ${Object.keys(json.frames).length} frames → ${pages.length} page(s) ${json.pages.map((p) => `${p.w}×${p.h}`).join(', ')}`);
}
