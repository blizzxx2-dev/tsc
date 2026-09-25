// Licence allow-list for everything shipped (PLT-0144): production dependencies must be
// MIT/BSD/Apache/ISC/OFL/CC-BY (or 0BSD/Unlicense/Zlib). Dev-only tooling is not shipped and not checked.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = /^(MIT|MIT-0|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|OFL-1\.1|CC-BY-4\.0|CC-BY-3\.0|Unlicense|Zlib|BlueOak-1\.0\.0)$/;
const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const seen = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    if (!info.version || seen.has(name)) continue;
    const pkg = JSON.parse(readFileSync(join('node_modules', name, 'package.json'), 'utf8'));
    const lic = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNKNOWN');
    seen.set(name, lic);
    walk(info.dependencies);
  }
})(tree.dependencies);

const bad = [];
for (const [name, lic] of seen) {
  const parts = lic.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/);
  const ok = lic.includes(' AND ') ? parts.every((p) => ALLOWED.test(p)) : parts.some((p) => ALLOWED.test(p));
  if (!ok) bad.push(`${name}: ${lic}`);
}
if (bad.length) {
  console.error(`licence check FAILED:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`licences OK: ${[...seen].map(([n, l]) => `${n} (${l})`).join(', ')}`);
