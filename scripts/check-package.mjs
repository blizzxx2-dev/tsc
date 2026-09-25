// Inspects a packaged desktop build (PLT-0026, PLT-0027, PLT-0041, PLT-0124, PLT-0183):
//   - Electron fuses: RunAsNode, NODE_OPTIONS and inspect args off; OnlyLoadAppFromAsar and ASAR integrity on
//   - no source maps, no steam_appid.txt, no dev dependencies in the package
//   - PLATFORM=none packages contain no Steamworks binaries
//   - compressed size budget (default 250 MB, the Windows demo depot limit)
// Usage: node scripts/check-package.mjs <appOutDir> [--no-steam] [--max-mb=250]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const noSteam = args.includes('--no-steam');
const maxMb = Number(args.find((a) => a.startsWith('--max-mb='))?.split('=')[1] ?? 250);
if (!dir || !existsSync(dir)) {
  console.error('usage: node scripts/check-package.mjs <appOutDir> [--no-steam] [--max-mb=250]');
  process.exit(2);
}

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.isFile() ? [join(d, e.name)] : []));
}
const files = walk(dir);
const problems = [];

// Executable: the .app bundle on macOS, otherwise the largest executable-looking file at the root.
const app = readdirSync(dir).find((n) => n.endsWith('.app'));
const exe = app
  ? join(dir, app)
  : readdirSync(dir)
      .map((n) => join(dir, n))
      .filter((p) => statSync(p).isFile() && (/\.exe$/.test(p) || (statSync(p).mode & 0o111 && !/\.(so|so\.\d+|dll|pak|bin|dat|json|html|txt)$/.test(p) && !/chrome[-_]/.test(p))))
      .sort((a, b) => statSync(b).size - statSync(a).size)[0];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const fuses = execFileSync(npx, ['@electron/fuses', 'read', '--app', exe], { encoding: 'utf8', shell: process.platform === 'win32' });
const want = {
  RunAsNode: 'Disabled',
  EnableNodeOptionsEnvironmentVariable: 'Disabled',
  EnableNodeCliInspectArguments: 'Disabled',
  EnableEmbeddedAsarIntegrityValidation: 'Enabled',
  OnlyLoadAppFromAsar: 'Enabled',
};
for (const [fuse, state] of Object.entries(want)) if (!new RegExp(`${fuse} is ${state}`).test(fuses)) problems.push(`fuse ${fuse} is not ${state}`);

for (const f of files) {
  if (f.endsWith('.map')) problems.push(`source map shipped: ${f}`);
  if (/steam_appid\.txt$/.test(f)) problems.push(`steam_appid.txt shipped: ${f}`);
  if (noSteam && /steam_api|libsteam_api|steamworksjs/.test(f)) problems.push(`Steamworks binary in a no-Steam package: ${f}`);
}
const asar = files.find((f) => f.endsWith('app.asar'));
if (asar) {
  const listing = execFileSync(npx, ['@electron/asar', 'list', asar], { encoding: 'utf8', shell: process.platform === 'win32' });
  for (const bad of ['/node_modules/electron/', '/node_modules/vite/', '/node_modules/typescript/', '/node_modules/@types/', '/src/', '/tests/', '.map']) if (listing.includes(bad)) problems.push(`package contains ${bad}`);
  if (noSteam && listing.includes('steamworks.js')) problems.push('steamworks.js inside a no-Steam package');
}

// Rough compressed size: gzip every file (Steam's depot compression is comparable).
let raw = 0;
let packed = 0;
for (const f of files) {
  const b = readFileSync(f);
  raw += b.length;
  packed += gzipSync(b, { level: 6 }).length;
}
const mb = packed / 1e6;
if (mb > maxMb) problems.push(`compressed size ${mb.toFixed(1)} MB > ${maxMb} MB`);

console.log(`package ${dir}: ${files.length} files, ${(raw / 1e6).toFixed(1)} MB raw, ~${mb.toFixed(1)} MB compressed`);
console.log(fuses.trim());
if (problems.length) {
  console.error(`package check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('package check OK');
