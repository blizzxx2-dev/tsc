// Generates THIRD_PARTY_NOTICES.txt (PLT-0145): every production npm dependency shipped in the game or
// the desktop package with its licence text, plus Electron/Chromium and the Steamworks redistributable.
// The file is packaged at the app root and opened from the credits via platform.open('notices').
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const seen = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (!info.version || seen.has(name)) continue;
    seen.set(name, info.version);
    walk(info.dependencies);
  }
})(tree.dependencies);

function licenceText(dir) {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(n));
  return f ? readFileSync(join(dir, f), 'utf8').trim() : null;
}

const parts = [
  'SUTURE & STEEL — THIRD-PARTY NOTICES',
  '',
  'Suture & Steel includes the following third-party software and fonts. Each is used under the licence reproduced below.',
  '',
];
const electronPkg = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8'));
parts.push(
  '='.repeat(78),
  `Electron ${electronPkg.version} — MIT`,
  '='.repeat(78),
  licenceText('node_modules/electron') ?? 'MIT License',
  '',
  'Electron bundles Chromium, Node.js and other components. Their licences are listed in full in',
  'LICENSES.chromium.html next to the game executable.',
  '',
);
for (const [name, version] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
  const dir = join('node_modules', name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  parts.push('='.repeat(78), `${name} ${version} — ${pkg.license ?? 'see below'}`, '='.repeat(78), licenceText(dir) ?? `Licence: ${pkg.license}`, '');
  if (name === 'steamworks.js')
    parts.push('steamworks.js redistributes the Steamworks API library (steam_api64.dll / libsteam_api.so / libsteam_api.dylib),', 'Copyright © Valve Corporation, under the Steamworks SDK Access Agreement.', '');
}
writeFileSync('THIRD_PARTY_NOTICES.txt', parts.join('\n'));
console.log(`THIRD_PARTY_NOTICES.txt: Electron + ${seen.size} packages`);
