// Art export (ART-0035): art-src/export/<category>/… masters → assets/<category>/… ship files,
// resized to ship resolution, trimmed, compressed, with assets/manifest.json (size, hash, trim, atlas page).
//   npm run art:export            export and write the manifest
//   npm run art:export -- --check verify every export is current (CI); exits 1 otherwise
// Rules per category live in scripts/lib/artExport.ts (from docs/art/pipeline.md).
import { runExport } from '../lib/artExport.ts';

const check = process.argv.includes('--check');
const { manifest, problems } = await runExport(process.cwd(), { check, log: (s) => console.log(s) });
const n = Object.keys(manifest.entries).length;
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
  console.error(`\nart:export: ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`art:export: ${n} export(s) ${check ? 'current' : 'written'}${check ? '' : ' → assets/manifest.json'}.`);
