/**
 * Prints the VFX spec table (ART-0294) from `VFX_SPECS` in src/art/vfx.ts as Markdown rows, for
 * docs/art/vfx/README.md. Run: `npx vite-node scripts/art/vfx-specs.ts`.
 */
import { VFX_SPECS } from '../../src/art/vfx';

for (const s of VFX_SPECS)
  console.log(
    `| \`${s.id}\` | ${s.task} | ${s.sprite} | ${s.frames || 'procedural'} | ${s.fps} | ${s.blend} | ${s.lifetime ? `${s.lifetime} s` : 'while active'} | ${s.maxConcurrent} |`,
  );
