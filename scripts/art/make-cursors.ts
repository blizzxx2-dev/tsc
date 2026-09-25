/**
 * Rasterises the hardware-cursor fallback PNGs (ART-0271) from `cursorSvg()` in src/art/cursors.ts:
 * public/cursors/<quill|busy|crosshair>-<32|64>.png, transparent, sRGB.
 * Run: `npx vite-node scripts/art/make-cursors.ts`.
 */
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { CURSOR_KINDS, CURSOR_SIZES, cursorFile, cursorSvg } from '../../src/art/cursors';

mkdirSync('public/cursors', { recursive: true });
for (const kind of CURSOR_KINDS)
  for (const size of CURSOR_SIZES) {
    const out = `public/${cursorFile(kind, size)}`;
    // Render at 4× and downsample so the thin strokes stay crisp at 32 px.
    await sharp(Buffer.from(cursorSvg(kind, size * 4)))
      .resize(size, size, { kernel: 'lanczos3' })
      .png()
      .toFile(out);
    console.log(out);
  }
