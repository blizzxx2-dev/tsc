// Bump an edition's SemVer in versions.json and print the tag to create (PLT-0146/0149).
//   node scripts/version-bump.mjs <demo|full> <patch|minor|major|x.y.z>
// Demo: 1.0.x after the demo ships; full: 0.x until 1.0. Tags: demo-v1.0.0 / full-v0.3.0.
import { readFileSync, writeFileSync } from 'node:fs';

const [edition, how] = process.argv.slice(2);
if (!['demo', 'full'].includes(edition) || !how) {
  console.error('usage: node scripts/version-bump.mjs <demo|full> <patch|minor|major|x.y.z>');
  process.exit(2);
}
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
const [ma, mi, pa] = versions[edition].split('-')[0].split('.').map(Number);
const next = /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(how) ? how : how === 'major' ? `${ma + 1}.0.0` : how === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
versions[edition] = next;
writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
console.log(`${edition}-v${next}`);
