// DRM-free download checksums (PLT-0039): SHA-256 of every installer/archive under release/, written
// to release/SHA256SUMS, plus a detached ASCII-armoured GPG signature (SHA256SUMS.asc) when a signing
// key is available (RELEASE_GPG_KEY = key id or fingerprint; the key must be in the runner's keyring —
// see docs/handoff/PLT/signing.md). Without a key the sums are still written and the script says so.
//   node scripts/release-checksums.mjs [release-dir]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.argv[2] ?? 'release';
const EXT = /\.(exe|dmg|zip|tar\.gz|AppImage|msi|pkg|7z)$/i;

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(f)) yield p;
  }
}

if (!existsSync(root)) {
  console.error(`${root}: no such directory — pack first (node scripts/desktop.mjs pack)`);
  process.exit(1);
}
const lines = [];
for (const file of walk(root)) {
  const sum = createHash('sha256').update(readFileSync(file)).digest('hex');
  lines.push(`${sum}  ${relative(root, file).replaceAll('\\', '/')}`);
}
if (!lines.length) {
  console.error(`${root}: no installers or archives found (SS_INSTALLERS=1 pack produces them)`);
  process.exit(1);
}
const out = join(root, 'SHA256SUMS');
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${out}: ${lines.length} file(s)`);

const key = process.env.RELEASE_GPG_KEY;
if (!key) {
  console.log('RELEASE_GPG_KEY not set: SHA256SUMS left unsigned');
  process.exit(0);
}
const r = spawnSync('gpg', ['--batch', '--yes', '--local-user', key, '--armor', '--detach-sign', '--output', `${out}.asc`, out], { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('gpg signing failed');
  process.exit(r.status ?? 1);
}
console.log(`${out}.asc written; verify with: gpg --verify SHA256SUMS.asc SHA256SUMS && sha256sum -c SHA256SUMS`);
