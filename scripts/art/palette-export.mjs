// Write the master palette (src/render/palette.ts) as a GIMP/Krita/Aseprite swatch file (ART-0011).
//   node scripts/art/palette-export.mjs   → docs/art/palette.gpl
import { writeFileSync } from 'node:fs';
import { importTs } from '../lib/ts-import.mjs';

const { SWATCHES } = await importTs('src/render/palette.ts');
const lines = ['GIMP Palette', 'Name: Suture & Steel master', 'Columns: 8', '#'];
for (const [name, hex] of Object.entries(SWATCHES)) {
  const n = parseInt(hex.slice(1), 16);
  lines.push(`${String((n >> 16) & 255).padStart(3)} ${String((n >> 8) & 255).padStart(3)} ${String(n & 255).padStart(3)}\t${name}`);
}
writeFileSync('docs/art/palette.gpl', lines.join('\n') + '\n');
console.log(`palette: ${Object.keys(SWATCHES).length} swatches → docs/art/palette.gpl`);
