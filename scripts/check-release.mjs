// Release-bundle guard (ENG-0237): dev/QA tooling must be stripped from `vite build --mode release`.
// Fails if the bundle still contains the automation hook or dev-only strings.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = ['__game', 'frames-', 'showcase', 'Preview'];
const dir = 'dist/assets';
const bad = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(dir, f), 'utf8');
  for (const s of FORBIDDEN) if (src.includes(s)) bad.push(`${f}: contains "${s}"`);
}
if (bad.length) {
  console.error('release bundle contains dev-only code:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('release bundle clean: no dev hooks');
